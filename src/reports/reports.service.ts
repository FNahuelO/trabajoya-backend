import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateReportDto } from "./dto";
import { ReportReason, ReportStatus } from "@prisma/client";

/**
 * Servicio de denuncias
 * Implementa funcionalidad requerida por Google Play para cumplir con políticas de seguridad
 * Permite a los usuarios denunciar contenido inapropiado o comportamiento abusivo
 */
@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Crear una denuncia
   * Permite denunciar un usuario o un mensaje específico
   */
  async createReport(reporterId: string, dto: CreateReportDto) {
    const { reportedUserId, messageId, reason, description } = dto;

    // No permitir denunciarse a sí mismo
    if (reporterId === reportedUserId) {
      throw new BadRequestException("No puedes denunciarte a ti mismo");
    }

    // Verificar que el usuario denunciado existe
    const reportedUser = await this.prisma.user.findUnique({
      where: { id: reportedUserId },
    });

    if (!reportedUser) {
      throw new NotFoundException("Usuario denunciado no encontrado");
    }

    // Si se proporciona un messageId, verificar que existe y pertenece a la conversación
    if (messageId) {
      const message = await this.prisma.message.findUnique({
        where: { id: messageId },
      });

      if (!message) {
        throw new NotFoundException("Mensaje no encontrado");
      }

      // Verificar que el mensaje está relacionado con el usuario denunciado
      if (
        message.fromUserId !== reportedUserId &&
        message.toUserId !== reportedUserId
      ) {
        throw new BadRequestException(
          "El mensaje no está relacionado con el usuario denunciado"
        );
      }

      // Verificar que el reporter está involucrado en la conversación
      if (
        message.fromUserId !== reporterId &&
        message.toUserId !== reporterId
      ) {
        throw new BadRequestException(
          "No puedes denunciar un mensaje en el que no estás involucrado"
        );
      }
    }

    // Verificar si ya existe una denuncia similar pendiente
    const existingReport = await this.prisma.report.findFirst({
      where: {
        reporterId,
        reportedId: reportedUserId,
        messageId: messageId || null,
        status: "PENDING",
      },
    });

    if (existingReport) {
      throw new ConflictException(
        "Ya existe una denuncia pendiente para este usuario/mensaje"
      );
    }

    // Crear la denuncia
    const report = await this.prisma.report.create({
      data: {
        reporterId,
        reportedId: reportedUserId,
        messageId: messageId || null,
        reason,
        description: description || null,
        status: ReportStatus.PENDING,
      },
      include: {
        reporter: {
          select: {
            id: true,
            email: true,
            userType: true,
          },
        },
        reported: {
          select: {
            id: true,
            email: true,
            userType: true,
            postulante: {
              select: {
                id: true,
                fullName: true,
              },
            },
            empresa: {
              select: {
                id: true,
                companyName: true,
              },
            },
          },
        },
        message: messageId
          ? {
              select: {
                id: true,
                content: true,
                createdAt: true,
              },
            }
          : undefined,
      },
    });

    return report;
  }

  /**
   * Obtener denuncias pendientes (para moderadores)
   */
  async getPendingReports(page: number = 1, pageSize: number = 10) {
    const skip = (page - 1) * pageSize;

    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        where: { status: ReportStatus.PENDING },
        include: {
          reporter: {
            select: {
              id: true,
              email: true,
              userType: true,
              postulante: {
                select: {
                  id: true,
                  fullName: true,
                  profilePicture: true,
                },
              },
              empresa: {
                select: {
                  id: true,
                  companyName: true,
                  logo: true,
                },
              },
            },
          },
          reported: {
            select: {
              id: true,
              email: true,
              userType: true,
              postulante: {
                select: {
                  id: true,
                  fullName: true,
                  profilePicture: true,
                },
              },
              empresa: {
                select: {
                  id: true,
                  companyName: true,
                  logo: true,
                },
              },
            },
          },
          message: {
            select: {
              id: true,
              content: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      this.prisma.report.count({
        where: { status: ReportStatus.PENDING },
      }),
    ]);

    return {
      reports,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * Obtener todas las denuncias (para moderadores)
   */
  async getAllReports(page: number = 1, pageSize: number = 10, status?: ReportStatus) {
    const skip = (page - 1) * pageSize;

    const where = status ? { status } : {};

    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        include: {
          reporter: {
            select: {
              id: true,
              email: true,
              userType: true,
              postulante: {
                select: {
                  id: true,
                  fullName: true,
                  profilePicture: true,
                },
              },
              empresa: {
                select: {
                  id: true,
                  companyName: true,
                  logo: true,
                },
              },
            },
          },
          reported: {
            select: {
              id: true,
              email: true,
              userType: true,
              postulante: {
                select: {
                  id: true,
                  fullName: true,
                  profilePicture: true,
                },
              },
              empresa: {
                select: {
                  id: true,
                  companyName: true,
                  logo: true,
                },
              },
            },
          },
          message: {
            select: {
              id: true,
              content: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      this.prisma.report.count({ where }),
    ]);

    return {
      reports,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * Marcar denuncia como revisada
   */
  async markAsReviewed(reportId: string, adminId: string, notes?: string) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException("Denuncia no encontrada");
    }

    return this.prisma.report.update({
      where: { id: reportId },
      data: {
        status: ReportStatus.REVIEWED,
        reviewedBy: adminId,
        reviewedAt: new Date(),
        adminNotes: notes || null,
      },
    });
  }

  /**
   * Resolver denuncia
   */
  async resolveReport(reportId: string, adminId: string, notes?: string) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException("Denuncia no encontrada");
    }

    return this.prisma.report.update({
      where: { id: reportId },
      data: {
        status: ReportStatus.RESOLVED,
        reviewedBy: adminId,
        reviewedAt: new Date(),
        adminNotes: notes || null,
      },
    });
  }

  /**
   * Desestimar denuncia
   */
  async dismissReport(reportId: string, adminId: string, notes?: string) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException("Denuncia no encontrada");
    }

    return this.prisma.report.update({
      where: { id: reportId },
      data: {
        status: ReportStatus.DISMISSED,
        reviewedBy: adminId,
        reviewedAt: new Date(),
        adminNotes: notes || null,
      },
    });
  }

  /**
   * Obtener estadísticas de denuncias
   */
  async getReportStats() {
    const [pending, reviewed, resolved, dismissed, total] = await Promise.all([
      this.prisma.report.count({ where: { status: ReportStatus.PENDING } }),
      this.prisma.report.count({ where: { status: ReportStatus.REVIEWED } }),
      this.prisma.report.count({ where: { status: ReportStatus.RESOLVED } }),
      this.prisma.report.count({ where: { status: ReportStatus.DISMISSED } }),
      this.prisma.report.count(),
    ]);

    return {
      pending,
      reviewed,
      resolved,
      dismissed,
      total,
    };
  }
}

