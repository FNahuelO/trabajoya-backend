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
import { Server, Socket } from "socket.io";
import { Logger, Inject, forwardRef } from "@nestjs/common";
import { CallsService } from "./calls.service";
import { WebSocketAuthService } from "../common/services/websocket-auth.service";
import { NotificationsService } from "../notifications/notifications.service";

type AuthenticatedSocket = Socket & {
  userId?: string;
  heartbeatInterval?: NodeJS.Timeout;
};

@WebSocketGateway({
  cors: {
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
      : "*", // En producción, especificar el dominio exacto
    credentials: true,
  },
  namespace: "/calls",
  pingInterval: 15000, // Ping cada 15 segundos para asegurar latidos frecuentes
  pingTimeout: 240000, // Timeout de 240 segundos (4 minutos) para permitir llamadas largas sin desconexión
  transports: ["websocket", "polling"], // Soporte para polling como fallback
})
export class CallsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger = new Logger("CallsGateway");
  private connectedUsers: Map<string, string> = new Map(); // userId -> socketId
  private readonly HEARTBEAT_INTERVAL = 20000; // 20 segundos para emitir pings más frecuentes durante llamadas

  constructor(
    private callsService: CallsService,
    private wsAuthService: WebSocketAuthService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService
  ) {}

  afterInit(server: Server) {
    this.logger.log("Calls Gateway initialized");
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Intentar autenticación con token (para clientes que lo envían)
      const authResult = await this.wsAuthService.validateConnection(client);

      if (authResult.isValid && authResult.userId) {
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
        this.logger.log(
          `User ${userId} connected with socket ${client.id} (authenticated)`
        );

        // Iniciar heartbeat
        this.startHeartbeat(client);

        // Notificar al usuario que se conectó
        client.emit("connected", {
          message: "Conectado al servicio de llamadas",
        });
      } else {
        // Permitir conexión temporal sin autenticación
        // El cliente deberá registrarse después con el evento 'register'
        this.logger.log(
          `Client ${client.id} connected without authentication (will register later)`
        );
      }
    } catch (error) {
      this.logger.error("Error handling connection:", error);
      // No desconectar, permitir que se registre después
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    // Detener heartbeat
    if (client.heartbeatInterval) {
      clearInterval(client.heartbeatInterval);
    }

    this.logger.log(`Client disconnected: ${client.id}`);

    // Buscar y eliminar el usuario del mapa
    if (client.userId) {
      // Solo eliminar del mapa si este es el socket activo del usuario
      if (this.connectedUsers.get(client.userId) === client.id) {
        this.connectedUsers.delete(client.userId);
      }
      this.logger.log(
        `User ${client.userId} disconnected (socket ${client.id})`
      );
    } else {
      // Si no tiene userId, buscar en el mapa
      for (const [userId, socketId] of this.connectedUsers.entries()) {
        if (socketId === client.id) {
          this.connectedUsers.delete(userId);
          this.logger.log(`User ${userId} disconnected`);
          break;
        }
      }
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
      `Pong received from ${client.userId || client.id} (latency: ${latency}ms)`
    );
  }

  /**
   * Registrar usuario conectado (para clientes que no enviaron token en handshake)
   */
  @SubscribeMessage("register")
  handleRegister(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    try {
      if (!data || !data.userId) {
        client.emit("error", { message: "UserId requerido" });
        return { success: false, message: "UserId requerido" };
      }

      const { userId } = data;

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

      client.userId = userId;
      this.connectedUsers.set(userId, client.id);

      // Iniciar heartbeat si no se había iniciado
      if (!client.heartbeatInterval) {
        this.startHeartbeat(client);
      }

      this.logger.log(`User ${userId} registered with socket ${client.id}`);
      this.logger.log(`Total connected users: ${this.connectedUsers.size}`);
      this.logger.log(
        `Connected users map:`,
        Array.from(this.connectedUsers.entries())
      );
      return { success: true };
    } catch (error) {
      this.logger.error("Error in handleRegister:", error);
      client.emit("error", { message: "Error al registrar usuario" });
      return { success: false, message: "Error al registrar usuario" };
    }
  }

  /**
   * Notificar llamada iniciada (puede ser llamado desde el controller o desde WebSocket)
   */
  async notifyCallInitiated(
    fromUserId: string,
    toUserId: string,
    callId: string,
    client?: AuthenticatedSocket
  ) {
    this.logger.log(
      `Call initiated from ${fromUserId} to ${toUserId} with callId ${callId}`
    );
    this.logger.log(`Total connected users: ${this.connectedUsers.size}`);
    this.logger.log(
      `Connected users map:`,
      Array.from(this.connectedUsers.entries())
    );

    // Obtener el socket del destinatario
    const toSocketId = this.connectedUsers.get(toUserId);
    
    // Si no hay cliente, usar el socket del llamador si está conectado
    const fromSocketId = client?.id || this.connectedUsers.get(fromUserId);

    // Obtener información del llamador (necesaria tanto para WebSocket como para push)
    let callerName = "Alguien";
    try {
      const fromUser = await this.callsService["prisma"].user.findUnique({
        where: { id: fromUserId },
        include: {
          postulante: {
            select: { fullName: true },
          },
          empresa: {
            select: { companyName: true },
          },
        },
      });

      callerName =
        fromUser?.postulante?.fullName ||
        fromUser?.empresa?.companyName ||
        fromUser?.email ||
        "Alguien";
    } catch (error) {
      this.logger.error(
        "Error getting caller info for push notification:",
        error
      );
    }

    if (toSocketId) {
      this.logger.log(
        `Sending call:incoming to socket ${toSocketId} (user ${toUserId})`
      );
      // Notificar al destinatario de la llamada entrante por WebSocket
      this.server.to(toSocketId).emit("call:incoming", {
        callId,
        fromUserId,
        fromSocketId: fromSocketId || "unknown",
      });
      this.logger.log(`Call:incoming event emitted successfully`);
      
      // IMPORTANTE: También enviar notificación push como fallback
      // Esto asegura que iOS reciba la llamada incluso si hay problemas con WebSocket
      // o si la app está en background
      this.logger.log(
        `Sending push notification as fallback for incoming call to user ${toUserId} (callId: ${callId}, fromUserId: ${fromUserId})`
      );
      try {
        await this.notificationsService.sendCallNotification(toUserId, callerName, {
          callId,
          fromUserId,
          toUserId,
        });
        this.logger.log(
          `Push notification sent successfully as fallback to user ${toUserId}`
        );
      } catch (error) {
        this.logger.error(
          `Error sending push notification for call (fallback) to user ${toUserId}:`,
          error
        );
      }
      
      return { success: true, message: "Llamada iniciada" };
    } else {
      this.logger.warn(`User ${toUserId} not found in connected users map`);
      this.logger.warn(
        `Available users:`,
        Array.from(this.connectedUsers.keys())
      );

      // Enviar notificación push al usuario no conectado
      this.logger.log(
        `Sending push notification for incoming call to user ${toUserId}`
      );

      // Enviar notificación push
      await this.notificationsService
        .sendCallNotification(toUserId, callerName, {
          callId,
          fromUserId,
          toUserId,
        })
        .catch((error) => {
          this.logger.error(
            "Error sending push notification for call:",
            error
          );
        });

      return { success: false, message: "Usuario no disponible" };
    }
  }

  /**
   * Iniciar llamada (handler de WebSocket)
   */
  @SubscribeMessage("call:initiate")
  async handleInitiateCall(
    @MessageBody()
    data: { fromUserId: string; toUserId: string; callId: string },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    return await this.notifyCallInitiated(
      data.fromUserId,
      data.toUserId,
      data.callId,
      client
    );
  }

  /**
   * Aceptar llamada
   */
  @SubscribeMessage("call:accept")
  async handleAcceptCall(
    @MessageBody()
    data: { callId: string; fromUserId: string; toUserId: string },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    const { callId, fromUserId } = data;
    this.logger.log(`Call ${callId} accepted`);

    // Notificar al llamador que la llamada fue aceptada
    const fromSocketId = this.connectedUsers.get(fromUserId);
    if (fromSocketId) {
      this.server.to(fromSocketId).emit("call:accepted", {
        callId,
        toSocketId: client.id,
      });
    }

    return { success: true };
  }

  /**
   * Rechazar llamada
   */
  @SubscribeMessage("call:reject")
  async handleRejectCall(
    @MessageBody() data: { callId: string; fromUserId: string },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    const { callId, fromUserId } = data;
    this.logger.log(`Call ${callId} rejected`);

    // Notificar al llamador que la llamada fue rechazada
    const fromSocketId = this.connectedUsers.get(fromUserId);
    if (fromSocketId) {
      this.server.to(fromSocketId).emit("call:rejected", { callId });
    }

    return { success: true };
  }

  /**
   * Cancelar llamada
   */
  @SubscribeMessage("call:cancel")
  async handleCancelCall(
    @MessageBody() data: { callId: string; toUserId: string },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    const { callId, toUserId } = data;
    this.logger.log(`Call ${callId} cancelled`);

    // Notificar al destinatario que la llamada fue cancelada
    const toSocketId = this.connectedUsers.get(toUserId);
    if (toSocketId) {
      this.server.to(toSocketId).emit("call:cancelled", { callId });
    }

    return { success: true };
  }

  /**
   * Finalizar llamada
   */
  @SubscribeMessage("call:end")
  async handleEndCall(
    @MessageBody()
    data: { callId: string; fromUserId: string; toUserId: string },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    const { callId, fromUserId, toUserId } = data;
    this.logger.log(`Call ${callId} ended`);

    // Notificar a ambas partes que la llamada finalizó
    const fromSocketId = this.connectedUsers.get(fromUserId);
    const toSocketId = this.connectedUsers.get(toUserId);

    const endCallData = {
      callId,
      fromUserId,
      toUserId,
    };

    if (fromSocketId) {
      this.logger.log(
        `Sending call:ended to fromUserId ${fromUserId} (socket ${fromSocketId})`
      );
      this.server.to(fromSocketId).emit("call:ended", endCallData);
    }
    if (toSocketId) {
      this.logger.log(
        `Sending call:ended to toUserId ${toUserId} (socket ${toSocketId})`
      );
      this.server.to(toSocketId).emit("call:ended", endCallData);
    }

    return { success: true };
  }

  /**
   * WebRTC: Enviar oferta
   */
  @SubscribeMessage("webrtc:offer")
  handleWebRTCOffer(
    @MessageBody() data: { offer: any; toUserId: string },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    const { offer, toUserId } = data;
    const toSocketId = this.connectedUsers.get(toUserId);

    if (toSocketId) {
      this.server.to(toSocketId).emit("webrtc:offer", {
        offer,
        fromSocketId: client.id,
      });
    }

    return { success: true };
  }

  /**
   * WebRTC: Enviar respuesta
   */
  @SubscribeMessage("webrtc:answer")
  handleWebRTCAnswer(
    @MessageBody() data: { answer: any; toUserId: string },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    const { answer, toUserId } = data;
    const toSocketId = this.connectedUsers.get(toUserId);

    if (toSocketId) {
      this.server.to(toSocketId).emit("webrtc:answer", {
        answer,
        fromSocketId: client.id,
      });
    }

    return { success: true };
  }

  /**
   * WebRTC: Enviar candidato ICE
   */
  @SubscribeMessage("webrtc:ice-candidate")
  handleICECandidate(
    @MessageBody() data: { candidate: any; toUserId: string },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    const { candidate, toUserId } = data;
    const toSocketId = this.connectedUsers.get(toUserId);

    if (toSocketId) {
      this.server.to(toSocketId).emit("webrtc:ice-candidate", {
        candidate,
        fromSocketId: client.id,
      });
    }

    return { success: true };
  }
}
