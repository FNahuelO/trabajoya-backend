import {
  Controller,
  Get,
  Post,
  Req,
  Body,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody } from "@nestjs/swagger";
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
  @ApiBody({
    schema: {
      type: "object",
      required: ["jobPostId"],
      properties: {
        jobPostId: {
          type: "string",
          description: "ID de la publicación de empleo a la que se asociará la promoción",
        },
      },
    },
  })
  async claim(@Req() req: any, @Body() body: { jobPostId: string }) {
    const { jobPostId } = body;

    if (!jobPostId) {
      throw new BadRequestException(
        "Debes crear una publicación antes de reclamar la promoción"
      );
    }

    const ip = req.ip || req.headers["x-forwarded-for"] || req.connection?.remoteAddress;
    const userAgent = req.headers["user-agent"];

    // Primero reclamar la promoción
    const promotion = await this.promotionsService.claimLaunchTrial(
      req.user?.sub,
      {
        ip: Array.isArray(ip) ? ip[0] : ip,
        userAgent,
      }
    );

    // Luego asociarla con la publicación (marcar como USED)
    const usedPromotion = await this.promotionsService.useLaunchTrial(
      req.user?.sub,
      jobPostId
    );

    return createResponse({
      success: true,
      message: "Promoción reclamada y activada correctamente",
      data: {
        id: usedPromotion.id,
        status: usedPromotion.status,
        claimedAt: promotion.claimedAt,
        usedAt: usedPromotion.usedAt,
        jobPostId,
      },
    });
  }
}

