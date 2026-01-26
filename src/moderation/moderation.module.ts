import { Module } from "@nestjs/common";
import { ModerationController } from "./moderation.controller";
import { ModerationService } from "./moderation.service";
import { ContentModerationService } from "../common/services/content-moderation.service";
import { MailModule } from "../mail/mail.module";
import { ReportsModule } from "../reports/reports.module";

@Module({
  imports: [MailModule, ReportsModule],
  controllers: [ModerationController],
  providers: [ModerationService, ContentModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
