import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Req,
  Query,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AdminGuard } from "../common/guards/admin.guard";
import { createResponse } from "../common/mapper/api-response.mapper";
import { ModerationService } from "./moderation.service";

@ApiTags("moderation")
@Controller("api/moderation")
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class ModerationController {
  constructor(private moderationService: ModerationService) {}

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
}
