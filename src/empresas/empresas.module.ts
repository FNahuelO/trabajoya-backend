import { Module } from "@nestjs/common";
import { EmpresasService } from "./empresas.service";
import { EmpresasController } from "./empresas.controller";
import { ContentModerationService } from "../common/services/content-moderation.service";
import { SubscriptionsModule } from "../subscriptions/subscriptions.module";
import { PaymentsModule } from "../payments/payments.module";
import { UploadModule } from "../upload/upload.module";

@Module({
  imports: [SubscriptionsModule, PaymentsModule, UploadModule],
  controllers: [EmpresasController],
  providers: [EmpresasService, ContentModerationService],
  exports: [EmpresasService],
})
export class EmpresasModule {}
