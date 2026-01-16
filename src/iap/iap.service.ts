import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { VerifyAppleDto } from './dto/verify-apple.dto';
import { VerifyGoogleDto } from './dto/verify-google.dto';
import { RestoreDto } from './dto/restore.dto';
import axios from 'axios';

@Injectable()
export class IapService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  /**
   * Mapea productId a planKey
   */
  async getPlanKeyFromProductId(
    productId: string,
    platform: 'IOS' | 'ANDROID',
  ): Promise<string> {
    const iapProduct = await this.prisma.iapProduct.findFirst({
      where: {
        productId,
        platform,
        active: true,
      },
    });

    if (!iapProduct) {
      throw new NotFoundException(
        `Producto IAP no encontrado: ${productId} para plataforma ${platform}`,
      );
    }

    return iapProduct.planKey;
  }

  /**
   * Verifica una compra de Apple usando App Store Server API
   * En producción, usar la API real. Aquí implementamos verificación básica.
   */
  async verifyApplePurchase(
    userId: string,
    dto: VerifyAppleDto,
  ): Promise<{ ok: boolean; entitlement: any; expiresAt: Date }> {
    // Verificar que el transactionId no haya sido usado (anti-replay)
    const existing = await this.prisma.jobPostEntitlement.findUnique({
      where: { transactionId: dto.transactionId },
    });

    if (existing) {
      throw new BadRequestException(
        'Esta transacción ya ha sido procesada (replay attack prevenido)',
      );
    }

    // Obtener planKey del productId
    const planKey = await this.getPlanKeyFromProductId(dto.productId, 'IOS');

    // Obtener plan para configurar entitlement
    const plan = await this.prisma.plan.findUnique({
      where: { code: planKey },
    });

    if (!plan) {
      throw new NotFoundException(`Plan no encontrado: ${planKey}`);
    }

    // TODO: Verificar con Apple App Store Server API
    // Por ahora, validación básica. En producción:
    // 1. Verificar signedTransactionInfo con Apple
    // 2. Validar que la compra esté en estado válido
    // 3. Obtener originalTransactionId si existe

    // Para desarrollo/testing, aceptamos la transacción
    // En producción, usar:
    // const appleApiUrl = this.configService.get('APPLE_IAP_API_URL');
    // const response = await axios.post(appleApiUrl, {
    //   signedTransactionInfo: dto.signedTransactionInfo,
    // });

    const publishedAt = new Date();
    const expiresAt = new Date(publishedAt);
    expiresAt.setDate(expiresAt.getDate() + plan.durationDays);

    // Si hay jobPostDraftId, crear el entitlement asociado
    let jobPostId: string | null = null;
    if (dto.jobPostDraftId) {
      // Verificar que el draft existe y pertenece al usuario
      const draft = await this.prisma.job.findFirst({
        where: {
          id: dto.jobPostDraftId,
          empresa: {
            userId,
          },
        },
      });

      if (!draft) {
        throw new NotFoundException('Draft de aviso no encontrado');
      }

      jobPostId = draft.id;
    }

    // Crear entitlement
    const entitlement = await this.prisma.jobPostEntitlement.create({
      data: {
        userId,
        jobPostId: jobPostId || '', // Si no hay draft, se asignará después
        source: 'APPLE_IAP',
        planKey,
        expiresAt,
        status: 'ACTIVE',
        maxEdits: plan.allowedModifications,
        editsUsed: 0,
        allowCategoryChange: plan.canModifyCategory,
        maxCategoryChanges: plan.categoryModifications,
        categoryChangesUsed: 0,
        transactionId: dto.transactionId,
        originalTransactionId: dto.transactionId, // En producción, obtener de Apple
        rawPayload: {
          productId: dto.productId,
          signedTransactionInfo: dto.signedTransactionInfo,
          signedRenewalInfo: dto.signedRenewalInfo,
        },
      },
    });

    return {
      ok: true,
      entitlement,
      expiresAt,
    };
  }

  /**
   * Verifica una compra de Google Play
   */
  async verifyGooglePurchase(
    userId: string,
    dto: VerifyGoogleDto,
  ): Promise<{ ok: boolean; entitlement: any; expiresAt: Date }> {
    // Verificar que el purchaseToken no haya sido usado
    const existing = await this.prisma.jobPostEntitlement.findFirst({
      where: {
        rawPayload: {
          path: ['purchaseToken'],
          equals: dto.purchaseToken,
        },
      },
    });

    if (existing) {
      throw new BadRequestException(
        'Este purchase token ya ha sido procesado (replay attack prevenido)',
      );
    }

    // Obtener planKey del productId
    const planKey = await this.getPlanKeyFromProductId(dto.productId, 'ANDROID');

    // Obtener plan
    const plan = await this.prisma.plan.findUnique({
      where: { code: planKey },
    });

    if (!plan) {
      throw new NotFoundException(`Plan no encontrado: ${planKey}`);
    }

    // TODO: Verificar con Google Play Developer API
    // En producción:
    // const googleApiUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/products/${dto.productId}/tokens/${dto.purchaseToken}`;
    // const response = await axios.get(googleApiUrl, {
    //   headers: {
    //     Authorization: `Bearer ${accessToken}`,
    //   },
    // });

    const publishedAt = new Date();
    const expiresAt = new Date(publishedAt);
    expiresAt.setDate(expiresAt.getDate() + plan.durationDays);

    // Si hay jobPostDraftId, crear el entitlement asociado
    let jobPostId: string | null = null;
    if (dto.jobPostDraftId) {
      const draft = await this.prisma.job.findFirst({
        where: {
          id: dto.jobPostDraftId,
          empresa: {
            userId,
          },
        },
      });

      if (!draft) {
        throw new NotFoundException('Draft de aviso no encontrado');
      }

      jobPostId = draft.id;
    }

    // Crear entitlement
    const entitlement = await this.prisma.jobPostEntitlement.create({
      data: {
        userId,
        jobPostId: jobPostId || '',
        source: 'GOOGLE_PLAY',
        planKey,
        expiresAt,
        status: 'ACTIVE',
        maxEdits: plan.allowedModifications,
        editsUsed: 0,
        allowCategoryChange: plan.canModifyCategory,
        maxCategoryChanges: plan.categoryModifications,
        categoryChangesUsed: 0,
        transactionId: dto.orderId || dto.purchaseToken, // Usar orderId si existe
        originalTransactionId: dto.orderId,
        rawPayload: {
          productId: dto.productId,
          purchaseToken: dto.purchaseToken,
          orderId: dto.orderId,
        },
      },
    });

    return {
      ok: true,
      entitlement,
      expiresAt,
    };
  }

  /**
   * Restaura compras (iOS) o sincroniza (Android)
   */
  async restorePurchases(
    userId: string,
    dto: RestoreDto,
  ): Promise<{ restored: number; entitlements: any[] }> {
    // TODO: Implementar lógica de restore
    // Para iOS: recibir array de signedTransactionInfo y verificar cada uno
    // Para Android: obtener compras activas del usuario desde Google Play API

    // Por ahora, retornar entitlements activos del usuario
    const entitlements = await this.prisma.jobPostEntitlement.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
    });

    return {
      restored: entitlements.length,
      entitlements,
    };
  }

  /**
   * Obtiene productos IAP por plataforma
   */
  async getIapProducts(platform: 'IOS' | 'ANDROID') {
    return this.prisma.iapProduct.findMany({
      where: {
        platform,
        active: true,
      },
      include: {
        plan: true,
      },
    });
  }
}

