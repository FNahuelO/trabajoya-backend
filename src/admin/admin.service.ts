import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getUsers(page: number, pageSize: number, userType?: string) {
    const skip = (page - 1) * pageSize;
    const where: any = {};
    if (userType) {
      where.userType = userType;
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          empresa: true,
          postulante: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: users,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getEmpresas(page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;

    const [empresas, total] = await Promise.all([
      this.prisma.empresaProfile.findMany({
        skip,
        take: pageSize,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              isVerified: true,
              createdAt: true,
            },
          },
          subscriptions: {
            where: { status: "ACTIVE" },
            orderBy: { startDate: "desc" },
            take: 1,
          },
        },
        orderBy: { userId: "desc" },
      }),
      this.prisma.empresaProfile.count(),
    ]);

    return {
      items: empresas,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getPostulantes(page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;

    const [postulantes, total] = await Promise.all([
      this.prisma.postulanteProfile.findMany({
        skip,
        take: pageSize,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              isVerified: true,
              createdAt: true,
            },
          },
        },
        orderBy: { userId: "desc" },
      }),
      this.prisma.postulanteProfile.count(),
    ]);

    return {
      items: postulantes,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getAllJobs(
    page: number,
    pageSize: number,
    status?: string,
    moderationStatus?: string
  ) {
    const skip = (page - 1) * pageSize;
    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (moderationStatus) {
      where.moderationStatus = moderationStatus;
    }

    const [jobs, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          empresa: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                },
              },
            },
          },
          applications: {
            select: {
              id: true,
            },
          },
        },
        orderBy: { publishedAt: "desc" },
      }),
      this.prisma.job.count({ where }),
    ]);

    return {
      items: jobs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getApplications(page: number, pageSize: number, status?: string) {
    const skip = (page - 1) * pageSize;
    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [applications, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          job: {
            include: {
              empresa: {
                select: {
                  id: true,
                  companyName: true,
                },
              },
            },
          },
          postulante: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: { appliedAt: "desc" },
      }),
      this.prisma.application.count({ where }),
    ]);

    return {
      items: applications,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getMessages(page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        skip,
        take: pageSize,
        include: {
          fromUser: {
            select: {
              id: true,
              email: true,
              userType: true,
            },
          },
          toUser: {
            select: {
              id: true,
              email: true,
              userType: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.message.count(),
    ]);

    return {
      items: messages,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getCalls(page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;

    const [calls, total] = await Promise.all([
      this.prisma.call.findMany({
        skip,
        take: pageSize,
        include: {
          fromUser: {
            select: {
              id: true,
              email: true,
              userType: true,
            },
          },
          toUser: {
            select: {
              id: true,
              email: true,
              userType: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.call.count(),
    ]);

    return {
      items: calls,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getSubscriptions(page: number, pageSize: number, status?: string) {
    const skip = (page - 1) * pageSize;
    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [subscriptions, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          empresa: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.subscription.count({ where }),
    ]);

    return {
      items: subscriptions,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getStats() {
    const [
      totalUsers,
      totalEmpresas,
      totalPostulantes,
      totalJobs,
      pendingJobs,
      activeJobs,
      totalApplications,
      totalMessages,
      totalCalls,
      activeSubscriptions,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.empresaProfile.count(),
      this.prisma.postulanteProfile.count(),
      this.prisma.job.count(),
      this.prisma.job.count({ where: { moderationStatus: "PENDING" } }),
      this.prisma.job.count({ where: { status: "active" } }),
      this.prisma.application.count(),
      this.prisma.message.count(),
      this.prisma.call.count(),
      this.prisma.subscription.count({ where: { status: "ACTIVE" } }),
    ]);

    return {
      totalUsers,
      totalEmpresas,
      totalPostulantes,
      totalJobs,
      pendingJobs,
      activeJobs,
      totalApplications,
      totalMessages,
      totalCalls,
      activeSubscriptions,
    };
  }
}
