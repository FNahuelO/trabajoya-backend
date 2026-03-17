import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePlanDto, UpdatePlanDto } from "./dto";

@Injectable()
export class PlansService {
  constructor(private prisma: PrismaService) {}

  async findAll(page: number = 1, pageSize: number = 20, search?: string) {
    const skip = (page - 1) * pageSize;
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.plan.findMany({
        where,
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        skip,
        take: pageSize,
      }),
      this.prisma.plan.count({ where }),
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
   * Obtiene solo los planes activos (para endpoint público)
   */
  async findAllActive(page: number = 1, pageSize: number = 100) {
    const skip = (page - 1) * pageSize;
    const where = {
      isActive: true,
    };

    const [items, total] = await Promise.all([
      this.prisma.plan.findMany({
        where,
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        skip,
        take: pageSize,
      }),
      this.prisma.plan.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
    });

    if (!plan) {
      throw new NotFoundException(`Plan con id ${id} no encontrado`);
    }

    return plan;
  }

  async findByCode(code: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { code },
    });

    if (!plan) {
      throw new NotFoundException(`Plan con código ${code} no encontrado`);
    }

    console.log('[PlansService] Plan encontrado por código:', {
      code: plan.code,
      name: plan.name,
      subscriptionPlan: plan.subscriptionPlan,
      subscriptionPlanType: typeof plan.subscriptionPlan,
    });

    return plan;
  }

  async create(dto: CreatePlanDto) {
    // Verificar si ya existe un plan con el mismo code
    const existing = await this.prisma.plan.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new BadRequestException(
        `Ya existe un plan con código ${dto.code}`
      );
    }

    // Verificar si ya existe un plan con el mismo name
    const existingName = await this.prisma.plan.findUnique({
      where: { name: dto.name },
    });

    if (existingName) {
      throw new BadRequestException(
        `Ya existe un plan con nombre ${dto.name}`
      );
    }

    // Si no se proporciona order, obtener el máximo order y sumar 10
    let order = dto.order;
    if (order === undefined) {
      const maxOrder = await this.prisma.plan.findFirst({
        orderBy: { order: "desc" },
        select: { order: true },
      });
      order = maxOrder ? maxOrder.order + 10 : 10;
    }

    const dtoAny = dto as any;
    const priceUsd = Number(
      dtoAny.priceUsd ??
        ((dtoAny.currency || "USD").toUpperCase() === "USD" ? dtoAny.price : 0)
    );
    const priceArs = Number(
      dtoAny.priceArs ??
        ((dtoAny.currency || "USD").toUpperCase() === "ARS" ? dtoAny.price : 0)
    );

    return this.prisma.plan.create({
      data: {
        name: dto.name,
        code: dto.code,
        // Campos nuevos
        priceUsd: Number.isFinite(priceUsd) ? priceUsd : 0,
        priceArs: Number.isFinite(priceArs) ? priceArs : 0,
        // Compatibilidad hacia atrás
        price: Number.isFinite(priceUsd) ? priceUsd : 0,
        currency: "USD",
        durationDays: dto.durationDays,
        unlimitedCvs: dto.unlimitedCvs ?? true,
        allowedModifications: dto.allowedModifications ?? 0,
        canModifyCategory: dto.canModifyCategory ?? false,
        categoryModifications: dto.categoryModifications ?? 0,
        hasFeaturedOption: dto.hasFeaturedOption ?? false,
        hasAIFeature: dto.hasAIFeature ?? false,
        launchBenefitAvailable: dto.launchBenefitAvailable ?? false,
        launchBenefitDuration: dto.launchBenefitDuration,
        isActive: dto.isActive ?? true,
        order,
        description: dto.description,
        subscriptionPlan: dto.subscriptionPlan || "BASIC", // Usar el valor proporcionado o PREMIUM por defecto
      },
    });
  }

  async update(id: string, dto: UpdatePlanDto) {
    const plan = await this.findOne(id);

    // Si se está actualizando el name, verificar que no exista otro plan con ese nombre
    if (dto.name && dto.name !== plan.name) {
      const existingName = await this.prisma.plan.findUnique({
        where: { name: dto.name },
      });

      if (existingName) {
        throw new BadRequestException(
          `Ya existe un plan con nombre ${dto.name}`
        );
      }
    }

    const dtoAny = dto as any;
    const data: any = { ...dto };

    if (dtoAny.priceUsd !== undefined) {
      data.price = dtoAny.priceUsd;
      data.currency = "USD";
    } else if (dtoAny.price !== undefined && dtoAny.currency) {
      if (String(dtoAny.currency).toUpperCase() === "USD") {
        data.priceUsd = dtoAny.price;
      }
      if (String(dtoAny.currency).toUpperCase() === "ARS") {
        data.priceArs = dtoAny.price;
      }
    }

    return this.prisma.plan.update({
      where: { id },
      data,
    });
  }

  async toggleActive(id: string) {
    const plan = await this.findOne(id);
    return this.update(id, { isActive: !plan.isActive });
  }

  async remove(id: string) {
    const plan = await this.findOne(id);
    // Hard delete: eliminación permanente
    return this.prisma.plan.delete({
      where: { id },
    });
  }

  async reorder(items: { id: string; order: number }[]) {
    const updates = items.map((item) =>
      this.prisma.plan.update({
        where: { id: item.id },
        data: { order: item.order },
      })
    );

    await Promise.all(updates);

    return { success: true, message: "Orden actualizado correctamente" };
  }
}

