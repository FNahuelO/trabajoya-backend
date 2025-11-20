import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger, UseGuards } from "@nestjs/common";
import { CallsService } from "./calls.service";

// Mapa para rastrear usuarios conectados
const connectedUsers = new Map<string, string>(); // userId -> socketId

@WebSocketGateway({
  cors: {
    origin: "*", // En producción, especificar el dominio exacto
    credentials: true,
  },
  namespace: "/calls",
})
export class CallsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger("CallsGateway");

  constructor(private callsService: CallsService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    // Buscar y eliminar el usuario del mapa
    for (const [userId, socketId] of connectedUsers.entries()) {
      if (socketId === client.id) {
        connectedUsers.delete(userId);
        this.logger.log(`User ${userId} disconnected`);
        break;
      }
    }
  }

  /**
   * Registrar usuario conectado
   */
  @SubscribeMessage("register")
  handleRegister(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket
  ) {
    const { userId } = data;
    connectedUsers.set(userId, client.id);
    this.logger.log(`User ${userId} registered with socket ${client.id}`);
    return { success: true };
  }

  /**
   * Iniciar llamada
   */
  @SubscribeMessage("call:initiate")
  async handleInitiateCall(
    @MessageBody()
    data: { fromUserId: string; toUserId: string; callId: string },
    @ConnectedSocket() client: Socket
  ) {
    const { fromUserId, toUserId, callId } = data;
    this.logger.log(`Call initiated from ${fromUserId} to ${toUserId}`);

    // Obtener el socket del destinatario
    const toSocketId = connectedUsers.get(toUserId);

    if (toSocketId) {
      // Notificar al destinatario de la llamada entrante
      this.server.to(toSocketId).emit("call:incoming", {
        callId,
        fromUserId,
        fromSocketId: client.id,
      });
      return { success: true, message: "Llamada iniciada" };
    } else {
      return { success: false, message: "Usuario no disponible" };
    }
  }

  /**
   * Aceptar llamada
   */
  @SubscribeMessage("call:accept")
  async handleAcceptCall(
    @MessageBody()
    data: { callId: string; fromUserId: string; toUserId: string },
    @ConnectedSocket() client: Socket
  ) {
    const { callId, fromUserId } = data;
    this.logger.log(`Call ${callId} accepted`);

    // Notificar al llamador que la llamada fue aceptada
    const fromSocketId = connectedUsers.get(fromUserId);
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
    @ConnectedSocket() client: Socket
  ) {
    const { callId, fromUserId } = data;
    this.logger.log(`Call ${callId} rejected`);

    // Notificar al llamador que la llamada fue rechazada
    const fromSocketId = connectedUsers.get(fromUserId);
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
    @ConnectedSocket() client: Socket
  ) {
    const { callId, toUserId } = data;
    this.logger.log(`Call ${callId} cancelled`);

    // Notificar al destinatario que la llamada fue cancelada
    const toSocketId = connectedUsers.get(toUserId);
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
    @ConnectedSocket() client: Socket
  ) {
    const { callId, fromUserId, toUserId } = data;
    this.logger.log(`Call ${callId} ended`);

    // Notificar a ambas partes que la llamada finalizó
    const fromSocketId = connectedUsers.get(fromUserId);
    const toSocketId = connectedUsers.get(toUserId);

    if (fromSocketId) {
      this.server.to(fromSocketId).emit("call:ended", { callId });
    }
    if (toSocketId) {
      this.server.to(toSocketId).emit("call:ended", { callId });
    }

    return { success: true };
  }

  /**
   * WebRTC: Enviar oferta
   */
  @SubscribeMessage("webrtc:offer")
  handleWebRTCOffer(
    @MessageBody() data: { offer: any; toUserId: string },
    @ConnectedSocket() client: Socket
  ) {
    const { offer, toUserId } = data;
    const toSocketId = connectedUsers.get(toUserId);

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
    @ConnectedSocket() client: Socket
  ) {
    const { answer, toUserId } = data;
    const toSocketId = connectedUsers.get(toUserId);

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
    @ConnectedSocket() client: Socket
  ) {
    const { candidate, toUserId } = data;
    const toSocketId = connectedUsers.get(toUserId);

    if (toSocketId) {
      this.server.to(toSocketId).emit("webrtc:ice-candidate", {
        candidate,
        fromSocketId: client.id,
      });
    }

    return { success: true };
  }
}
