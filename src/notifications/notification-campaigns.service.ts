import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  NotificationCampaignStatus,
  NotificationCampaignTarget,
  UserType,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ExpoPushService } from "./expo-push.service";
import { CampaignTargetAudience } from "./dto/send-campaign.dto";

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
