import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PaymentMethod, PaymentStatus } from "@prisma/client";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { MercadoPagoService } from "./mercadopago.service";
import { JobPaymentCompletionService } from "./job-payment-completion.service";

@Injectable()
export class MercadoPagoCheckoutService {
  private readonly logger = new Logger(MercadoPagoCheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mercadoPagoService: MercadoPagoService,
    private readonly jobPaymentCompletion: JobPaymentCompletionService,
    private readonly configService: ConfigService
  ) {}

  getPaymentConfig() {
    const defaultProvider =
      this.configService.get<string>("PAYMENT_DEFAULT_PROVIDER") || "mercadopago";
    const enableIapFallback =
      String(this.configService.get<string>("ENABLE_IAP_FALLBACK") ?? "true").toLowerCase() !==
      "false";

    const iosMobileRaw =
      this.configService.get<string>("IOS_MOBILE_PAYMENT_PROVIDER") || "mercadopago_web";
    const iosMobileProvider: "iap" | "mercadopago" | "mercadopago_web" =
      iosMobileRaw === "iap"
        ? "iap"
        : iosMobileRaw === "mercadopago_web"
          ? "mercadopago_web"
          : "mercadopago";

    const androidMobileRaw =
      this.configService.get<string>("ANDROID_MOBILE_PAYMENT_PROVIDER") || "mercadopago_web";
    const androidMobileProvider: "iap" | "mercadopago" | "mercadopago_web" =
      androidMobileRaw === "iap"
        ? "iap"
        : androidMobileRaw === "mercadopago"
          ? "mercadopago"
          : "mercadopago_web";

    const webEmpresasUrl =
      this.configService.get<string>("WEB_EMPRESAS_URL") ||
      this.configService.get<string>("FRONTEND_EMPRESAS_URL") ||
      null;

    return {
      defaultProvider,
      enableIapFallback,
      mercadoPagoConfigured: !!this.configService.get<string>("MERCADOPAGO_ACCESS_TOKEN"),
      webEmpresasUrl,
      iosMobileProvider,
      androidMobileProvider,
    };
  }

  async createJobPreference(
    userId: string,
    params: { jobId: string; planId: string; platform?: "mobile" | "web"; fromApp?: boolean }
  ) {
    const profile = await this.prisma.empresaProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException("Empresa no encontrada");
    }

    const job = await this.prisma.job.findFirst({
      where: {
        id: params.jobId,
        empresaId: profile.id,
      },
    });

    if (!job) {
      throw new NotFoundException("Empleo no encontrado");
    }

    const latestEntitlement = await this.prisma.jobPostEntitlement.findFirst({
      where: { jobPostId: params.jobId },
      orderBy: { createdAt: "desc" },
    });
    const isExpiredEntitlement =
      latestEntitlement?.status === "EXPIRED" ||
      (latestEntitlement?.expiresAt
        ? new Date(latestEntitlement.expiresAt) < new Date()
        : false);
    const isRenewalFlow = !!job.isPaid && isExpiredEntitlement;

    if (job.isPaid && !isRenewalFlow) {
      throw new BadRequestException("Este empleo ya ha sido pagado");
    }

    if (job.moderationStatus !== "PENDING_PAYMENT" && !isRenewalFlow) {
      throw new BadRequestException("Este empleo no requiere pago o ya fue procesado");
    }

    const selectedPlan = await this.prisma.plan.findFirst({
      where: {
        id: params.planId,
        isActive: true,
      },
    });

    if (!selectedPlan) {
      throw new BadRequestException("El plan seleccionado no es válido");
    }

    const amount = Number((selectedPlan as any).priceArs ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException(
        "El plan no tiene precio en ARS configurado (priceArs)"
      );
    }

    const orderId = randomUUID();
    const now = new Date();
    const reservedExpiresAt = new Date(now);
    reservedExpiresAt.setDate(
      reservedExpiresAt.getDate() + Number(selectedPlan.durationDays || 30)
    );

    if (latestEntitlement) {
      await this.prisma.jobPostEntitlement.update({
        where: { id: latestEntitlement.id },
        data: {
          source: "MANUAL",
          planKey: selectedPlan.code,
          expiresAt: reservedExpiresAt,
          status: "REVOKED",
          maxEdits: selectedPlan.allowedModifications || 0,
          editsUsed: 0,
          allowCategoryChange: selectedPlan.canModifyCategory || false,
          maxCategoryChanges: selectedPlan.categoryModifications || 0,
          categoryChangesUsed: 0,
          rawPayload: {
            pendingPayment: true,
            renewalFlow: isRenewalFlow,
            selectedPlanId: selectedPlan.id,
            selectedPlanCode: selectedPlan.code,
            paymentProvider: "mercadopago",
          },
        },
      });
    } else {
      await this.prisma.jobPostEntitlement.create({
        data: {
          userId,
          jobPostId: params.jobId,
          source: "MANUAL",
          planKey: selectedPlan.code,
          expiresAt: reservedExpiresAt,
          status: "REVOKED",
          maxEdits: selectedPlan.allowedModifications || 0,
          editsUsed: 0,
          allowCategoryChange: selectedPlan.canModifyCategory || false,
          maxCategoryChanges: selectedPlan.categoryModifications || 0,
          categoryChangesUsed: 0,
          rawPayload: {
            pendingPayment: true,
            renewalFlow: isRenewalFlow,
            selectedPlanId: selectedPlan.id,
            selectedPlanCode: selectedPlan.code,
            paymentProvider: "mercadopago",
          },
        },
      });
    }

