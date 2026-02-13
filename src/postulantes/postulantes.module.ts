import { Module, forwardRef } from "@nestjs/common";
import { PostulantesService } from "./postulantes.service";
import { PostulantesController } from "./postulantes.controller";
import { AtsService } from "./ats.service";
import { PrismaModule } from "../prisma/prisma.module";
import { UploadModule } from "../upload/upload.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [PrismaModule, UploadModule, NotificationsModule],
  controllers: [PostulantesController],
  providers: [AtsService, PostulantesService],
  exports: [AtsService, PostulantesService],
})
export class PostulantesModule {}
