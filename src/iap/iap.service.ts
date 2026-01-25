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
    console.log('[IAP] Buscando producto IAP:', { productId, platform });
    
    const iapProduct = await this.prisma.iapProduct.findFirst({
      where: {
        productId,
        platform,
        active: true,
      },
    });

    if (!iapProduct) {
      // Buscar todos los productos activos para esta plataforma para ayudar en debugging
      const allProducts = await this.prisma.iapProduct.findMany({
        where: {
          platform,
          active: true,
        },
        select: {
          productId: true,
          planKey: true,
        },
      });
      
      console.error('[IAP] Producto IAP no encontrado:', {
        productId,
        platform,
        productosDisponibles: allProducts,
      });
      
      throw new NotFoundException(
        `Producto IAP no encontrado: ${productId} para plataforma ${platform}. ` +
        `Productos disponibles: ${allProducts.map(p => p.productId).join(', ') || 'ninguno'}`,
      );
    }

    console.log('[IAP] Producto IAP encontrado:', {
      productId: iapProduct.productId,
      planKey: iapProduct.planKey,
    });

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
    // Validar que userId existe
    if (!userId) {
      console.error('[IAP] Error: userId es undefined o null');
      throw new BadRequestException(
        'Usuario no autenticado. Por favor, inicia sesión nuevamente.',
      );
    }

    console.log('[IAP] Verificando compra Apple:', {
      userId,
      productId: dto.productId,
      transactionId: dto.transactionId,
      hasJobPostDraftId: !!dto.jobPostDraftId,
    });

    try {
      // Verificar que el transactionId no haya sido usado (anti-replay)
      // PERO: Si existe pero el entitlement está en un estado inválido o no tiene job asociado,
      // permitir reprocesarlo
      const existing = await this.prisma.jobPostEntitlement.findUnique({
        where: { transactionId: dto.transactionId },
        include: {
          job: {
            select: { id: true },
          },
        },
      });

      if (existing) {
        // Verificar si el entitlement es válido (tiene un job válido)
        const jobExists = existing.job && existing.job.id;
        
        if (jobExists) {
          console.warn('[IAP] Transacción duplicada detectada con entitlement válido:', {
            transactionId: dto.transactionId,
            entitlementId: existing.id,
            jobId: existing.jobPostId,
          });
          throw new BadRequestException(
            'Esta transacción ya ha sido procesada (replay attack prevenido)',
          );
        } else {
          // El entitlement existe pero el job no existe (probablemente fue eliminado)
          // Eliminar el entitlement inválido y permitir reprocesar
          console.warn('[IAP] Transacción encontrada pero con job inválido, eliminando entitlement y reprocesando:', {
            transactionId: dto.transactionId,
            entitlementId: existing.id,
            jobId: existing.jobPostId,
          });
          
          await this.prisma.jobPostEntitlement.delete({
            where: { id: existing.id },
          });
          
          console.log('[IAP] Entitlement inválido eliminado, continuando con el procesamiento...');
        }
      }

      // Obtener planKey del productId
      console.log('[IAP] Obteniendo planKey para productId:', dto.productId);
      const planKey = await this.getPlanKeyFromProductId(dto.productId, 'IOS');
      console.log('[IAP] PlanKey obtenido:', planKey);

      // Obtener plan para configurar entitlement
      const plan = await this.prisma.plan.findUnique({
        where: { code: planKey },
      });

      if (!plan) {
        console.error('[IAP] Plan no encontrado:', planKey);
        throw new NotFoundException(`Plan no encontrado: ${planKey}`);
      }

      console.log('[IAP] Plan encontrado:', {
        code: plan.code,
        name: plan.name,
        durationDays: plan.durationDays,
      });

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

      // Si hay jobPostDraftId, verificar que existe y pertenece al usuario
      let jobPostId: string;
      if (dto.jobPostDraftId) {
        console.log('[IAP] Verificando draft de aviso:', dto.jobPostDraftId);
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
          console.error('[IAP] Draft no encontrado o no pertenece al usuario:', {
            jobPostDraftId: dto.jobPostDraftId,
            userId,
          });
          throw new NotFoundException('Draft de aviso no encontrado');
        }

        jobPostId = draft.id;
        console.log('[IAP] Draft verificado:', jobPostId);
      } else {
        // Si no hay jobPostDraftId, crear un job temporal/draft para asociar el entitlement
        // Este job será usado cuando el usuario publique un aviso
        console.log('[IAP] No hay draft, creando job temporal para el entitlement...');
        
        // Obtener el perfil de empresa del usuario
        const empresaProfile = await this.prisma.empresaProfile.findUnique({
          where: { userId },
        });

        if (!empresaProfile) {
          console.error('[IAP] Usuario no tiene perfil de empresa:', userId);
          throw new BadRequestException('Usuario no tiene perfil de empresa configurado');
        }

        // Crear un job temporal/draft con todos los campos requeridos
        console.log('[IAP] Creando job temporal con empresaId:', empresaProfile.id);
        try {
          const tempJob = await this.prisma.job.create({
            data: {
              empresaId: empresaProfile.id,
              title: 'Draft temporal - Pendiente de publicación',
              description: 'Este es un draft temporal creado para asociar un entitlement de compra IAP. Se actualizará cuando publiques un aviso.',
              requirements: 'Pendiente de completar',
              location: 'Pendiente de completar',
              jobType: 'TIEMPO_COMPLETO', // Valor por defecto
              category: 'General', // Valor por defecto
              experienceLevel: 'JUNIOR', // Valor por defecto
              status: 'draft', // Estado de draft
              moderationStatus: 'PENDING',
            },
          });

          jobPostId = tempJob.id;
          console.log('[IAP] ✅ Job temporal creado exitosamente:', jobPostId);
          
          // Verificar que el job existe antes de continuar
          const verifyJob = await this.prisma.job.findUnique({
            where: { id: jobPostId },
          });
          
          if (!verifyJob) {
            console.error('[IAP] ❌ ERROR: El job temporal no se encontró después de crearlo:', jobPostId);
            throw new InternalServerErrorException('Error al crear job temporal para el entitlement');
          }
          
          console.log('[IAP] ✅ Job temporal verificado:', verifyJob.id);
        } catch (error: any) {
          console.error('[IAP] ❌ Error al crear job temporal:', {
            message: error?.message,
            code: error?.code,
            meta: error?.meta,
            empresaId: empresaProfile.id,
            userId,
          });
          throw new InternalServerErrorException(
            `Error al crear job temporal: ${error?.message || 'Error desconocido'}`
          );
        }
      }

      // Verificar que el jobPostId existe antes de crear el entitlement
      console.log('[IAP] Verificando que jobPostId existe antes de crear entitlement:', jobPostId);
      const verifyJobExists = await this.prisma.job.findUnique({
        where: { id: jobPostId },
        select: { id: true },
      });

      if (!verifyJobExists) {
        console.error('[IAP] ❌ ERROR CRÍTICO: El jobPostId no existe en la base de datos:', jobPostId);
        throw new InternalServerErrorException(
          `El job con id ${jobPostId} no existe en la base de datos. No se puede crear el entitlement.`
        );
      }

      console.log('[IAP] ✅ Job verificado, existe en la base de datos:', verifyJobExists.id);

      // Crear entitlement
      console.log('[IAP] Creando entitlement con jobPostId:', jobPostId);
      let entitlement;
      try {
        entitlement = await this.prisma.jobPostEntitlement.create({
          data: {
            userId,
            jobPostId: jobPostId, // Ahora siempre tiene un valor válido
            source: 'APPLE_IAP',
            planKey,
            expiresAt,
            status: 'ACTIVE',
            maxEdits: plan.allowedModifications,
            editsUsed: 0,
            allowCategoryChange: plan.canModifyCategory,
            maxCategoryChanges: plan.categoryModifications || 0,
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

        console.log('[IAP] ✅ Entitlement creado exitosamente:', entitlement.id);
      } catch (createError: any) {
        console.error('[IAP] ❌ Error al crear entitlement:', {
          message: createError?.message,
          code: createError?.code,
          meta: createError?.meta,
          jobPostId,
          userId,
          planKey,
        });
        
        // Si el error es de foreign key, dar un mensaje más específico
        if (createError?.code === 'P2003' || createError?.message?.includes('Foreign key constraint')) {
          throw new InternalServerErrorException(
            `Error de foreign key: El job con id ${jobPostId} no existe en la base de datos. ` +
            `Esto puede ocurrir si el job fue eliminado o no se creó correctamente.`
          );
        }
        
        throw createError;
      }

      return {
        ok: true,
        entitlement,
        expiresAt,
      };
    } catch (error: any) {
      // Si es una excepción de NestJS (BadRequestException, NotFoundException, etc.), relanzarla
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        console.error('[IAP] Error de validación:', error.message);
        throw error;
      }

      // Para otros errores, loguear y lanzar InternalServerErrorException con detalles
      console.error('[IAP] Error inesperado al verificar compra Apple:', {
        message: error?.message,
        stack: error?.stack,
        userId,
        productId: dto.productId,
        transactionId: dto.transactionId,
        errorName: error?.name,
        errorCode: error?.code,
      });

      throw new InternalServerErrorException(
        `Error al procesar la compra: ${error?.message || 'Error desconocido'}`,
      );
    }
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
        maxCategoryChanges: plan.categoryModifications || 0,
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

  /**
   * Lista productos IAP para admin (con paginación)
   */
  async listIapProductsAdmin(
    page: number,
    pageSize: number,
    planKey?: string,
    platform?: 'IOS' | 'ANDROID',
  ) {
    const skip = (page - 1) * pageSize;
    const where: any = {};

    if (planKey) {
      where.planKey = planKey;
    }
    if (platform) {
      where.platform = platform;
    }

    const [items, total] = await Promise.all([
      this.prisma.iapProduct.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          plan: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        orderBy: [{ platform: 'asc' }, { productId: 'asc' }],
      }),
      this.prisma.iapProduct.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Obtiene producto IAP por ID
   */
  async getIapProductById(id: string) {
    const product = await this.prisma.iapProduct.findUnique({
      where: { id },
      include: {
        plan: true,
      },
    });

    if (!product) {
      throw new NotFoundException(`Producto IAP con id ${id} no encontrado`);
    }

    return product;
  }

  /**
   * Crea un producto IAP
   */
  async createIapProduct(dto: {
    productId: string;
    platform: 'IOS' | 'ANDROID';
    planKey: string;
    active?: boolean;
  }) {
    // Verificar que el plan existe
    const plan = await this.prisma.plan.findUnique({
      where: { code: dto.planKey },
    });

    if (!plan) {
      throw new NotFoundException(`Plan con código ${dto.planKey} no encontrado`);
    }

    // Verificar que no exista ya
    const existing = await this.prisma.iapProduct.findUnique({
      where: {
        productId_platform: {
          productId: dto.productId,
          platform: dto.platform,
        },
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Ya existe un producto IAP con productId ${dto.productId} para plataforma ${dto.platform}`,
      );
    }

    return this.prisma.iapProduct.create({
      data: {
        productId: dto.productId,
        platform: dto.platform,
        planKey: dto.planKey,
        active: dto.active ?? true,
      },
      include: {
        plan: true,
      },
    });
  }

  /**
   * Actualiza un producto IAP
   */
  async updateIapProduct(id: string, dto: { active?: boolean }) {
    const product = await this.getIapProductById(id);

    return this.prisma.iapProduct.update({
      where: { id },
      data: dto,
      include: {
        plan: true,
      },
    });
  }

  /**
   * Elimina un producto IAP
   */
  async deleteIapProduct(id: string) {
    await this.getIapProductById(id);

    return this.prisma.iapProduct.delete({
      where: { id },
    });
  }
}

