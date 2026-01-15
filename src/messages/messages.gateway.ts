import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from "@nestjs/websockets";
import { Server, Socket as SocketIOSocket } from "socket.io";
import { Logger, Inject, forwardRef } from "@nestjs/common";
import { MessagesService } from "./messages.service";
import { WebSocketAuthService } from "../common/services/websocket-auth.service";
import { NotificationsService } from "../notifications/notifications.service";

import { SendMessageDto } from "./dto";

type AuthenticatedSocket = SocketIOSocket & {
  userId?: string;
  heartbeatInterval?: NodeJS.Timeout;
};

@WebSocketGateway({
  cors: {
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
      : process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  },
  namespace: "/messages",
  pingInterval: 25000, // Ping cada 25 segundos
  pingTimeout: 60000, // Timeout de 60 segundos
  transports: ["websocket", "polling"], // Soporte para polling como fallback
})
export class MessagesGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger("MessagesGateway");
  private connectedUsers: Map<string, string> = new Map(); // userId -> socketId
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 segundos

  constructor(
    private messagesService: MessagesService,
    private wsAuthService: WebSocketAuthService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService
  ) {}

  afterInit(server: Server) {
    this.logger.log("Messages Gateway initialized");
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Validar autenticación usando el servicio
      const authResult = await this.wsAuthService.validateConnection(client);

      if (!authResult.isValid || !authResult.userId) {
        this.logger.warn(
          `Authentication failed for socket ${client.id}: ${authResult.error}`
        );
        client.emit("error", { message: "Authentication failed" });
        client.disconnect();
        return;
      }

      const userId = authResult.userId;
      client.userId = userId;

      // Si el usuario ya está conectado en otro socket, desconectar el anterior
      const existingSocketId = this.connectedUsers.get(userId);
      if (
        existingSocketId &&
        existingSocketId !== client.id &&
        this.server?.sockets?.sockets
      ) {
        const existingSocket =
          this.server.sockets.sockets.get(existingSocketId);
        if (existingSocket) {
          this.logger.log(
            `Disconnecting previous socket ${existingSocketId} for user ${userId}`
          );
          existingSocket.emit("disconnected", {
            reason: "Nueva conexión establecida",
          });
          existingSocket.disconnect();
        }
      }

      this.connectedUsers.set(userId, client.id);

      this.logger.log(`User ${userId} connected with socket ${client.id}`);

      // Iniciar heartbeat
      this.startHeartbeat(client);

      // Notificar al usuario que se conectó
      client.emit("connected", { message: "Conectado al chat" });

      // Enviar contador de mensajes no leídos
      const unreadCount = await this.messagesService.getUnreadCount(userId);
      client.emit("unreadCount", { count: unreadCount });
    } catch (error) {
      this.logger.error("Error handling WebSocket connection:", error);
      if (client && typeof client.emit === "function") {
        client.emit("error", { message: "Connection error" });
      }
      if (client && typeof client.disconnect === "function") {
        client.disconnect();
      }
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    // Detener heartbeat
    if (client.heartbeatInterval) {
      clearInterval(client.heartbeatInterval);
    }

    if (client.userId) {
      // Solo eliminar del mapa si este es el socket activo del usuario
      if (this.connectedUsers.get(client.userId) === client.id) {
        this.connectedUsers.delete(client.userId);
      }
      this.logger.log(
        `User ${client.userId} disconnected (socket ${client.id})`
      );
    }
  }

  /**
   * Iniciar heartbeat para mantener la conexión viva
   */
  private startHeartbeat(client: AuthenticatedSocket) {
    // Limpiar heartbeat anterior si existe
    if (client.heartbeatInterval) {
      clearInterval(client.heartbeatInterval);
    }

    // Enviar ping cada 30 segundos
    client.heartbeatInterval = setInterval(() => {
      if (client.connected) {
        client.emit("ping", { timestamp: Date.now() });
      } else {
        // Si el cliente no está conectado, limpiar el intervalo
        if (client.heartbeatInterval) {
          clearInterval(client.heartbeatInterval);
        }
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  /**
   * Responder a pong del cliente
   */
  @SubscribeMessage("pong")
  handlePong(
    @MessageBody() data: { timestamp: number },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    // El cliente respondió, la conexión está viva
    const latency = Date.now() - data.timestamp;
    this.logger.debug(
      `Pong received from ${client.userId} (latency: ${latency}ms)`
    );
  }

  @SubscribeMessage("sendMessage")
  async handleSendMessage(
    @MessageBody() data: SendMessageDto,
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    try {
      if (!client.userId) {
        client.emit("error", { message: "Usuario no autenticado" });
        return;
      }

      // Enviar mensaje usando el servicio
      const message = await this.messagesService.sendMessage(
        client.userId,
        data
      );

      // Obtener nombre del remitente
      const fromUser = (message as any).fromUser;
      const senderName =
        fromUser?.postulante?.fullName ||
        fromUser?.empresa?.companyName ||
        fromUser?.email ||
        "Alguien";

      // Enviar mensaje al destinatario si está conectado
      const recipientSocketId = this.connectedUsers.get(data.toUserId);
      if (recipientSocketId) {
        this.server.to(recipientSocketId).emit("newMessage", message);

        // Enviar contador actualizado de mensajes no leídos
        const unreadCount = await this.messagesService.getUnreadCount(
          data.toUserId
        );
        this.server
          .to(recipientSocketId)
          .emit("unreadCount", { count: unreadCount });
      }

      // SIEMPRE enviar notificación push, incluso si el usuario está conectado
      // Esto asegura que las notificaciones funcionen cuando la app está en segundo plano o cerrada
      this.logger.log(
        `Sending push notification to user ${
          data.toUserId
        } (connected: ${!!recipientSocketId})`
      );

      // Enviar notificación push
      await this.notificationsService
        .sendMessageNotification(data.toUserId, senderName, data.message, {
          messageId: message.id,
          fromUserId: client.userId,
          toUserId: data.toUserId,
        })
        .catch((error) => {
          this.logger.error("Error sending push notification:", error);
        });

      // Confirmar al remitente que el mensaje se envió
      client.emit("messageSent", message);

      // Enviar contador actualizado al remitente también
      const senderUnreadCount = await this.messagesService.getUnreadCount(
        client.userId
      );
      client.emit("unreadCount", { count: senderUnreadCount });
    } catch (error) {
      this.logger.error("Error sending message:", error);
      client.emit("error", { message: "Error al enviar el mensaje" });
    }
  }

  @SubscribeMessage("markAsRead")
  async handleMarkAsRead(
    @MessageBody() data: { messageId: string },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    try {
      if (!client.userId) {
        client.emit("error", { message: "Usuario no autenticado" });
        return;
      }

      const message = await this.messagesService.markAsRead(
        client.userId,
        data.messageId
      );

      // Notificar al remitente que su mensaje fue leído
      const senderSocketId = this.connectedUsers.get(message.fromUserId);
      if (senderSocketId) {
        this.server.to(senderSocketId).emit("messageRead", {
          messageId: message.id,
          readAt: message.createdAt,
        });
      }

      // Enviar contador actualizado
      const unreadCount = await this.messagesService.getUnreadCount(
        client.userId
      );
      client.emit("unreadCount", { count: unreadCount });
    } catch (error) {
      this.logger.error("Error marking message as read:", error);
      client.emit("error", { message: "Error al marcar mensaje como leído" });
    }
  }

  @SubscribeMessage("joinConversation")
  async handleJoinConversation(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    try {
      if (!client.userId) {
        client.emit("error", { message: "Usuario no autenticado" });
        return;
      }

      // Unirse a la sala de la conversación
      const roomName = this.getConversationRoomName(client.userId, data.userId);
      client.join(roomName);

      this.logger.log(
        `User ${client.userId} joined conversation room ${roomName}`
      );

      // Cargar mensajes de la conversación
      const messages = await this.messagesService.getConversationWith(
        client.userId,
        data.userId
      );
      client.emit("conversationLoaded", { messages });
    } catch (error) {
      this.logger.error("Error joining conversation:", error);
      client.emit("error", { message: "Error al cargar la conversación" });
    }
  }

  @SubscribeMessage("leaveConversation")
  handleLeaveConversation(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    const roomName = this.getConversationRoomName(client.userId!, data.userId);
    client.leave(roomName);
    this.logger.log(`User ${client.userId} left conversation room ${roomName}`);
  }

  @SubscribeMessage("typing")
  handleTyping(
    @MessageBody() data: { userId: string; isTyping: boolean },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    if (!client.userId) return;

    const roomName = this.getConversationRoomName(client.userId, data.userId);
    client.to(roomName).emit("userTyping", {
      userId: client.userId,
      isTyping: data.isTyping,
    });
  }

  // Método para enviar notificación de nuevo mensaje a un usuario específico
  async notifyNewMessage(userId: string, message: any) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.server.to(socketId).emit("newMessage", message);
    }
  }

  // Método para enviar contador de mensajes no leídos
  async notifyUnreadCount(userId: string, count: number) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.server.to(socketId).emit("unreadCount", { count });
    }
  }

  // Método para notificar que un mensaje fue leído
  async notifyMessageRead(userId: string, messageId: string, readAt: string) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.server.to(socketId).emit("messageRead", {
        messageId,
        readAt,
      });
    }
  }

  private getConversationRoomName(userId1: string, userId2: string): string {
    // Crear un nombre de sala consistente independientemente del orden de los usuarios
    const sortedIds = [userId1, userId2].sort();
    return `conversation:${sortedIds[0]}:${sortedIds[1]}`;
  }
}
