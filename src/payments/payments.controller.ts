import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
  UseGuards,
  Req,
  NotFoundException,
} from "@nestjs/common";
import { PaymentsService } from "./payments.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { createResponse } from "../common/mapper/api-response.mapper";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("payments")
@Controller("api/payments")
export class PaymentsController {
  constructor(
    private paymentsService: PaymentsService,
    private subscriptionsService: SubscriptionsService,
    private prisma: PrismaService
  ) {}

  /**
   * Crear orden de pago
   */
  @Post("create-order")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async createOrder(@Body() body: CreateOrderDto) {
    const order = await this.paymentsService.createOrder(
      body.amount,
      body.currency || "USD",
      body.description || `Pago de plan ${body.planType || "premium"}`
    );

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
    @Body() body: { planType?: string },
    @Req() req: any
  ) {
    const capture = await this.paymentsService.captureOrder(orderId);

    // Si se capturó exitosamente y hay planType, crear suscripción
    if (capture.status === "COMPLETED" && body.planType) {
      try {
        // Obtener empresa del usuario
        const empresa = await this.prisma.empresaProfile.findUnique({
          where: { userId: req.user?.sub },
        });

        if (empresa) {
          // Mapear planType a enum
          const planTypeMap: Record<
            string,
            "BASIC" | "PREMIUM" | "ENTERPRISE"
          > = {
            basic: "BASIC",
            premium: "PREMIUM",
            enterprise: "ENTERPRISE",
          };

          const planType =
            planTypeMap[body.planType.toLowerCase()] ||
            (body.planType.toUpperCase() as "BASIC" | "PREMIUM" | "ENTERPRISE");

          await this.subscriptionsService.createOrUpdateSubscription(
            empresa.id,
            planType,
            orderId
          );
        }
      } catch (error) {
        console.error("Error creating subscription after payment:", error);
        // No fallar el pago si falla la creación de suscripción
      }
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
}
