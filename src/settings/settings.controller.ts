import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AdminGuard } from "../common/guards/admin.guard";
import { createResponse } from "../common/mapper/api-response.mapper";
import { SettingsService } from "./settings.service";
import { UpdateSupportConfigDto } from "./dto/update-support-config.dto";

@ApiTags("admin-settings")
@Controller("api/admin/settings")
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get("support")
  async getSupport() {
    const data = await this.settingsService.getSupportConfig();
    return createResponse({
      success: true,
      message: "Configuración de soporte obtenida correctamente",
      data,
    });
  }

  @Patch("support")
  async updateSupport(@Body() dto: UpdateSupportConfigDto) {
    const data = await this.settingsService.updateSupportConfig(dto);
    return createResponse({
      success: true,
      message: "Configuración de soporte actualizada correctamente",
      data,
    });
  }
}
