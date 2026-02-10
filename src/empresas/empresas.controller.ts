import {
  Body,
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Param,
  Req,
  UseGuards,
  Patch,
  Query,
} from "@nestjs/common";
import { EmpresasService } from "./empresas.service";
import { JobDescriptionService } from "../jobs/job-description.service";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { createResponse } from "src/common/mapper/api-response.mapper";

@ApiTags("empresas")
@Controller("api/empresas")
export class EmpresasController {
  constructor(
    private service: EmpresasService,
    private jobDescriptionService: JobDescriptionService
  ) {}

  @Get("profile")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async me(@Req() req: any) {
    return createResponse({
      success: true,
      message: "Perfil de empresa obtenido correctamente",
      data: await this.service.getByUser(req.user?.sub),
    });
  }

  @Put("profile")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async update(@Req() req: any, @Body() dto: any) {
    return createResponse({
      success: true,
      message: "Perfil de empresa actualizado correctamente",
      data: await this.service.updateByUser(req.user?.sub, dto),
    });
  }

  @Get("jobs")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getJobs(@Req() req: any) {
    return createResponse({
      success: true,
      message: "Trabajos obtenidos correctamente",
      data: await this.service.getJobs(req.user?.sub),
    });
  }

  @Post("jobs")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async createJob(@Req() req: any, @Body() dto: any) {
    return createResponse({
      success: true,
      message: "Trabajo creado correctamente",
      data: await this.service.createJob(req.user?.sub, dto),
    });
  }

  @Post("jobs/generate-description")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Generar descripción de trabajo con IA (solo PREMIUM/ENTERPRISE)" })
  async generateJobDescription(@Req() req: any, @Body() dto: any) {
    // Obtener el perfil de empresa para tener el ID
    const empresa = await this.service.getByUser(req.user?.sub);
    if (!empresa || !empresa.id) {
      throw new Error("Empresa no encontrada");
    }

    const result = await this.jobDescriptionService.generateJobDescription(
      empresa.id,
      dto
    );
    
    return createResponse({
      success: true,
      message: "Descripción generada correctamente",
      data: result,
    });
  }

  @Put("jobs/:id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async updateJob(@Req() req: any, @Param("id") id: string, @Body() dto: any) {
    return createResponse({
      success: true,
      message: "Trabajo actualizado correctamente",
      data: await this.service.updateJob(req.user?.sub, id, dto),
    });
  }

  @Delete("jobs/:id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async deleteJob(@Req() req: any, @Param("id") id: string) {
    return createResponse({
      success: true,
      message: "Trabajo eliminado correctamente",
      data: await this.service.deleteJob(req.user?.sub, id),
    });
  }

  @Post("jobs/:id/payment/create-order")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async createJobPaymentOrder(@Req() req: any, @Param("id") id: string) {
    return createResponse({
      success: true,
      message: "Orden de pago creada correctamente",
      data: await this.service.createJobPaymentOrder(req.user?.sub, id),
    });
  }

  @Post("jobs/:id/payment/confirm")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async confirmJobPayment(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: { orderId: string }
  ) {
    return createResponse({
      success: true,
      message: "Pago confirmado correctamente, el empleo está en revisión",
      data: await this.service.confirmJobPayment(
        req.user?.sub,
        id,
        body.orderId
      ),
    });
  }

  @Get("jobs/:jobId/applicants")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getJobApplicants(@Req() req: any, @Param("jobId") jobId: string) {
    return createResponse({
      success: true,
      message: "Postulantes obtenidos correctamente",
      data: await this.service.getJobApplicants(req.user?.sub, jobId),
    });
  }

  @Patch("applications/:id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  updateApplicationStatusPatch(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: { status: string; notes?: string }
  ) {
    return createResponse({
      success: true,
      message: "Estado de la aplicación actualizado correctamente",
      data: this.service.updateApplicationStatus(
        req.user?.sub,
        id,
        dto.status,
        dto.notes
      ),
    });
  }

  @Put("applications/:id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  updateApplicationStatus(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: { status: string; notes?: string }
  ) {
    return createResponse({
      success: true,
      message: "Estado de la aplicación actualizado correctamente",
      data: this.service.updateApplicationStatus(
        req.user?.sub,
        id,
        dto.status,
        dto.notes
      ),
    });
  }

  // Endpoints para moderación (coordinadores)
  @Get("moderation/pending")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getPendingJobs(@Req() req: any) {
    // TODO: Agregar verificación de rol de coordinador
    return createResponse({
      success: true,
      message: "Empleos pendientes de moderación obtenidos correctamente",
      data: await this.service.getPendingJobs(),
    });
  }

  @Get("moderation/rejected")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getRejectedJobs(@Req() req: any) {
    // TODO: Agregar verificación de rol de coordinador
    return createResponse({
      success: true,
      message: "Empleos rechazados obtenidos correctamente",
      data: await this.service.getRejectedJobs(),
    });
  }

  @Get("moderation/job/:id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getJobForModeration(@Req() req: any, @Param("id") id: string) {
    // TODO: Agregar verificación de rol de coordinador
    return createResponse({
      success: true,
      message: "Empleo obtenido correctamente",
      data: await this.service.getJobForModeration(id),
    });
  }

  @Post("moderation/job/:id/approve")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async approveJob(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: { reason?: string }
  ) {
    // TODO: Agregar verificación de rol de coordinador
    return createResponse({
      success: true,
      message: "Empleo aprobado correctamente",
      data: await this.service.approveJob(id, req.user?.sub, dto.reason),
    });
  }

  @Post("moderation/job/:id/reject")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async rejectJob(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: { reason: string }
  ) {
    // TODO: Agregar verificación de rol de coordinador
    return createResponse({
      success: true,
      message: "Empleo rechazado correctamente",
      data: await this.service.rejectJob(id, req.user?.sub, dto.reason),
    });
  }

  // Endpoint para buscar empresas (igual que /api/jobs)
  // Debe ir al final para evitar conflictos con rutas más específicas
  @Get()
  @ApiOperation({ summary: "Buscar empresas" })
  async search(@Query() query: any) {
    return createResponse({
      success: true,
      message: "Empresas obtenidas correctamente",
      data: await this.service.search(query),
    });
  }
}
