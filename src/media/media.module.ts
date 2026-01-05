import { Module } from "@nestjs/common";
import { MediaController, UserMediaController } from "./media.controller";
import { MediaService } from "./media.service";
import { PrismaModule } from "../prisma/prisma.module";
import { UploadModule } from "../upload/upload.module";

@Module({
  imports: [PrismaModule, UploadModule],
  controllers: [MediaController, UserMediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
