import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ModerationService {
  constructor(private prisma: PrismaService) {}

  async getPendingJobs(page: number = 1, pageSize: number = 10) {
    const skip = (page - 1) * pageSize;

    const [jobs, total] = await Promise.all([
      this.prisma.job.findMany({
        where: {
          moderationStatus: 'PENDING',
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
          publishedAt: 'desc',
        },
        skip,
        take: pageSize,
      }),
      this.prisma.job.count({
        where: {
          moderationStatus: 'PENDING',
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

  async getRejectedJobs(page: number = 1, pageSize: number = 10) {
    const skip = (page - 1) * pageSize;

    const [jobs, total] = await Promise.all([
      this.prisma.job.findMany({
        where: {
          moderationStatus: {
            in: ['REJECTED', 'AUTO_REJECTED'],
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
          moderatedAt: 'desc',
        },
        skip,
        take: pageSize,
      }),
      this.prisma.job.count({
        where: {
          moderationStatus: {
            in: ['REJECTED', 'AUTO_REJECTED'],
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
      throw new NotFoundException('Empleo no encontrado');
    }

    return this.prisma.job.update({
      where: { id: jobId },
      data: {
        moderationStatus: 'APPROVED',
        moderatedBy: moderatorId,
        moderatedAt: new Date(),
        moderationReason: null,
        // Si está aprobado, activar el empleo
        status: 'active',
      },
    });
  }

  async rejectJob(jobId: string, reason: string, moderatorId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException('Empleo no encontrado');
    }

    return this.prisma.job.update({
      where: { id: jobId },
      data: {
        moderationStatus: 'REJECTED',
        moderatedBy: moderatorId,
        moderatedAt: new Date(),
        moderationReason: reason,
        // Si está rechazado, desactivar el empleo
        status: 'inactive',
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
      throw new NotFoundException('Empleo no encontrado');
    }

    return job;
  }
}

