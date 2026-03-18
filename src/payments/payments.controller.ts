import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
  UseGuards,
  Req,
  HttpCode,
  UnauthorizedException,
} from "@nestjs/common";
import { PaymentsService } from "./payments.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { createResponse } from "../common/mapper/api-response.mapper";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";
import { PrismaService } from "../prisma/prisma.service";
import { PaymentMethod, PaymentStatus, SubscriptionPlan } from "@prisma/client";

@ApiTags("payments")
@Controller("api/payments")
export class PaymentsController {
  constructor(
    private paymentsService: PaymentsService,
    private subscriptionsService: SubscriptionsService,
    private prisma: PrismaService
  ) { }

  private validateIpnSecretOrThrow(secretFromHeader?: string) {
    const configuredSecret = process.env.IPN_SHARED_SECRET;
    if (!configuredSecret) {
      return;
    }

    if (secretFromHeader !== configuredSecret) {
      throw new UnauthorizedException("IPN secret inválido");
    }
  }

  private extractOrderIdFromIpnBody(body: any): string | null {
    const payload = body?.payload ?? body;
    const parseConceptOrderId = (rawConcept: unknown): string | null => {
      const concept = String(rawConcept || "").trim();
      if (!concept) return null;

      const orderPattern =
        /(?:^|[|,;\s])(?:ORDER|ORDER_ID|PAYMENT_ORDER_ID|PAYMENTORDERID)\s*[:=]\s*([A-Za-z0-9\-_]+)/i;
      const match = concept.match(orderPattern);
      if (match?.[1]) return match[1].trim();

      if (!concept.includes(" ")) {
        return concept;
      }

      return null;
    };

    const candidates = [
      body?.orderId,
      body?.order_id,
      payload?.orderId,
      payload?.order_id,
      payload?.resource?.id,
      payload?.resource?.supplementary_data?.related_ids?.order_id,
      payload?.data?.orderId,
      payload?.data?.order_id,
      payload?.external_reference,
      payload?.reference,
      parseConceptOrderId(body?.concept),
      parseConceptOrderId(body?.query_ticket_text),
      parseConceptOrderId(payload?.concept),
      parseConceptOrderId(payload?.query_ticket_text),
      parseConceptOrderId(payload?.data?.concept),
      parseConceptOrderId(payload?.data?.query_ticket_text),
      parseConceptOrderId(payload?.resource?.concept),
      parseConceptOrderId(payload?.metadata?.concept),
      parseConceptOrderId(payload?.meta?.concept),
    ];

    for (const value of candidates) {
      if (typeof value === "string" && value.trim().length > 0) {
        return value.trim();
      }
    }

    return null;
  }

  private extractIpnPayload(body: any) {
    return body?.payload ?? body;
  }

  private extractJobIdFromIpnBody(body: any): string | null {
    const payload = body?.payload ?? body;
    const parseConceptJobId = (rawConcept: unknown): string | null => {
      const concept = String(rawConcept || "").trim();
      if (!concept) return null;

      const jobPattern = /(?:^|[|,;\s])JOB(?:_ID)?\s*[:=]\s*([A-Za-z0-9\-_]+)/i;
      const match = concept.match(jobPattern);
      if (match?.[1]) return match[1].trim();

      return null;
    };

    const candidates = [
      body?.jobId,
      body?.job_id,
      payload?.jobId,
      payload?.job_id,
      payload?.data?.jobId,
      payload?.data?.job_id,
      payload?.metadata?.jobId,
      payload?.meta?.jobId,
      parseConceptJobId(body?.concept),
      parseConceptJobId(payload?.concept),
      parseConceptJobId(payload?.data?.concept),
      parseConceptJobId(payload?.resource?.concept),
      parseConceptJobId(payload?.metadata?.concept),
      parseConceptJobId(payload?.meta?.concept),
    ];

    for (const value of candidates) {
      if (typeof value === "string" && value.trim().length > 0) {
        return value.trim();
      }
    }

    return null;
  }

