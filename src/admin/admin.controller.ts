import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Query,
  Param,
  Body,
  Req,
  UseGuards,
} from "@nestjs/common";
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

  @Get("promotions")
  async getPromotions(@Query() query: any) {
    const page = parseInt(query.page) || 1;
    const pageSize = parseInt(query.pageSize) || 20;
    const status = query.status;
    const data = await this.adminService.getPromotions(page, pageSize, status);
    return createResponse({
      success: true,
      message: "Promociones obtenidas correctamente",
      data,
    });
  }

  @Get("payments")
  async getPayments(@Query() query: any) {
    const page = parseInt(query.page) || 1;
    const pageSize = parseInt(query.pageSize) || 20;
    const status = query.status;
    const paymentMethod = query.paymentMethod;
    const search = query.search;
    const dateFrom = query.dateFrom;
    const dateTo = query.dateTo;
    const data = await this.adminService.getPayments(
      page,
      pageSize,
      status,
      paymentMethod,
      search,
      dateFrom,
      dateTo
    );
    return createResponse({
      success: true,
      message: "Pagos obtenidos correctamente",
      data,
    });
  }

  @Get("payments/stats")
  async getPaymentStats() {
    const data = await this.adminService.getPaymentStats();
    return createResponse({
      success: true,
      message: "Estadísticas de pagos obtenidas correctamente",
      data,
    });
  }

  @Get("video-meetings")
  async getVideoMeetings(@Query() query: any) {
    const page = parseInt(query.page) || 1;
    const pageSize = parseInt(query.pageSize) || 20;
    const status = query.status;
    const data = await this.adminService.getVideoMeetings(
      page,
      pageSize,
      status
    );
    return createResponse({
      success: true,
      message: "Reuniones obtenidas correctamente",
      data,
    });
  }

  @Get("entitlements")
  async getEntitlements(@Query() query: any) {
    const page = parseInt(query.page) || 1;
    const pageSize = parseInt(query.pageSize) || 20;
    const status = query.status;
    const data = await this.adminService.getEntitlements(
      page,
      pageSize,
      status
    );
    return createResponse({
      success: true,
      message: "Entitlements obtenidos correctamente",
      data,
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // ROLES
  // ══════════════════════════════════════════════════════════════════════

  @Get("roles")
  async getRoles() {
    const data = await this.adminService.getRoles();
    return createResponse({
      success: true,
      message: "Roles obtenidos correctamente",
      data,
    });
  }

  @Get("roles/:id")
  async getRoleById(@Param("id") id: string) {
    const data = await this.adminService.getRoleById(id);
    return createResponse({
      success: true,
      message: "Rol obtenido correctamente",
      data,
    });
  }

  @Post("roles")
  async createRole(
    @Body()
    body: {
      name: string;
      displayName: string;
      description?: string;
      permissions: string[];
    }
  ) {
    const data = await this.adminService.createRole(body);
    return createResponse({
      success: true,
      message: "Rol creado correctamente",
      data,
    });
  }

  @Patch("roles/:id")
  async updateRole(
    @Param("id") id: string,
    @Body()
    body: {
      displayName?: string;
      description?: string;
      permissions?: string[];
    }
  ) {
    const data = await this.adminService.updateRole(id, body);
    return createResponse({
      success: true,
      message: "Rol actualizado correctamente",
      data,
    });
  }

  @Delete("roles/:id")
  async deleteRole(@Param("id") id: string) {
    const data = await this.adminService.deleteRole(id);
    return createResponse({
      success: true,
      message: "Rol eliminado correctamente",
      data,
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // USUARIOS INTERNOS
  // ══════════════════════════════════════════════════════════════════════

  @Get("internal-users")
  async getInternalUsers(@Query() query: any) {
    const page = parseInt(query.page) || 1;
    const pageSize = parseInt(query.pageSize) || 20;
    const search = query.search;
    const data = await this.adminService.getInternalUsers(
      page,
      pageSize,
      search
    );
    return createResponse({
      success: true,
      message: "Usuarios internos obtenidos correctamente",
      data,
    });
  }

  @Get("internal-users/:id")
  async getInternalUserById(@Param("id") id: string) {
    const data = await this.adminService.getInternalUserById(id);
    return createResponse({
      success: true,
      message: "Usuario interno obtenido correctamente",
      data,
    });
  }

  @Post("internal-users")
  async createInternalUser(
    @Body()
    body: {
      email: string;
      password: string;
      roleId?: string;
    }
  ) {
    const data = await this.adminService.createInternalUser(body);
    return createResponse({
      success: true,
      message: "Usuario interno creado correctamente",
      data,
    });
  }

  @Patch("internal-users/:id")
  async updateInternalUser(
    @Param("id") id: string,
    @Body()
    body: {
      email?: string;
      password?: string;
      roleId?: string | null;
      isVerified?: boolean;
    }
  ) {
    const data = await this.adminService.updateInternalUser(id, body);
    return createResponse({
      success: true,
      message: "Usuario interno actualizado correctamente",
      data,
    });
  }

  @Delete("internal-users/:id")
  async deleteInternalUser(@Param("id") id: string, @Req() req: any) {
    const data = await this.adminService.deleteInternalUser(
      id,
      req.user?.sub
    );
    return createResponse({
      success: true,
      message: "Usuario interno eliminado correctamente",
      data,
    });
  }
}
