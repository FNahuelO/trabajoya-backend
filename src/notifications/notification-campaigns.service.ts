import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  NotificationCampaignScheduleStatus,
  NotificationCampaignScheduleType,
  NotificationCampaignStatus,
  NotificationCampaignTarget,
  UserType,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ExpoPushService } from "./expo-push.service";
import { CampaignTargetAudience } from "./dto/send-campaign.dto";
import {
  CampaignScheduleType,
  ScheduleCampaignDto,
  UpdateCampaignScheduleDto,
} from "./dto/schedule-campaign.dto";
import {
  computeNextRecurringRunAt,
  DEFAULT_CAMPAIGN_TIMEZONE,
  formatScheduleSummary,
} from "./campaign-schedule.utils";

type AudienceStats = {
  totalActiveTokens: number;
  uniqueUsers: number;
  postulanteTokens: number;
  postulanteUsers: number;
  empresaTokens: number;
  empresaUsers: number;
};

type UserReachPreview = {
  userIds: string[];
  usersFound: number;
  usersWithTokens: number;
  tokensTargeted: number;
  users: Array<{
    id: string;
    email: string;
    userType: UserType;
    displayName: string | null;
    tokenCount: number;
  }>;
};

@Injectable()
export class NotificationCampaignsService {
  private readonly logger = new Logger(NotificationCampaignsService.name);

  constructor(
    private prisma: PrismaService,
    private expoPushService: ExpoPushService
  ) {}

  private mapTargetAudience(
    target: CampaignTargetAudience
  ): NotificationCampaignTarget {
    return target as NotificationCampaignTarget;
  }

  private getUserTypesForTarget(
    target: CampaignTargetAudience
  ): UserType[] | undefined {
    if (target === CampaignTargetAudience.POSTULANTE) {
      return [UserType.POSTULANTE];
    }
    if (target === CampaignTargetAudience.EMPRESA) {
      return [UserType.EMPRESA];
    }
    return [UserType.POSTULANTE, UserType.EMPRESA];
  }

  private normalizeUserIds(userIds?: string[]): string[] {
    return Array.from(
      new Set((userIds || []).map((userId) => userId.trim()).filter(Boolean))
    );
  }

  async getAudienceStats(): Promise<AudienceStats> {
    const appUserTypes = [UserType.POSTULANTE, UserType.EMPRESA];

    const [allTokens, postulanteTokens, empresaTokens] = await Promise.all([
      this.prisma.pushToken.findMany({
        where: {
          isActive: true,
          user: { userType: { in: appUserTypes } },
        },
        select: { token: true, userId: true },
      }),
      this.prisma.pushToken.findMany({
        where: {
          isActive: true,
          user: { userType: UserType.POSTULANTE },
        },
        select: { token: true, userId: true },
      }),
      this.prisma.pushToken.findMany({
        where: {
          isActive: true,
          user: { userType: UserType.EMPRESA },
        },
        select: { token: true, userId: true },
      }),
    ]);

    return {
      totalActiveTokens: allTokens.length,
      uniqueUsers: new Set(allTokens.map((token) => token.userId)).size,
      postulanteTokens: postulanteTokens.length,
      postulanteUsers: new Set(postulanteTokens.map((token) => token.userId))
        .size,
      empresaTokens: empresaTokens.length,
      empresaUsers: new Set(empresaTokens.map((token) => token.userId)).size,
    };
  }

