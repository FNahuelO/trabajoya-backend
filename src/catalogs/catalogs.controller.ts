import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { CatalogsService } from "./catalogs.service";
import { CreateCatalogDto, UpdateCatalogDto, ReorderCatalogDto, CatalogType } from "./dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AdminGuard } from "../common/guards/admin.guard";
import { Public } from "../common/decorators/public.decorator";
import { createResponse } from "../common/mapper/api-response.mapper";

@ApiTags("catalogs")
@Controller("api")
export class CatalogsController {
  constructor(private readonly catalogsService: CatalogsService) {}

  // Endpoint público
  @Public()
  @Get("catalogs")
  @ApiQuery({ name: "lang", enum: ["es", "en", "pt"], required: false, example: "es" })
  async getPublicCatalogs(@Query("lang") lang?: "es" | "en" | "pt") {
    const data = await this.catalogsService.getPublicCatalogs(lang || "es");
    return createResponse({
      success: true,
      message: "Catálogos obtenidos correctamente",
      data,
    });
  }

  // Endpoints admin
  @Get("admin/catalogs")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiQuery({ name: "type", enum: CatalogType, required: false })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  async findAll(
    @Query("type") type?: CatalogType,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string
  ) {
    const data = await this.catalogsService.findAll(
      type,
      search,
      parseInt(page || "1"),
      parseInt(pageSize || "20")
    );
    return createResponse({
      success: true,
      message: "Catálogos obtenidos correctamente",
      data,
    });
  }

  @Get("admin/catalogs/:id")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  async findOne(@Param("id") id: string) {
    const data = await this.catalogsService.findOne(id);
    return createResponse({
      success: true,
      message: "Catálogo obtenido correctamente",
      data,
    });
  }

  @Post("admin/catalogs")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  async create(@Body() dto: CreateCatalogDto) {
    const data = await this.catalogsService.create(dto);
    return createResponse({
      success: true,
      message: "Catálogo creado correctamente",
      data,
    });
  }

  @Patch("admin/catalogs/:id")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  async update(@Param("id") id: string, @Body() dto: UpdateCatalogDto) {
    const data = await this.catalogsService.update(id, dto);
    return createResponse({
      success: true,
      message: "Catálogo actualizado correctamente",
      data,
    });
  }

  @Patch("admin/catalogs/:id/activate")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  async toggleActive(@Param("id") id: string) {
    const data = await this.catalogsService.toggleActive(id);
    return createResponse({
      success: true,
      message: "Estado del catálogo actualizado correctamente",
      data,
    });
  }

  @Patch("admin/catalogs/reorder")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  async reorder(@Body() dto: ReorderCatalogDto) {
    const data = await this.catalogsService.reorder(dto);
    return createResponse({
      success: true,
      message: "Orden actualizado correctamente",
      data,
    });
  }

  @Delete("admin/catalogs/:id")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  async remove(@Param("id") id: string) {
    const data = await this.catalogsService.remove(id);
    return createResponse({
      success: true,
      message: "Catálogo eliminado correctamente",
      data,
    });
  }
}

