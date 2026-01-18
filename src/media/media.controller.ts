import {
  Controller,
  Get,
  Param,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { MediaService } from "./media.service";
import { Response } from "express";

@ApiTags("media")
@Controller("api/media")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MediaController {
  constructor(private service: MediaService) {}

  @Get(":id/access")
  @ApiOperation({
    summary: "Obtiene acceso a un archivo de media mediante URL firmada (GCP CDN o Storage)",
  })
  @ApiResponse({
    status: 200,
    description: "Acceso otorgado correctamente",
  })
  async getMediaAccess(
    @Req() req: any,
    @Param("id") mediaAssetId: string,
    @Res() res: Response
  ) {
    const userId = req.user?.sub;
    const userType = req.user?.userType || "";
    const userRole = req.user?.role;

    const access = await this.service.getMediaAccess(
      userId,
      userType,
      userRole,
      mediaAssetId
    );

    // Devolver la URL firmada (GCP CDN o Storage)
    return res.json({
      success: true,
      message: "Acceso otorgado correctamente",
      data: {
        url: access.url,
        expiresAt: access.expiresAt,
      },
    });
  }
}

@ApiTags("media")
@Controller("api/users")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserMediaController {
  constructor(private service: MediaService) {}

  @Get(":id/video/access")
  @ApiOperation({
    summary: "Obtiene acceso al video de presentación de un usuario mediante URL firmada",
  })
  @ApiResponse({
    status: 200,
    description: "Acceso otorgado correctamente",
  })
  async getVideoAccess(
    @Req() req: any,
    @Param("id") targetUserId: string,
    @Res() res: Response
  ) {
    const userId = req.user?.sub;
    const userType = req.user?.userType || "";
    const userRole = req.user?.role;

    const access = await this.service.getVideoAccess(
      userId,
      userType,
      userRole,
      targetUserId
    );

    // Devolver la URL firmada (GCP CDN o Storage)
    return res.json({
      success: true,
      message: "Acceso otorgado correctamente",
      data: {
        url: access.url,
        expiresAt: access.expiresAt,
      },
    });
  }
}
