import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from "@nestjs/swagger";
import { GoogleMeetService } from "./google-meet.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { createResponse } from "../common/mapper/api-response.mapper";
import { Public } from "../common/decorators/public.decorator";

@ApiTags("google-meet")
@Controller("api/google-meet")
export class GoogleMeetController {
  constructor(private googleMeetService: GoogleMeetService) {}

  @Get("auth-url")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Obtener URL de autorización para Google Calendar",
    description:
      "Genera una URL para que el usuario autorice el acceso a Google Calendar. " +
      "El usuario debe visitar esta URL, autorizar la aplicación, y luego usar el código " +
      "recibido en el endpoint /google-meet/authorize",
  })
  @ApiResponse({
    status: 200,
    description: "URL de autorización generada",
    schema: {
      type: "object",
      properties: {
        authUrl: { type: "string" },
      },
    },
  })
  async getAuthUrl(@Req() req: any, @Query("redirectUri") redirectUri?: string) {
    const defaultRedirectUri =
      process.env.GOOGLE_OAUTH_REDIRECT_URI ||
      `${process.env.ALLOWED_ORIGINS?.split(",")[0] || "http://localhost:3000"}/auth/google/callback`;

    const authUrl = this.googleMeetService.getAuthUrl(
      redirectUri || defaultRedirectUri
    );

    return createResponse({
      success: true,
      message: "URL de autorización generada",
      data: { authUrl },
    });
  }

  @Post("authorize")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Intercambiar código de autorización por tokens",
    description:
      "Intercambia el código de autorización recibido de Google por tokens de acceso. " +
      "Los tokens deben guardarse en la base de datos asociados al usuario.",
  })
  @ApiResponse({
    status: 200,
    description: "Tokens obtenidos exitosamente",
    schema: {
      type: "object",
      properties: {
        accessToken: { type: "string" },
        refreshToken: { type: "string" },
      },
    },
  })
  async authorize(
    @Req() req: any,
    @Body() body: { code: string; redirectUri?: string }
  ) {
    const defaultRedirectUri =
      process.env.GOOGLE_OAUTH_REDIRECT_URI ||
      `${process.env.ALLOWED_ORIGINS?.split(",")[0] || "http://localhost:3000"}/auth/google/callback`;

    const tokens = await this.googleMeetService.getTokensFromCode(
      body.code,
      body.redirectUri || defaultRedirectUri
    );

    // TODO: Guardar los tokens en la base de datos asociados al usuario
    // Por ejemplo, agregar campos googleAccessToken y googleRefreshToken al modelo User
    // await this.prisma.user.update({
    //   where: { id: req.user.sub },
    //   data: {
    //     googleAccessToken: tokens.accessToken,
    //     googleRefreshToken: tokens.refreshToken,
    //   },
    // });

    return createResponse({
      success: true,
      message: "Autorización exitosa. Guarda estos tokens en la base de datos.",
      data: tokens,
    });
  }

  @Post("refresh-token")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Refrescar token de acceso de Google",
    description:
      "Obtiene un nuevo token de acceso usando el refresh token guardado.",
  })
  @ApiResponse({
    status: 200,
    description: "Token refrescado exitosamente",
    schema: {
      type: "object",
      properties: {
        accessToken: { type: "string" },
      },
    },
  })
  async refreshToken(@Req() req: any, @Body() body: { refreshToken: string }) {
    const tokens = await this.googleMeetService.refreshAccessToken(
      body.refreshToken
    );

    // TODO: Actualizar el accessToken en la base de datos
    // await this.prisma.user.update({
    //   where: { id: req.user.sub },
    //   data: { googleAccessToken: tokens.accessToken },
    // });

    return createResponse({
      success: true,
      message: "Token refrescado exitosamente",
      data: tokens,
    });
  }
}

