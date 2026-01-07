import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCatalogDto, UpdateCatalogDto, ReorderCatalogDto, CatalogType } from "./dto";

@Injectable()
export class CatalogsService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    type?: CatalogType,
    search?: string,
    page: number = 1,
    pageSize: number = 20
  ) {
    const skip = (page - 1) * pageSize;
    const where: any = {};

    if (type) {
      where.type = type;
    }

    if (search) {
      where.OR = [
        { code: { contains: search, mode: "insensitive" } },
        {
          translations: {
            some: {
              label: { contains: search, mode: "insensitive" },
            },
          },
        },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.catalog.findMany({
        where,
        include: {
          translations: true,
        },
        orderBy: [{ type: "asc" }, { order: "asc" }],
        skip,
        take: pageSize,
      }),
      this.prisma.catalog.count({ where }),
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
    const catalog = await this.prisma.catalog.findUnique({
      where: { id },
      include: {
        translations: true,
      },
    });

    if (!catalog) {
      throw new NotFoundException(`Catálogo con id ${id} no encontrado`);
    }

    return catalog;
  }

  async create(dto: CreateCatalogDto) {
    // Verificar si ya existe un catálogo con el mismo type y code
    const existing = await this.prisma.catalog.findUnique({
      where: {
        type_code: {
          type: dto.type,
          code: dto.code,
        },
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Ya existe un catálogo con type ${dto.type} y code ${dto.code}`
      );
    }

    // Si no se proporciona order, obtener el máximo order del tipo y sumar 10
    let order = dto.order;
    if (order === undefined) {
      const maxOrder = await this.prisma.catalog.findFirst({
        where: { type: dto.type },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      order = maxOrder ? maxOrder.order + 10 : 10;
    }

    return this.prisma.catalog.create({
      data: {
        type: dto.type,
        code: dto.code,
        isActive: dto.isActive ?? true,
        order,
        translations: {
          create: [
            { lang: "ES", label: dto.translations.es },
            { lang: "EN", label: dto.translations.en },
            { lang: "PT", label: dto.translations.pt },
          ],
        },
      },
      include: {
        translations: true,
      },
    });
  }

  async update(id: string, dto: UpdateCatalogDto) {
    const catalog = await this.findOne(id);

    const updateData: any = {};

    if (dto.isActive !== undefined) {
      updateData.isActive = dto.isActive;
    }

    if (dto.order !== undefined) {
      updateData.order = dto.order;
    }

    // Actualizar traducciones si se proporcionan
    if (dto.translations) {
      const translations = dto.translations;
      
      // Actualizar o crear cada traducción
      const translationUpdates = [];
      
      if (translations.es !== undefined) {
        translationUpdates.push(
          this.prisma.catalogTranslation.upsert({
            where: {
              catalogId_lang: {
                catalogId: id,
                lang: "ES",
              },
            },
            update: { label: translations.es },
            create: {
              catalogId: id,
              lang: "ES",
              label: translations.es,
            },
          })
        );
      }

      if (translations.en !== undefined) {
        translationUpdates.push(
          this.prisma.catalogTranslation.upsert({
            where: {
              catalogId_lang: {
                catalogId: id,
                lang: "EN",
              },
            },
            update: { label: translations.en },
            create: {
              catalogId: id,
              lang: "EN",
              label: translations.en,
            },
          })
        );
      }

      if (translations.pt !== undefined) {
        translationUpdates.push(
          this.prisma.catalogTranslation.upsert({
            where: {
              catalogId_lang: {
                catalogId: id,
                lang: "PT",
              },
            },
            update: { label: translations.pt },
            create: {
              catalogId: id,
              lang: "PT",
              label: translations.pt,
            },
          })
        );
      }

      await Promise.all(translationUpdates);
    }

    if (Object.keys(updateData).length > 0) {
      await this.prisma.catalog.update({
        where: { id },
        data: updateData,
      });
    }

    return this.findOne(id);
  }

  async reorder(dto: ReorderCatalogDto) {
    const updates = dto.items.map((item) =>
      this.prisma.catalog.update({
        where: { id: item.id },
        data: { order: item.order },
      })
    );

    await Promise.all(updates);

    return { success: true, message: "Orden actualizado correctamente" };
  }

  async toggleActive(id: string) {
    const catalog = await this.findOne(id);
    return this.update(id, { isActive: !catalog.isActive });
  }

  async remove(id: string) {
    const catalog = await this.findOne(id);
    // Soft delete: marcar como inactivo
    return this.update(id, { isActive: false });
  }

  // Endpoint público: obtener catálogos activos por idioma
  async getPublicCatalogs(lang: "es" | "en" | "pt" = "es") {
    const langUpper = lang.toUpperCase() as "ES" | "EN" | "PT";

    const catalogTypes: Array<"JOB_AREA" | "JOB_TYPE" | "JOB_LEVEL" | "JOB_TYPES" | "EXPERIENCE_LEVELS" | "APPLICATION_STATUSES" | "MODALITIES" | "LANGUAGE_LEVELS" | "COMPANY_SIZES" | "SECTORS" | "STUDY_TYPES" | "STUDY_STATUSES" | "MARITAL_STATUSES"> = [
      "JOB_AREA",
      "JOB_TYPE",
      "JOB_LEVEL",
      "JOB_TYPES",
      "EXPERIENCE_LEVELS",
      "APPLICATION_STATUSES",
      "MODALITIES",
      "LANGUAGE_LEVELS",
      "COMPANY_SIZES",
      "SECTORS",
      "STUDY_TYPES",
      "STUDY_STATUSES",
      "MARITAL_STATUSES",
    ];

    const catalogsByType = await Promise.all(
      catalogTypes.map((type) =>
        this.prisma.catalog.findMany({
          where: {
            type,
            isActive: true,
          },
          include: {
            translations: {
              where: { lang: langUpper },
            },
          },
          orderBy: { order: "asc" },
        })
      )
    );

    // Mapear los tipos a sus claves en camelCase para mantener compatibilidad
    const typeKeyMap: Record<string, string> = {
      JOB_AREA: "jobAreas",
      JOB_TYPE: "jobTypes",
      JOB_LEVEL: "jobLevels",
      JOB_TYPES: "jobTypesList",
      EXPERIENCE_LEVELS: "experienceLevels",
      APPLICATION_STATUSES: "applicationStatuses",
      MODALITIES: "modalities",
      LANGUAGE_LEVELS: "languageLevels",
      COMPANY_SIZES: "companySizes",
      SECTORS: "sectors",
      STUDY_TYPES: "studyTypes",
      STUDY_STATUSES: "studyStatuses",
      MARITAL_STATUSES: "maritalStatuses",
    };

    const result: Record<string, Array<{ code: string; label: string; order: number }>> = {};

    catalogTypes.forEach((type, index) => {
      const key = typeKeyMap[type] || type.toLowerCase();
      result[key] = catalogsByType[index].map((item) => ({
        code: item.code,
        label: item.translations[0]?.label || "",
        order: item.order,
      }));
    });

    return result;
  }
}

