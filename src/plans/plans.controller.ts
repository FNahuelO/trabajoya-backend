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
  ValidationPipe,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { PlansService } from "./plans.service";
import { CreatePlanDto, UpdatePlanDto, ReorderPlanDto } from "./dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AdminGuard } from "../common/guards/admin.guard";
import { Public } from "../common/decorators/public.decorator";
import { createResponse } from "../common/mapper/api-response.mapper";

@ApiTags("plans")
@Controller("api")
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  // Endpoint público para obtener planes activos
  @Public()
  @Get("plans")
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  async getPublicPlans(
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string
  ) {
    // Usar método específico que filtra por isActive en la base de datos
    const data = await this.plansService.findAllActive(
      parseInt(page || "1"),
      parseInt(pageSize || "100") // Aumentar pageSize por defecto para obtener todos los planes
    );
    return createResponse({
      success: true,
      message: "Planes obtenidos correctamente",
      data,
    });
  }

  @Get("admin/plans")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  @ApiQuery({ name: "search", required: false, type: String })
  async findAll(
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("search") search?: string
  ) {
    const data = await this.plansService.findAll(
      parseInt(page || "1"),
      parseInt(pageSize || "20"),
      search
    );
    return createResponse({
      success: true,
      message: "Planes obtenidos correctamente",
      data,
    });
  }

  @Get("admin/plans/:id")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  async findOne(@Param("id") id: string) {
    const data = await this.plansService.findOne(id);
    return createResponse({
      success: true,
      message: "Plan obtenido correctamente",
      data,
    });
  }

  @Post("admin/plans")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  async create(@Body() dto: CreatePlanDto) {
    const data = await this.plansService.create(dto);
    return createResponse({
      success: true,
      message: "Plan creado correctamente",
      data,
    });
  }

  @Patch("admin/plans/:id")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  async update(@Param("id") id: string, @Body() dto: UpdatePlanDto) {
    const data = await this.plansService.update(id, dto);
    return createResponse({
      success: true,
      message: "Plan actualizado correctamente",
      data,
    });
  }

  @Patch("admin/plans/:id/activate")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  async toggleActive(@Param("id") id: string) {
    const data = await this.plansService.toggleActive(id);
    return createResponse({
      success: true,
      message: "Estado del plan actualizado correctamente",
      data,
    });
  }

  @Patch("admin/plans/reorder")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  async reorder(
    @Body(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
    dto: ReorderPlanDto
  ) {
    const data = await this.plansService.reorder(dto.items);
    return createResponse({
      success: true,
      message: "Orden actualizado correctamente",
      data,
    });
  }

  @Delete("admin/plans/:id")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  async remove(@Param("id") id: string) {
    const data = await this.plansService.remove(id);
    return createResponse({
      success: true,
      message: "Plan eliminado correctamente",
      data,
    });
  }
}

