import { Injectable } from "@nestjs/common";
import { PaymentMethod } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export interface JobPaymentCompletionResult {
  updatedJobs: number;
  activatedEntitlements: number;
  jobId: string | null;
}

export interface JobPaymentFailureResult {
  updatedJobs: number;
  revokedEntitlements: number;
  jobId: string | null;
}

@Injectable()
export class JobPaymentCompletionService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolvePlanForJob(job: { id: string; paymentAmount: any; paymentCurrency: string | null }, orderId: string | null) {
    const reservedEntitlement = await this.prisma.jobPostEntitlement.findUnique({
      where: { jobPostId: job.id },
    });

    if (reservedEntitlement?.planKey) {
      const reservedPlan = await this.prisma.plan.findFirst({
        where: {
          code: reservedEntitlement.planKey,
          isActive: true,
        },
      });
      if (reservedPlan) {
        return { plan: reservedPlan, reservedEntitlement };
      }
    }

    if (orderId) {
      const tx = await this.prisma.paymentTransaction.findUnique({
        where: { orderId },
      });
      if (tx?.planId) {
        const byPlanId = await this.prisma.plan.findFirst({
          where: {
            id: tx.planId,
            isActive: true,
          },
        });
        if (byPlanId) {
          return { plan: byPlanId, reservedEntitlement };
        }
      }
    }

    const activePlans = await this.prisma.plan.findMany({
      where: { isActive: true },
    });
    const amount = Number(job.paymentAmount);
    const currency = String(job.paymentCurrency || "USD").toUpperCase();
    if (Number.isFinite(amount) && amount > 0) {
      const byAmount =
        activePlans.find((item: any) => {
          const expected =
            currency === "ARS"
              ? Number((item as any).priceArs ?? 0)
              : Number((item as any).priceUsd ?? item.price);
          return Number.isFinite(expected) && Math.abs(expected - amount) < 0.01;
        }) || null;
      if (byAmount) {
        return { plan: byAmount, reservedEntitlement };
      }
    }

    return { plan: null, reservedEntitlement };
  }

  async completeJobPayment(
    orderId: string | null,
    jobId: string | null,
    payload: Record<string, unknown>,
    options?: {
      paymentMethod?: PaymentMethod;
      activationSource?: "ipn" | "mercadopago" | "manual";
    }
  ): Promise<JobPaymentCompletionResult> {
    const whereCandidates: Array<{ paymentOrderId?: string; id?: string }> = [];
    if (orderId) whereCandidates.push({ paymentOrderId: orderId });
    if (jobId) whereCandidates.push({ id: jobId });

    if (!whereCandidates.length) {
      return { updatedJobs: 0, activatedEntitlements: 0, jobId: null };
    }

    const job = await this.prisma.job.findFirst({
      where: { OR: whereCandidates },
    });

    if (!job) {
      return { updatedJobs: 0, activatedEntitlements: 0, jobId: null };
    }

    const now = new Date();

    await this.prisma.job.update({
      where: { id: job.id },
      data: {
        isPaid: true,
        paymentStatus: "COMPLETED",
        paidAt: now,
        moderationStatus: "APPROVED" as any,
        status: "active",
      },
    });

    const { plan, reservedEntitlement } = await this.resolvePlanForJob(job, orderId);
    if (!plan || !reservedEntitlement) {
      return { updatedJobs: 1, activatedEntitlements: 0, jobId: job.id };
    }

    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + Number(plan.durationDays || 30));

    const currentRawPayload =
      reservedEntitlement.rawPayload && typeof reservedEntitlement.rawPayload === "object"
        ? (reservedEntitlement.rawPayload as Record<string, any>)
        : {};

    const activationKey =
      options?.activationSource === "mercadopago"
        ? "activatedFromMercadoPago"
        : options?.activationSource === "ipn"
          ? "activatedFromIpn"
          : "activatedFromPayment";

    await this.prisma.jobPostEntitlement.update({
      where: { id: reservedEntitlement.id },
      data: {
        source: "MANUAL",
        planKey: plan.code,
        expiresAt,
        status: "ACTIVE",
        maxEdits: plan.allowedModifications || 0,
        editsUsed: 0,
        allowCategoryChange: plan.canModifyCategory || false,
        maxCategoryChanges: plan.categoryModifications || 0,
        categoryChangesUsed: 0,
        rawPayload: {
          ...currentRawPayload,
          activatedFromPayment: true,
          [activationKey]: true,
          orderId: orderId || null,
          paymentPayload: payload as any,
        },
      },
    });

    return { updatedJobs: 1, activatedEntitlements: 1, jobId: job.id };
  }

  async failJobPayment(
    orderId: string | null,
    jobId: string | null
  ): Promise<JobPaymentFailureResult> {
    const whereCandidates: Array<{ paymentOrderId?: string; id?: string }> = [];
    if (orderId) whereCandidates.push({ paymentOrderId: orderId });
    if (jobId) whereCandidates.push({ id: jobId });

    if (!whereCandidates.length) {
      return { updatedJobs: 0, revokedEntitlements: 0, jobId: null };
    }

    const job = await this.prisma.job.findFirst({
      where: { OR: whereCandidates },
    });

    if (!job) {
      return { updatedJobs: 0, revokedEntitlements: 0, jobId: null };
    }

    await this.prisma.job.update({
      where: { id: job.id },
      data: {
        isPaid: false,
        paymentStatus: "FAILED",
        moderationStatus: "PENDING_PAYMENT" as any,
        status: "inactive",
      },
    });

    const reservedEntitlement = await this.prisma.jobPostEntitlement.findUnique({
      where: { jobPostId: job.id },
    });

    if (!reservedEntitlement) {
      return { updatedJobs: 1, revokedEntitlements: 0, jobId: job.id };
    }

    await this.prisma.jobPostEntitlement.update({
      where: { id: reservedEntitlement.id },
      data: { status: "REVOKED" },
    });

    return { updatedJobs: 1, revokedEntitlements: 1, jobId: job.id };
  }
}
