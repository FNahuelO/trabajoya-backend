import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
  UseGuards,
} from "@nestjs/common";
import { PaymentsService } from "./payments.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { createResponse } from "../common/mapper/api-response.mapper";

@ApiTags("payments")
@Controller("api/payments")
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

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
  async captureOrder(@Param("orderId") orderId: string) {
    const capture = await this.paymentsService.captureOrder(orderId);

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

    // Aquí procesarías los diferentes eventos de PayPal
    console.log("PayPal Webhook Event:", body.event_type);

    return createResponse({
      success: true,
      message: "Webhook procesado",
    });
  }
}
