import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { GcpCdnService } from "../upload/gcp-cdn.service";
import { GCSUploadService } from "../upload/gcs-upload.service";
// import { I18nService } from "nestjs-i18n"; // Temporalmente deshabilitado

@Injectable()
export class JobsService {
  constructor(
    private prisma: PrismaService,
    private gcpCdnService: GcpCdnService,
    private gcsUploadService: GCSUploadService
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
      const searchQuery = q.q.trim();
      
      // Dividir la búsqueda en palabras clave individuales
      const keywords = searchQuery
        .split(/\s+/)
        .filter((word: string) => word.length > 0)
        .map((word: string) => word.trim());

      if (keywords.length > 0) {
        // Si hay múltiples palabras, buscar que al menos una palabra aparezca en cada campo
        // Esto permite búsqueda flexible: "desarrollador react" encontrará trabajos que tengan
        // "desarrollador" O "react" en cualquier campo
        const keywordConditions = keywords.map((keyword: string) => ({
          OR: [
            { title: { contains: keyword, mode: "insensitive" } },
            { description: { contains: keyword, mode: "insensitive" } },
            { requirements: { contains: keyword, mode: "insensitive" } },
            // También buscar en el nombre de la empresa
            { empresa: { companyName: { contains: keyword, mode: "insensitive" } } },
            // Buscar en industria y sector de la empresa
            { empresa: { industria: { contains: keyword, mode: "insensitive" } } },
            { empresa: { sector: { contains: keyword, mode: "insensitive" } } },
          ],
        }));

        // Si hay una sola palabra, usar búsqueda exacta o parcial
        // Si hay múltiples palabras, buscar que al menos una coincida (OR entre palabras)
        if (keywords.length === 1) {
          // Una palabra: buscar coincidencias exactas o parciales
          where.AND.push({
            OR: [
              { title: { contains: keywords[0], mode: "insensitive" } },
              { description: { contains: keywords[0], mode: "insensitive" } },
              { requirements: { contains: keywords[0], mode: "insensitive" } },
              { empresa: { companyName: { contains: keywords[0], mode: "insensitive" } } },
              // Buscar en industria y sector de la empresa
              { empresa: { industria: { contains: keywords[0], mode: "insensitive" } } },
              { empresa: { sector: { contains: keywords[0], mode: "insensitive" } } },
            ],
          });
        } else {
          // Múltiples palabras: buscar que al menos una palabra coincida
          // Esto hace la búsqueda más flexible y trae resultados similares
          where.AND.push({
            OR: keywordConditions,
          });
        }
      }
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

    let jobs: any[] = [];
    let total = 0;

    // Si hay búsqueda por texto, intentar primero búsqueda exacta (todas las palabras)
    // Si no hay resultados, usar búsqueda flexible (al menos una palabra)
    if (q.q) {
      const searchQuery = q.q.trim();
      const keywords = searchQuery
        .split(/\s+/)
        .filter((word: string) => word.length > 0)
        .map((word: string) => word.trim());

      if (keywords.length > 1) {
        // Para múltiples palabras: primero intentar búsqueda exacta (todas las palabras deben aparecer)
        const exactWhere = {
          ...where,
          AND: [
            ...where.AND.filter((condition: any) => {
              // Filtrar condiciones de búsqueda de texto existentes
              if (!condition.OR) return true;
              return !condition.OR.some((c: any) => c.title || c.description || c.requirements || c.empresa);
            }),
            {
              AND: keywords.map((keyword: string) => ({
                OR: [
                  { title: { contains: keyword, mode: "insensitive" } },
                  { description: { contains: keyword, mode: "insensitive" } },
                  { requirements: { contains: keyword, mode: "insensitive" } },
                  { empresa: { companyName: { contains: keyword, mode: "insensitive" } } },
                  // Buscar en industria y sector de la empresa
                  { empresa: { industria: { contains: keyword, mode: "insensitive" } } },
                  { empresa: { sector: { contains: keyword, mode: "insensitive" } } },
                ],
              })),
            },
          ],
        };

        const [exactJobs, exactTotal] = await Promise.all([
          this.prisma.job.findMany({
            where: exactWhere,
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
          this.prisma.job.count({ where: exactWhere }),
        ]);

        // Si hay resultados exactos, usarlos
        if (exactTotal > 0) {
          jobs = exactJobs;
          total = exactTotal;
        } else {
          // Si no hay resultados exactos, usar búsqueda flexible (ya definida en where)
          const [flexibleJobs, flexibleTotal] = await Promise.all([
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

          jobs = flexibleJobs;
          total = flexibleTotal;
        }
      } else {
        // Una sola palabra: usar búsqueda normal (ya definida en where)
        const [normalJobs, normalTotal] = await Promise.all([
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

        jobs = normalJobs;
        total = normalTotal;
      }
    } else {
      // Sin búsqueda de texto, usar búsqueda normal
      const [normalJobs, normalTotal] = await Promise.all([
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

      jobs = normalJobs;
      total = normalTotal;
    }

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
                await this.gcsUploadService.getObjectUrl(logo, 3600);
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
              (job.empresa as any).logo = await this.gcsUploadService.getObjectUrl(
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
