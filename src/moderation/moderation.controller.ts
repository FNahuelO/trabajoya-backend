import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  Query,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AdminGuard } from "../common/guards/admin.guard";
import { createResponse } from "../common/mapper/api-response.mapper";
import { ContentModerationService } from "../common/services/content-moderation.service";
import { ModerationService } from "./moderation.service";

@ApiTags("moderation")
@Controller("api/moderation")
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class ModerationController {
  constructor(
    private moderationService: ModerationService,
    private contentModeration: ContentModerationService
  ) {}

  @Get("terms")
  @ApiOperation({ summary: "Listar términos del filtro automático de avisos" })
  async listTerms() {
    const data = await this.contentModeration.listTerms();
    return createResponse({
      success: true,
      message: "Términos obtenidos correctamente",
      data,
    });
  }

  @Post("terms")
  @ApiOperation({ summary: "Agregar un término al filtro automático" })
  async createTerm(@Body() body: any) {
    const data = await this.contentModeration.createTerm(body || {});
    return createResponse({
      success: true,
      message: "Término agregado correctamente",
      data,
    });
  }

  @Post("terms/test")
  @ApiOperation({ summary: "Probar un texto contra el filtro automático" })
  async testContent(@Body() body: any) {
    await this.contentModeration.refreshTerms();
    const data = this.contentModeration.analyzeJobContent({
      title: String(body?.title || ""),
      description: String(body?.description || ""),
      requirements: String(body?.requirements || ""),
    });
    return createResponse({
      success: true,
      message: "Análisis realizado",
      data,
    });
  }

  @Patch("terms/:id")
  @ApiOperation({ summary: "Editar o activar/desactivar un término" })
  async updateTerm(@Param("id") id: string, @Body() body: any) {
    const data = await this.contentModeration.updateTerm(id, body || {});
    return createResponse({
      success: true,
      message: "Término actualizado correctamente",
      data,
    });
  }

  @Delete("terms/:id")
  @ApiOperation({ summary: "Eliminar un término" })
  async deleteTerm(@Param("id") id: string) {
    await this.contentModeration.deleteTerm(id);
    return createResponse({
      success: true,
      message: "Término eliminado correctamente",
    });
  }

  @Get("jobs/pending")
  async getPendingJobs(@Query() query: any) {
    const page = parseInt(query.page) || 1;
    const pageSize = parseInt(query.pageSize) || 10;
    const data = await this.moderationService.getPendingJobs(page, pageSize);
    return createResponse({
      success: true,
      message: "Empleos pendientes obtenidos correctamente",
      data,
    });
  }

  @Get("jobs/rejected")
  async getRejectedJobs(@Query() query: any) {
    const page = parseInt(query.page) || 1;
    const pageSize = parseInt(query.pageSize) || 10;
    const data = await this.moderationService.getRejectedJobs(page, pageSize);
    return createResponse({
      success: true,
      message: "Empleos rechazados obtenidos correctamente",
      data,
    });
  }

  @Post("jobs/:id/approve")
  async approveJob(@Param("id") id: string, @Req() req: any) {
    const data = await this.moderationService.approveJob(id, req.user?.sub);
    return createResponse({
      success: true,
      message: "Empleo aprobado correctamente",
      data,
    });
  }

  @Post("jobs/:id/reject")
  async rejectJob(
    @Param("id") id: string,
    @Body() body: { reason: string },
    @Req() req: any
  ) {
    const data = await this.moderationService.rejectJob(
      id,
      body.reason,
      req.user?.sub
    );
    return createResponse({
      success: true,
      message: "Empleo rechazado correctamente",
      data,
    });
  }

  @Get("jobs/:id")
  async getJobDetails(@Param("id") id: string) {
    const data = await this.moderationService.getJobDetails(id);
    return createResponse({
      success: true,
      message: "Detalles del empleo obtenidos correctamente",
      data,
    });
  }

  @Get("stats")
  async getModerationStats() {
    const data = await this.moderationService.getModerationStats();
    return createResponse({
      success: true,
      message: "Estadísticas de moderación obtenidas correctamente",
      data,
    });
  }

  @Get("reports/pending")
  @ApiOperation({
    summary: "Obtener denuncias pendientes",
    description: "Retorna las denuncias pendientes de revisión. Requerido por Google Play.",
  })
  async getPendingReports(@Query() query: any) {
    const page = parseInt(query.page) || 1;
    const pageSize = parseInt(query.pageSize) || 10;
    const data = await this.moderationService.getPendingReports(page, pageSize);
    return createResponse({
      success: true,
      message: "Denuncias pendientes obtenidas correctamente",
      data,
    });
  }

  @Get("reports")
  @ApiOperation({
    summary: "Obtener todas las denuncias",
    description: "Retorna todas las denuncias, opcionalmente filtradas por estado",
  })
  async getAllReports(@Query() query: any) {
    const page = parseInt(query.page) || 1;
    const pageSize = parseInt(query.pageSize) || 10;
    const status = query.status;
    const data = await this.moderationService.getAllReports(page, pageSize, status);
    return createResponse({
      success: true,
      message: "Denuncias obtenidas correctamente",
      data,
    });
  }

  @Get("reports/stats")
  @ApiOperation({
    summary: "Obtener estadísticas de denuncias",
    description: "Retorna estadísticas de denuncias",
  })
  async getReportStats() {
    const data = await this.moderationService.getReportStats();
    return createResponse({
      success: true,
      message: "Estadísticas de denuncias obtenidas correctamente",
      data,
    });
  }
}
