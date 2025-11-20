import { Injectable } from "@nestjs/common";
import { I18nService } from "nestjs-i18n";

@Injectable()
export class OptionsService {
  constructor(private readonly i18n: I18nService) {}

  /**
   * Obtiene las opciones traducidas según el idioma especificado
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

    const options = await this.i18n.t(`options.${category}`, {
      lang,
    });

    // Convertir el objeto a un array de opciones con value y label
    const optionsArray = Object.entries(
      options as unknown as Record<string, string>
    ).map(([value, label]) => ({
      value,
      label,
    }));

    return optionsArray;
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
      const label = await this.i18n.t(`options.${category}.${value}`, {
        lang,
      });
      return label as string;
    } catch (error) {
      return value; // Si no encuentra traducción, devuelve el valor original
    }
  }
}
