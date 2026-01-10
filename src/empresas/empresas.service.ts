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
import { CloudFrontSignerService } from "../upload/cloudfront-signer.service";
import { S3UploadService } from "../upload/s3-upload.service";
// import { I18nService } from "nestjs-i18n"; // Temporalmente deshabilitado

@Injectable()
export class EmpresasService {
  constructor(
    private prisma: PrismaService,
    private contentModeration: ContentModerationService,
    private subscriptionsService: SubscriptionsService,
    private paymentsService: PaymentsService,
    private cloudFrontSigner: CloudFrontSignerService,
    private s3UploadService: S3UploadService,
    private configService: ConfigService
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
        // Verificar si CloudFront está configurado
        if (this.cloudFrontSigner.isCloudFrontConfigured()) {
          const logoPath = profile.logo.startsWith("/")
            ? profile.logo
            : `/${profile.logo}`;
          const cloudFrontUrl =
            this.cloudFrontSigner.getCloudFrontUrl(logoPath);
          // Solo actualizar si se generó una URL válida (verificar que no sea malformada)
          if (
            cloudFrontUrl &&
            cloudFrontUrl.startsWith("https://") &&
            !cloudFrontUrl.includes("https:///")
          ) {
            profile.logo = cloudFrontUrl;
          } else {
            // Si CloudFront falla o retorna URL malformada, usar S3 directo
            console.warn(
              `[EmpresasService] CloudFront configurado pero URL malformada: ${cloudFrontUrl}. ` +
                `Usando S3 directo para logo: ${profile.logo}`
            );
            profile.logo = await this.s3UploadService.getObjectUrl(
              profile.logo,
              3600
            );
          }
        } else {
          // Si CloudFront no está configurado, usar S3 directo
          console.log(
            `[EmpresasService] CloudFront no configurado. Usando S3 directo para logo: ${profile.logo}`
          );
          profile.logo = await this.s3UploadService.getObjectUrl(
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
    const where: any = {};

    // Búsqueda por nombre de empresa
    if (query.q) {
      where.companyName = {
        contains: query.q,
        mode: "insensitive" as any,
      };
    }

    // Búsqueda por ubicación
    if (query.location) {
      where.OR = [
        { ciudad: { contains: query.location, mode: "insensitive" as any } },
        { provincia: { contains: query.location, mode: "insensitive" as any } },
        { pais: { contains: query.location, mode: "insensitive" as any } },
      ];
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

    // Transformar logos a URLs
    const empresasWithUrls = await Promise.all(
      empresas.map(async (empresa) => {
        if (empresa.logo && !empresa.logo.startsWith("http")) {
          try {
            if (this.cloudFrontSigner.isCloudFrontConfigured()) {
              const logoPath = empresa.logo.startsWith("/")
                ? empresa.logo
                : `/${empresa.logo}`;
              const cloudFrontUrl = this.cloudFrontSigner.getCloudFrontUrl(logoPath);
              if (
                cloudFrontUrl &&
                cloudFrontUrl.startsWith("https://") &&
                !cloudFrontUrl.includes("https:///")
              ) {
                empresa.logo = cloudFrontUrl;
              } else {
                empresa.logo = await this.s3UploadService.getObjectUrl(empresa.logo, 3600);
              }
            } else {
              empresa.logo = await this.s3UploadService.getObjectUrl(empresa.logo, 3600);
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
      return this.prisma.job.create({
        data: {
          ...dto,
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

    return this.prisma.job.create({
      data: {
        ...dto,
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

    return this.prisma.job.update({
      where: { id: jobId },
      data: dto,
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
              if (this.cloudFrontSigner.isCloudFrontConfigured()) {
                const avatarPath = profilePicture.startsWith("/")
                  ? profilePicture
                  : `/${profilePicture}`;
                const cloudFrontUrl = this.cloudFrontSigner.getCloudFrontUrl(avatarPath);
                if (
                  cloudFrontUrl &&
                  cloudFrontUrl.startsWith("https://") &&
                  !cloudFrontUrl.includes("https:///")
                ) {
                  avatarUrl = cloudFrontUrl;
                } else {
                  avatarUrl = await this.s3UploadService.getObjectUrl(profilePicture, 3600);
                }
              } else {
                avatarUrl = await this.s3UploadService.getObjectUrl(profilePicture, 3600);
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
    });

    if (!job) {
      throw new NotFoundException("Empleo no encontrado");
    }

    return this.prisma.job.update({
      where: { id: jobId },
      data: {
        moderationStatus: "APPROVED" as any,
        moderationReason: reason || null,
        moderatedBy: moderatorId,
        moderatedAt: new Date(),
      } as any,
    });
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
