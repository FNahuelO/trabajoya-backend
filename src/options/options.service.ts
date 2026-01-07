import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

// Mapeo de categorías a tipos de catálogo
const categoryToCatalogType: Record<string, string> = {
  jobTypes: "JOB_TYPES",
  experienceLevels: "EXPERIENCE_LEVELS",
  applicationStatuses: "APPLICATION_STATUSES",
  modalities: "MODALITIES",
  languageLevels: "LANGUAGE_LEVELS",
  companySizes: "COMPANY_SIZES",
  sectors: "SECTORS",
  studyTypes: "STUDY_TYPES",
  studyStatuses: "STUDY_STATUSES",
  maritalStatuses: "MARITAL_STATUSES",
};

@Injectable()
export class OptionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtiene las opciones traducidas según el idioma especificado desde catálogos
   */
  async getOptions(category: string, lang: string) {
    const validCategories = [
      "jobTypes",
      "experienceLevels",
      "applicationStatuses",
      "modalities",
      "languageLevels",
      "companySizes",
      "sectors",
      "studyTypes",
      "studyStatuses",
      "maritalStatuses",
    ];

    if (!validCategories.includes(category)) {
      throw new Error(`Categoría inválida: ${category}`);
    }

    const catalogType = categoryToCatalogType[category] as any;
    const langUpper = lang.toUpperCase() as "ES" | "EN" | "PT";

    const catalogs = await this.prisma.catalog.findMany({
      where: {
        type: catalogType,
        isActive: true,
      },
      include: {
        translations: {
          where: { lang: langUpper },
        },
      },
      orderBy: { order: "asc" },
    });

    // Convertir a formato { value, label }
    return catalogs.map((catalog) => ({
      value: catalog.code,
      label: catalog.translations[0]?.label || catalog.code,
    }));
  }

  /**
   * Obtiene todas las opciones disponibles en un solo llamado
   */
  async getAllOptions(lang: string) {
    const categories = [
      "jobTypes",
      "experienceLevels",
      "applicationStatuses",
      "modalities",
      "languageLevels",
      "companySizes",
      "sectors",
      "studyTypes",
      "studyStatuses",
      "maritalStatuses",
    ];

    const allOptions: Record<string, any> = {};

    for (const category of categories) {
      allOptions[category] = await this.getOptions(category, lang);
    }

    return allOptions;
  }

  /**
   * Obtiene una opción específica traducida
   */
  async getOptionLabel(
    category: string,
    value: string,
    lang: string
  ): Promise<string> {
    try {
      const catalogType = categoryToCatalogType[category] as any;
      const langUpper = lang.toUpperCase() as "ES" | "EN" | "PT";

      const catalog = await this.prisma.catalog.findFirst({
        where: {
          type: catalogType,
          code: value,
          isActive: true,
        },
        include: {
          translations: {
            where: { lang: langUpper },
          },
        },
      });

      return catalog?.translations[0]?.label || value;
    } catch (error) {
      return value; // Si no encuentra traducción, devuelve el valor original
    }
  }
}
