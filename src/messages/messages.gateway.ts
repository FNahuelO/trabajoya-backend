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
import { Logger, UseGuards } from "@nestjs/common";
import { MessagesService } from "./messages.service";

import { SendMessageDto } from "./dto";

type AuthenticatedSocket = SocketIOSocket & {
  userId?: string;
};

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  },
  namespace: "/messages",
})
export class MessagesGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger("MessagesGateway");
  private connectedUsers: Map<string, string> = new Map(); // userId -> socketId

  constructor(private messagesService: MessagesService) {}

  afterInit(server: Server) {
    this.logger.log("Messages Gateway initialized");
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Extraer el token del handshake
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace("Bearer ", "");

      if (!token) {
        this.logger.warn("No token provided for WebSocket connection");
        client.disconnect();
        return;
      }

      // Aquí deberías validar el JWT token
      // Por simplicidad, asumimos que el token es válido
      // En producción, deberías usar el mismo servicio de JWT que usas en HTTP
      const userId = this.extractUserIdFromToken(token);

      if (!userId) {
        this.logger.warn("Invalid token for WebSocket connection");
        client.disconnect();
        return;
      }

      client.userId = userId;
      this.connectedUsers.set(userId, client.id);

      this.logger.log(`User ${userId} connected with socket ${client.id}`);

      // Notificar al usuario que se conectó
      client.emit("connected", { message: "Conectado al chat" });

      // Enviar contador de mensajes no leídos
      const unreadCount = await this.messagesService.getUnreadCount(userId);
      client.emit("unreadCount", { count: unreadCount });
    } catch (error) {
      this.logger.error("Error handling WebSocket connection:", error);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      this.connectedUsers.delete(client.userId);
      this.logger.log(`User ${client.userId} disconnected`);
    }
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

  private extractUserIdFromToken(token: string): string | null {
    try {
      // Aquí deberías usar el mismo servicio de JWT que usas en HTTP
      // Por simplicidad, asumimos que el token contiene el userId
      // En producción, deberías decodificar el JWT y extraer el sub
      const payload = JSON.parse(
        Buffer.from(token.split(".")[1], "base64").toString()
      );
      return payload.sub || payload.userId;
    } catch (error) {
      this.logger.error("Error extracting userId from token:", error);
      return null;
    }
  }
}
