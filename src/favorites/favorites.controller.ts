import {
  Controller,
  Get,
  Param,
  Post,
  Delete,
  UseGuards,
  Req,
} from "@nestjs/common";
import { FavoritesService } from "./favorites.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { createResponse } from "../common/mapper/api-response.mapper";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";

@ApiTags("favorites")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller("api/favorites")
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get("jobs")
  async listJobs(@Req() req: any) {
    const data = await this.favoritesService.listJobFavorites(
      req.user?.sub || req.user?.id
    );
    return createResponse({
      success: true,
      message: "Favoritos de trabajos obtenidos correctamente",
      data,
    });
  }

  @Post("jobs/:jobId")
  async addJob(@Req() req: any, @Param("jobId") jobId: string) {
    const data = await this.favoritesService.addJobFavorite(
      req.user?.sub || req.user?.id,
      jobId
    );
    return createResponse({
      success: true,
      message: "Trabajo agregado a favoritos correctamente",
      data,
    });
  }

  @Delete("jobs/:jobId")
  async removeJob(@Req() req: any, @Param("jobId") jobId: string) {
    await this.favoritesService.removeJobFavorite(
      req.user?.sub || req.user?.id,
      jobId
    );
    return createResponse({
      success: true,
      message: "Trabajo eliminado de favoritos correctamente",
      data: null,
    });
  }

  @Get("companies")
  async listCompanies(@Req() req: any) {
    const data = await this.favoritesService.listCompanyFavorites(
      req.user?.sub || req.user?.id
    );
    return createResponse({
      success: true,
      message: "Favoritos de empresas obtenidos correctamente",
      data,
    });
  }

  @Post("companies/:empresaId")
  async addCompany(@Req() req: any, @Param("empresaId") empresaId: string) {
    const data = await this.favoritesService.addCompanyFavorite(
      req.user?.sub || req.user?.id,
      empresaId
    );
    return createResponse({
      success: true,
      message: "Empresa agregada a favoritos correctamente",
      data,
    });
  }

  @Delete("companies/:empresaId")
  async removeCompany(@Req() req: any, @Param("empresaId") empresaId: string) {
    await this.favoritesService.removeCompanyFavorite(
      req.user?.sub || req.user?.id,
      empresaId
    );
    return createResponse({
      success: true,
      message: "Empresa eliminada de favoritos correctamente",
      data: null,
    });
  }
}
