import { Module } from "@nestjs/common";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import { ExpoPushService } from "./expo-push.service";
import { NotificationCampaignsService } from "./notification-campaigns.service";
import { PrismaModule } from "../prisma/prisma.module";
import { MailModule } from "../mail/mail.module";

@Module({
  imports: [PrismaModule, MailModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, ExpoPushService, NotificationCampaignsService],
  exports: [NotificationsService, ExpoPushService, NotificationCampaignsService],
})
export class NotificationsModule {}