  private async resolvePlanForIpn(job: any, orderId: string | null) {
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

  private async markJobPaymentCompletedFromIpn(
    orderId: string | null,
    jobId: string | null,
    payload: any
  ) {
    const whereCandidates: any[] = [];
    if (orderId) whereCandidates.push({ paymentOrderId: orderId });
    if (jobId) whereCandidates.push({ id: jobId });

    if (!whereCandidates.length) {
      return { updatedJobs: 0, activatedEntitlements: 0, jobId: null };
    }

    const job = await this.prisma.job.findFirst({
      where: {
        OR: whereCandidates,
      },
    });

    if (!job) {
      return { updatedJobs: 0, activatedEntitlements: 0, jobId: null };
    }

    const now = new Date();
    const moderationStatus =
      job.moderationStatus === "PENDING_PAYMENT" ? "PENDING" : job.moderationStatus;

    await this.prisma.job.update({
      where: { id: job.id },
      data: {
        isPaid: true,
        paymentStatus: "COMPLETED",
        paidAt: now,
        moderationStatus: moderationStatus as any,
      },
    });

    const { plan, reservedEntitlement } = await this.resolvePlanForIpn(job, orderId);
    if (!plan || !reservedEntitlement) {
      return { updatedJobs: 1, activatedEntitlements: 0, jobId: job.id };
    }

    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + Number(plan.durationDays || 30));

    const currentRawPayload =
      reservedEntitlement.rawPayload && typeof reservedEntitlement.rawPayload === "object"
        ? (reservedEntitlement.rawPayload as Record<string, any>)
        : {};

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
          activatedFromIpn: true,
          orderId: orderId || null,
          ipnPayload: payload,
        },
      },
    });

    return { updatedJobs: 1, activatedEntitlements: 1, jobId: job.id };
  }

  private async markJobPaymentFailedFromIpn(orderId: string | null, jobId: string | null) {
    const whereCandidates: any[] = [];
    if (orderId) whereCandidates.push({ paymentOrderId: orderId });
    if (jobId) whereCandidates.push({ id: jobId });

    if (!whereCandidates.length) {
      return { updatedJobs: 0, revokedEntitlements: 0, jobId: null };
    }

    const job = await this.prisma.job.findFirst({
      where: {
        OR: whereCandidates,
      },
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
      data: {
        status: "REVOKED",
      },
    });

    return { updatedJobs: 1, revokedEntitlements: 1, jobId: job.id };
  }

  /**
   * Crear orden de pago
   */
  @Post("create-order")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async createOrder(@Body() body: CreateOrderDto, @Req() req: any) {
    const order = await this.paymentsService.createOrder(
      body.amount,
      body.currency || "USD",
      body.description || `Pago de plan ${body.planType || "premium"}`
    );

    // Guardar la transacción con estado PENDING
    try {
      const empresa = await this.prisma.empresaProfile.findUnique({
        where: { userId: req.user?.sub },
      });

      // Buscar el plan por código si se proporciona planType (que es el código del plan)
      let planTypeEnum: "URGENT" | "STANDARD" | "PREMIUM" | "CRYSTAL" | "BASIC" | "ENTERPRISE" | null = null;
      let foundPlanId: string | null = null;

      if (body.planType) {
        try {
          // Buscar plan por código
          const plan = await this.prisma.plan.findUnique({
            where: { code: body.planType.toUpperCase() },
          });

          if (plan) {
            foundPlanId = plan.id;
            // Usar directamente el subscriptionPlan del plan
            if (plan.subscriptionPlan) {
              planTypeEnum = plan.subscriptionPlan as SubscriptionPlan;
            } else {
              planTypeEnum = "PREMIUM" as SubscriptionPlan;
            }
            console.log(
              `Plan found by code: ${plan.code} (${plan.name}), mapped to subscription type: ${planTypeEnum}`
            );
          } else {
            console.warn(`Plan not found with code: ${body.planType}`);
          }
        } catch (error) {
          console.error("Error searching plan by code:", error);
        }
      }

      await this.prisma.paymentTransaction.create({
        data: {
          userId: req.user?.sub,
          empresaId: empresa?.id || null,
          orderId: order.orderId,
          amount: body.amount,
          currency: body.currency || "USD",
          status: PaymentStatus.PENDING,
          paymentMethod: PaymentMethod.PAYPAL,
          description:
            body.description || `Pago de plan ${body.planType || "premium"}`,
          planType: planTypeEnum as SubscriptionPlan,
          planId: foundPlanId,
        },
      });
    } catch (error) {
      console.error("Error saving payment transaction on create:", error);
      // No fallar la creación de la orden si falla el guardado de la transacción
    }

    return createResponse({
      success: true,
      message: "Orden creada exitosamente",
      data: order,
    });
  }

  /**
   * Capturar pago de orden
   */
  @Post("capture-order/:orderId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async captureOrder(
    @Param("orderId") orderId: string,
    @Body()
    body: {
      planType?: string;
      planId?: string;
      amount?: number;
      currency?: string;
      description?: string;
    },
    @Req() req: any
  ) {
    const capture = await this.paymentsService.captureOrder(orderId);

    // Obtener detalles del pago desde la respuesta de PayPal
    const purchaseUnit = capture.purchase_units?.[0];
    const amount = purchaseUnit?.amount?.value
      ? parseFloat(purchaseUnit.amount.value)
      : body.amount || 0;
    const currency =
      purchaseUnit?.amount?.currency_code || body.currency || "USD";
    const description =
      purchaseUnit?.description || body.description || "Pago en TrabajoYa";

    // Determinar el estado del pago
    const paymentStatus =
      capture.status === "COMPLETED"
        ? PaymentStatus.COMPLETED
        : capture.status === "FAILED"
          ? PaymentStatus.FAILED
          : PaymentStatus.PENDING;

    // Guardar la transacción de pago
    try {
      // Obtener empresa del usuario si existe
      const empresa = await this.prisma.empresaProfile.findUnique({
        where: { userId: req.user?.sub },
      });

      // Buscar el plan por código si se proporciona planType (que es el código del plan)
      let planTypeEnum: SubscriptionPlan | null = null;
      let foundPlanId: string | null = body.planId || null;

      if (body.planType) {
        try {
          // Buscar plan por código
          const plan = await this.prisma.plan.findUnique({
            where: { code: body.planType.toUpperCase() },
          });

          if (plan) {
            foundPlanId = plan.id;
            // Usar el subscriptionPlan del plan (configurado por admin)
            planTypeEnum = plan.subscriptionPlan;
            console.log(
              `Plan found by code: ${plan.code} (${plan.name}), subscription type: ${planTypeEnum}`
            );
          } else {
            console.warn(`Plan not found with code: ${body.planType}`);
          }
        } catch (error) {
          console.error("Error searching plan by code:", error);
        }
      }

      // Si no tenemos planType del body, intentar obtenerlo de la transacción existente
      if (!planTypeEnum) {
        try {
          const existingTransaction =
            await this.prisma.paymentTransaction.findUnique({
              where: { orderId },
            });
          if (existingTransaction?.planType) {
            planTypeEnum = existingTransaction.planType;
            if (existingTransaction.planId) {
              foundPlanId = existingTransaction.planId;
            }
          }
        } catch (error) {
          console.error("Error fetching existing transaction:", error);
        }
      }

      // Crear o actualizar la transacción de pago
      await this.prisma.paymentTransaction.upsert({
        where: { orderId },
        update: {
          status: paymentStatus,
          paypalData: capture as any,
          updatedAt: new Date(),
          // Actualizar planType y planId si se encontraron
          ...(planTypeEnum && { planType: planTypeEnum }),
          ...(foundPlanId && { planId: foundPlanId }),
        },
        create: {
          userId: req.user?.sub,
          empresaId: empresa?.id || null,
          orderId,
          amount,
          currency,
          status: paymentStatus,
          paymentMethod: PaymentMethod.PAYPAL,
          description,
          planType: planTypeEnum as SubscriptionPlan,
          planId: foundPlanId,
          paypalData: capture as any,
        },
      });

      // Si se capturó exitosamente, SIEMPRE crear suscripción
      if (capture.status === "COMPLETED" && empresa) {
        try {
          let finalPlanType: SubscriptionPlan | null = null;
          let planDurationDays = 30; // Default

          // Prioridad 1: Obtener información del plan desde planId (body.planId o foundPlanId)
          const planIdToUse = body.planId || foundPlanId;
          if (planIdToUse) {
            try {
              const plan = await this.prisma.plan.findUnique({
                where: { id: planIdToUse },
              });
              if (plan) {
                planDurationDays = plan.durationDays;
                // Usar el subscriptionPlan del plan (configurado por admin)
                finalPlanType = plan.subscriptionPlan;
                console.log(
                  `Plan found: ${plan.name} (${plan.code}), subscription type: ${finalPlanType}, duration: ${plan.durationDays} days`
                );
              }
            } catch (error) {
              console.error("Error fetching plan by planId:", error);
            }
          }

          // Prioridad 2: Si no tenemos planId, buscar plan por código (planType es el código del plan)
          if (!finalPlanType && body.planType && !planIdToUse) {
            try {
              const plan = await this.prisma.plan.findUnique({
                where: { code: body.planType.toUpperCase() },
              });
              if (plan) {
                planDurationDays = plan.durationDays;
                // Usar el subscriptionPlan del plan (configurado por admin)
                finalPlanType = plan.subscriptionPlan;
                console.log(
                  `Plan found by code: ${plan.code} (${plan.name}), subscription type: ${finalPlanType}, duration: ${plan.durationDays} days`
                );
              }
            } catch (error) {
              console.error("Error fetching plan by code:", error);
            }
          }

          // Prioridad 3: Si aún no tenemos, buscar en la transacción
          if (!finalPlanType) {
            try {
              const transaction =
                await this.prisma.paymentTransaction.findUnique({
                  where: { orderId },
                });
              if (transaction?.planType) {
                finalPlanType = transaction.planType;
                console.log(
                  `Using planType from transaction: ${finalPlanType}`
                );
              }
            } catch (error) {
              console.error("Error fetching transaction:", error);
            }
          }

          // Validar que se determinó el planType antes de crear la suscripción
          if (!finalPlanType) {
            console.error(
              `❌ No se pudo determinar el planType para crear la suscripción. ` +
              `orderId: ${orderId}, planId: ${planIdToUse}, body.planType: ${body.planType}`
            );
            // No lanzar error para no fallar el pago, pero loguear el error detallado
            console.error(
              `⚠️ Se omitió la creación de suscripción porque no se pudo determinar el planType. ` +
              `El pago fue procesado correctamente, pero la suscripción debe crearse manualmente.`
            );
            return createResponse({
              success: true,
              message: "Pago capturado exitosamente, pero no se pudo crear la suscripción automáticamente",
              data: capture,
            });
          }

          console.log(
            `Creating subscription for empresa ${empresa.id}, planType: ${finalPlanType}, duration: ${planDurationDays} days, orderId: ${orderId}`
          );

          const subscription =
            await this.subscriptionsService.createOrUpdateSubscription(
              empresa.id,
              finalPlanType,
              orderId,
              undefined, // paypalSubscriptionId
              planDurationDays
            );

          console.log(
            `✅ Subscription created successfully: ${subscription.id} for empresa ${empresa.id}, planType: ${subscription.planType}, status: ${subscription.status}`
          );
        } catch (error) {
          console.error("❌ Error creating subscription after payment:", error);
          // No fallar el pago si falla la creación de suscripción, pero loguear el error detallado
          if (error instanceof Error) {
            console.error("Error details:", error.message, error.stack);
          }
        }
      } else {
        if (!empresa) {
          console.error(
            `❌ No se encontró empresa para userId ${req.user?.sub} al capturar pago ${orderId}`
          );
        }
        if (capture.status !== "COMPLETED") {
          console.warn(
            `⚠️ Payment status is ${capture.status}, not creating subscription for orderId ${orderId}`
          );
        }
      }
    } catch (error) {
      console.error("Error saving payment transaction:", error);
      // No fallar el pago si falla el guardado de la transacción
    }

    return createResponse({
      success: true,
      message: "Pago capturado exitosamente",
      data: capture,
    });
  }

  /**
   * Obtener detalles de orden
   */
  @Get("order/:orderId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getOrderDetails(@Param("orderId") orderId: string) {
    const details = await this.paymentsService.getOrderDetails(orderId);

    return createResponse({
      success: true,
      message: "Detalles de orden obtenidos",
      data: details,
    });
  }

  /**
   * Obtener historial de pagos del usuario
   */
  @Get("history")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getPaymentHistory(@Req() req: any) {
    const transactions = await this.prisma.paymentTransaction.findMany({
      where: { userId: req.user?.sub },
      orderBy: { createdAt: "desc" },
      include: {
        empresa: {
          select: {
            id: true,
            companyName: true,
          },
        },
      },
    });

    return createResponse({
      success: true,
      message: "Historial de pagos obtenido",
      data: transactions,
    });
  }

  /**
   * Obtener historial de pagos de una empresa (admin)
   */
  @Get("history/empresa/:empresaId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getEmpresaPaymentHistory(@Param("empresaId") empresaId: string) {
    const transactions = await this.prisma.paymentTransaction.findMany({
      where: { empresaId },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    return createResponse({
      success: true,
      message: "Historial de pagos de la empresa obtenido",
      data: transactions,
    });
  }

  /**
   * Obtener todas las transacciones (admin)
   */
  @Get("transactions")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getAllTransactions() {
    const transactions = await this.prisma.paymentTransaction.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        empresa: {
          select: {
            id: true,
            companyName: true,
          },
        },
      },
    });

    return createResponse({
      success: true,
      message: "Todas las transacciones obtenidas",
      data: transactions,
    });
  }

  /**
   * Webhook de PayPal (sin autenticación)
   */
  @Post("webhook")
  async handleWebhook(@Headers() headers: any, @Body() body: any) {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;

    if (!webhookId) {
      return createResponse({
        success: false,
        message: "Webhook ID no configurado",
      });
    }

    const isValid = await this.paymentsService.verifyWebhook(
      webhookId,
      headers,
      body
    );

    if (!isValid) {
      return createResponse({
        success: false,
        message: "Webhook inválido",
      });
    }

    // Procesar eventos de PayPal
    const eventType = body.event_type;
    const resource = body.resource;

    console.log("PayPal Webhook Event:", eventType);

    try {
      // Eventos relacionados con pagos
      if (
        eventType === "PAYMENT.CAPTURE.COMPLETED" ||
        eventType === "PAYMENT.SALE.COMPLETED"
      ) {
        // El pago fue completado - la suscripción ya se creó en captureOrder
        console.log("Payment completed:", resource);
      }

      // Eventos de suscripción
      if (eventType === "BILLING.SUBSCRIPTION.CREATED") {
        console.log("Subscription created:", resource);
      }

      if (eventType === "BILLING.SUBSCRIPTION.CANCELLED") {
        // Buscar suscripción por paypalSubscriptionId y cancelarla
        if (resource?.id) {
          // Implementar cancelación de suscripción
          console.log("Subscription cancelled:", resource.id);
        }
      }

      if (eventType === "BILLING.SUBSCRIPTION.EXPIRED") {
        // Marcar suscripción como expirada
        if (resource?.id) {
          // Implementar expiración de suscripción
          console.log("Subscription expired:", resource.id);
        }
      }
    } catch (error) {
      console.error("Error processing webhook:", error);
    }

    return createResponse({
      success: true,
      message: "Webhook procesado",
    });
  }

  /**
   * IPN de confirmación de pago (sin autenticación JWT)
   */
  @Post("ipn/confirm")
  @HttpCode(200)
  async handleIpnConfirm(
    @Headers("x-ipn-secret") ipnSecret: string | undefined,
    @Body() body: any
  ) {
    this.validateIpnSecretOrThrow(ipnSecret);

    const orderId = this.extractOrderIdFromIpnBody(body);
    const jobId = this.extractJobIdFromIpnBody(body);
    const payload = this.extractIpnPayload(body);
    let updated = 0;

    if (orderId) {
      const result = await this.prisma.paymentTransaction.updateMany({
        where: { orderId },
        data: {
          status: PaymentStatus.COMPLETED,
          paypalData: payload,
          updatedAt: new Date(),
        },
      });
      updated = result.count;
    }

    const jobUpdate = await this.markJobPaymentCompletedFromIpn(orderId, jobId, payload);

    return createResponse({
      success: true,
      message: "IPN de confirmación procesado",
      data: {
        orderId,
        jobId,
        updatedTransactions: updated,
        updatedJobs: jobUpdate.updatedJobs,
        activatedEntitlements: jobUpdate.activatedEntitlements,
      },
    });
  }

  /**
   * IPN de rechazo de pago (sin autenticación JWT)
   */
  @Post("ipn/reject")
  @HttpCode(200)
  async handleIpnReject(
    @Headers("x-ipn-secret") ipnSecret: string | undefined,
    @Body() body: any
  ) {
    this.validateIpnSecretOrThrow(ipnSecret);

    const orderId = this.extractOrderIdFromIpnBody(body);
    const jobId = this.extractJobIdFromIpnBody(body);
    const payload = this.extractIpnPayload(body);
    let updated = 0;

    if (orderId) {
      const result = await this.prisma.paymentTransaction.updateMany({
        where: { orderId },
        data: {
          status: PaymentStatus.FAILED,
          paypalData: payload,
          updatedAt: new Date(),
        },
      });
      updated = result.count;
    }

    const jobUpdate = await this.markJobPaymentFailedFromIpn(orderId, jobId);

    return createResponse({
      success: true,
      message: "IPN de rechazo procesado",
      data: {
        orderId,
        jobId,
        updatedTransactions: updated,
        updatedJobs: jobUpdate.updatedJobs,
        revokedEntitlements: jobUpdate.revokedEntitlements,
      },
    });
  }
}
