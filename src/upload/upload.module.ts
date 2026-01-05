import { Module } from "@nestjs/common";
import { UploadController } from "./upload.controller";
import { UploadService } from "./upload.service";
import { CVParserService } from "./cv-parser.service";
import { S3UploadService } from "./s3-upload.service";
import { CloudFrontSignerService } from "./cloudfront-signer.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [UploadController],
  providers: [
    UploadService,
    CVParserService,
    S3UploadService,
    CloudFrontSignerService,
  ],
  exports: [CVParserService, CloudFrontSignerService, S3UploadService],
})
export class UploadModule {}
