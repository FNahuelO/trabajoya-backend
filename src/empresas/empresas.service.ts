import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ContentModerationService } from "../common/services/content-moderation.service";
// import { I18nService } from "nestjs-i18n"; // Temporalmente deshabilitado

@Injectable()
export class EmpresasService {
  constructor(
    private prisma: PrismaService,
    private contentModeration: ContentModerationService
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

    return profile;
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

    // Si se actualiza industria, también actualizar sector
    if (updateData.industria && !updateData.sector) {
      updateData.sector = updateData.industria;
    }
    if (updateData.sector && !updateData.industria) {
      updateData.industria = updateData.sector;
    }

    // Si se actualiza cantidadEmpleados, también actualizar tamano
    if (updateData.cantidadEmpleados && !updateData.tamano) {
      updateData.tamano = updateData.cantidadEmpleados;
    }
    if (updateData.tamano && !updateData.cantidadEmpleados) {
      updateData.cantidadEmpleados = updateData.tamano;
    }

    // Mapear telefono a phone si viene telefono
    if (updateData.telefono) {
      // Si el teléfono no tiene código de país, mantener el existente
      const existingPhone = (profile as any).phone || "";
      if (!updateData.telefono.startsWith("+") && existingPhone) {
        const phoneMatch = existingPhone.match(/^(\+\d+)(.*)$/);
        if (phoneMatch) {
          updateData.telefono = `${phoneMatch[1]}${updateData.telefono}`;
        }
      }
      updateData.phone = updateData.telefono;
      delete updateData.telefono; // Eliminar telefono ya que usamos phone
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

    // Aplicar filtro automático de moderación
    const moderationResult = this.contentModeration.analyzeJobContent({
      title: dto.title || "",
      description: dto.description || "",
      requirements: dto.requirements || "",
    });

    // Determinar el estado de moderación
    let moderationStatus = "PENDING";
    let autoRejectionReason = null;

    if (!moderationResult.isApproved) {
      moderationStatus = "AUTO_REJECTED";
      autoRejectionReason = moderationResult.reason;
    }

    return this.prisma.job.create({
      data: {
        ...dto,
        empresaId: profile.id,
        moderationStatus: moderationStatus as any,
        autoRejectionReason: autoRejectionReason,
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

    return this.prisma.application.findMany({
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
}
