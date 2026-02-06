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
      // Obtener el jobPostId primero para verificar si la transacción ya fue usada para ESTA publicación
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
        // NUEVO FLUJO: No se permite comprar un plan sin una publicación asociada
        // El usuario debe crear primero la publicación y luego comprar el plan
        console.error('[IAP] ❌ Intento de compra sin jobPostDraftId');
        throw new BadRequestException(
          'No se puede comprar un plan sin una publicación asociada. ' +
          'Por favor, crea primero una publicación y luego selecciona un plan.'
        );
      }

      // Verificar que el transactionId no haya sido usado para ESTA publicación específica (anti-replay)
      // NOTA: Con productos consumibles, cada compra genera una nueva transacción única
      // Por lo tanto, no deberíamos tener el problema de transacciones duplicadas
      // PERO: Mantenemos la verificación por seguridad (anti-replay attack)
      const existingForThisJob = await this.prisma.jobPostEntitlement.findFirst({
        where: {
          transactionId: dto.transactionId,
          jobPostId: jobPostId,
        },
        include: {
          job: {
            select: { id: true },
          },
        },
      });

      if (existingForThisJob) {
        // Verificar si el entitlement es válido (tiene un job válido)
        const jobExists = existingForThisJob.job && existingForThisJob.job.id;
        
        if (jobExists) {
          console.warn('[IAP] Transacción duplicada detectada para esta publicación:', {
            transactionId: dto.transactionId,
            entitlementId: existingForThisJob.id,
            jobId: existingForThisJob.jobPostId,
          });
          throw new BadRequestException(
            'Esta transacción ya ha sido procesada para esta publicación (replay attack prevenido)',
          );
        } else {
          // El entitlement existe pero el job no existe (probablemente fue eliminado)
          // Eliminar el entitlement inválido y permitir reprocesar
          console.warn('[IAP] Transacción encontrada pero con job inválido, eliminando entitlement y reprocesando:', {
            transactionId: dto.transactionId,
            entitlementId: existingForThisJob.id,
            jobId: existingForThisJob.jobPostId,
          });
          
          await this.prisma.jobPostEntitlement.delete({
            where: { id: existingForThisJob.id },
          });
          
          console.log('[IAP] Entitlement inválido eliminado, continuando con el procesamiento...');
        }
      } else {
        // La transacción no fue usada para esta publicación
        // Verificar si fue usada para otra publicación (esto es válido y permitido)
        const existingForOtherJob = await this.prisma.jobPostEntitlement.findFirst({
          where: {
            transactionId: dto.transactionId,
            jobPostId: { not: jobPostId },
          },
        });

        if (existingForOtherJob) {
          console.log('[IAP] Transacción ya usada para otra publicación, pero permitida para esta nueva publicación:', {
            transactionId: dto.transactionId,
            previousJobId: existingForOtherJob.jobPostId,
            newJobId: jobPostId,
          });
          // Esto es válido: la misma transacción puede usarse para múltiples publicaciones
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

      // jobPostId ya fue obtenido arriba durante la verificación de replay attack

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
        
        // Actualizar el estado del job después de crear el entitlement exitosamente
        // La publicación se aprueba inmediatamente para que sea visible, pero estará bajo revisión 48-72hs
        try {
          await this.prisma.job.update({
            where: { id: jobPostId },
            data: {
              moderationStatus: 'APPROVED',
              paymentStatus: 'PAID',
              paidAt: new Date(),
              isPaid: true,
              status: 'active',
              publishedAt: new Date(), // Actualizar fecha de publicación al momento del pago
            },
          });
          console.log('[IAP] ✅ Estado del job actualizado a PAID y APPROVED (publicado, bajo revisión 48-72hs)');
        } catch (updateError: any) {
          console.error('[IAP] ⚠️ Error al actualizar estado del job (no crítico):', updateError?.message);
          // No lanzar error, el entitlement ya fue creado
        }
      } catch (createError: any) {
        console.error('[IAP] ❌ Error al crear entitlement:', {
          message: createError?.message,
          code: createError?.code,
          meta: createError?.meta,
          jobPostId,
          userId,
          planKey,
          transactionId: dto.transactionId,
        });
        
        // Si el error es de unique constraint en transactionId, verificar si realmente existe
        if (
          createError?.code === 'P2002' && 
          createError?.meta?.target?.includes('transactionId')
        ) {
          console.error('[IAP] ⚠️ Error de constraint único en transactionId detectado');
          console.error('[IAP] Verificando si el constraint realmente existe en la BD...');
          
          try {
            // Verificar si existe un entitlement con esta transacción para este job específico
            const existingForThisJob = await this.prisma.jobPostEntitlement.findFirst({
              where: {
                transactionId: dto.transactionId,
                jobPostId: jobPostId,
              },
            });
            
            if (existingForThisJob) {
              console.error('[IAP] ⚠️ Entitlement existente encontrado para esta transacción y este job:', existingForThisJob.id);
              throw new BadRequestException(
                'Esta transacción ya ha sido procesada para esta publicación (replay attack prevenido)',
              );
            }
            
            // Verificar si existe para otro job (esto es válido)
            const existingForOtherJob = await this.prisma.jobPostEntitlement.findFirst({
              where: {
                transactionId: dto.transactionId,
                jobPostId: { not: jobPostId },
              },
            });
            
            if (existingForOtherJob) {
              console.log('[IAP] ✅ Transacción ya usada para otro job, pero esto es válido.');
              console.error('[IAP] ⚠️ ERROR: El constraint único de transactionId todavía existe en la base de datos.');
              console.error('[IAP] ⚠️ Intentando eliminar el constraint automáticamente...');
              
              try {
                // Intentar eliminar el constraint o índice único automáticamente
                // Primero intentar como constraint
                try {
                  await this.prisma.$executeRawUnsafe(`
                    ALTER TABLE "JobPostEntitlement" 
                    DROP CONSTRAINT IF EXISTS "JobPostEntitlement_transactionId_key";
                  `);
                  console.log('[IAP] ✅ Constraint eliminado exitosamente');
                } catch (constraintError: any) {
                  // Si falla como constraint, intentar como índice único
                  console.log('[IAP] Intentando eliminar como índice único...');
                  try {
                    await this.prisma.$executeRawUnsafe(`
                      DROP INDEX IF EXISTS "JobPostEntitlement_transactionId_key";
                    `);
                    console.log('[IAP] ✅ Índice único eliminado exitosamente');
                  } catch (indexError: any) {
                    // Si ambos fallan, verificar si realmente existe
                    console.log('[IAP] Verificando si el constraint/índice realmente existe...');
                    const constraintExists = await this.prisma.$queryRawUnsafe<Array<{conname: string}>>(`
                      SELECT conname 
                      FROM pg_constraint 
                      WHERE conname = 'JobPostEntitlement_transactionId_key'
                      UNION ALL
                      SELECT indexname::text as conname
                      FROM pg_indexes 
                      WHERE indexname = 'JobPostEntitlement_transactionId_key';
                    `);
                    
                    if (constraintExists && constraintExists.length > 0) {
                      // Intentar con el nombre exacto encontrado
                      for (const constraint of constraintExists) {
                        try {
                          await this.prisma.$executeRawUnsafe(`
                            ALTER TABLE "JobPostEntitlement" 
                            DROP CONSTRAINT IF EXISTS "${constraint.conname}";
                          `);
                          console.log(`[IAP] ✅ Constraint ${constraint.conname} eliminado`);
                        } catch (e) {
                          try {
                            await this.prisma.$executeRawUnsafe(`
                              DROP INDEX IF EXISTS "${constraint.conname}";
                            `);
                            console.log(`[IAP] ✅ Índice ${constraint.conname} eliminado`);
                          } catch (e2) {
                            console.error(`[IAP] ⚠️ No se pudo eliminar ${constraint.conname}`);
                          }
                        }
                      }
                    }
                  }
                }
                
                console.log('[IAP] Reintentando crear entitlement...');
                
                // Reintentar crear el entitlement
                entitlement = await this.prisma.jobPostEntitlement.create({
                  data: {
                    userId,
                    jobPostId: jobPostId,
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
                    originalTransactionId: dto.transactionId,
                    rawPayload: {
                      productId: dto.productId,
                      signedTransactionInfo: dto.signedTransactionInfo,
                      signedRenewalInfo: dto.signedRenewalInfo,
                    },
                  },
                });
                
                console.log('[IAP] ✅ Entitlement creado exitosamente después de eliminar constraint:', entitlement.id);
                
                // Actualizar el estado del job
                // La publicación se aprueba inmediatamente para que sea visible, pero estará bajo revisión 48-72hs
                try {
                  await this.prisma.job.update({
                    where: { id: jobPostId },
                    data: {
                      moderationStatus: 'APPROVED',
                      paymentStatus: 'PAID',
                      paidAt: new Date(),
                      isPaid: true,
                      status: 'active',
                      publishedAt: new Date(),
                    },
                  });
                  console.log('[IAP] ✅ Estado del job actualizado a PAID y APPROVED (publicado, bajo revisión 48-72hs)');
                } catch (updateError: any) {
                  console.error('[IAP] ⚠️ Error al actualizar estado del job (no crítico):', updateError?.message);
                }
                
                // Salir del catch y retornar el entitlement
                return {
                  ok: true,
                  entitlement,
                  expiresAt,
                };
              } catch (dropError: any) {
                console.error('[IAP] ❌ Error al eliminar constraint automáticamente:', dropError?.message);
                console.error('[IAP] ❌ Stack:', dropError?.stack);
                throw new InternalServerErrorException(
                  `Error al crear entitlement: El constraint único de transactionId todavía existe en la base de datos. ` +
                  `Por favor, ejecuta la migración manualmente: ` +
                  `ALTER TABLE "JobPostEntitlement" DROP CONSTRAINT IF EXISTS "JobPostEntitlement_transactionId_key"; ` +
                  `DROP INDEX IF EXISTS "JobPostEntitlement_transactionId_key";`
                );
              }
            }
          } catch (checkError: any) {
            console.error('[IAP] Error al verificar entitlements existentes:', checkError);
          }
          
          throw new InternalServerErrorException(
            `Error al crear entitlement: El constraint único de transactionId todavía existe en la base de datos. ` +
            `Por favor, ejecuta la migración para eliminarlo: ` +
            `ALTER TABLE "JobPostEntitlement" DROP CONSTRAINT IF EXISTS "JobPostEntitlement_transactionId_key";`
          );
        }
        
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
    // Obtener el jobPostId primero para verificar si el purchaseToken ya fue usada para ESTA publicación
    let jobPostId: string;
    if (dto.jobPostDraftId) {
      console.log('[IAP] Verificando draft de aviso (Google):', dto.jobPostDraftId);
      const draft = await this.prisma.job.findFirst({
        where: {
          id: dto.jobPostDraftId,
          empresa: {
            userId,
          },
        },
      });

      if (!draft) {
        console.error('[IAP] Draft no encontrado o no pertenece al usuario (Google):', {
          jobPostDraftId: dto.jobPostDraftId,
          userId,
        });
        throw new NotFoundException('Draft de aviso no encontrado');
      }

      jobPostId = draft.id;
      console.log('[IAP] Draft verificado (Google):', jobPostId);
    } else {
      // NUEVO FLUJO: No se permite comprar un plan sin una publicación asociada
      console.error('[IAP] ❌ Intento de compra sin jobPostDraftId (Google)');
      throw new BadRequestException(
        'No se puede comprar un plan sin una publicación asociada. ' +
        'Por favor, crea primero una publicación y luego selecciona un plan.'
      );
    }

    // Verificar que el purchaseToken no haya sido usado para ESTA publicación específica (anti-replay)
    // PERO: Permitir que el mismo purchaseToken se use para DIFERENTES publicaciones
    const existingForThisJob = await this.prisma.jobPostEntitlement.findFirst({
      where: {
        jobPostId: jobPostId,
        rawPayload: {
          path: ['purchaseToken'],
          equals: dto.purchaseToken,
        },
      },
    });

    if (existingForThisJob) {
      console.warn('[IAP] Purchase token duplicado detectado para esta publicación (Google):', {
        purchaseToken: dto.purchaseToken,
        entitlementId: existingForThisJob.id,
        jobId: existingForThisJob.jobPostId,
      });
      throw new BadRequestException(
        'Este purchase token ya ha sido procesado para esta publicación (replay attack prevenido)',
      );
    } else {
      // El purchaseToken no fue usado para esta publicación
      // Verificar si fue usado para otra publicación (esto es válido y permitido)
      const existingForOtherJob = await this.prisma.jobPostEntitlement.findFirst({
        where: {
          jobPostId: { not: jobPostId },
          rawPayload: {
            path: ['purchaseToken'],
            equals: dto.purchaseToken,
          },
        },
      });

      if (existingForOtherJob) {
        console.log('[IAP] Purchase token ya usado para otra publicación, pero permitido para esta nueva publicación (Google):', {
          purchaseToken: dto.purchaseToken,
          previousJobId: existingForOtherJob.jobPostId,
          newJobId: jobPostId,
        });
        // Esto es válido: el mismo purchaseToken puede usarse para múltiples publicaciones
      }
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

    // Verificar que el jobPostId existe antes de crear el entitlement
    console.log('[IAP] Verificando que jobPostId existe antes de crear entitlement (Google):', jobPostId);
    const verifyJobExists = await this.prisma.job.findUnique({
      where: { id: jobPostId },
      select: { id: true },
    });

    if (!verifyJobExists) {
      console.error('[IAP] ❌ ERROR CRÍTICO: El jobPostId no existe en la base de datos (Google):', jobPostId);
      throw new InternalServerErrorException(
        `El job con id ${jobPostId} no existe en la base de datos. No se puede crear el entitlement.`
      );
    }

    console.log('[IAP] ✅ Job verificado, existe en la base de datos (Google):', verifyJobExists.id);

    // Crear entitlement
    console.log('[IAP] Creando entitlement con jobPostId (Google):', jobPostId);
    const entitlement = await this.prisma.jobPostEntitlement.create({
      data: {
        userId,
        jobPostId: jobPostId, // Ahora siempre tiene un valor válido
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

    console.log('[IAP] ✅ Entitlement creado exitosamente (Google):', entitlement.id);

    // Actualizar el estado del job después de crear el entitlement exitosamente
    // La publicación se aprueba inmediatamente para que sea visible, pero estará bajo revisión 48-72hs
    try {
      await this.prisma.job.update({
        where: { id: jobPostId },
        data: {
          moderationStatus: 'APPROVED',
          paymentStatus: 'PAID',
          paidAt: new Date(),
          isPaid: true,
          status: 'active',
          publishedAt: new Date(),
        },
      });
      console.log('[IAP] ✅ Estado del job actualizado a PAID y APPROVED (publicado, bajo revisión 48-72hs) (Google)');
    } catch (updateError: any) {
      console.error('[IAP] ⚠️ Error al actualizar estado del job (no crítico):', updateError?.message);
      // No lanzar error, el entitlement ya fue creado
    }

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

