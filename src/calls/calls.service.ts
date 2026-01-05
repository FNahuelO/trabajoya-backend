import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CallStatus, CallType, InitiateCallDto, CallResponseDto } from "./dto";

@Injectable()
export class CallsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Iniciar una nueva llamada
   */
  async initiateCall(
    fromUserId: string,
    dto: InitiateCallDto
  ): Promise<CallResponseDto> {
    const { toUserId, callType = CallType.VOICE } = dto;

    // Validar que no se llame a sí mismo
    if (fromUserId === toUserId) {
      throw new BadRequestException("No puedes llamarte a ti mismo");
    }

    // Verificar que el usuario destinatario existe
    const toUser = await this.prisma.user.findUnique({
      where: { id: toUserId },
    });

    if (!toUser) {
      throw new NotFoundException("Usuario no encontrado");
    }

    // Verificar si hay una llamada activa
    const activeCall = await this.prisma.call.findFirst({
      where: {
        OR: [
          { fromUserId, status: { in: ["PENDING", "ACCEPTED"] } },
          { toUserId: fromUserId, status: { in: ["PENDING", "ACCEPTED"] } },
        ],
      },
    });

    if (activeCall) {
      throw new BadRequestException("Ya tienes una llamada activa en progreso");
    }

    // Crear la llamada
    const call = await this.prisma.call.create({
      data: {
        fromUserId,
        toUserId,
        callType: callType as CallType,
        status: CallStatus.PENDING,
      },
    });

    return this.mapCallToResponse(call);
  }

  /**
   * Aceptar una llamada
   */
  async acceptCall(userId: string, callId: string): Promise<CallResponseDto> {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
    });

    if (!call) {
      throw new NotFoundException("Llamada no encontrada");
    }

    if (call.toUserId !== userId) {
      throw new ForbiddenException(
        "No tienes permisos para aceptar esta llamada"
      );
    }

    if (call.status !== CallStatus.PENDING) {
      throw new BadRequestException("La llamada ya no está disponible");
    }

    const updatedCall = await this.prisma.call.update({
      where: { id: callId },
      data: {
        status: CallStatus.ACCEPTED,
        startedAt: new Date(),
      },
    });

    return this.mapCallToResponse(updatedCall);
  }

  /**
   * Rechazar una llamada
   */
  async rejectCall(userId: string, callId: string): Promise<CallResponseDto> {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
    });

    if (!call) {
      throw new NotFoundException("Llamada no encontrada");
    }

    if (call.toUserId !== userId) {
      throw new ForbiddenException(
        "No tienes permisos para rechazar esta llamada"
      );
    }

    if (call.status !== CallStatus.PENDING) {
      throw new BadRequestException("La llamada ya no está disponible");
    }

    const updatedCall = await this.prisma.call.update({
      where: { id: callId },
      data: {
        status: CallStatus.REJECTED,
        endedAt: new Date(),
      },
    });

    return this.mapCallToResponse(updatedCall);
  }

  /**
   * Finalizar una llamada
   */
  async endCall(userId: string, callId: string): Promise<CallResponseDto> {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
    });

    if (!call) {
      throw new NotFoundException("Llamada no encontrada");
    }

    if (call.fromUserId !== userId && call.toUserId !== userId) {
      throw new ForbiddenException(
        "No tienes permisos para finalizar esta llamada"
      );
    }

    if (call.status === CallStatus.ENDED) {
      throw new BadRequestException("La llamada ya está finalizada");
    }

    const endedAt = new Date();
    let duration: number | null = null;

    if (call.startedAt) {
      duration = Math.floor(
        (endedAt.getTime() - call.startedAt.getTime()) / 1000
      );
    }

    const updatedCall = await this.prisma.call.update({
      where: { id: callId },
      data: {
        status: CallStatus.ENDED,
        endedAt,
        duration,
      },
    });

    return this.mapCallToResponse(updatedCall);
  }

  /**
   * Cancelar una llamada (solo el que llama)
   */
  async cancelCall(userId: string, callId: string): Promise<CallResponseDto> {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
    });

    if (!call) {
      throw new NotFoundException("Llamada no encontrada");
    }

    if (call.fromUserId !== userId) {
      throw new ForbiddenException(
        "No tienes permisos para cancelar esta llamada"
      );
    }

    if (call.status !== CallStatus.PENDING) {
      throw new BadRequestException("La llamada ya no se puede cancelar");
    }

    const updatedCall = await this.prisma.call.update({
      where: { id: callId },
      data: {
        status: CallStatus.CANCELLED,
        endedAt: new Date(),
      },
    });

    return this.mapCallToResponse(updatedCall);
  }

  /**
   * Marcar llamada como perdida
   */
  async markAsMissed(callId: string): Promise<CallResponseDto> {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
    });

    if (!call) {
      throw new NotFoundException("Llamada no encontrada");
    }

    const updatedCall = await this.prisma.call.update({
      where: { id: callId },
      data: {
        status: CallStatus.MISSED,
        endedAt: new Date(),
      },
    });

    return this.mapCallToResponse(updatedCall);
  }

  /**
   * Obtener historial de llamadas del usuario
   */
  async getCallHistory(userId: string): Promise<CallResponseDto[]> {
    const calls = await this.prisma.call.findMany({
      where: {
        OR: [{ fromUserId: userId }, { toUserId: userId }],
      },
      orderBy: { createdAt: "desc" },
      take: 50, // Limitar a las últimas 50 llamadas
    });

    return calls.map((call) => this.mapCallToResponse(call));
  }

  /**
   * Obtener una llamada por ID
   */
  async getCallById(callId: string): Promise<CallResponseDto> {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
    });

    if (!call) {
      throw new NotFoundException("Llamada no encontrada");
    }

    return this.mapCallToResponse(call);
  }

  /**
   * Obtener llamadas activas del usuario
   */
  async getActiveCall(userId: string): Promise<CallResponseDto | null> {
    const call = await this.prisma.call.findFirst({
      where: {
        OR: [
          { fromUserId: userId, status: { in: ["PENDING", "ACCEPTED"] } },
          { toUserId: userId, status: { in: ["PENDING", "ACCEPTED"] } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    return call ? this.mapCallToResponse(call) : null;
  }

  /**
   * Mapear Call a DTO
   */
  private mapCallToResponse(call: any): CallResponseDto {
    return {
      id: call.id,
      fromUserId: call.fromUserId,
      toUserId: call.toUserId,
      callType: call.callType || CallType.VOICE,
      status: call.status,
      startedAt: call.startedAt,
      endedAt: call.endedAt,
      duration: call.duration,
      createdAt: call.createdAt,
    };
  }
}
