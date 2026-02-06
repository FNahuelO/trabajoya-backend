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
      totalPayments,
      completedPayments,
      totalPromotions,
      claimedPromotions,
      usedPromotions,
      totalVideoMeetings,
      scheduledMeetings,
      pendingReports,
      totalIapProducts,
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
      this.prisma.paymentTransaction.count(),
      this.prisma.paymentTransaction.count({ where: { status: "COMPLETED" } }),
      this.prisma.userPromotion.count(),
      this.prisma.userPromotion.count({ where: { status: "CLAIMED" } }),
      this.prisma.userPromotion.count({ where: { status: "USED" } }),
      this.prisma.videoMeeting.count(),
      this.prisma.videoMeeting.count({ where: { status: "SCHEDULED" } }),
      this.prisma.report.count({ where: { status: "PENDING" } }),
      this.prisma.iapProduct.count({ where: { active: true } }),
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
      totalPayments,
      completedPayments,
      totalPromotions,
      claimedPromotions,
      usedPromotions,
      totalVideoMeetings,
      scheduledMeetings,
      pendingReports,
      totalIapProducts,
    };
  }

  // Promotions
  async getPromotions(page: number, pageSize: number, status?: string) {
    const skip = (page - 1) * pageSize;
    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [promotions, total] = await Promise.all([
      this.prisma.userPromotion.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              userType: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.userPromotion.count({ where }),
    ]);

    return {
      items: promotions,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // Payments
  async getPayments(page: number, pageSize: number, status?: string) {
    const skip = (page - 1) * pageSize;
    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [payments, total] = await Promise.all([
      this.prisma.paymentTransaction.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              userType: true,
            },
          },
          empresa: {
            select: {
              id: true,
              companyName: true,
            },
          },
          plan: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.paymentTransaction.count({ where }),
    ]);

    return {
      items: payments,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // Video Meetings
  async getVideoMeetings(page: number, pageSize: number, status?: string) {
    const skip = (page - 1) * pageSize;
    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [meetings, total] = await Promise.all([
      this.prisma.videoMeeting.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          createdBy: {
            select: {
              id: true,
              email: true,
              userType: true,
            },
          },
          invitedUser: {
            select: {
              id: true,
              email: true,
              userType: true,
            },
          },
        },
        orderBy: { scheduledAt: "desc" },
      }),
      this.prisma.videoMeeting.count({ where }),
    ]);

    return {
      items: meetings,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // Entitlements
  async getEntitlements(page: number, pageSize: number, status?: string) {
    const skip = (page - 1) * pageSize;
    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [entitlements, total] = await Promise.all([
      this.prisma.jobPostEntitlement.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              userType: true,
            },
          },
          job: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.jobPostEntitlement.count({ where }),
    ]);

    return {
      items: entitlements,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
