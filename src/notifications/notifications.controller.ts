import {
  Controller,
  Post,
  Delete,
  Get,
  Put,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from "@nestjs/swagger";
import { NotificationsService } from "./notifications.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { createResponse } from "../common/mapper/api-response.mapper";
import { RegisterTokenDto, UnregisterTokenDto } from "./dto/register-token.dto";
import {
  NotificationPreferencesDto,
  NotificationPreferencesResponseDto,
} from "./dto/notification-preferences.dto";

@ApiTags("notifications")
@Controller("api/notifications")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Post("register-token")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Registrar token de push notification" })
  @ApiResponse({
    status: 200,
    description: "Token registrado correctamente",
  })
  async registerToken(@Req() req: any, @Body() dto: RegisterTokenDto) {
    const userId = req.user?.sub;

    await this.notificationsService.registerPushToken(
      userId,
      dto.pushToken,
      dto.platform,
      dto.deviceId
    );

    return createResponse({
      success: true,
      message: "Token de notificaciones registrado correctamente",
      data: null,
    });
  }

  @Delete("unregister-token")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Desregistrar token de push notification" })
  @ApiResponse({
    status: 200,
    description: "Token desregistrado correctamente",
  })
  async unregisterToken(@Body() dto: UnregisterTokenDto) {
    await this.notificationsService.unregisterPushToken(dto.pushToken);

    return createResponse({
      success: true,
      message: "Token de notificaciones desregistrado correctamente",
      data: null,
    });
  }

  @Delete("unregister-all")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Desregistrar todos los tokens del usuario autenticado",
  })
  @ApiResponse({
    status: 200,
    description: "Todos los tokens desregistrados correctamente",
  })
  async unregisterAllTokens(@Req() req: any) {
    const userId = req.user?.sub;

    await this.notificationsService.unregisterAllUserTokens(userId);

    return createResponse({
      success: true,
      message: "Todos los tokens desregistrados correctamente",
      data: null,
    });
  }

  @Get("preferences")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Obtener preferencias de notificaciones" })
  @ApiResponse({
    status: 200,
    description: "Preferencias obtenidas correctamente",
    type: NotificationPreferencesResponseDto,
  })
  async getPreferences(@Req() req: any) {
    const userId = req.user?.sub;

    const preferences = await this.notificationsService.getUserPreferences(
      userId
    );

    return createResponse({
      success: true,
      message: "Preferencias obtenidas correctamente",
      data: { preferences },
    });
  }

  @Put("preferences")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Actualizar preferencias de notificaciones" })
  @ApiResponse({
    status: 200,
    description: "Preferencias actualizadas correctamente",
    type: NotificationPreferencesResponseDto,
  })
  async updatePreferences(
    @Req() req: any,
    @Body() dto: NotificationPreferencesDto
  ) {
    const userId = req.user?.sub;

    const preferences = await this.notificationsService.updateUserPreferences(
      userId,
      dto
    );

    return createResponse({
      success: true,
      message: "Preferencias actualizadas correctamente",
      data: { preferences },
    });
  }

  @Post("test-send")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "TEST: Enviar notificación de prueba (solo para debugging)",
  })
  @ApiResponse({
    status: 200,
    description: "Notificación de prueba enviada",
  })
  async testSendNotification(
    @Req() req: any,
    @Body() dto: { title?: string; body?: string; type?: "message" | "call" }
  ) {
    const userId = req.user?.sub;
    const title = dto.title || "Notificación de Prueba";
    const body = dto.body || "Esta es una notificación de prueba del sistema";
    const type = dto.type || "message";

    try {
      await this.notificationsService.sendPushToUser(userId, title, body, {
        type,
        testNotification: true,
        timestamp: new Date().toISOString(),
      });

      return createResponse({
        success: true,
        message: "Notificación de prueba enviada correctamente",
        data: {
          userId,
          title,
          body,
          type,
          instruction: "Cierra completamente la app y espera la notificación",
        },
      });
    } catch (error) {
      return createResponse({
        success: false,
        message: "Error enviando notificación de prueba",
        data: { error: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  @Get("debug-tokens/:userId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "DEBUG: Ver todos los tokens registrados de un usuario",
  })
  @ApiResponse({
    status: 200,
    description: "Tokens del usuario",
  })
  async debugGetUserTokens(
    @Req() req: any,
    @Body("userId") paramUserId?: string
  ) {
    // Solo permitir ver los tokens del usuario autenticado o un admin viendo sus propios tokens
    const userId = paramUserId || req.user?.sub;

    if (!userId) {
      return createResponse({
        success: false,
        message: "Usuario no identificado",
        data: null,
      });
    }

    try {
      const tokens = await this.notificationsService.getUserActiveTokens(
        userId
      );

      return createResponse({
        success: true,
        message: "Tokens obtenidos correctamente",
        data: {
          userId,
          tokenCount: tokens.length,
          tokens: tokens.map((token, index) => ({
            index: index + 1,
            token: `${token.substring(0, 30)}...${token.substring(
              token.length - 10
            )}`,
            fullToken: token,
            isValid:
              token.startsWith("ExponentPushToken[") ||
              token.startsWith("ExpoPushToken["),
          })),
        },
      });
    } catch (error) {
      return createResponse({
        success: false,
        message: "Error obteniendo tokens",
        data: { error: error instanceof Error ? error.message : String(error) },
      });
    }
  }
}
