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
import { ICalendarService } from "../common/services/icalendar.service";

@Injectable()
export class VideoMeetingsService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => MessagesService))
    private messagesService: MessagesService,
    private icalendarService: ICalendarService,
    @Optional() private googleMeetService?: GoogleMeetService
  ) {}

  private async getValidAccessToken(params: {
    userId: string;
    accessToken?: string | null;
    refreshToken?: string | null;
    labelForLogs: string;
  }): Promise<string | null> {
    const { userId, accessToken, refreshToken, labelForLogs } = params;
    if (!accessToken) return null;

    let tokenToUse = accessToken;
    if (this.googleMeetService && refreshToken) {
      try {
        const refreshed = await this.googleMeetService.refreshAccessToken(refreshToken);
        tokenToUse = refreshed.accessToken;
        await this.prisma.user.update({
          where: { id: userId },
          data: { googleAccessToken: tokenToUse },
        });
      } catch (refreshError) {
        console.warn(`[VideoMeetings] No se pudo refrescar token (${labelForLogs}):`, refreshError);
      }
    }
    return tokenToUse;
  }

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

    // Validar que el creador (empresa) tenga Google Calendar conectado
    const creator = await this.prisma.user.findUnique({
      where: { id: createdById },
      select: {
        id: true,
        email: true,
        googleAccessToken: true,
        googleRefreshToken: true,
      },
    });

    if (!creator) {
      throw new NotFoundException("Usuario creador no encontrado");
    }

    if (!creator.googleAccessToken && !creator.googleRefreshToken) {
      throw new BadRequestException(
        "Debes conectar tu Google Calendar antes de crear una videollamada. Ve a Configuración para conectarlo."
      );
    }

    // Validar que la fecha programada sea en el futuro
    const scheduledDate = new Date(scheduledAt);
    if (scheduledDate <= new Date()) {
      throw new BadRequestException(
        "La fecha programada debe ser en el futuro"
      );
    }

    // Calcular fecha de fin basada en la duración
    const startTime = scheduledDate;
    const durationMinutes = duration || 30;
    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

    // Intentar crear eventos de Google Calendar (empresa + postulante) al AGENDAR
    let meetingUrl: string | undefined;
    let googleEventIdCreator: string | undefined;
    let googleEventIdInvited: string | undefined;

    if (this.googleMeetService) {
      // creator ya fue consultado arriba para validar Google Calendar
      const invited = await this.prisma.user.findUnique({
        where: { id: invitedUserId },
        select: {
          id: true,
          email: true,
          googleAccessToken: true,
          googleRefreshToken: true,
        },
      });

      // 1) Crear evento con Google Meet en calendario del creador (si está conectado)
      if (creator?.email) {
        const creatorAccessToken = await this.getValidAccessToken({
          userId: creator.id,
          accessToken: creator.googleAccessToken,
          refreshToken: creator.googleRefreshToken,
          labelForLogs: "creador",
        });

        if (creatorAccessToken) {
          try {
            const creatorEvent = await this.googleMeetService.createMeeting(
              creator.email,
              creatorAccessToken,
              title || "Videollamada",
              description || "",
              startTime,
              endTime,
              [invited?.email].filter(Boolean) as string[]
            );
            meetingUrl = creatorEvent.meetingUrl;
            googleEventIdCreator = creatorEvent.eventId;
          } catch (error) {
            console.error(
              "[VideoMeetings] Error creando evento (Meet) en calendario del creador:",
              error
            );
          }
        }
      }

      // El evento del invitado se crea automáticamente por Google Calendar
      // al incluirlo como attendee en createMeeting() con sendUpdates: "all".
      // No es necesario crear un evento "espejo" separado (causaba duplicación).
      // Usamos el mismo eventId ya que Google Calendar comparte el evento entre organizador y asistentes.
      if (googleEventIdCreator) {
        googleEventIdInvited = googleEventIdCreator;
      }
    }

    // Crear la reunión
    const meeting = await this.prisma.videoMeeting.create({
      data: {
        createdById,
        invitedUserId,
        scheduledAt: scheduledDate,
        meetingUrl,
        googleEventIdCreator,
        googleEventIdInvited,
        ...rest,
        status: VideoMeetingStatus.SCHEDULED,
      },
    });

    // Generar archivos .ics para ambos usuarios (siempre, independientemente de Google Calendar)
    // Esto permite que los usuarios puedan importar el evento a cualquier calendario
    try {
      // Obtener información completa de los usuarios para el .ics
      const [creatorFull, invitedFull] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: createdById },
          select: { email: true },
        }),
        this.prisma.user.findUnique({
          where: { id: invitedUserId },
          select: { email: true },
        }),
      ]);

      // Los archivos .ics se generan bajo demanda cuando el usuario los solicita
      // No los almacenamos en la base de datos, solo los generamos cuando se necesitan
      console.log(
        `[VideoMeetings] Videollamada creada. Archivos .ics disponibles para descarga para ambos usuarios.`
      );
    } catch (error) {
      console.error(
        "[VideoMeetings] Error preparando información para .ics:",
        error
      );
      // No fallar la creación de la reunión si hay error con .ics
    }

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
   * Actualiza los eventos de Google Calendar de ambos usuarios si existen
   */
  async updateMeeting(
    userId: string,
    meetingId: string,
    dto: UpdateVideoMeetingDto
  ): Promise<VideoMeetingResponseDto> {
    const meeting = await this.prisma.videoMeeting.findUnique({
      where: { id: meetingId },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            googleAccessToken: true,
            googleRefreshToken: true,
          },
        },
        invitedUser: {
          select: {
            id: true,
            email: true,
            googleAccessToken: true,
            googleRefreshToken: true,
          },
        },
      },
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
    let newScheduledAt: Date | undefined;
    if (dto.scheduledAt) {
      const scheduledDate = new Date(dto.scheduledAt);
      if (scheduledDate <= new Date()) {
        throw new BadRequestException(
          "La fecha programada debe ser en el futuro"
        );
      }
      newScheduledAt = scheduledDate;
      updateData.scheduledAt = scheduledDate;
    }

    // Calcular fechas de inicio y fin
    const startTime = newScheduledAt || new Date(meeting.scheduledAt);
    const durationMinutes = dto.duration || meeting.duration || 30;
    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

    const title = dto.title || meeting.title || "Videollamada";
    const description = dto.description || meeting.description || "";

    // Actualizar evento del calendario del creador (empresa)
    if (
      this.googleMeetService &&
      meeting.googleEventIdCreator &&
      meeting.createdBy.googleAccessToken
    ) {
      try {
        let accessToken = meeting.createdBy.googleAccessToken;
        if (meeting.createdBy.googleRefreshToken) {
          try {
            const refreshed = await this.googleMeetService.refreshAccessToken(
              meeting.createdBy.googleRefreshToken
            );
            accessToken = refreshed.accessToken;
            await this.prisma.user.update({
              where: { id: meeting.createdById },
              data: { googleAccessToken: accessToken },
            });
          } catch (refreshError) {
            console.warn(
              `No se pudo refrescar el token del creador al actualizar: ${refreshError}`
            );
          }
        }

        const updatedEvent = await this.googleMeetService.updateMeeting(
          accessToken,
          meeting.googleEventIdCreator,
          title,
          description,
          startTime,
          endTime,
          [meeting.invitedUser.email].filter(Boolean)
        );

        // Actualizar la URL si cambió
        if (updatedEvent.meetingUrl && updatedEvent.meetingUrl !== meeting.meetingUrl) {
          updateData.meetingUrl = updatedEvent.meetingUrl;
        }
      } catch (error) {
        console.error(
          "Error actualizando evento del calendario del creador:",
          error
        );
        // Continuar sin fallar si no se puede actualizar el evento
      }
    }

    // No es necesario actualizar el evento del invitado por separado.
    // Google Calendar propaga automáticamente los cambios a todos los asistentes
    // cuando se actualiza el evento del creador con sendUpdates: "all".

    const updatedMeeting = await this.prisma.videoMeeting.update({
      where: { id: meetingId },
      data: updateData,
    });

    return this.mapMeetingToResponse(updatedMeeting);
  }

  /**
   * Aceptar una reunión (solo el invitado)
   * Crea eventos en Google Calendar de ambos usuarios si tienen tokens configurados
   */
  async acceptMeeting(
    userId: string,
    meetingId: string
  ): Promise<VideoMeetingResponseDto> {
    const meeting = await this.prisma.videoMeeting.findUnique({
      where: { id: meetingId },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            googleAccessToken: true,
            googleRefreshToken: true,
          },
        },
        invitedUser: {
          select: {
            id: true,
            email: true,
            googleAccessToken: true,
            googleRefreshToken: true,
          },
        },
      },
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

    // Actualizar la reunión con el estado ACCEPTED.
    // Los eventos de calendario (y meetingUrl) se crean al agendar en createVideoMeeting.
    const updateData: any = { status: VideoMeetingStatus.ACCEPTED };

    const updatedMeeting = await this.prisma.videoMeeting.update({
      where: { id: meetingId },
      data: updateData,
    });

    // Enviar mensaje de confirmación al creador
    try {
      const formattedDate = new Date(meeting.scheduledAt).toLocaleString("es-ES", {
        dateStyle: "full",
        timeStyle: "short",
      });
      const confirmationMessage = `✅ Tu videollamada${
        meeting.title ? ` "${meeting.title}"` : ""
      } ha sido aceptada.\n\n📅 Fecha: ${formattedDate}${
        meeting.meetingUrl ? `\n🔗 ${meeting.meetingUrl}` : ""
      }`;

      await this.messagesService.sendMessage(meeting.invitedUserId, {
        toUserId: meeting.createdById,
        message: confirmationMessage,
      });
    } catch (error) {
      console.error("Error al enviar mensaje de confirmación:", error);
    }

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
   * Elimina los eventos de Google Calendar de ambos usuarios si existen
   */
  async cancelMeeting(
    userId: string,
    meetingId: string
  ): Promise<VideoMeetingResponseDto> {
    const meeting = await this.prisma.videoMeeting.findUnique({
      where: { id: meetingId },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            googleAccessToken: true,
            googleRefreshToken: true,
          },
        },
        invitedUser: {
          select: {
            id: true,
            email: true,
            googleAccessToken: true,
            googleRefreshToken: true,
          },
        },
      },
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

    // Eliminar evento del calendario del creador (empresa)
    if (
      this.googleMeetService &&
      meeting.googleEventIdCreator &&
      meeting.createdBy.googleAccessToken
    ) {
      try {
        let accessToken = meeting.createdBy.googleAccessToken;
        if (meeting.createdBy.googleRefreshToken) {
          try {
            const refreshed = await this.googleMeetService.refreshAccessToken(
              meeting.createdBy.googleRefreshToken
            );
            accessToken = refreshed.accessToken;
            await this.prisma.user.update({
              where: { id: meeting.createdById },
              data: { googleAccessToken: accessToken },
            });
          } catch (refreshError) {
            console.warn(
              `No se pudo refrescar el token del creador al cancelar: ${refreshError}`
            );
          }
        }

        await this.googleMeetService.deleteMeeting(
          accessToken,
          meeting.googleEventIdCreator
        );
      } catch (error) {
        console.error(
          "Error eliminando evento del calendario del creador:",
          error
        );
        // Continuar sin fallar si no se puede eliminar el evento
      }
    }

    // No es necesario eliminar el evento del invitado por separado.
    // Google Calendar elimina automáticamente el evento de los asistentes
    // cuando se elimina el evento del creador con sendUpdates: "all".

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
   * Genera un archivo .ics (iCalendar) para una reunión
   * Permite que cualquier usuario pueda importar el evento a su calendario
   *
   * @param userId ID del usuario que solicita el archivo
   * @param meetingId ID de la reunión
   * @returns Contenido del archivo .ics como string
   */
  async generateICSFile(
    userId: string,
    meetingId: string
  ): Promise<string> {
    const meeting = await this.prisma.videoMeeting.findUnique({
      where: { id: meetingId },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
          },
        },
        invitedUser: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!meeting) {
      throw new NotFoundException("Reunión no encontrada");
    }

    // Verificar que el usuario tenga acceso
    if (meeting.createdById !== userId && meeting.invitedUserId !== userId) {
      throw new ForbiddenException(
        "No tienes permisos para acceder a esta reunión"
      );
    }

    // Calcular fecha de fin
    const startTime = new Date(meeting.scheduledAt);
    const durationMinutes = meeting.duration || 30;
    const endTime = new Date(
      startTime.getTime() + durationMinutes * 60 * 1000
    );

    // Determinar quién es el organizador y quién el invitado
    const isCreator = meeting.createdById === userId;
    // Type assertion needed due to Prisma type inference limitation with nested select
    const meetingWithRelations = meeting as any;
    const organizerEmail = isCreator
      ? meetingWithRelations.createdBy.email
      : meetingWithRelations.invitedUser.email;
    const otherUserEmail = isCreator
      ? meetingWithRelations.invitedUser.email
      : meetingWithRelations.createdBy.email;

    // Generar el archivo .ics
    const icsContent = this.icalendarService.generateVideoMeetingICS(
      meeting.title || "Videollamada",
      meeting.description || "",
      startTime,
      endTime,
      meeting.meetingUrl,
      organizerEmail,
      otherUserEmail
    );

    return icsContent;
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
