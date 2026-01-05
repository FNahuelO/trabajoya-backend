import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ContentModerationService } from "../common/services/content-moderation.service";

@Injectable()
export class ModerationService {
  constructor(
    private prisma: PrismaService,
    private contentModeration: ContentModerationService
  ) {}

  async getPendingJobs(page: number = 1, pageSize: number = 10) {
    const skip = (page - 1) * pageSize;

    const [jobs, total] = await Promise.all([
      this.prisma.job.findMany({
        where: {
          moderationStatus: "PENDING",
          // Los empleos con PENDING_PAYMENT no deberían aparecer aquí
          // porque tienen un status diferente
        },
        include: {
          empresa: {
            include: {
              user: {
                select: {
                  email: true,
                  id: true,
                  createdAt: true,
                },
              },
            },
            select: {
              id: true,
              companyName: true,
              email: true,
              ciudad: true,
              provincia: true,
              pais: true,
              logo: true,
              user: true,
            },
          },
          _count: {
            select: { applications: true },
          },
        },
        orderBy: {
          publishedAt: "desc",
        },
        skip,
        take: pageSize,
      }),
      this.prisma.job.count({
        where: {
          moderationStatus: "PENDING",
        },
      }),
    ]);

    // Agregar análisis de moderación para cada empleo pendiente
    const jobsWithAnalysis = jobs.map((job) => {
      const analysis = this.contentModeration.analyzeJobContent({
        title: job.title,
        description: job.description,
        requirements: job.requirements,
      });
      return {
        ...job,
        moderationAnalysis: analysis,
      };
    });

    return {
      jobs: jobsWithAnalysis,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getRejectedJobs(page: number = 1, pageSize: number = 10) {
    const skip = (page - 1) * pageSize;

    const [jobs, total] = await Promise.all([
      this.prisma.job.findMany({
        where: {
          moderationStatus: {
            in: ["REJECTED", "AUTO_REJECTED"],
          },
        },
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
        orderBy: {
          moderatedAt: "desc",
        },
        skip,
        take: pageSize,
      }),
      this.prisma.job.count({
        where: {
          moderationStatus: {
            in: ["REJECTED", "AUTO_REJECTED"],
          },
        },
      }),
    ]);

    return {
      jobs,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async approveJob(jobId: string, moderatorId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException("Empleo no encontrado");
    }

    return this.prisma.job.update({
      where: { id: jobId },
      data: {
        moderationStatus: "APPROVED",
        moderatedBy: moderatorId,
        moderatedAt: new Date(),
        moderationReason: null,
        // Si está aprobado, activar el empleo
        status: "active",
      },
    });
  }

  async rejectJob(jobId: string, reason: string, moderatorId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException("Empleo no encontrado");
    }

    return this.prisma.job.update({
      where: { id: jobId },
      data: {
        moderationStatus: "REJECTED",
        moderatedBy: moderatorId,
        moderatedAt: new Date(),
        moderationReason: reason,
        // Si está rechazado, desactivar el empleo
        status: "inactive",
      },
    });
  }

  async getJobDetails(jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        empresa: {
          include: {
            user: {
              select: {
                email: true,
                id: true,
              },
            },
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException("Empleo no encontrado");
    }

    // Si el empleo está pendiente o fue rechazado automáticamente,
    // incluir el análisis de moderación actualizado
    let moderationAnalysis = null;
    if (
      job.moderationStatus === "PENDING" ||
      job.moderationStatus === "AUTO_REJECTED"
    ) {
      moderationAnalysis = this.contentModeration.analyzeJobContent({
        title: job.title,
        description: job.description,
        requirements: job.requirements,
      });
    }

    return {
      ...job,
      moderationAnalysis,
    };
  }

  /**
   * Obtiene estadísticas de moderación para el dashboard
   */
  async getModerationStats() {
    const [pendingCount, approvedCount, rejectedCount, autoRejectedCount] =
      await Promise.all([
        this.prisma.job.count({
          where: { moderationStatus: "PENDING" },
        }),
        this.prisma.job.count({
          where: { moderationStatus: "APPROVED" },
        }),
        this.prisma.job.count({
          where: { moderationStatus: "REJECTED" },
        }),
        this.prisma.job.count({
          where: { moderationStatus: "AUTO_REJECTED" },
        }),
      ]);

    return {
      pending: pendingCount,
      approved: approvedCount,
      rejected: rejectedCount,
      autoRejected: autoRejectedCount,
      total: pendingCount + approvedCount + rejectedCount + autoRejectedCount,
    };
  }
}
