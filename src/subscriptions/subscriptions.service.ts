import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SubscriptionsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Obtener suscripción activa de una empresa
   */
  async getActiveSubscription(empresaId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        empresaId,
        status: "ACTIVE",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return subscription;
  }

  /**
   * Obtener suscripción por ID
   */
  async getSubscriptionById(id: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id },
      include: {
        empresa: {
          select: {
            id: true,
            companyName: true,
            userId: true,
          },
        },
      },
    });

    if (!subscription) {
      throw new NotFoundException("Suscripción no encontrada");
    }

    return subscription;
  }

  /**
   * Crear o actualizar suscripción
   */
  async createOrUpdateSubscription(
    empresaId: string,
    planType: "BASIC" | "PREMIUM" | "ENTERPRISE",
    paypalOrderId?: string,
    paypalSubscriptionId?: string,
    durationDays: number = 30
  ) {
    // Verificar que la empresa existe
    const empresa = await this.prisma.empresaProfile.findUnique({
      where: { id: empresaId },
    });

    if (!empresa) {
      throw new NotFoundException("Empresa no encontrada");
    }

    // Cancelar suscripción activa previa si existe
    await this.prisma.subscription.updateMany({
      where: {
        empresaId,
        status: "ACTIVE",
      },
      data: {
        status: "CANCELED",
        canceledAt: new Date(),
        cancelReason: "Upgrade to new plan",
      },
    });

    // Calcular fecha de expiración usando la duración del plan
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + durationDays);

    // Crear nueva suscripción
    const subscription = await this.prisma.subscription.create({
      data: {
        empresaId,
        planType,
        status: "ACTIVE",
        paypalOrderId,
        paypalSubscriptionId,
        startDate: new Date(),
        endDate,
      },
    });

    console.log(
      `Subscription created: ${subscription.id} for empresa ${empresaId}, planType: ${planType}, duration: ${durationDays} days, endDate: ${endDate}`
    );

    return subscription;
  }

  /**
   * Cancelar suscripción
   */
  async cancelSubscription(empresaId: string, reason?: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        empresaId,
        status: "ACTIVE",
      },
    });

    if (!subscription) {
      throw new NotFoundException("No hay suscripción activa para cancelar");
    }

    const updated = await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: "CANCELED",
        canceledAt: new Date(),
        cancelReason: reason || "Cancelado por el usuario",
      },
    });

    return updated;
  }

  /**
   * Actualizar plan de suscripción
   */
  async updateSubscriptionPlan(
    empresaId: string,
    newPlanType: "BASIC" | "PREMIUM" | "ENTERPRISE"
  ) {
    const currentSubscription = await this.getActiveSubscription(empresaId);

    if (!currentSubscription) {
      // Si no hay suscripción activa, crear una nueva
      return this.createOrUpdateSubscription(empresaId, newPlanType);
    }

    // Si es el mismo plan, no hacer nada
    if (currentSubscription.planType === newPlanType) {
      return currentSubscription;
    }

    // Crear nueva suscripción con el nuevo plan
    return this.createOrUpdateSubscription(empresaId, newPlanType);
  }

  /**
   * Obtener límites según el plan
   */
  getPlanLimits(planType: "BASIC" | "PREMIUM" | "ENTERPRISE") {
    switch (planType) {
      case "BASIC":
        return {
          maxJobs: 3,
          features: ["basic"],
        };
      case "PREMIUM":
        return {
          maxJobs: -1, // Ilimitado
          features: [
            "unlimited_jobs",
            "priority_search",
            "analytics",
            "advanced_messaging",
          ],
        };
      case "ENTERPRISE":
        return {
          maxJobs: -1, // Ilimitado
          features: [
            "unlimited_jobs",
            "priority_search",
            "analytics",
            "advanced_messaging",
            "multiple_users",
            "api_access",
            "dedicated_support",
          ],
        };
      default:
        return {
          maxJobs: 3,
          features: ["basic"],
        };
    }
  }

  /**
   * Verificar si la empresa puede crear más empleos
   */
  async canCreateJob(empresaId: string): Promise<{
    canCreate: boolean;
    reason?: string;
    hasActiveSubscription?: boolean;
  }> {
    // Primero verificar si tiene una suscripción activa
    const subscription = await this.getActiveSubscription(empresaId);

    if (!subscription) {
      return {
        canCreate: false,
        hasActiveSubscription: false,
        reason:
          "No tienes un plan activo. Por favor, selecciona un plan para poder publicar empleos.",
      };
    }

    const planType = subscription.planType;
    const limits = this.getPlanLimits(planType);

    // Si no hay límite, puede crear
    if (limits.maxJobs === -1) {
      return { canCreate: true, hasActiveSubscription: true };
    }

    // Contar empleos activos
    const activeJobsCount = await this.prisma.job.count({
      where: {
        empresaId,
        status: "active",
      },
    });

    if (activeJobsCount >= limits.maxJobs) {
      return {
        canCreate: false,
        hasActiveSubscription: true,
        reason: `Has alcanzado el límite de ${limits.maxJobs} empleos para tu plan. Considera actualizar a Premium para publicar empleos ilimitados.`,
      };
    }

    return { canCreate: true, hasActiveSubscription: true };
  }

  /**
   * Obtener todas las suscripciones de una empresa
   */
  async getSubscriptionHistory(empresaId: string) {
    return this.prisma.subscription.findMany({
      where: { empresaId },
      orderBy: {
        createdAt: "desc",
      },
    });
  }
}
