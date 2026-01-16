import {
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PromotionsService } from "./promotions.service";
import { createResponse } from "../common/mapper/api-response.mapper";

@ApiTags("promotions")
@Controller("api/promotions")
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Get("launch-trial/status")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Obtener estado de la promoción de lanzamiento" })
  async getStatus(@Req() req: any) {
    const status = await this.promotionsService.getLaunchTrialStatus(
      req.user?.sub
    );
    return createResponse({
      success: true,
      message: "Estado de promoción obtenido correctamente",
      data: status,
    });
  }

  @Post("launch-trial/claim")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Reclamar promoción de lanzamiento" })
  async claim(@Req() req: any) {
    const ip = req.ip || req.headers["x-forwarded-for"] || req.connection?.remoteAddress;
    const userAgent = req.headers["user-agent"];

    const promotion = await this.promotionsService.claimLaunchTrial(
      req.user?.sub,
      {
        ip: Array.isArray(ip) ? ip[0] : ip,
        userAgent,
      }
    );

    return createResponse({
      success: true,
      message: "Promoción reclamada correctamente",
      data: {
        id: promotion.id,
        status: promotion.status,
        claimedAt: promotion.claimedAt,
      },
    });
  }
}

