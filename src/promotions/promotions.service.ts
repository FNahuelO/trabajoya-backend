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
  private readonly PROMO_KEY = "LAUNCH_TRIAL_4D";

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService
  ) {}

  /**
   * Verifica si la ventana de promoción está abierta
   */
  isLaunchTrialWindow(now?: Date): boolean {
    const currentTime = now || new Date();
    const startAt = this.configService.get<string>("LAUNCH_TRIAL_START_AT");
    const endAt = this.configService.get<string>("LAUNCH_TRIAL_END_AT");

    if (!startAt || !endAt) {
      return false; // Si no están configuradas, la ventana está cerrada
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
   */
  async getLaunchTrialStatus(userId: string) {
    const windowOpen = this.isLaunchTrialWindow();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { empresa: true },
    });

    if (!user || user.userType !== "EMPRESA") {
      return {
        eligible: false,
        alreadyUsed: false,
        windowOpen,
        reason: "Solo empresas pueden usar esta promoción",
      };
    }

    // Buscar promoción existente
    const promotion = await this.prisma.userPromotion.findUnique({
      where: {
        userId_promoKey: {
          userId,
          promoKey: this.PROMO_KEY,
        },
      },
    });

    if (!promotion) {
      return {
        eligible: windowOpen,
        alreadyUsed: false,
        windowOpen,
        reason: windowOpen
          ? undefined
          : "La ventana de promoción no está abierta",
      };
    }

    if (promotion.status === "USED") {
      return {
        eligible: false,
        alreadyUsed: true,
        windowOpen,
        reason: "Ya has utilizado esta promoción",
      };
    }

    if (promotion.status === "CLAIMED") {
      return {
        eligible: true,
        alreadyUsed: false,
        windowOpen,
        reason: undefined,
      };
    }

    if (promotion.status === "EXPIRED") {
      return {
        eligible: false,
        alreadyUsed: false,
        windowOpen,
        reason: "La promoción ha expirado",
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
    };
  }

  /**
   * Reclama la promoción de lanzamiento
   */
  async claimLaunchTrial(
    userId: string,
    metadata?: { ip?: string; userAgent?: string; companyId?: string }
  ) {
    const windowOpen = this.isLaunchTrialWindow();
    if (!windowOpen) {
      throw new BadRequestException(
        "La ventana de promoción no está abierta"
      );
    }

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
          promoKey: this.PROMO_KEY,
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
      promoKey: this.PROMO_KEY,
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
    const promotion = await this.prisma.userPromotion.findUnique({
      where: {
        userId_promoKey: {
          userId,
          promoKey: this.PROMO_KEY,
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
   * Obtiene la promoción reclamada de un usuario
   */
  async getClaimedPromotion(userId: string) {
    return this.prisma.userPromotion.findUnique({
      where: {
        userId_promoKey: {
          userId,
          promoKey: this.PROMO_KEY,
        },
      },
    });
  }
}

