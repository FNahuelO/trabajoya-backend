import {
  Controller,
  Get,
  Param,
  Query,
  BadRequestException,
  Post,
  Patch,
  Delete,
  Body,
  UseGuards,
} from "@nestjs/common";
import { OptionsService } from "./options.service";
import { CatalogsService } from "../catalogs/catalogs.service";
import { CreateCatalogDto, UpdateCatalogDto, ReorderCatalogDto, CatalogType } from "../catalogs/dto";
import { Public } from "../common/decorators/public.decorator";
import { ApiTags, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AdminGuard } from "../common/guards/admin.guard";
import { createResponse } from "../common/mapper/api-response.mapper";
import { ValidationPipe } from "@nestjs/common";

// Mapeo de categorías a tipos de catálogo
const categoryToCatalogType: Record<string, CatalogType> = {
  jobTypes: CatalogType.JOB_TYPES,
  experienceLevels: CatalogType.EXPERIENCE_LEVELS,
  applicationStatuses: CatalogType.APPLICATION_STATUSES,
  modalities: CatalogType.MODALITIES,
  languageLevels: CatalogType.LANGUAGE_LEVELS,
  companySizes: CatalogType.COMPANY_SIZES,
  sectors: CatalogType.SECTORS,
  studyTypes: CatalogType.STUDY_TYPES,
  studyStatuses: CatalogType.STUDY_STATUSES,
  maritalStatuses: CatalogType.MARITAL_STATUSES,
};

@ApiTags("options")
@Controller("api")
export class OptionsController {
  constructor(
    private readonly optionsService: OptionsService,
    private readonly catalogsService: CatalogsService
  ) {}

  /**
   * GET /api/options
   * Obtiene todas las opciones disponibles en el idioma especificado (público)
   */
  @Get("options")
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
   * Obtiene las opciones de una categoría específica (público)
   */
  @Get("options/:category")
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

  // Endpoints de administración

  /**
   * GET /api/admin/options
   * Lista todas las opciones por categoría (admin)
   */
  @Get("admin/options")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiQuery({ name: "category", required: false })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  async listOptions(
    @Query("category") category?: string,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string
  ) {
    const catalogType = category ? categoryToCatalogType[category] : undefined;
    const data = await this.catalogsService.findAll(
      catalogType,
      search,
      parseInt(page || "1"),
      parseInt(pageSize || "20")
    );
    return createResponse({
      success: true,
      message: "Opciones obtenidas correctamente",
      data,
    });
  }

  /**
   * GET /api/admin/options/:id
   * Obtiene una opción específica (admin)
   */
  @Get("admin/options/:id")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  async getOption(@Param("id") id: string) {
    const data = await this.catalogsService.findOne(id);
    return createResponse({
      success: true,
      message: "Opción obtenida correctamente",
      data,
    });
  }

  /**
   * POST /api/admin/options
   * Crea una nueva opción (admin)
   */
  @Post("admin/options")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  async createOption(@Body() dto: CreateCatalogDto) {
    const data = await this.catalogsService.create(dto);
    return createResponse({
      success: true,
      message: "Opción creada correctamente",
      data,
    });
  }

  /**
   * PATCH /api/admin/options/:id
   * Actualiza una opción (admin)
   */
  @Patch("admin/options/:id")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  async updateOption(@Param("id") id: string, @Body() dto: UpdateCatalogDto) {
    const data = await this.catalogsService.update(id, dto);
    return createResponse({
      success: true,
      message: "Opción actualizada correctamente",
      data,
    });
  }

  /**
   * PATCH /api/admin/options/:id/activate
   * Activa/desactiva una opción (admin)
   */
  @Patch("admin/options/:id/activate")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  async toggleActive(@Param("id") id: string) {
    const data = await this.catalogsService.toggleActive(id);
    return createResponse({
      success: true,
      message: "Estado de la opción actualizado correctamente",
      data,
    });
  }

  /**
   * PATCH /api/admin/options/reorder
   * Reordena opciones (admin)
   */
  @Patch("admin/options/reorder")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  async reorderOptions(
    @Body(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
    dto: ReorderCatalogDto
  ) {
    const data = await this.catalogsService.reorder(dto);
    return createResponse({
      success: true,
      message: "Orden actualizado correctamente",
      data,
    });
  }

  /**
   * DELETE /api/admin/options/:id
   * Elimina una opción (admin)
   */
  @Delete("admin/options/:id")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  async deleteOption(@Param("id") id: string) {
    const data = await this.catalogsService.remove(id);
    return createResponse({
      success: true,
      message: "Opción eliminada correctamente",
      data,
    });
  }
}
