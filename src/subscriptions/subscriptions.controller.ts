import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
  Delete,
  NotFoundException,
} from "@nestjs/common";
import { SubscriptionsService } from "./subscriptions.service";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { createResponse } from "../common/mapper/api-response.mapper";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("subscriptions")
@Controller("api/subscriptions")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SubscriptionsController {
  constructor(
    private subscriptionsService: SubscriptionsService,
    private prisma: PrismaService
  ) {}

  /**
   * Obtener suscripción activa de la empresa
   */
  @Get("current")
  async getCurrentSubscription(@Req() req: any) {
    const empresa = await this.getEmpresaFromUser(req.user?.sub);

    const subscription = await this.subscriptionsService.getActiveSubscription(
      empresa.id
    );
    const planType = subscription?.planType || "BASIC";
    const limits = this.subscriptionsService.getPlanLimits(planType);

    return createResponse({
      success: true,
      message: "Suscripción obtenida correctamente",
      data: {
        subscription: subscription || null,
        planType,
        limits,
      },
    });
  }

  /**
   * Crear o actualizar suscripción
   */
  @Post()
  async createSubscription(
    @Req() req: any,
    @Body()
    body: {
      planType: "BASIC" | "PREMIUM" | "ENTERPRISE";
      paypalOrderId?: string;
    }
  ) {
    const empresa = await this.getEmpresaFromUser(req.user?.sub);

    const subscription =
      await this.subscriptionsService.createOrUpdateSubscription(
        empresa.id,
        body.planType,
        body.paypalOrderId
      );

    return createResponse({
      success: true,
      message: "Suscripción creada correctamente",
      data: subscription,
    });
  }

  /**
   * Cancelar suscripción
   */
  @Delete("cancel")
  async cancelSubscription(
    @Req() req: any,
    @Body() body?: { reason?: string }
  ) {
    const empresa = await this.getEmpresaFromUser(req.user?.sub);

    const subscription = await this.subscriptionsService.cancelSubscription(
      empresa.id,
      body?.reason
    );

    return createResponse({
      success: true,
      message: "Suscripción cancelada correctamente",
      data: subscription,
    });
  }

  /**
   * Actualizar plan de suscripción
   */
  @Post("upgrade")
  async upgradePlan(
    @Req() req: any,
    @Body() body: { planType: "BASIC" | "PREMIUM" | "ENTERPRISE" }
  ) {
    const empresa = await this.getEmpresaFromUser(req.user?.sub);

    const subscription = await this.subscriptionsService.updateSubscriptionPlan(
      empresa.id,
      body.planType
    );

    return createResponse({
      success: true,
      message: "Plan actualizado correctamente",
      data: subscription,
    });
  }

  /**
   * Obtener historial de suscripciones
   */
  @Get("history")
  async getHistory(@Req() req: any) {
    const empresa = await this.getEmpresaFromUser(req.user?.sub);

    const history = await this.subscriptionsService.getSubscriptionHistory(
      empresa.id
    );

    return createResponse({
      success: true,
      message: "Historial obtenido correctamente",
      data: history,
    });
  }

  /**
   * Verificar si puede crear más empleos
   */
  @Get("can-create-job")
  async canCreateJob(@Req() req: any) {
    const empresa = await this.getEmpresaFromUser(req.user?.sub);

    const result = await this.subscriptionsService.canCreateJob(empresa.id);

    return createResponse({
      success: true,
      message: result.canCreate
        ? "Puedes crear más empleos"
        : "Has alcanzado el límite de empleos",
      data: result,
    });
  }

  /**
   * Helper para obtener empresa desde userId
   */
  private async getEmpresaFromUser(userId: string) {
    const empresa = await this.prisma.empresaProfile.findUnique({
      where: { userId },
    });

    if (!empresa) {
      throw new NotFoundException("Empresa no encontrada");
    }

    return empresa;
  }
}
