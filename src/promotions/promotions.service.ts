import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "@prisma/client";

@Injectable()
export class PromotionsService {
  private readonly DEFAULT_PROMO_KEY = "LAUNCH_TRIAL_4D";

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService
  ) {}

  /**
   * Obtiene la promoción activa desde la base de datos
   */
  async getActivePromotion(promoKey?: string) {
    const code = promoKey || this.DEFAULT_PROMO_KEY;
    return this.prisma.promotion.findFirst({
      where: {
        code,
        isActive: true,
      },
    });
  }

  /**
   * Verifica si la ventana de promoción está abierta
   * Ahora usa las fechas de la tabla Promotion en lugar de variables de entorno
   */
  async isLaunchTrialWindow(now?: Date): Promise<boolean> {
    const currentTime = now || new Date();
    
    // Primero intentar obtener las fechas de la promoción en la BD
    const promotion = await this.getActivePromotion();
    
    if (promotion && promotion.startAt && promotion.endAt) {
      return currentTime >= promotion.startAt && currentTime <= promotion.endAt;
    }

    // Fallback a variables de entorno (retrocompatibilidad)
    const startAt = this.configService.get<string>("LAUNCH_TRIAL_START_AT");
    const endAt = this.configService.get<string>("LAUNCH_TRIAL_END_AT");

    if (!startAt || !endAt) {
      return false;
    }

    try {
      const start = new Date(startAt);
      const end = new Date(endAt);
      return currentTime >= start && currentTime <= end;
    } catch (error) {
      console.error("[PromotionsService] Error parsing dates:", error);
      return false;
    }
  }

  /**
   * Obtiene el estado de la promoción para un usuario
   * Ahora incluye los datos de la promoción desde la BD
   */
  async getLaunchTrialStatus(userId: string) {
    const windowOpen = await this.isLaunchTrialWindow();
    const promotion = await this.getActivePromotion();
    
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { empresa: true },
    });

    // Datos base de la promoción (desde BD o defaults)
    const promotionData = promotion
      ? {
          code: promotion.code,
          title: promotion.title,
          description: promotion.description,
          durationDays: promotion.durationDays,
          metadata: promotion.metadata,
        }
      : null;

    if (!user || user.userType !== "EMPRESA") {
      return {
        eligible: false,
        alreadyUsed: false,
        windowOpen,
        reason: "Solo empresas pueden usar esta promoción",
        promotion: promotionData,
      };
    }

    const promoKey = promotion?.code || this.DEFAULT_PROMO_KEY;

    // Buscar promoción existente del usuario
    const userPromotion = await this.prisma.userPromotion.findUnique({
      where: {
        userId_promoKey: {
          userId,
          promoKey,
        },
      },
    });

    if (!userPromotion) {
      return {
        eligible: windowOpen,
        alreadyUsed: false,
        windowOpen,
        reason: windowOpen
          ? undefined
          : "La ventana de promoción no está abierta",
        promotion: promotionData,
      };
    }

    if (userPromotion.status === "USED") {
      return {
        eligible: false,
        alreadyUsed: true,
        windowOpen,
        reason: "Ya has utilizado esta promoción",
        promotion: promotionData,
      };
    }

    if (userPromotion.status === "CLAIMED") {
      // Si ya reclamó la promoción, marcar como ya usada para que no se muestre la card
      return {
        eligible: false,
        alreadyUsed: true,
        windowOpen,
        reason: "Ya has reclamado esta promoción",
        promotion: promotionData,
      };
    }

    if (userPromotion.status === "EXPIRED") {
      return {
        eligible: false,
        alreadyUsed: false,
        windowOpen,
        reason: "La promoción ha expirado",
        promotion: promotionData,
      };
    }

    // AVAILABLE
    return {
      eligible: windowOpen,
      alreadyUsed: false,
      windowOpen,
      reason: windowOpen
        ? undefined
        : "La ventana de promoción no está abierta",
      promotion: promotionData,
    };
  }

  /**
   * Reclama la promoción de lanzamiento
   */
  async claimLaunchTrial(
    userId: string,
    metadata?: { ip?: string; userAgent?: string; companyId?: string }
  ) {
    const windowOpen = await this.isLaunchTrialWindow();
    if (!windowOpen) {
      throw new BadRequestException(
        "La ventana de promoción no está abierta"
      );
    }

    const activePromotion = await this.getActivePromotion();
    const promoKey = activePromotion?.code || this.DEFAULT_PROMO_KEY;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { empresa: true },
    });

    if (!user || user.userType !== "EMPRESA") {
      throw new ForbiddenException(
        "Solo empresas pueden reclamar esta promoción"
      );
    }

    // Verificar si ya existe una promoción
    const existing = await this.prisma.userPromotion.findUnique({
      where: {
        userId_promoKey: {
          userId,
          promoKey,
        },
      },
    });

    if (existing) {
      if (existing.status === "USED") {
        throw new BadRequestException("Ya has utilizado esta promoción");
      }
      if (existing.status === "CLAIMED") {
        throw new BadRequestException("Ya has reclamado esta promoción");
      }
      if (existing.status === "EXPIRED") {
        throw new BadRequestException("La promoción ha expirado");
      }
    }

    // Crear o actualizar promoción
    const promotionData: Prisma.UserPromotionCreateInput = {
      user: { connect: { id: userId } },
      promoKey,
      status: "CLAIMED",
      claimedAt: new Date(),
      metadata: metadata || {},
    };

    if (user.empresa) {
      promotionData.metadata = {
        ...(metadata || {}),
        companyId: user.empresa.id,
        cuit: user.empresa.cuit,
      };
    }

    const promotion = existing
      ? await this.prisma.userPromotion.update({
          where: { id: existing.id },
          data: {
            status: "CLAIMED",
            claimedAt: new Date(),
            metadata: promotionData.metadata,
          },
        })
      : await this.prisma.userPromotion.create({
          data: promotionData,
        });

    return promotion;
  }

  /**
   * Marca la promoción como usada al publicar un aviso
   */
  async useLaunchTrial(userId: string, jobPostId: string) {
    const activePromotion = await this.getActivePromotion();
    const promoKey = activePromotion?.code || this.DEFAULT_PROMO_KEY;

    const promotion = await this.prisma.userPromotion.findUnique({
      where: {
        userId_promoKey: {
          userId,
          promoKey,
        },
      },
    });

    if (!promotion) {
      throw new NotFoundException("Promoción no encontrada");
    }

    if (promotion.status !== "CLAIMED") {
      throw new BadRequestException(
        `La promoción no está en estado CLAIMED (actual: ${promotion.status})`
      );
    }

    return this.prisma.userPromotion.update({
      where: { id: promotion.id },
      data: {
        status: "USED",
        usedAt: new Date(),
        metadata: {
          ...((promotion.metadata as any) || {}),
          jobPostId,
        },
      },
    });
  }

  /**
   * Activa un job post existente usando la promoción de lanzamiento.
   * Crea el JobPostEntitlement y actualiza el estado del job.
   */
  async activateJobWithPromotion(
    userId: string,
    jobPostId: string,
    promotion: { claimedAt: Date | null }
  ) {
    // Verificar que el job existe y pertenece al usuario
    const job = await this.prisma.job.findUnique({
      where: { id: jobPostId },
      include: { empresa: true },
    });

    if (!job) {
      throw new NotFoundException(
        `La publicación con id ${jobPostId} no existe`
      );
    }

    // Verificar que el job pertenece al usuario
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { empresa: true },
    });

    if (!user?.empresa || job.empresaId !== user.empresa.id) {
      throw new ForbiddenException(
        "No tienes permiso para activar esta publicación"
      );
    }

    // Verificar que no exista ya un entitlement activo para este job
    const existingEntitlement = await this.prisma.jobPostEntitlement.findUnique({
      where: { jobPostId },
    });

    if (existingEntitlement && existingEntitlement.status === "ACTIVE") {
      throw new BadRequestException(
        "Esta publicación ya tiene un plan activo"
      );
    }

    // Obtener la duración de la promoción
    const activePromotion = await this.getActivePromotion();
    const durationDays = activePromotion?.durationDays || 4;

    const publishedAt = new Date();
    const expiresAt = new Date(publishedAt);
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    // Crear el entitlement (o actualizar si existía uno expirado/revocado)
    if (existingEntitlement) {
      await this.prisma.jobPostEntitlement.update({
        where: { id: existingEntitlement.id },
        data: {
          source: "PROMO",
          planKey: "LAUNCH_TRIAL",
          expiresAt,
          status: "ACTIVE",
          maxEdits: 0,
          editsUsed: 0,
          allowCategoryChange: false,
          maxCategoryChanges: 0,
          categoryChangesUsed: 0,
          rawPayload: {
            promo_key: activePromotion?.code || "LAUNCH_TRIAL_4D",
            claimed_at: promotion.claimedAt,
          },
        },
      });
    } else {
      await this.prisma.jobPostEntitlement.create({
        data: {
          userId,
          jobPostId,
          source: "PROMO",
          planKey: "LAUNCH_TRIAL",
          expiresAt,
          status: "ACTIVE",
          maxEdits: 0,
          editsUsed: 0,
          allowCategoryChange: false,
          maxCategoryChanges: 0,
          categoryChangesUsed: 0,
          rawPayload: {
            promo_key: activePromotion?.code || "LAUNCH_TRIAL_4D",
            claimed_at: promotion.claimedAt,
          },
        },
      });
    }

    // Actualizar el job: marcar como pagado y aprobado (promoción auto-aprueba)
    const updatedJob = await this.prisma.job.update({
      where: { id: jobPostId },
      data: {
        isPaid: true,
        paymentStatus: "COMPLETED",
        status: "active",
        moderationStatus: "APPROVED",
        moderatedAt: publishedAt,
        publishedAt,
        paidAt: publishedAt,
      },
    });

    return { entitlement: { jobPostId, expiresAt, status: "ACTIVE" }, job: updatedJob };
  }

  /**
   * Obtiene la promoción reclamada de un usuario
   */
  async getClaimedPromotion(userId: string) {
    const activePromotion = await this.getActivePromotion();
    const promoKey = activePromotion?.code || this.DEFAULT_PROMO_KEY;

    return this.prisma.userPromotion.findUnique({
      where: {
        userId_promoKey: {
          userId,
          promoKey,
        },
      },
    });
  }
}

