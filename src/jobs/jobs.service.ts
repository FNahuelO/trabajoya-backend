import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { GcpCdnService } from "../upload/gcp-cdn.service";
import { S3UploadService } from "../upload/s3-upload.service";
// import { I18nService } from "nestjs-i18n"; // Temporalmente deshabilitado

@Injectable()
export class JobsService {
  constructor(
    private prisma: PrismaService,
    private gcpCdnService: GcpCdnService,
    private s3UploadService: S3UploadService
  ) {}

  async search(q: any) {
    const where: any = {
      AND: [
        {
          OR: [{ status: "activo" }, { status: "active" }],
        },
        {
          moderationStatus: "APPROVED",
        },
      ],
    };

    if (q.q) {
      where.AND.push({
        OR: [
          { title: { contains: q.q, mode: "insensitive" } },
          { description: { contains: q.q, mode: "insensitive" } },
          { requirements: { contains: q.q, mode: "insensitive" } },
        ],
      });
    }

    if (q.location) {
      where.AND.push({
        OR: [
          { location: { contains: q.location, mode: "insensitive" } },
          { city: { contains: q.location, mode: "insensitive" } },
          { state: { contains: q.location, mode: "insensitive" } },
        ],
      });
    }

    if (q.categoria) {
      // Filtrar por categoría del trabajo O por industria/sector de la empresa
      where.AND.push({
        OR: [
          { category: q.categoria },
          { empresa: { sector: q.categoria } },
          { empresa: { industria: q.categoria } },
        ],
      });
    }
    if (q.tipoEmpleo) {
      where.AND.push({ jobType: q.tipoEmpleo });
    }
    if (q.modalidad) {
      where.AND.push({ workMode: q.modalidad });
    }
    if (q.nivelLaboral) {
      where.AND.push({ experienceLevel: q.nivelLaboral });
    }

    // Filtro por fecha desde (fechaDesde)
    if (q.fechaDesde) {
      const fechaDesde = new Date(q.fechaDesde);
      where.AND.push({
        publishedAt: {
          gte: fechaDesde,
        },
      });
    }

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

    // Transformar logos a URLs (CloudFront o S3 presigned)
    const jobsWithProcessedLogos = await Promise.all(
      jobs.map(async (job) => {
        const logoValue = job.empresa?.logo as unknown as
          | string
          | null
          | undefined;
        if (
          logoValue &&
          typeof logoValue === "string" &&
          !logoValue.startsWith("http")
        ) {
          const logo: string = logoValue;
          try {
            if (this.gcpCdnService.isCdnConfigured()) {
              (job.empresa as any).logo = await this.gcpCdnService.getCdnUrl(logo);
            } else {
              (job.empresa as any).logo =
                await this.s3UploadService.getObjectUrl(logo, 3600);
            }
          } catch (error) {
            console.error("Error generando URL para logo en jobs:", error);
          }
        }
        return job;
      })
    );

    return {
      data: jobsWithProcessedLogos,
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

    // Transformar logo a URL (CloudFront o S3 presigned)
    const logoValue = job.empresa?.logo as unknown as string | null | undefined;
    if (
      logoValue &&
      typeof logoValue === "string" &&
      !logoValue.startsWith("http")
    ) {
      const logo: string = logoValue;
      try {
            if (this.gcpCdnService.isCdnConfigured()) {
              (job.empresa as any).logo = await this.gcpCdnService.getCdnUrl(logo);
            } else {
              (job.empresa as any).logo = await this.s3UploadService.getObjectUrl(
                logo,
                3600
              );
            }
      } catch (error) {
        console.error("Error generando URL para logo en job detail:", error);
      }
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
