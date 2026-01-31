import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Body,
  UseGuards,
  Req,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { createResponse } from "../common/mapper/api-response.mapper";
import { BlockedUsersService } from "./blocked-users.service";
import { BlockUserDto } from "./dto";

/**
 * Controlador de bloqueo de usuarios
 * Endpoints requeridos por Google Play para cumplir con políticas de seguridad
 */
@ApiTags("blocked-users")
@Controller("api/blocked-users")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BlockedUsersController {
  constructor(private blockedUsersService: BlockedUsersService) {}

  @Post()
  @ApiOperation({
    summary: "Bloquear un usuario",
    description: "Bloquea a un usuario. Un usuario bloqueado no podrá enviar mensajes ni iniciar nuevos chats. Requerido por Google Play.",
  })
  @ApiResponse({ status: 201, description: "Usuario bloqueado correctamente" })
  @ApiResponse({ status: 400, description: "Datos inválidos" })
  @ApiResponse({ status: 404, description: "Usuario no encontrado" })
  @ApiResponse({ status: 409, description: "Usuario ya está bloqueado" })
  async blockUser(@Req() req: any, @Body() dto: BlockUserDto) {
    await this.blockedUsersService.blockUser(req.user?.sub, dto);
    return createResponse({
      success: true,
      message: "Usuario bloqueado correctamente",
    });
  }

  @Delete(":blockedUserId")
  @ApiOperation({
    summary: "Desbloquear un usuario",
    description: "Desbloquea a un usuario previamente bloqueado",
  })
  @ApiResponse({ status: 200, description: "Usuario desbloqueado correctamente" })
  @ApiResponse({ status: 404, description: "Usuario no está bloqueado" })
  async unblockUser(@Req() req: any, @Param("blockedUserId") blockedUserId: string) {
    await this.blockedUsersService.unblockUser(req.user?.sub, blockedUserId);
    return createResponse({
      success: true,
      message: "Usuario desbloqueado correctamente",
    });
  }

  @Get()
  @ApiOperation({
    summary: "Obtener lista de usuarios bloqueados",
    description: "Retorna la lista de usuarios que el usuario actual ha bloqueado",
  })
  @ApiResponse({ status: 200, description: "Lista de usuarios bloqueados" })
  async getBlockedUsers(@Req() req: any) {
    const blockedUsers = await this.blockedUsersService.getBlockedUsers(req.user?.sub);
    return createResponse({
      success: true,
      message: "Usuarios bloqueados obtenidos correctamente",
      data: blockedUsers,
    });
  }

  @Get("check/:userId")
  @ApiOperation({
    summary: "Verificar si un usuario está bloqueado",
    description: "Verifica si el usuario actual ha bloqueado al usuario especificado",
  })
  @ApiResponse({ status: 200, description: "Estado de bloqueo" })
  async checkBlocked(@Req() req: any, @Param("userId") userId: string) {
    const isBlocked = await this.blockedUsersService.isBlocked(req.user?.sub, userId);
    return createResponse({
      success: true,
      message: "Estado de bloqueo obtenido correctamente",
      data: { isBlocked },
    });
  }
}





