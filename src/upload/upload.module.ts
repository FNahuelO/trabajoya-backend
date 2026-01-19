import { Module } from "@nestjs/common";
import { UploadController } from "./upload.controller";
import { UploadService } from "./upload.service";
import { CVParserService } from "./cv-parser.service";
import { GCSUploadService } from "./gcs-upload.service";
import { GcpCdnService } from "./gcp-cdn.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [UploadController],
  providers: [
    UploadService,
    CVParserService,
    GCSUploadService,
    GcpCdnService,
  ],
  exports: [CVParserService, GCSUploadService, GcpCdnService],
})
export class UploadModule {}
