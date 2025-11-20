import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Delete,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";

import { MessagesService } from "./messages.service";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { createResponse } from "src/common/mapper/api-response.mapper";
import {
  SendMessageDto,
  MessageResponseDto,
  ConversationResponseDto,
} from "./dto";
import { WebSocketMessageInterceptor } from "./interceptors/websocket-message.interceptor";

@ApiTags("messages")
@Controller("api/messages")
@UseGuards(JwtAuthGuard)
@UseInterceptors(WebSocketMessageInterceptor)
@ApiBearerAuth()
export class MessagesController {
  constructor(private service: MessagesService) {}

  @Post()
  @ApiOperation({ summary: "Enviar un mensaje" })
  @ApiResponse({
    status: 201,
    description: "Mensaje enviado correctamente",
    type: MessageResponseDto,
  })
  @ApiResponse({ status: 400, description: "Datos de entrada inválidos" })
  @ApiResponse({
    status: 404,
    description: "Usuario destinatario no encontrado",
  })
  async sendMessage(@Req() req: any, @Body() dto: SendMessageDto) {
    const message = await this.service.sendMessage(req.user?.sub, dto);
    return createResponse({
      success: true,
      message: "Mensaje enviado correctamente",
      data: message,
    });
  }

  @Get()
  @ApiOperation({ summary: "Obtener lista de conversaciones" })
  @ApiResponse({
    status: 200,
    description: "Conversaciones obtenidas correctamente",
    type: [ConversationResponseDto],
  })
  async getConversations(@Req() req: any) {
    const conversations = await this.service.getConversations(req.user?.sub);
    return createResponse({
      success: true,
      message: "Conversaciones obtenidas correctamente",
      data: conversations,
    });
  }

  @Get(":userId")
  @ApiOperation({ summary: "Obtener conversación con un usuario específico" })
  @ApiParam({
    name: "userId",
    description: "ID del usuario con quien se conversa",
  })
  @ApiResponse({
    status: 200,
    description: "Conversación obtenida correctamente",
    type: [MessageResponseDto],
  })
  @ApiResponse({ status: 404, description: "Usuario no encontrado" })
  async getConversationWith(@Req() req: any, @Param("userId") userId: string) {
    const messages = await this.service.getConversationWith(
      req.user?.sub,
      userId
    );
    return createResponse({
      success: true,
      message: "Conversación obtenida correctamente",
      data: messages,
    });
  }

  @Patch(":id/read")
  @ApiOperation({ summary: "Marcar un mensaje como leído" })
  @ApiParam({ name: "id", description: "ID del mensaje" })
  @ApiResponse({
    status: 200,
    description: "Mensaje marcado como leído correctamente",
    type: MessageResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: "No tienes permisos para marcar este mensaje",
  })
  @ApiResponse({ status: 404, description: "Mensaje no encontrado" })
  async markAsRead(@Req() req: any, @Param("id") id: string) {
    const message = await this.service.markAsRead(req.user?.sub, id);
    return createResponse({
      success: true,
      message: "Mensaje marcado como leído correctamente",
      data: message,
    });
  }

  @Get("unread/count")
  @ApiOperation({ summary: "Obtener cantidad de mensajes no leídos" })
  @ApiResponse({
    status: 200,
    description: "Cantidad de mensajes no leídos obtenida correctamente",
    schema: { type: "object", properties: { count: { type: "number" } } },
  })
  async getUnreadCount(@Req() req: any) {
    const count = await this.service.getUnreadCount(req.user?.sub);
    return createResponse({
      success: true,
      message: "Cantidad de mensajes no leídos obtenida correctamente",
      data: { count },
    });
  }

  @Get("stats")
  @ApiOperation({ summary: "Obtener estadísticas de mensajes del usuario" })
  @ApiResponse({
    status: 200,
    description: "Estadísticas obtenidas correctamente",
    schema: {
      type: "object",
      properties: {
        totalMessages: { type: "number" },
        unreadMessages: { type: "number" },
        sentMessages: { type: "number" },
        receivedMessages: { type: "number" },
      },
    },
  })
  async getMessageStats(@Req() req: any) {
    const stats = await this.service.getMessageStats(req.user?.sub);
    return createResponse({
      success: true,
      message: "Estadísticas obtenidas correctamente",
      data: stats,
    });
  }

  @Get("search")
  @ApiOperation({ summary: "Buscar mensajes por contenido" })
  @ApiQuery({ name: "q", description: "Término de búsqueda" })
  @ApiQuery({
    name: "limit",
    description: "Límite de resultados",
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: "Mensajes encontrados",
    type: [MessageResponseDto],
  })
  async searchMessages(
    @Req() req: any,
    @Query("q") query: string,
    @Query("limit") limit?: string
  ) {
    const searchLimit = limit ? parseInt(limit, 10) : 50;
    const messages = await this.service.searchMessages(
      req.user?.sub,
      query,
      searchLimit
    );
    return createResponse({
      success: true,
      message: "Mensajes encontrados",
      data: messages,
    });
  }

  @Delete(":id")
  @ApiOperation({ summary: "Eliminar un mensaje" })
  @ApiParam({ name: "id", description: "ID del mensaje" })
  @ApiResponse({ status: 200, description: "Mensaje eliminado correctamente" })
  @ApiResponse({
    status: 403,
    description: "No tienes permisos para eliminar este mensaje",
  })
  @ApiResponse({ status: 404, description: "Mensaje no encontrado" })
  @HttpCode(HttpStatus.OK)
  async deleteMessage(@Req() req: any, @Param("id") id: string) {
    await this.service.deleteMessage(req.user?.sub, id);
    return createResponse({
      success: true,
      message: "Mensaje eliminado correctamente",
    });
  }
}
