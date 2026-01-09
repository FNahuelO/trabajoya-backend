import { Module } from "@nestjs/common";
import { MessagesController } from "./messages.controller";
import { MessagesService } from "./messages.service";
import { MessagesGateway } from "./messages.gateway";
import { PrismaModule } from "../prisma/prisma.module";
import { UploadModule } from "../upload/upload.module";

@Module({
  imports: [PrismaModule, UploadModule],
  controllers: [MessagesController],
  providers: [MessagesService, MessagesGateway],
  exports: [MessagesService, MessagesGateway],
})
export class MessagesModule {}
