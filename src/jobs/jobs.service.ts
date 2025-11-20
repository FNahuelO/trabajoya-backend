import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
// import { I18nService } from "nestjs-i18n"; // Temporalmente deshabilitado

@Injectable()
export class JobsService {
  constructor(private prisma: PrismaService) {}

  async search(q: any) {
    const where: any = {
      OR: [{ status: "activo" }, { status: "active" }],
    };

    if (q.q) {
      where.AND = where.AND || [];
      where.AND.push({
        OR: [
          { title: { contains: q.q, mode: "insensitive" } },
          { description: { contains: q.q, mode: "insensitive" } },
          { requirements: { contains: q.q, mode: "insensitive" } },
        ],
      });
    }

    if (q.location) {
      where.AND = where.AND || [];
      where.AND.push({
        OR: [
          { location: { contains: q.location, mode: "insensitive" } },
          { city: { contains: q.location, mode: "insensitive" } },
          { state: { contains: q.location, mode: "insensitive" } },
        ],
      });
    }

    if (q.categoria) where.category = q.categoria;
    if (q.tipoEmpleo) where.jobType = q.tipoEmpleo;
    if (q.modalidad) where.workMode = q.modalidad;

    const page = Number(q.page || 1);
    const pageSize = Number(q.pageSize || 20);
    const skip = (page - 1) * pageSize;

    const [jobs, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        take: pageSize,
        skip,
        orderBy: { publishedAt: "desc" },
        include: {
          empresa: {
            select: {
              id: true,
              companyName: true,
              ciudad: true,
              provincia: true,
              pais: true,
              logo: true,
            } as any,
          },
          _count: {
            select: { applications: true },
          },
        },
      }),
      this.prisma.job.count({ where }),
    ]);

    return {
      data: jobs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findById(id: string) {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: {
        empresa: {
          select: {
            id: true,
            companyName: true,
            email: true,
            ciudad: true,
            provincia: true,
            pais: true,
            logo: true,
          } as any,
        },
        _count: {
          select: { applications: true },
        },
      },
    });

    if (!job) {
      throw new NotFoundException("Mensaje de error");
    }

    return job;
  }

  async create(dto: any) {
    return this.prisma.job.create({ data: dto });
  }

  async update(id: string, userId: string, dto: any) {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: { empresa: true },
    });

    if (!job) {
      throw new NotFoundException("Mensaje de error");
    }

    if (job.empresa.userId !== userId) {
      throw new ForbiddenException("Mensaje de error");
    }

    return this.prisma.job.update({
      where: { id },
      data: dto,
    });
  }

  async delete(id: string, userId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: { empresa: true },
    });

    if (!job) {
      throw new NotFoundException("Mensaje de error");
    }

    if (job.empresa.userId !== userId) {
      throw new ForbiddenException("Mensaje de error");
    }

    return this.prisma.job.delete({ where: { id } });
  }

  async getByEmpresa(empresaId: string) {
    return this.prisma.job.findMany({
      where: { empresaId },
      orderBy: { publishedAt: "desc" },
      include: {
        _count: {
          select: { applications: true },
        },
      },
    });
  }
}
