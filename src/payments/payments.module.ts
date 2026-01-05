import { Module } from "@nestjs/common";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { PrismaModule } from "../prisma/prisma.module";
import { SubscriptionsModule } from "../subscriptions/subscriptions.module";

@Module({
  imports: [PrismaModule, SubscriptionsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
