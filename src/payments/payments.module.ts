import { Module } from "@nestjs/common";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { MercadoPagoService } from "./mercadopago.service";
import { MercadoPagoCheckoutService } from "./mercadopago-checkout.service";
import { JobPaymentCompletionService } from "./job-payment-completion.service";
import { PrismaModule } from "../prisma/prisma.module";
import { SubscriptionsModule } from "../subscriptions/subscriptions.module";

@Module({
  imports: [PrismaModule, SubscriptionsModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    MercadoPagoService,
    MercadoPagoCheckoutService,
    JobPaymentCompletionService,
  ],
  exports: [
    PaymentsService,
    MercadoPagoService,
    MercadoPagoCheckoutService,
    JobPaymentCompletionService,
  ],
})
export class PaymentsModule {}
