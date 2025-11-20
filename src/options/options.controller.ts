import {
  Controller,
  Get,
  Param,
  Query,
  BadRequestException,
} from "@nestjs/common";
import { OptionsService } from "./options.service";
import { Public } from "../common/decorators/public.decorator";
import { ApiTags } from "@nestjs/swagger";

@ApiTags("options")
@Controller("api/options")
export class OptionsController {
  constructor(private readonly optionsService: OptionsService) {}

  /**
   * GET /api/options
   * Obtiene todas las opciones disponibles en el idioma especificado
   */
  @Get()
  @Public()
  async getAllOptions(@Query("lang") lang?: string) {
    const language = lang || "es";
    try {
      const options = await this.optionsService.getAllOptions(language);
      return {
        success: true,
        data: options,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  /**
   * GET /api/options/:category
   * Obtiene las opciones de una categoría específica
   */
  @Get(":category")
  @Public()
  async getOptionsByCategory(
    @Param("category") category: string,
    @Query("lang") lang?: string
  ) {
    const language = lang || "es";
    try {
      const options = await this.optionsService.getOptions(category, language);
      return {
        success: true,
        category,
        data: options,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
