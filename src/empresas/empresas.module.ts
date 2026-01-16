import { Module } from "@nestjs/common";
import { EmpresasService } from "./empresas.service";
import { EmpresasController } from "./empresas.controller";
import { ContentModerationService } from "../common/services/content-moderation.service";
import { SubscriptionsModule } from "../subscriptions/subscriptions.module";
import { PaymentsModule } from "../payments/payments.module";
import { UploadModule } from "../upload/upload.module";
import { JobsModule } from "../jobs/jobs.module";
import { PromotionsModule } from "../promotions/promotions.module";

@Module({
  imports: [SubscriptionsModule, PaymentsModule, UploadModule, JobsModule, PromotionsModule],
  controllers: [EmpresasController],
  providers: [EmpresasService, ContentModerationService],
  exports: [EmpresasService],
})
export class EmpresasModule {}
