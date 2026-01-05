import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AdminGuard } from "../common/guards/admin.guard";
import { createResponse } from "../common/mapper/api-response.mapper";
import { AdminService } from "./admin.service";

@ApiTags("admin")
@Controller("api/admin")
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get("users")
  async getUsers(@Query() query: any) {
    const page = parseInt(query.page) || 1;
    const pageSize = parseInt(query.pageSize) || 20;
    const userType = query.userType;
    const data = await this.adminService.getUsers(page, pageSize, userType);
    return createResponse({
      success: true,
      message: "Usuarios obtenidos correctamente",
      data,
    });
  }

  @Get("empresas")
  async getEmpresas(@Query() query: any) {
    const page = parseInt(query.page) || 1;
    const pageSize = parseInt(query.pageSize) || 20;
    const data = await this.adminService.getEmpresas(page, pageSize);
    return createResponse({
      success: true,
      message: "Empresas obtenidas correctamente",
      data,
    });
  }

  @Get("postulantes")
  async getPostulantes(@Query() query: any) {
    const page = parseInt(query.page) || 1;
    const pageSize = parseInt(query.pageSize) || 20;
    const data = await this.adminService.getPostulantes(page, pageSize);
    return createResponse({
      success: true,
      message: "Postulantes obtenidos correctamente",
      data,
    });
  }

  @Get("jobs/all")
  async getAllJobs(@Query() query: any) {
    const page = parseInt(query.page) || 1;
    const pageSize = parseInt(query.pageSize) || 20;
    const status = query.status;
    const moderationStatus = query.moderationStatus;
    const data = await this.adminService.getAllJobs(
      page,
      pageSize,
      status,
      moderationStatus
    );
    return createResponse({
      success: true,
      message: "Trabajos obtenidos correctamente",
      data,
    });
  }

  @Get("applications")
  async getApplications(@Query() query: any) {
    const page = parseInt(query.page) || 1;
    const pageSize = parseInt(query.pageSize) || 20;
    const status = query.status;
    const data = await this.adminService.getApplications(
      page,
      pageSize,
      status
    );
    return createResponse({
      success: true,
      message: "Aplicaciones obtenidas correctamente",
      data,
    });
  }

  @Get("messages")
  async getMessages(@Query() query: any) {
    const page = parseInt(query.page) || 1;
    const pageSize = parseInt(query.pageSize) || 20;
    const data = await this.adminService.getMessages(page, pageSize);
    return createResponse({
      success: true,
      message: "Mensajes obtenidos correctamente",
      data,
    });
  }

  @Get("calls")
  async getCalls(@Query() query: any) {
    const page = parseInt(query.page) || 1;
    const pageSize = parseInt(query.pageSize) || 20;
    const data = await this.adminService.getCalls(page, pageSize);
    return createResponse({
      success: true,
      message: "Llamadas obtenidas correctamente",
      data,
    });
  }

  @Get("subscriptions")
  async getSubscriptions(@Query() query: any) {
    const page = parseInt(query.page) || 1;
    const pageSize = parseInt(query.pageSize) || 20;
    const status = query.status;
    const data = await this.adminService.getSubscriptions(
      page,
      pageSize,
      status
    );
    return createResponse({
      success: true,
      message: "Suscripciones obtenidas correctamente",
      data,
    });
  }

  @Get("stats")
  async getStats() {
    const data = await this.adminService.getStats();
    return createResponse({
      success: true,
      message: "Estadísticas obtenidas correctamente",
      data,
    });
  }
}