  async getReachForUsers(userIds: string[]): Promise<UserReachPreview> {
    const normalizedUserIds = this.normalizeUserIds(userIds);

    if (normalizedUserIds.length === 0) {
      return {
        userIds: [],
        usersFound: 0,
        usersWithTokens: 0,
        tokensTargeted: 0,
        users: [],
      };
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: normalizedUserIds } },
      select: {
        id: true,
        email: true,
        userType: true,
        postulante: { select: { fullName: true } },
        empresa: { select: { companyName: true } },
        pushTokens: {
          where: { isActive: true },
          select: { id: true },
        },
      },
    });

    const usersById = new Map(users.map((user) => [user.id, user]));
    const missingUserIds = normalizedUserIds.filter(
      (userId) => !usersById.has(userId)
    );

    if (missingUserIds.length > 0) {
      throw new NotFoundException(
        `No se encontraron usuarios: ${missingUserIds.join(", ")}`
      );
    }

    const previewUsers = normalizedUserIds.map((userId) => {
      const user = usersById.get(userId)!;
      const tokenCount = user.pushTokens.length;
      const displayName =
        user.postulante?.fullName || user.empresa?.companyName || null;

      return {
        id: user.id,
        email: user.email,
        userType: user.userType,
        displayName,
        tokenCount,
      };
    });

    const tokensTargeted = previewUsers.reduce(
      (total, user) => total + user.tokenCount,
      0
    );

    return {
      userIds: normalizedUserIds,
      usersFound: previewUsers.length,
      usersWithTokens: previewUsers.filter((user) => user.tokenCount > 0).length,
      tokensTargeted,
      users: previewUsers,
    };
  }

  async listSchedules(page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      this.prisma.notificationCampaignSchedule.findMany({
        skip,
        take: pageSize,
        orderBy: [{ status: "asc" }, { nextRunAt: "asc" }, { createdAt: "desc" }],
      }),
      this.prisma.notificationCampaignSchedule.count(),
    ]);

    return {
      items: items.map((schedule) => ({
        ...schedule,
        scheduleSummary: formatScheduleSummary(
          schedule.scheduleType,
          schedule.scheduledAt,
          schedule.recurrenceDays,
          schedule.recurrenceTime,
          schedule.timezone,
          schedule.maxRuns,
          schedule.runsCompleted
        ),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  private resolveSchedulePayload(
    dto: ScheduleCampaignDto,
    runsCompleted = 0
  ) {
    const normalizedUserIds = this.normalizeUserIds(dto.userIds);
    const isSpecific =
      dto.targetAudience === CampaignTargetAudience.SPECIFIC ||
      normalizedUserIds.length > 0;

    if (isSpecific && normalizedUserIds.length === 0) {
      throw new BadRequestException(
        "Debes seleccionar al menos un usuario para envíos específicos"
      );
    }

    const timezone = dto.timezone?.trim() || DEFAULT_CAMPAIGN_TIMEZONE;
    const nextRunAt = this.computeNextRunAtFromDto(dto, timezone);

    if (
      dto.scheduleType === CampaignScheduleType.RECURRING &&
      dto.maxRuns != null &&
      dto.maxRuns <= runsCompleted
    ) {
      throw new BadRequestException(
        "El límite de repeticiones debe ser mayor a los envíos ya realizados"
      );
    }

    return {
      normalizedUserIds,
      isSpecific,
      timezone,
      nextRunAt,
      maxRuns:
        dto.scheduleType === CampaignScheduleType.RECURRING
          ? dto.maxRuns ?? null
          : null,
    };
  }

  private computeNextRunAtFromDto(
    dto: ScheduleCampaignDto,
    timezone: string,
    after?: Date
  ): Date {
    if (dto.scheduleType === CampaignScheduleType.ONCE) {
      if (!dto.scheduledAt) {
        throw new BadRequestException(
          "scheduledAt es requerido para campañas programadas únicas"
        );
      }

      const nextRunAt = new Date(dto.scheduledAt);
      if (Number.isNaN(nextRunAt.getTime())) {
        throw new BadRequestException("Fecha programada inválida");
      }
      if (nextRunAt <= new Date()) {
        throw new BadRequestException(
          "La fecha programada debe ser posterior al momento actual"
        );
      }

      return nextRunAt;
    }

    if (!dto.recurrenceDays?.length || !dto.recurrenceTime) {
      throw new BadRequestException(
        "recurrenceDays y recurrenceTime son requeridos para campañas recurrentes"
      );
    }

    return computeNextRecurringRunAt(
      dto.recurrenceDays,
      dto.recurrenceTime,
      timezone,
      after
    );
  }

  async scheduleCampaign(adminUserId: string, dto: ScheduleCampaignDto) {
    const payload = this.resolveSchedulePayload(dto);

    return this.prisma.notificationCampaignSchedule.create({
      data: {
        title: dto.title,
        body: dto.body,
        targetAudience: payload.isSpecific
          ? NotificationCampaignTarget.SPECIFIC
          : this.mapTargetAudience(dto.targetAudience),
        targetUserIds: payload.isSpecific ? payload.normalizedUserIds : [],
        scheduleType:
          dto.scheduleType === CampaignScheduleType.ONCE
            ? NotificationCampaignScheduleType.ONCE
            : NotificationCampaignScheduleType.RECURRING,
        scheduledAt:
          dto.scheduleType === CampaignScheduleType.ONCE
            ? payload.nextRunAt
            : null,
        recurrenceDays:
          dto.scheduleType === CampaignScheduleType.RECURRING
            ? dto.recurrenceDays || []
            : [],
        recurrenceTime:
          dto.scheduleType === CampaignScheduleType.RECURRING
            ? dto.recurrenceTime
            : null,
        timezone: payload.timezone,
        maxRuns: payload.maxRuns,
        status: NotificationCampaignScheduleStatus.ACTIVE,
        nextRunAt: payload.nextRunAt,
        createdByUserId: adminUserId,
      },
    });
  }

  async updateSchedule(scheduleId: string, dto: UpdateCampaignScheduleDto) {
    const schedule = await this.prisma.notificationCampaignSchedule.findUnique({
      where: { id: scheduleId },
    });

    if (!schedule) {
      throw new NotFoundException("Programación no encontrada");
    }

    if (schedule.status === NotificationCampaignScheduleStatus.COMPLETED) {
      throw new BadRequestException(
        "No se puede editar una programación completada"
      );
    }

    const payload = this.resolveSchedulePayload(dto, schedule.runsCompleted);

    if (schedule.runsCompleted > 0 && dto.scheduleType === CampaignScheduleType.ONCE) {
      throw new BadRequestException(
        "No se puede cambiar a envío único después de haber ejecutado envíos"
      );
    }

    return this.prisma.notificationCampaignSchedule.update({
      where: { id: scheduleId },
      data: {
        title: dto.title,
        body: dto.body,
        targetAudience: payload.isSpecific
          ? NotificationCampaignTarget.SPECIFIC
          : this.mapTargetAudience(dto.targetAudience),
        targetUserIds: payload.isSpecific ? payload.normalizedUserIds : [],
        scheduleType:
          dto.scheduleType === CampaignScheduleType.ONCE
            ? NotificationCampaignScheduleType.ONCE
            : NotificationCampaignScheduleType.RECURRING,
        scheduledAt:
          dto.scheduleType === CampaignScheduleType.ONCE
            ? payload.nextRunAt
            : null,
        recurrenceDays:
          dto.scheduleType === CampaignScheduleType.RECURRING
            ? dto.recurrenceDays || []
            : [],
        recurrenceTime:
          dto.scheduleType === CampaignScheduleType.RECURRING
            ? dto.recurrenceTime
            : null,
        timezone: payload.timezone,
        maxRuns: payload.maxRuns,
        nextRunAt: payload.nextRunAt,
        status: NotificationCampaignScheduleStatus.ACTIVE,
      },
    });
  }

  async updateScheduleStatus(
    scheduleId: string,
    status: "ACTIVE" | "PAUSED"
  ) {
    const schedule = await this.prisma.notificationCampaignSchedule.findUnique({
      where: { id: scheduleId },
    });

    if (!schedule) {
      throw new NotFoundException("Programación no encontrada");
    }

    if (schedule.status === NotificationCampaignScheduleStatus.COMPLETED) {
      throw new BadRequestException(
        "No se puede modificar una programación completada"
      );
    }

    if (status === "ACTIVE") {
      if (
        schedule.maxRuns != null &&
        schedule.runsCompleted >= schedule.maxRuns
      ) {
        throw new BadRequestException(
          "La programación ya alcanzó el límite de repeticiones"
        );
      }

      if (schedule.scheduleType === NotificationCampaignScheduleType.RECURRING) {
        const nextRunAt = computeNextRecurringRunAt(
          schedule.recurrenceDays,
          schedule.recurrenceTime || "00:00",
          schedule.timezone
        );

        return this.prisma.notificationCampaignSchedule.update({
          where: { id: scheduleId },
          data: {
            status: NotificationCampaignScheduleStatus.ACTIVE,
            nextRunAt,
          },
        });
      }
    }

    return this.prisma.notificationCampaignSchedule.update({
      where: { id: scheduleId },
      data: {
        status:
          status === "ACTIVE"
            ? NotificationCampaignScheduleStatus.ACTIVE
            : NotificationCampaignScheduleStatus.PAUSED,
      },
    });
  }

  async deleteSchedule(scheduleId: string) {
    const schedule = await this.prisma.notificationCampaignSchedule.findUnique({
      where: { id: scheduleId },
    });

    if (!schedule) {
      throw new NotFoundException("Programación no encontrada");
    }

    await this.prisma.notificationCampaignSchedule.delete({
      where: { id: scheduleId },
    });

    return { deleted: true };
  }

  async processDueSchedules() {
    const now = new Date();
    const dueSchedules = await this.prisma.notificationCampaignSchedule.findMany({
      where: {
        status: NotificationCampaignScheduleStatus.ACTIVE,
        nextRunAt: { lte: now },
      },
      orderBy: { nextRunAt: "asc" },
      take: 20,
    });

    if (dueSchedules.length === 0) {
      return { processed: 0 };
    }

    let processed = 0;

    for (const schedule of dueSchedules) {
      try {
        const targetAudience = this.mapScheduleTargetAudience(schedule);
        const campaign = await this.sendCampaign(
          schedule.createdByUserId || "system",
          schedule.title,
          schedule.body,
          targetAudience,
          schedule.targetUserIds
        );

        const updateData: {
          lastRunAt: Date;
          lastCampaignId: string;
          runsCompleted: number;
          status?: NotificationCampaignScheduleStatus;
          nextRunAt?: Date | null;
        } = {
          lastRunAt: now,
          lastCampaignId: campaign.id,
          runsCompleted: schedule.runsCompleted + 1,
        };

        const reachedLimit =
          schedule.scheduleType === NotificationCampaignScheduleType.ONCE ||
          (schedule.maxRuns != null &&
            updateData.runsCompleted >= schedule.maxRuns);

        if (reachedLimit) {
          updateData.status = NotificationCampaignScheduleStatus.COMPLETED;
          updateData.nextRunAt = null;
        } else {
          updateData.nextRunAt = computeNextRecurringRunAt(
            schedule.recurrenceDays,
            schedule.recurrenceTime || "00:00",
            schedule.timezone,
            now
          );
        }

        await this.prisma.notificationCampaignSchedule.update({
          where: { id: schedule.id },
          data: updateData,
        });

        processed += 1;
        this.logger.log(
          `[NotificationCampaignsService] Schedule ${schedule.id} executed (campaign ${campaign.id})`
        );
      } catch (error) {
        this.logger.error(
          `[NotificationCampaignsService] Schedule ${schedule.id} failed:`,
          error
        );
      }
    }

    return { processed };
  }

  private mapScheduleTargetAudience(schedule: {
    targetAudience: NotificationCampaignTarget;
  }): CampaignTargetAudience {
    return schedule.targetAudience as CampaignTargetAudience;
  }

  async listCampaigns(page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      this.prisma.notificationCampaign.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.notificationCampaign.count(),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  async sendCampaign(
    adminUserId: string,
    title: string,
    body: string,
    targetAudience: CampaignTargetAudience,
    userIds?: string[]
  ) {
    const normalizedUserIds = this.normalizeUserIds(userIds);
    const isSpecific =
      targetAudience === CampaignTargetAudience.SPECIFIC ||
      normalizedUserIds.length > 0;

    if (isSpecific && normalizedUserIds.length === 0) {
      throw new BadRequestException(
        "Debes seleccionar al menos un usuario para envíos específicos"
      );
    }

    const campaign = await this.prisma.notificationCampaign.create({
      data: {
        title,
        body,
        targetAudience: isSpecific
          ? NotificationCampaignTarget.SPECIFIC
          : this.mapTargetAudience(targetAudience),
        targetUserIds: isSpecific ? normalizedUserIds : [],
        status: NotificationCampaignStatus.PENDING,
        sentByUserId: adminUserId,
      },
    });

    try {
      let tokens: Array<{ token: string; userId: string }>;

      if (isSpecific) {
        await this.getReachForUsers(normalizedUserIds);

        tokens = await this.prisma.pushToken.findMany({
          where: {
            isActive: true,
            userId: { in: normalizedUserIds },
          },
          select: { token: true, userId: true },
        });
      } else {
        const userTypes = this.getUserTypesForTarget(targetAudience);
        tokens = await this.prisma.pushToken.findMany({
          where: {
            isActive: true,
            user: { userType: { in: userTypes } },
          },
          select: { token: true, userId: true },
        });
      }

      const uniqueUsers = new Set(tokens.map((token) => token.userId)).size;
      const pushTokens = tokens.map((token) => token.token);

      if (pushTokens.length === 0) {
        const updated = await this.prisma.notificationCampaign.update({
          where: { id: campaign.id },
          data: {
            status: NotificationCampaignStatus.SENT,
            tokensTargeted: 0,
            uniqueUsers: 0,
            sentAt: new Date(),
          },
        });

        this.logger.warn(
          `[NotificationCampaignsService] Campaign ${campaign.id} sent with 0 tokens`
        );

        return updated;
      }

      await this.expoPushService.sendPushNotifications(
        pushTokens,
        title,
        body,
        {
          type: "campaign",
          campaignId: campaign.id,
        },
        {
          priority: "high",
          channelId: "general",
        }
      );

      const updated = await this.prisma.notificationCampaign.update({
        where: { id: campaign.id },
        data: {
          status: NotificationCampaignStatus.SENT,
          tokensTargeted: pushTokens.length,
          uniqueUsers,
          sentAt: new Date(),
        },
      });

      this.logger.log(
        `[NotificationCampaignsService] Campaign ${campaign.id} sent to ${pushTokens.length} token(s), ${uniqueUsers} user(s)`
      );

      return updated;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error desconocido";

      await this.prisma.notificationCampaign.update({
        where: { id: campaign.id },
        data: {
          status: NotificationCampaignStatus.FAILED,
          errorMessage: message,
        },
      });

      this.logger.error(
        `[NotificationCampaignsService] Campaign ${campaign.id} failed:`,
        error
      );

      throw error;
    }
  }
}
