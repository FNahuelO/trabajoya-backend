import { Module } from "@nestjs/common";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import { ExpoPushService } from "./expo-push.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, ExpoPushService],
  exports: [NotificationsService, ExpoPushService],
})
export class NotificationsModule {}

