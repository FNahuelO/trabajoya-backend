import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import * as bcrypt from "bcryptjs";

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
  async getPayments(
    page: number,
    pageSize: number,
    status?: string,
    paymentMethod?: string,
    search?: string,
    dateFrom?: string,
    dateTo?: string
  ) {
    const skip = (page - 1) * pageSize;
    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (paymentMethod) {
      where.paymentMethod = paymentMethod;
    }
    if (search) {
      where.OR = [
        { orderId: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { user: { email: { contains: search, mode: "insensitive" } } },
        { empresa: { companyName: { contains: search, mode: "insensitive" } } },
      ];
    }
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
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

  // Payment Stats
  async getPaymentStats() {
    const [
      totalPayments,
      completedPayments,
      pendingPayments,
      failedPayments,
      totalRevenueResult,
      paypalCount,
      appleIapCount,
      googlePlayCount,
      todayPayments,
    ] = await Promise.all([
      this.prisma.paymentTransaction.count(),
      this.prisma.paymentTransaction.count({ where: { status: "COMPLETED" } }),
      this.prisma.paymentTransaction.count({ where: { status: "PENDING" } }),
      this.prisma.paymentTransaction.count({ where: { status: "FAILED" } }),
      this.prisma.paymentTransaction.aggregate({
        _sum: { amount: true },
        where: { status: "COMPLETED" },
      }),
      this.prisma.paymentTransaction.count({ where: { paymentMethod: "PAYPAL" } }),
      this.prisma.paymentTransaction.count({ where: { paymentMethod: "APPLE_IAP" } }),
      this.prisma.paymentTransaction.count({ where: { paymentMethod: "GOOGLE_PLAY" } }),
      this.prisma.paymentTransaction.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
    ]);

    return {
      totalPayments,
      completedPayments,
      pendingPayments,
      failedPayments,
      totalRevenue: totalRevenueResult._sum.amount || 0,
      byMethod: {
        paypal: paypalCount,
        appleIap: appleIapCount,
        googlePlay: googlePlayCount,
      },
      todayPayments,
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

  // ══════════════════════════════════════════════════════════════════════
  // ROLES
  // ══════════════════════════════════════════════════════════════════════

  async getRoles() {
    const roles = await this.prisma.role.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { users: true } },
      },
    });
    return roles;
  }

  async getRoleById(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true } },
      },
    });
    if (!role) throw new NotFoundException("Rol no encontrado");
    return role;
  }

  async createRole(data: {
    name: string;
    displayName: string;
    description?: string;
    permissions: string[];
  }) {
    const existing = await this.prisma.role.findUnique({
      where: { name: data.name },
    });
    if (existing)
      throw new BadRequestException("Ya existe un rol con ese nombre");

    return this.prisma.role.create({
      data: {
        name: data.name.toUpperCase().replace(/\s+/g, "_"),
        displayName: data.displayName,
        description: data.description,
        permissions: data.permissions,
        isSystem: false,
      },
    });
  }

  async updateRole(
    id: string,
    data: {
      displayName?: string;
      description?: string;
      permissions?: string[];
    }
  ) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException("Rol no encontrado");

    return this.prisma.role.update({
      where: { id },
      data: {
        ...(data.displayName !== undefined && {
          displayName: data.displayName,
        }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...(data.permissions !== undefined && {
          permissions: data.permissions,
        }),
      },
    });
  }

  async deleteRole(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!role) throw new NotFoundException("Rol no encontrado");
    if (role.isSystem)
      throw new ForbiddenException("No se pueden eliminar roles del sistema");
    if (role._count.users > 0)
      throw new BadRequestException(
        "No se puede eliminar un rol que tiene usuarios asignados. Reasigne los usuarios primero."
      );

    return this.prisma.role.delete({ where: { id } });
  }

  // ══════════════════════════════════════════════════════════════════════
  // USUARIOS INTERNOS (ADMIN)
  // ══════════════════════════════════════════════════════════════════════

  async getInternalUsers(page: number, pageSize: number, search?: string) {
    const skip = (page - 1) * pageSize;
    const where: any = { userType: "ADMIN" };

    if (search) {
      where.email = { contains: search, mode: "insensitive" };
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        select: {
          id: true,
          email: true,
          userType: true,
          isVerified: true,
          createdAt: true,
          updatedAt: true,
          role: {
            select: {
              id: true,
              name: true,
              displayName: true,
            },
          },
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

  async getInternalUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        userType: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
        role: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
      },
    });
    if (!user || user.userType !== "ADMIN")
      throw new NotFoundException("Usuario interno no encontrado");
    return user;
  }

  async createInternalUser(data: {
    email: string;
    password: string;
    roleId?: string;
  }) {
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing)
      throw new BadRequestException("Ya existe un usuario con ese email");

    if (data.roleId) {
      const role = await this.prisma.role.findUnique({
        where: { id: data.roleId },
      });
      if (!role) throw new BadRequestException("Rol no encontrado");
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    return this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        userType: "ADMIN",
        isVerified: true,
        roleId: data.roleId || null,
      },
      select: {
        id: true,
        email: true,
        userType: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
        role: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
      },
    });
  }

  async updateInternalUser(
    id: string,
    data: {
      email?: string;
      password?: string;
      roleId?: string | null;
      isVerified?: boolean;
    }
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.userType !== "ADMIN")
      throw new NotFoundException("Usuario interno no encontrado");

    if (data.email && data.email !== user.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: data.email },
      });
      if (existing)
        throw new BadRequestException("Ya existe un usuario con ese email");
    }

    if (data.roleId) {
      const role = await this.prisma.role.findUnique({
        where: { id: data.roleId },
      });
      if (!role) throw new BadRequestException("Rol no encontrado");
    }

    const updateData: any = {};
    if (data.email) updateData.email = data.email;
    if (data.password) updateData.passwordHash = await bcrypt.hash(data.password, 10);
    if (data.roleId !== undefined) updateData.roleId = data.roleId;
    if (data.isVerified !== undefined) updateData.isVerified = data.isVerified;

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        userType: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
        role: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
      },
    });
  }

  async deleteInternalUser(id: string, requesterId: string) {
    if (id === requesterId)
      throw new ForbiddenException("No puedes eliminar tu propio usuario");

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.userType !== "ADMIN")
      throw new NotFoundException("Usuario interno no encontrado");

    await this.prisma.user.delete({ where: { id } });
    return { deleted: true };
  }
}
