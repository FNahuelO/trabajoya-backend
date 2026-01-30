import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AdminGuard } from "../common/guards/admin.guard";
import { createResponse } from "../common/mapper/api-response.mapper";
import { ReportsService } from "./reports.service";
import { CreateReportDto } from "./dto";
import { ReportStatus } from "@prisma/client";

/**
 * Controlador de denuncias
 * Endpoints requeridos por Google Play para cumplir con políticas de seguridad
 */
@ApiTags("reports")
@Controller("api/reports")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Post()
  @ApiOperation({
    summary: "Crear una denuncia",
    description:
      "Permite denunciar un usuario o un mensaje específico. Requerido por Google Play.",
  })
  @ApiResponse({ status: 201, description: "Denuncia creada correctamente" })
  @ApiResponse({ status: 400, description: "Datos inválidos" })
  @ApiResponse({ status: 404, description: "Usuario o mensaje no encontrado" })
  @ApiResponse({ status: 409, description: "Ya existe una denuncia pendiente" })
  async createReport(@Req() req: any, @Body() dto: CreateReportDto) {
    const report = await this.reportsService.createReport(req.user?.sub, dto);
    return createResponse({
      success: true,
      message: "Gracias por tu reporte. Lo revisaremos pronto.",
      data: report,
    });
  }

  @Get("pending")
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: "Obtener denuncias pendientes (Admin)",
    description: "Retorna las denuncias pendientes de revisión",
  })
  @ApiResponse({ status: 200, description: "Denuncias pendientes" })
  async getPendingReports(@Query() query: any) {
    const page = parseInt(query.page) || 1;
    const pageSize = parseInt(query.pageSize) || 10;
    const data = await this.reportsService.getPendingReports(page, pageSize);
    return createResponse({
      success: true,
      message: "Denuncias pendientes obtenidas correctamente",
      data,
    });
  }

  @Get()
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: "Obtener todas las denuncias (Admin)",
    description: "Retorna todas las denuncias, opcionalmente filtradas por estado",
  })
  @ApiResponse({ status: 200, description: "Lista de denuncias" })
  async getAllReports(@Query() query: any) {
    const page = parseInt(query.page) || 1;
    const pageSize = parseInt(query.pageSize) || 10;
    const status = query.status as ReportStatus | undefined;
    const data = await this.reportsService.getAllReports(page, pageSize, status);
    return createResponse({
      success: true,
      message: "Denuncias obtenidas correctamente",
      data,
    });
  }

  @Patch(":id/review")
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: "Marcar denuncia como revisada (Admin)",
    description: "Marca una denuncia como revisada",
  })
  @ApiResponse({ status: 200, description: "Denuncia marcada como revisada" })
  @ApiResponse({ status: 404, description: "Denuncia no encontrada" })
  async markAsReviewed(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: { notes?: string }
  ) {
    const report = await this.reportsService.markAsReviewed(
      id,
      req.user?.sub,
      body.notes
    );
    return createResponse({
      success: true,
      message: "Denuncia marcada como revisada",
      data: report,
    });
  }

  @Patch(":id/resolve")
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: "Resolver denuncia (Admin)",
    description: "Marca una denuncia como resuelta",
  })
  @ApiResponse({ status: 200, description: "Denuncia resuelta" })
  @ApiResponse({ status: 404, description: "Denuncia no encontrada" })
  async resolveReport(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: { notes?: string }
  ) {
    const report = await this.reportsService.resolveReport(
      id,
      req.user?.sub,
      body.notes
    );
    return createResponse({
      success: true,
      message: "Denuncia resuelta",
      data: report,
    });
  }

  @Patch(":id/dismiss")
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: "Desestimar denuncia (Admin)",
    description: "Marca una denuncia como desestimada",
  })
  @ApiResponse({ status: 200, description: "Denuncia desestimada" })
  @ApiResponse({ status: 404, description: "Denuncia no encontrada" })
  async dismissReport(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: { notes?: string }
  ) {
    const report = await this.reportsService.dismissReport(
      id,
      req.user?.sub,
      body.notes
    );
    return createResponse({
      success: true,
      message: "Denuncia desestimada",
      data: report,
    });
  }

  @Get("stats")
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: "Obtener estadísticas de denuncias (Admin)",
    description: "Retorna estadísticas de denuncias",
  })
  @ApiResponse({ status: 200, description: "Estadísticas de denuncias" })
  async getReportStats() {
    const stats = await this.reportsService.getReportStats();
    return createResponse({
      success: true,
      message: "Estadísticas obtenidas correctamente",
      data: stats,
    });
  }
}




