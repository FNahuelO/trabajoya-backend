import { Injectable, Logger } from "@nestjs/common";
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
    targetAudience: CampaignTargetAudience
  ) {
    const campaign = await this.prisma.notificationCampaign.create({
      data: {
        title,
        body,
        targetAudience: this.mapTargetAudience(targetAudience),
        status: NotificationCampaignStatus.PENDING,
        sentByUserId: adminUserId,
      },
    });

    try {
      const userTypes = this.getUserTypesForTarget(targetAudience);
      const tokens = await this.prisma.pushToken.findMany({
        where: {
          isActive: true,
          user: { userType: { in: userTypes } },
        },
        select: { token: true, userId: true },
      });

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