    await this.prisma.job.update({
      where: { id: params.jobId },
      data: {
        paymentOrderId: orderId,
        paymentStatus: "PENDING",
        paymentAmount: amount,
        paymentCurrency: "ARS",
        isPaid: false,
        moderationStatus: "PENDING_PAYMENT" as any,
        status: "inactive",
      },
    });

    await this.prisma.paymentTransaction.create({
      data: {
        userId,
        empresaId: profile.id,
        orderId,
        amount,
        currency: "ARS",
        status: PaymentStatus.PENDING,
        paymentMethod: PaymentMethod.MERCADOPAGO,
        description: `Pago por publicación de empleo: ${job.title}`,
        planType: selectedPlan.subscriptionPlan,
        planId: selectedPlan.id,
      },
    });

    const preference = await this.mercadoPagoService.createPreference({
      amount,
      title: `Plan ${selectedPlan.name} - ${job.title}`,
      jobId: params.jobId,
      orderId,
      planId: selectedPlan.id,
      userId,
      platform: params.platform || "mobile",
      fromApp: params.fromApp,
    });

    return preference;
  }

  async getOrderStatus(userId: string, orderId: string) {
    const transaction = await this.prisma.paymentTransaction.findUnique({
      where: { orderId },
    });

    if (!transaction || transaction.userId !== userId) {
      throw new NotFoundException("Orden de pago no encontrada");
    }

    const job = await this.prisma.job.findFirst({
      where: { paymentOrderId: orderId },
      select: {
        id: true,
        isPaid: true,
        paymentStatus: true,
        moderationStatus: true,
        status: true,
      },
    });

    return {
      orderId,
      status: transaction.status,
      paymentMethod: transaction.paymentMethod,
      amount: transaction.amount,
      currency: transaction.currency,
      job,
    };
  }

  async handleWebhookNotification(body: {
    type?: string;
    action?: string;
    data?: { id?: string | number };
    topic?: string;
    resource?: string;
    id?: string | number;
  }) {
    const topic = body?.type || body?.topic;
    const paymentId =
      body?.data?.id != null
        ? String(body.data.id)
        : body?.id != null
          ? String(body.id)
          : body?.resource?.includes("payment")
            ? body.resource.split("/").pop()
            : null;

    if (!paymentId) {
      this.logger.warn("Webhook MP sin payment id", body);
      return { processed: false, reason: "missing_payment_id" };
    }

    if (topic && topic !== "payment") {
      return { processed: false, reason: "ignored_topic", topic };
    }

    const payment = await this.mercadoPagoService.getPaymentById(paymentId);
    const orderId = payment?.external_reference
      ? String(payment.external_reference)
      : null;
    const metadata = (payment?.metadata || {}) as Record<string, unknown>;
    const jobId = metadata?.jobId ? String(metadata.jobId) : null;
    const mpStatus = String(payment?.status || "").toLowerCase();

    if (!orderId) {
      this.logger.warn("Pago MP sin external_reference", { paymentId, mpStatus });
      return { processed: false, reason: "missing_order_id" };
    }

    const existingTx = await this.prisma.paymentTransaction.findUnique({
      where: { orderId },
    });

    if (!existingTx) {
      this.logger.warn("Transacción no encontrada para orderId", orderId);
      return { processed: false, reason: "transaction_not_found", orderId };
    }

    if (existingTx.status === PaymentStatus.COMPLETED) {
      return { processed: true, reason: "already_completed", orderId };
    }

    if (mpStatus === "approved") {
      await this.prisma.paymentTransaction.update({
        where: { orderId },
        data: {
          status: PaymentStatus.COMPLETED,
          paypalData: payment as any,
          updatedAt: new Date(),
        },
      });

      const result = await this.jobPaymentCompletion.completeJobPayment(
        orderId,
        jobId,
        {
          mercadoPagoPaymentId: paymentId,
          mercadoPagoStatus: mpStatus,
          payment,
        },
        { paymentMethod: PaymentMethod.MERCADOPAGO, activationSource: "mercadopago" }
      );

      return {
        processed: true,
        reason: "approved",
        orderId,
        jobId: result.jobId,
        activatedEntitlements: result.activatedEntitlements,
      };
    }

    if (mpStatus === "rejected" || mpStatus === "cancelled") {
      await this.prisma.paymentTransaction.update({
        where: { orderId },
        data: {
          status: PaymentStatus.FAILED,
          paypalData: payment as any,
          failureReason: String(payment?.status_detail || mpStatus),
          updatedAt: new Date(),
        },
      });

      const result = await this.jobPaymentCompletion.failJobPayment(orderId, jobId);
      return {
        processed: true,
        reason: mpStatus,
        orderId,
        jobId: result.jobId,
      };
    }

    if (mpStatus === "pending" || mpStatus === "in_process") {
      await this.prisma.paymentTransaction.update({
        where: { orderId },
        data: {
          status: PaymentStatus.PENDING,
          paypalData: payment as any,
          updatedAt: new Date(),
        },
      });
      return { processed: true, reason: "pending", orderId };
    }

    return { processed: false, reason: "unknown_status", mpStatus, orderId };
  }
}
