import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { ContentModerationService } from "../common/services/content-moderation.service";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";
import { PaymentsService } from "../payments/payments.service";
import { GcpCdnService } from "../upload/gcp-cdn.service";
import { GCSUploadService } from "../upload/gcs-upload.service";
import { PromotionsService } from "../promotions/promotions.service";
import { MailService } from "../mail/mail.service";
// import { I18nService } from "nestjs-i18n"; // Temporalmente deshabilitado

@Injectable()
export class EmpresasService {
  constructor(
    private prisma: PrismaService,
    private contentModeration: ContentModerationService,
    private subscriptionsService: SubscriptionsService,
    private paymentsService: PaymentsService,
    private gcpCdnService: GcpCdnService,
    private gcsUploadService: GCSUploadService,
    private configService: ConfigService,
    private promotionsService: PromotionsService,
    private mailService: MailService
  ) {}

  async getByUser(userId: string) {
    const profile = await this.prisma.empresaProfile.findUnique({
      where: { userId },
      include: {
        jobs: {
          include: {
            _count: {
              select: { applications: true },
            },
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException("Mensaje de error");
    }

    // Transformar el logo key en una URL válida (CloudFront o S3 directo)
    if (profile.logo && !profile.logo.startsWith("http")) {
      try {
        // Usar GCP CDN si está configurado, si no usar URL firmada
        if (this.gcpCdnService.isCdnConfigured()) {
          profile.logo = await this.gcpCdnService.getCdnUrl(profile.logo);
        } else {
          profile.logo = await this.gcsUploadService.getObjectUrl(
            profile.logo,
            3600
          );
        }
      } catch (error) {
        console.error("Error generando URL para logo:", error);
        // Si falla, mantener el key original para que el frontend pueda intentar construirla
      }
    }

    return profile;
  }

  /**
   * Buscar empresas (endpoint público)
   */
  async search(query: any) {
    const where: any = {
      AND: [],
    };

    // Búsqueda por nombre de empresa, industria o sector
    if (query.q) {
      where.AND.push({
        OR: [
          { companyName: { contains: query.q, mode: "insensitive" as any } },
          { industria: { contains: query.q, mode: "insensitive" as any } },
          { sector: { contains: query.q, mode: "insensitive" as any } },
        ],
      });
    }

    // Búsqueda por ubicación
    if (query.location) {
      where.AND.push({
        OR: [
          { ciudad: { contains: query.location, mode: "insensitive" as any } },
          { provincia: { contains: query.location, mode: "insensitive" as any } },
          { pais: { contains: query.location, mode: "insensitive" as any } },
        ],
      });
    }

    // Si no hay condiciones, usar objeto vacío para obtener todas las empresas
    if (where.AND.length === 0) {
      delete where.AND;
    }

    const page = Number(query.page || 1);
    const pageSize = Number(query.pageSize || 20);
    const skip = (page - 1) * pageSize;

    const [empresas, total] = await Promise.all([
      this.prisma.empresaProfile.findMany({
        where,
        skip,
        take: pageSize,
        select: {
          id: true,
          companyName: true,
          ciudad: true,
          provincia: true,
          pais: true,
          logo: true,
          descripcion: true,
          sector: true,
          industria: true,
          sitioWeb: true,
          email: true,
          phone: true,
          phoneCountryCode: true,
        },
        orderBy: { companyName: "asc" },
      }),
      this.prisma.empresaProfile.count({ where }),
    ]);

    // Log para verificar qué devuelve Prisma directamente
    console.log(`[EmpresasService] Empresas obtenidas de Prisma: ${empresas.length}`);
    if (empresas.length > 0) {
      console.log(`[EmpresasService] Primera empresa (antes de procesar logos):`, {
        id: empresas[0].id,
        companyName: empresas[0].companyName,
        logo: empresas[0].logo,
        logoType: typeof empresas[0].logo,
        hasLogo: !!empresas[0].logo,
      });
    }

    // Transformar logos a URLs
    const empresasWithUrls = await Promise.all(
      empresas.map(async (empresa) => {
        if (empresa.logo && !empresa.logo.startsWith("http")) {
          try {
            if (this.gcpCdnService.isCdnConfigured()) {
              empresa.logo = await this.gcpCdnService.getCdnUrl(empresa.logo);
            } else {
              empresa.logo = await this.gcsUploadService.getObjectUrl(empresa.logo, 3600);
            }
          } catch (error) {
            console.error("Error generando URL para logo:", error);
          }
        }
        return empresa;
      })
    );

    return {
      data: empresasWithUrls,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async updateByUser(userId: string, dto: any) {
    const profile = await this.prisma.empresaProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException("Mensaje de error");
    }

    // Preparar datos de actualización, mapeando campos si es necesario
    const updateData: any = { ...dto };

    // Si se actualiza documento, también actualizar cuit
    if (updateData.documento && !updateData.cuit) {
      updateData.cuit = updateData.documento;
    }
    if (updateData.cuit && !updateData.documento) {
      updateData.documento = updateData.cuit;
    }

    // industria y sector son campos independientes, no se sincronizan
    // Si se actualiza cantidadEmpleados, también actualizar tamano
    if (updateData.cantidadEmpleados && !updateData.tamano) {
      updateData.tamano = updateData.cantidadEmpleados;
    }
    if (updateData.tamano && !updateData.cantidadEmpleados) {
      updateData.cantidadEmpleados = updateData.tamano;
    }

    // Mapear telefono y phoneCountryCode por separado
    if (updateData.telefono !== undefined) {
      // Guardar solo el número de teléfono sin código de país
      updateData.phone = updateData.telefono.trim() || undefined;
      delete updateData.telefono; // Eliminar telefono ya que usamos phone
    }
    
    // Mapear phoneCountryCode si viene
    if (updateData.phoneCountryCode !== undefined) {
      updateData.phoneCountryCode = updateData.phoneCountryCode.trim() || undefined;
    }

    return this.prisma.empresaProfile.update({
      where: { userId },
      data: updateData,
    });
  }

  async createJob(userId: string, dto: any) {
    const profile = await this.prisma.empresaProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException("Mensaje de error");
    }

    // Verificar si se está usando el plan LAUNCH_TRIAL
    const planKey = dto.planKey || dto.plan_key;
    const isLaunchTrial = planKey === "LAUNCH_TRIAL";

    if (isLaunchTrial) {
      // Validar que la promoción esté CLAIMED y no USED
      const promotion = await this.promotionsService.getClaimedPromotion(userId);
      
      if (!promotion || promotion.status !== "CLAIMED") {
        throw new BadRequestException(
          "Debes reclamar la promoción de lanzamiento antes de publicar"
        );
      }

      // Aplicar filtro automático de moderación
      const moderationResult = this.contentModeration.analyzeJobContent({
        title: dto.title || "",
        description: dto.description || "",
        requirements: dto.requirements || "",
      });

      let moderationStatus = "PENDING";
      let status = "inactive";
      let autoRejectionReason = null;

      if (!moderationResult.isApproved) {
        moderationStatus = "AUTO_REJECTED";
        status = "inactive";
        autoRejectionReason = moderationResult.reasons.join(". ");
      } else {
        moderationStatus = "PENDING";
        status = "inactive";
      }

      // Asegurar que el título original se preserve siempre
      if (!dto.title || dto.title.trim() === '') {
        throw new BadRequestException("El título del empleo es requerido");
      }
      
      // Crear el aviso
      const publishedAt = new Date();
      const expiresAt = new Date(publishedAt);
      expiresAt.setDate(expiresAt.getDate() + 4); // 4 días desde publicación

      // Filtrar planId ya que no existe en el modelo Job (se maneja con JobPostEntitlement)
      const { planId, ...jobData } = dto;
      
      const job = await this.prisma.job.create({
        data: {
          ...jobData,
          title: dto.title.trim(), // Asegurar que el título original se preserve
          empresaId: profile.id,
          moderationStatus: moderationStatus as any,
          status: status,
          autoRejectionReason: autoRejectionReason,
          isPaid: true,
          paymentStatus: "COMPLETED",
          publishedAt: publishedAt,
        },
      });

      // Crear entitlement
      await this.prisma.jobPostEntitlement.create({
        data: {
          userId: userId,
          jobPostId: job.id,
          source: "PROMO",
          planKey: "LAUNCH_TRIAL",
          expiresAt: expiresAt,
          status: "ACTIVE",
          maxEdits: 0,
          editsUsed: 0,
          allowCategoryChange: false,
          maxCategoryChanges: 0,
          categoryChangesUsed: 0,
          rawPayload: {
            promo_key: "LAUNCH_TRIAL_4D",
            claimed_at: promotion.claimedAt,
          },
        },
      });

      // Marcar promoción como USED
      await this.promotionsService.useLaunchTrial(userId, job.id);

      return job;
    }

    // Flujo normal (sin trial)
    // Verificar si la empresa tiene una suscripción activa y su plan
    const activeSubscription =
      await this.subscriptionsService.getActiveSubscription(profile.id);

    // Precio por publicación (configurable)
    const jobPublicationPrice = parseFloat(
      process.env.JOB_PUBLICATION_PRICE || "10.00"
    );

    // Por ahora, TODOS los planes requieren pago por publicación
    // En el futuro, planes PREMIUM/ENTERPRISE podrían incluir publicaciones gratis
    // Los planes solo controlan límites de cantidad, no eximen del pago

    // Verificar si el plan incluye publicaciones gratis
    const planIncludesFreeJobs =
      activeSubscription?.planType === "PREMIUM" ||
      activeSubscription?.planType === "ENTERPRISE";

    // Si NO incluye publicaciones gratis, requiere pago
    if (!planIncludesFreeJobs) {
      // Asegurar que el título original se preserve siempre
      // Si el título viene vacío o no viene, no crear el job (debe fallar la validación)
      if (!dto.title || dto.title.trim() === '') {
        throw new BadRequestException("El título del empleo es requerido");
      }
      
      // Filtrar planId ya que no existe en el modelo Job (se maneja con JobPostEntitlement)
      const { planId, ...jobData } = dto;
      
      return this.prisma.job.create({
        data: {
          ...jobData,
          title: dto.title.trim(), // Asegurar que el título original se preserve
          empresaId: profile.id,
          moderationStatus: "PENDING_PAYMENT" as any,
          status: "inactive",
          isPaid: false,
          paymentStatus: "PENDING",
          paymentAmount: jobPublicationPrice,
          paymentCurrency: "USD",
        },
      });
    }

    // Si el plan incluye publicaciones gratis (PREMIUM/ENTERPRISE), pasa directo a moderación automática
    // Aplicar filtro automático de moderación
    const moderationResult = this.contentModeration.analyzeJobContent({
      title: dto.title || "",
      description: dto.description || "",
      requirements: dto.requirements || "",
    });

    // Determinar el estado de moderación y status basado en el resultado
    let moderationStatus = "PENDING";
    let status = "inactive"; // Por defecto inactivo hasta aprobación manual
    let autoRejectionReason = null;

    if (!moderationResult.isApproved) {
      // Si no pasa la revisión automática, rechazar automáticamente
      moderationStatus = "AUTO_REJECTED";
      status = "inactive";
      // Combinar todas las razones en un mensaje
      autoRejectionReason = moderationResult.reasons.join(". ");
    } else if (moderationResult.needsManualReview) {
      // Si necesita revisión manual (score >= 30 y < 50), va a PENDING
      moderationStatus = "PENDING";
      status = "inactive";
    } else {
      // Si pasa completamente (score < 30), aún así va a PENDING para revisión manual
      moderationStatus = "PENDING";
      status = "inactive";
    }

    // Asegurar que el título original se preserve siempre
    if (!dto.title || dto.title.trim() === '') {
      throw new BadRequestException("El título del empleo es requerido");
    }
    
    // Filtrar planId ya que no existe en el modelo Job (se maneja con JobPostEntitlement)
    const { planId, ...jobData } = dto;
    
    return this.prisma.job.create({
      data: {
        ...jobData,
        title: dto.title.trim(), // Asegurar que el título original se preserve
        empresaId: profile.id,
        moderationStatus: moderationStatus as any,
        status: status,
        autoRejectionReason: autoRejectionReason,
        isPaid: true, // Con suscripción activa se considera pagado
        paymentStatus: "COMPLETED",
      },
    });
  }

  async getJobs(userId: string) {
    const profile = await this.prisma.empresaProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException("Mensaje de error");
    }

    return this.prisma.job.findMany({
      where: { empresaId: profile.id },
      orderBy: { publishedAt: "desc" },
      include: {
        _count: {
          select: { applications: true },
        },
        entitlements: {
          where: {
            status: 'ACTIVE',
          },
          take: 1,
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });
  }

  async updateJob(userId: string, jobId: string, dto: any) {
    const profile = await this.prisma.empresaProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException("Mensaje de error");
    }

    const job = await this.prisma.job.findFirst({
      where: { id: jobId, empresaId: profile.id },
    });

    if (!job) {
      throw new NotFoundException("Mensaje de error");
    }

    // Verificar si hay cambios reales (excluyendo campos que no cuentan como modificación)
    const hasChanges =
      (dto.title && dto.title !== job.title) ||
      (dto.description && dto.description !== job.description) ||
      (dto.requirements && dto.requirements !== job.requirements) ||
      (dto.benefits !== undefined && dto.benefits !== job.benefits) ||
      (dto.location !== undefined && dto.location !== job.location) ||
      (dto.city !== undefined && dto.city !== job.city) ||
      (dto.state !== undefined && dto.state !== job.state) ||
      (dto.jobType !== undefined && dto.jobType !== job.jobType) ||
      (dto.workMode !== undefined && dto.workMode !== job.workMode) ||
      (dto.minSalary !== undefined && dto.minSalary !== job.minSalary) ||
      (dto.maxSalary !== undefined && dto.maxSalary !== job.maxSalary);

    // Si hay cambios, incrementar el contador de modificaciones
    if (hasChanges) {
      // Buscar el entitlement activo para este job
      const activeEntitlement = await this.prisma.jobPostEntitlement.findFirst({
        where: {
          jobPostId: jobId,
          status: "ACTIVE",
        },
      });

      if (activeEntitlement) {
        // Solo verificar límite si maxEdits > 0 (si es 0, son modificaciones ilimitadas)
        if (activeEntitlement.maxEdits > 0) {
          const editsUsed = activeEntitlement.editsUsed || 0;
          if (editsUsed >= activeEntitlement.maxEdits) {
            throw new BadRequestException(
              "Has alcanzado el límite de modificaciones permitidas para este empleo."
            );
          }

          // Incrementar el contador de modificaciones solo si hay límite
          await this.prisma.jobPostEntitlement.update({
            where: { id: activeEntitlement.id },
            data: {
              editsUsed: editsUsed + 1,
            },
          });
        }
        // Si maxEdits es 0, no incrementamos el contador (modificaciones ilimitadas)
      }
    }

    // Si se actualizan campos de contenido, aplicar moderación automática nuevamente
    const contentChanged =
      (dto.title && dto.title !== job.title) ||
      (dto.description && dto.description !== job.description) ||
      (dto.requirements && dto.requirements !== job.requirements);

    if (contentChanged) {
      const moderationResult = this.contentModeration.analyzeJobContent({
        title: dto.title || job.title || "",
        description: dto.description || job.description || "",
        requirements: dto.requirements || job.requirements || "",
      });

      // Si no pasa la moderación automática, rechazar
      if (!moderationResult.isApproved) {
        dto.moderationStatus = "AUTO_REJECTED";
        dto.status = "inactive";
        dto.autoRejectionReason = moderationResult.reasons.join(". ");
        // Limpiar campos de moderación manual si estaban aprobados
        dto.moderatedBy = null;
        dto.moderatedAt = null;
        dto.moderationReason = null;
      } else {
        // Si pasa la moderación automática, volver a estado PENDING para revisión manual
        dto.moderationStatus = "PENDING";
        dto.status = "inactive";
        dto.autoRejectionReason = null;
        // Limpiar campos de moderación manual
        dto.moderatedBy = null;
        dto.moderatedAt = null;
        dto.moderationReason = null;
      }
    }

    // Remover campos que no existen en el modelo Prisma
    const { ciudad, provincia, ...cleanDto } = dto;

    return this.prisma.job.update({
      where: { id: jobId },
      data: cleanDto,
      include: {
        entitlements: {
          where: { status: "ACTIVE" },
        },
      },
    });
  }

  async deleteJob(userId: string, jobId: string) {
    const profile = await this.prisma.empresaProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException("Mensaje de error");
    }

    const job = await this.prisma.job.findFirst({
      where: { id: jobId, empresaId: profile.id },
    });

    if (!job) {
      throw new NotFoundException("Mensaje de error");
    }

    return this.prisma.job.delete({ where: { id: jobId } });
  }

  async getJobApplicants(userId: string, jobId: string) {
    const profile = await this.prisma.empresaProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException("Mensaje de error");
    }

    const job = await this.prisma.job.findFirst({
      where: { id: jobId, empresaId: profile.id },
    });

    if (!job) {
      throw new NotFoundException("Mensaje de error");
    }

    const applications = await this.prisma.application.findMany({
      where: { jobId },
      orderBy: { appliedAt: "desc" },
      include: {
        postulante: {
          include: {
            user: {
              select: {
                email: true,
              },
            },
            experiences: true,
            education: true,
          },
        },
        job: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    // Transformar avatares de postulantes a URLs completas
    const applicationsWithUrls = await Promise.all(
      applications.map(async (application) => {
        if (application.postulante?.profilePicture) {
          const profilePicture = application.postulante.profilePicture;
          let avatarUrl = profilePicture;
          
          if (!profilePicture.startsWith("http")) {
            try {
              if (this.gcpCdnService.isCdnConfigured()) {
                avatarUrl = await this.gcpCdnService.getCdnUrl(profilePicture);
              } else {
                avatarUrl = await this.gcsUploadService.getObjectUrl(profilePicture, 3600);
              }
            } catch (error) {
              console.error("Error generando URL para avatar de postulante:", error);
            }
          }
          
          // Actualizar tanto profilePicture como avatar para compatibilidad
          application.postulante.profilePicture = avatarUrl;
          (application.postulante as any).avatar = avatarUrl;
        }
        return application;
      })
    );

    return applicationsWithUrls;
  }

  async updateApplicationStatus(
    userId: string,
    applicationId: string,
    status: string,
    notes?: string
  ) {
    const profile = await this.prisma.empresaProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException("Mensaje de error");
    }

    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: { job: true },
    });

    if (!application || application.job.empresaId !== profile.id) {
      throw new NotFoundException("Mensaje de error");
    }

    return this.prisma.application.update({
      where: { id: applicationId },
      data: {
        status: status as any,
        coverLetter: notes,
      },
    });
  }

  // Métodos para moderación (coordinadores)
  async getPendingJobs() {
    return this.prisma.job.findMany({
      where: {
        moderationStatus: "PENDING" as any,
      } as any,
      include: {
        empresa: {
          include: {
            user: {
              select: {
                email: true,
              },
            },
          },
        },
        _count: {
          select: { applications: true },
        },
      },
      orderBy: {
        publishedAt: "asc",
      },
    });
  }

  async getRejectedJobs() {
    return this.prisma.job.findMany({
      where: {
        moderationStatus: {
          in: ["REJECTED", "AUTO_REJECTED"] as any,
        },
      } as any,
      include: {
        empresa: {
          include: {
            user: {
              select: {
                email: true,
              },
            },
          },
        },
        _count: {
          select: { applications: true },
        },
      },
      orderBy: {
        publishedAt: "desc",
      },
    });
  }

  async approveJob(jobId: string, moderatorId: string, reason?: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        empresa: {
          include: {
            user: {
              select: {
                email: true,
              },
            },
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException("Empleo no encontrado");
    }

    const updatedJob = await this.prisma.job.update({
      where: { id: jobId },
      data: {
        moderationStatus: "APPROVED" as any,
        moderationReason: reason || null,
        moderatedBy: moderatorId,
        moderatedAt: new Date(),
        status: "active", // Activar el empleo cuando se aprueba
      } as any,
    });

    // Enviar correo de aprobación a la empresa
    if (job.empresa?.user?.email) {
      try {
        await this.mailService.sendJobApprovalEmail(
          job.empresa.user.email,
          job.title,
          job.empresa.companyName || "",
          job.id
        );
      } catch (error) {
        // Log el error pero no fallar la aprobación si el correo falla
        console.error("Error enviando correo de aprobación:", error);
      }
    }

    return updatedJob;
  }

  async rejectJob(jobId: string, moderatorId: string, reason: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException("Empleo no encontrado");
    }

    return this.prisma.job.update({
      where: { id: jobId },
      data: {
        moderationStatus: "REJECTED" as any,
        moderationReason: reason,
        moderatedBy: moderatorId,
        moderatedAt: new Date(),
      } as any,
    });
  }

  async getJobForModeration(jobId: string) {
    return this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        empresa: {
          include: {
            user: {
              select: {
                email: true,
                createdAt: true,
              },
            },
          },
        },
        _count: {
          select: { applications: true },
        },
      },
    });
  }

  /**
   * Crear orden de pago para una publicación
   */
  async createJobPaymentOrder(userId: string, jobId: string) {
    const profile = await this.prisma.empresaProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException("Empresa no encontrada");
    }

    const job = await this.prisma.job.findFirst({
      where: {
        id: jobId,
        empresaId: profile.id,
      },
    });

    if (!job) {
      throw new NotFoundException("Empleo no encontrado");
    }

    if (job.isPaid) {
      throw new BadRequestException("Este empleo ya ha sido pagado");
    }

    if (job.moderationStatus !== "PENDING_PAYMENT") {
      throw new BadRequestException(
        "Este empleo no requiere pago o ya fue procesado"
      );
    }

    const amount =
      job.paymentAmount ||
      parseFloat(process.env.JOB_PUBLICATION_PRICE || "10.00");
    const currency = job.paymentCurrency || "USD";

    // Crear orden de pago en PayPal
    const order = await this.paymentsService.createOrder(
      amount,
      currency,
      `Pago por publicación de empleo: ${job.title}`
    );

    // Actualizar el empleo con el orderId
    await this.prisma.job.update({
      where: { id: jobId },
      data: {
        paymentOrderId: order.orderId,
        paymentStatus: "PENDING",
      },
    });

    return {
      orderId: order.orderId,
      status: order.status,
      links: order.links,
      amount,
      currency,
    };
  }

  /**
   * Confirmar pago de una publicación y pasar a moderación
   */
  async confirmJobPayment(userId: string, jobId: string, orderId: string) {
    const profile = await this.prisma.empresaProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException("Empresa no encontrada");
    }

    const job = await this.prisma.job.findFirst({
      where: {
        id: jobId,
        empresaId: profile.id,
        paymentOrderId: orderId,
      },
    });

    if (!job) {
      throw new NotFoundException("Empleo no encontrado o orderId no coincide");
    }

    if (job.isPaid) {
      throw new BadRequestException("Este empleo ya ha sido pagado");
    }

    // Capturar el pago en PayPal
    const captureResult = await this.paymentsService.captureOrder(orderId);

    if (captureResult.status !== "COMPLETED") {
      throw new BadRequestException("El pago no pudo ser completado");
    }

    // Aplicar filtro automático de moderación ahora que está pagado
    const moderationResult = this.contentModeration.analyzeJobContent({
      title: job.title || "",
      description: job.description || "",
      requirements: job.requirements || "",
    });

    // Determinar el estado de moderación y status basado en el resultado
    let moderationStatus = "PENDING";
    let status = "inactive";
    let autoRejectionReason = null;

    if (!moderationResult.isApproved) {
      moderationStatus = "AUTO_REJECTED";
      status = "inactive";
      autoRejectionReason = moderationResult.reasons.join(". ");
    } else {
      moderationStatus = "PENDING";
      status = "inactive";
    }

    // Actualizar el empleo con el pago confirmado y pasar a moderación
    return this.prisma.job.update({
      where: { id: jobId },
      data: {
        isPaid: true,
        paymentStatus: "COMPLETED",
        paidAt: new Date(),
        moderationStatus: moderationStatus as any,
        status: status,
        autoRejectionReason: autoRejectionReason,
      },
    });
  }
}
