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
    summary: "Obtiene acceso a un archivo de media mediante CloudFront signed cookies",
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

    // Setear las cookies
    res.cookie("CloudFront-Policy", access.cookies["CloudFront-Policy"], {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      expires: access.expiresAt,
      domain: undefined, // CloudFront cookies no deben tener domain
      path: "/",
    });

    res.cookie("CloudFront-Signature", access.cookies["CloudFront-Signature"], {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      expires: access.expiresAt,
      domain: undefined,
      path: "/",
    });

    res.cookie(
      "CloudFront-Key-Pair-Id",
      access.cookies["CloudFront-Key-Pair-Id"],
      {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        expires: access.expiresAt,
        domain: undefined,
        path: "/",
      }
    );

    // Devolver la URL de CloudFront
    return res.json({
      success: true,
      message: "Acceso otorgado correctamente",
      data: {
        url: access.cloudFrontUrl,
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
    summary: "Obtiene acceso al video de presentación de un usuario",
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

    // Setear las cookies
    res.cookie("CloudFront-Policy", access.cookies["CloudFront-Policy"], {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      expires: access.expiresAt,
      domain: undefined,
      path: "/",
    });

    res.cookie("CloudFront-Signature", access.cookies["CloudFront-Signature"], {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      expires: access.expiresAt,
      domain: undefined,
      path: "/",
    });

    res.cookie(
      "CloudFront-Key-Pair-Id",
      access.cookies["CloudFront-Key-Pair-Id"],
      {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        expires: access.expiresAt,
        domain: undefined,
        path: "/",
      }
    );

    // Devolver la URL de CloudFront
    return res.json({
      success: true,
      message: "Acceso otorgado correctamente",
      data: {
        url: access.cloudFrontUrl,
        expiresAt: access.expiresAt,
      },
    });
  }
}
