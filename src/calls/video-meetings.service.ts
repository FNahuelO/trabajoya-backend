import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
  Optional,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateVideoMeetingDto,
  UpdateVideoMeetingDto,
  VideoMeetingResponseDto,
  VideoMeetingStatus,
} from "./dto/video-meeting.dto";
import { MessagesService } from "../messages/messages.service";
import { GoogleMeetService } from "./google-meet.service";

@Injectable()
export class VideoMeetingsService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => MessagesService))
    private messagesService: MessagesService,
    @Optional() private googleMeetService?: GoogleMeetService
  ) {}

  /**
   * Crear una nueva reunión de videollamada
   */
  async createVideoMeeting(
    createdById: string,
    dto: CreateVideoMeetingDto
  ): Promise<VideoMeetingResponseDto> {
    const {
      invitedUserId,
      scheduledAt,
      title,
      description,
      duration,
      ...rest
    } = dto;

    // Validar que no se invite a sí mismo
    if (createdById === invitedUserId) {
      throw new BadRequestException("No puedes invitarte a ti mismo");
    }

    // Verificar que el usuario invitado existe
    const invitedUser = await this.prisma.user.findUnique({
      where: { id: invitedUserId },
    });

    if (!invitedUser) {
      throw new NotFoundException("Usuario invitado no encontrado");
    }

    // Validar que la fecha programada sea en el futuro
    const scheduledDate = new Date(scheduledAt);
    if (scheduledDate <= new Date()) {
      throw new BadRequestException(
        "La fecha programada debe ser en el futuro"
      );
    }

    // Obtener información del creador para Google Meet
    const creator = await this.prisma.user.findUnique({
      where: { id: createdById },
      select: { email: true },
    });

    // Intentar crear reunión de Google Meet si está configurado
    let meetingUrl: string | undefined;
    let googleEventId: string | undefined;

    if (this.googleMeetService && creator?.email) {
      try {
        // NOTA: En producción, necesitarás obtener el accessToken del usuario
        // desde la base de datos o desde el frontend. Por ahora, esto es opcional.
        // Si el usuario no ha autorizado Google Calendar, simplemente no se crea el Meet.
        // Para usar Google Meet, el usuario debe haber autorizado la app previamente
        // y tener un accessToken guardado. Esto se puede hacer en un endpoint separado
        // donde el usuario autoriza la aplicación.
        // Por ahora, dejamos meetingUrl como undefined si no hay token
        // En el futuro, puedes agregar un campo googleAccessToken al modelo User
      } catch (error) {
        // Si falla la creación de Google Meet, continuar sin él
        console.warn(
          "No se pudo crear Google Meet, continuando sin él:",
          error
        );
      }
    }

    // Crear la reunión
    const meeting = await this.prisma.videoMeeting.create({
      data: {
        createdById,
        invitedUserId,
        scheduledAt: scheduledDate,
        meetingUrl,
        ...rest,
        status: VideoMeetingStatus.SCHEDULED,
      },
    });

    // Enviar mensaje de invitación automáticamente
    try {
      const formattedDate = scheduledDate.toLocaleString("es-ES", {
        dateStyle: "full",
        timeStyle: "short",
      });
      const invitationMessage = `📹 Te invito a una videollamada${
        title ? `: ${title}` : ""
      }${
        description ? `\n\n${description}` : ""
      }\n\n📅 Fecha: ${formattedDate}${
        duration ? `\n⏱️ Duración estimada: ${duration} minutos` : ""
      }\n\nPuedes aceptar o rechazar la invitación desde tus reuniones.`;

      await this.messagesService.sendMessage(createdById, {
        toUserId: invitedUserId,
        message: invitationMessage,
      });
    } catch (error) {
      // Si falla el envío del mensaje, no fallar la creación de la reunión
      console.error("Error al enviar mensaje de invitación:", error);
    }

    return this.mapMeetingToResponse(meeting);
  }

  /**
   * Obtener todas las reuniones del usuario
   */
  async getUserMeetings(userId: string): Promise<VideoMeetingResponseDto[]> {
    const meetings = await this.prisma.videoMeeting.findMany({
      where: {
        OR: [{ createdById: userId }, { invitedUserId: userId }],
      },
      orderBy: { scheduledAt: "asc" },
    });

    return meetings.map((meeting) => this.mapMeetingToResponse(meeting));
  }

  /**
   * Obtener una reunión por ID
   */
  async getMeetingById(
    userId: string,
    meetingId: string
  ): Promise<VideoMeetingResponseDto> {
    const meeting = await this.prisma.videoMeeting.findUnique({
      where: { id: meetingId },
    });

    if (!meeting) {
      throw new NotFoundException("Reunión no encontrada");
    }

    // Verificar que el usuario tenga acceso a esta reunión
    if (meeting.createdById !== userId && meeting.invitedUserId !== userId) {
      throw new ForbiddenException("No tienes permisos para ver esta reunión");
    }

    return this.mapMeetingToResponse(meeting);
  }

  /**
   * Actualizar una reunión
   */
  async updateMeeting(
    userId: string,
    meetingId: string,
    dto: UpdateVideoMeetingDto
  ): Promise<VideoMeetingResponseDto> {
    const meeting = await this.prisma.videoMeeting.findUnique({
      where: { id: meetingId },
    });

    if (!meeting) {
      throw new NotFoundException("Reunión no encontrada");
    }

    // Solo el creador puede actualizar
    if (meeting.createdById !== userId) {
      throw new ForbiddenException(
        "Solo el creador puede actualizar la reunión"
      );
    }

    // No se puede actualizar si ya está en progreso o completada
    if (
      meeting.status === VideoMeetingStatus.IN_PROGRESS ||
      meeting.status === VideoMeetingStatus.COMPLETED
    ) {
      throw new BadRequestException(
        "No se puede actualizar una reunión en progreso o completada"
      );
    }

    const updateData: any = { ...dto };
    if (dto.scheduledAt) {
      const scheduledDate = new Date(dto.scheduledAt);
      if (scheduledDate <= new Date()) {
        throw new BadRequestException(
          "La fecha programada debe ser en el futuro"
        );
      }
      updateData.scheduledAt = scheduledDate;
    }

    const updatedMeeting = await this.prisma.videoMeeting.update({
      where: { id: meetingId },
      data: updateData,
    });

    return this.mapMeetingToResponse(updatedMeeting);
  }

  /**
   * Aceptar una reunión (solo el invitado)
   */
  async acceptMeeting(
    userId: string,
    meetingId: string
  ): Promise<VideoMeetingResponseDto> {
    const meeting = await this.prisma.videoMeeting.findUnique({
      where: { id: meetingId },
    });

    if (!meeting) {
      throw new NotFoundException("Reunión no encontrada");
    }

    if (meeting.invitedUserId !== userId) {
      throw new ForbiddenException("Solo el invitado puede aceptar la reunión");
    }

    if (meeting.status !== VideoMeetingStatus.SCHEDULED) {
      throw new BadRequestException("La reunión ya no está disponible");
    }

    const updatedMeeting = await this.prisma.videoMeeting.update({
      where: { id: meetingId },
      data: {
        status: VideoMeetingStatus.ACCEPTED,
      },
    });

    return this.mapMeetingToResponse(updatedMeeting);
  }

  /**
   * Rechazar una reunión (solo el invitado)
   */
  async rejectMeeting(
    userId: string,
    meetingId: string
  ): Promise<VideoMeetingResponseDto> {
    const meeting = await this.prisma.videoMeeting.findUnique({
      where: { id: meetingId },
    });

    if (!meeting) {
      throw new NotFoundException("Reunión no encontrada");
    }

    if (meeting.invitedUserId !== userId) {
      throw new ForbiddenException(
        "Solo el invitado puede rechazar la reunión"
      );
    }

    if (meeting.status !== VideoMeetingStatus.SCHEDULED) {
      throw new BadRequestException("La reunión ya no está disponible");
    }

    const updatedMeeting = await this.prisma.videoMeeting.update({
      where: { id: meetingId },
      data: {
        status: VideoMeetingStatus.REJECTED,
      },
    });

    return this.mapMeetingToResponse(updatedMeeting);
  }

  /**
   * Cancelar una reunión (solo el creador)
   */
  async cancelMeeting(
    userId: string,
    meetingId: string
  ): Promise<VideoMeetingResponseDto> {
    const meeting = await this.prisma.videoMeeting.findUnique({
      where: { id: meetingId },
    });

    if (!meeting) {
      throw new NotFoundException("Reunión no encontrada");
    }

    if (meeting.createdById !== userId) {
      throw new ForbiddenException("Solo el creador puede cancelar la reunión");
    }

    if (
      meeting.status === VideoMeetingStatus.COMPLETED ||
      meeting.status === VideoMeetingStatus.CANCELLED
    ) {
      throw new BadRequestException("La reunión ya no se puede cancelar");
    }

    const updatedMeeting = await this.prisma.videoMeeting.update({
      where: { id: meetingId },
      data: {
        status: VideoMeetingStatus.CANCELLED,
      },
    });

    return this.mapMeetingToResponse(updatedMeeting);
  }

  /**
   * Iniciar una reunión (crear llamada asociada)
   */
  async startMeeting(
    userId: string,
    meetingId: string,
    callId: string
  ): Promise<VideoMeetingResponseDto> {
    const meeting = await this.prisma.videoMeeting.findUnique({
      where: { id: meetingId },
    });

    if (!meeting) {
      throw new NotFoundException("Reunión no encontrada");
    }

    // Verificar que el usuario tenga acceso
    if (meeting.createdById !== userId && meeting.invitedUserId !== userId) {
      throw new ForbiddenException(
        "No tienes permisos para iniciar esta reunión"
      );
    }

    // Verificar que la reunión esté aceptada o programada
    if (
      meeting.status !== VideoMeetingStatus.ACCEPTED &&
      meeting.status !== VideoMeetingStatus.SCHEDULED
    ) {
      throw new BadRequestException(
        "La reunión debe estar aceptada para iniciarse"
      );
    }

    const updatedMeeting = await this.prisma.videoMeeting.update({
      where: { id: meetingId },
      data: {
        status: VideoMeetingStatus.IN_PROGRESS,
        callId,
        startedAt: new Date(),
      },
    });

    return this.mapMeetingToResponse(updatedMeeting);
  }

  /**
   * Finalizar una reunión
   */
  async completeMeeting(
    userId: string,
    meetingId: string
  ): Promise<VideoMeetingResponseDto> {
    const meeting = await this.prisma.videoMeeting.findUnique({
      where: { id: meetingId },
    });

    if (!meeting) {
      throw new NotFoundException("Reunión no encontrada");
    }

    // Verificar que el usuario tenga acceso
    if (meeting.createdById !== userId && meeting.invitedUserId !== userId) {
      throw new ForbiddenException(
        "No tienes permisos para finalizar esta reunión"
      );
    }

    if (meeting.status !== VideoMeetingStatus.IN_PROGRESS) {
      throw new BadRequestException("La reunión no está en progreso");
    }

    const updatedMeeting = await this.prisma.videoMeeting.update({
      where: { id: meetingId },
      data: {
        status: VideoMeetingStatus.COMPLETED,
        endedAt: new Date(),
      },
    });

    return this.mapMeetingToResponse(updatedMeeting);
  }

  /**
   * Mapear VideoMeeting a DTO
   */
  private mapMeetingToResponse(meeting: any): VideoMeetingResponseDto {
    return {
      id: meeting.id,
      createdById: meeting.createdById,
      invitedUserId: meeting.invitedUserId,
      title: meeting.title,
      description: meeting.description,
      scheduledAt: meeting.scheduledAt,
      duration: meeting.duration,
      status: meeting.status,
      meetingUrl: meeting.meetingUrl,
      callId: meeting.callId,
      createdAt: meeting.createdAt,
      updatedAt: meeting.updatedAt,
      startedAt: meeting.startedAt,
      endedAt: meeting.endedAt,
    };
  }
}
