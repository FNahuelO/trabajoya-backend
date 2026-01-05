import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";

/**
 * Servicio para crear y gestionar reuniones de Google Meet
 * Utiliza Google Calendar API para crear eventos con Google Meet integrado
 */
@Injectable()
export class GoogleMeetService {
  private readonly logger = new Logger(GoogleMeetService.name);
  private oauth2Client: OAuth2Client;

  constructor(private configService: ConfigService) {
    const clientId = this.configService.get<string>("GOOGLE_CLIENT_ID");
    const clientSecret = this.configService.get<string>("GOOGLE_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      this.logger.warn(
        "Google OAuth credentials not configured. Google Meet features will be disabled."
      );
      return;
    }

    this.oauth2Client = new OAuth2Client({
      clientId,
      clientSecret,
      redirectUri: "urn:ietf:wg:oauth:2.0:oob", // Para aplicaciones de servidor
    });
  }

  /**
   * Crea una reunión de Google Meet creando un evento en Google Calendar
   * 
   * NOTA: Para usar esto, el usuario debe haber autorizado la aplicación
   * con los scopes necesarios de Google Calendar. En producción, necesitarás
   * implementar un flujo OAuth para obtener tokens de acceso del usuario.
   * 
   * @param userEmail Email del usuario que crea la reunión
   * @param accessToken Token de acceso OAuth del usuario (obtenido del frontend)
   * @param title Título de la reunión
   * @param description Descripción de la reunión
   * @param startTime Fecha/hora de inicio (ISO 8601)
   * @param endTime Fecha/hora de fin (ISO 8601)
   * @param attendees Lista de emails de los asistentes
   * @returns URL de la reunión de Google Meet
   */
  async createMeeting(
    userEmail: string,
    accessToken: string,
    title: string,
    description: string,
    startTime: Date,
    endTime: Date,
    attendees: string[] = []
  ): Promise<{ meetingUrl: string; eventId: string }> {
    if (!this.oauth2Client) {
      throw new BadRequestException(
        "Google OAuth no está configurado. Por favor, configura GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET."
      );
    }

    try {
      // Configurar el cliente OAuth con el token del usuario
      this.oauth2Client.setCredentials({
        access_token: accessToken,
      });

      // Crear cliente de Google Calendar
      const calendar = google.calendar({ version: "v3", auth: this.oauth2Client });

      // Crear el evento con Google Meet
      const event = {
        summary: title,
        description: description,
        start: {
          dateTime: startTime.toISOString(),
          timeZone: "America/Argentina/Buenos_Aires", // Ajusta según tu zona horaria
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: "America/Argentina/Buenos_Aires",
        },
        attendees: attendees.map((email) => ({ email })),
        conferenceData: {
          createRequest: {
            requestId: `meet-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            conferenceSolutionKey: {
              type: "hangoutsMeet",
            },
          },
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 24 * 60 }, // 1 día antes
            { method: "popup", minutes: 15 }, // 15 minutos antes
          ],
        },
      };

      const response = await calendar.events.insert({
        calendarId: "primary",
        requestBody: event,
        conferenceDataVersion: 1,
        sendUpdates: "all", // Enviar invitaciones a los asistentes
      });

      const meetingUrl =
        response.data.conferenceData?.entryPoints?.[0]?.uri ||
        response.data.hangoutLink;

      if (!meetingUrl) {
        throw new BadRequestException(
          "No se pudo crear el enlace de Google Meet"
        );
      }

      this.logger.log(
        `Reunión de Google Meet creada: ${meetingUrl} para usuario ${userEmail}`
      );

      return {
        meetingUrl,
        eventId: response.data.id || "",
      };
    } catch (error: any) {
      this.logger.error("Error creando reunión de Google Meet:", error);
      
      if (error.code === 401) {
        throw new BadRequestException(
          "Token de acceso inválido o expirado. Por favor, re-autoriza la aplicación."
        );
      }
      
      if (error.code === 403) {
        throw new BadRequestException(
          "No tienes permisos para crear eventos de calendario. Por favor, autoriza el acceso a Google Calendar."
        );
      }

      throw new BadRequestException(
        `Error al crear reunión de Google Meet: ${error.message}`
      );
    }
  }

  /**
   * Genera una URL de autorización OAuth para que el usuario autorice
   * el acceso a Google Calendar
   * 
   * @param redirectUri URI de redirección después de la autorización
   * @returns URL de autorización OAuth
   */
  getAuthUrl(redirectUri: string): string {
    if (!this.oauth2Client) {
      throw new BadRequestException(
        "Google OAuth no está configurado"
      );
    }

    const scopes = [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      redirect_uri: redirectUri,
      prompt: "consent", // Forzar consentimiento para obtener refresh token
    });
  }

  /**
   * Intercambia un código de autorización por tokens de acceso
   * 
   * @param code Código de autorización recibido del callback OAuth
   * @param redirectUri URI de redirección usado en la autorización
   * @returns Tokens de acceso y refresh
   */
  async getTokensFromCode(
    code: string,
    redirectUri: string
  ): Promise<{ accessToken: string; refreshToken?: string }> {
    if (!this.oauth2Client) {
      throw new BadRequestException("Google OAuth no está configurado");
    }

    try {
      const { tokens } = await this.oauth2Client.getToken({
        code,
        redirect_uri: redirectUri,
      });

      return {
        accessToken: tokens.access_token || "",
        refreshToken: tokens.refresh_token,
      };
    } catch (error: any) {
      this.logger.error("Error obteniendo tokens de Google:", error);
      throw new BadRequestException(
        `Error al obtener tokens: ${error.message}`
      );
    }
  }

  /**
   * Refresca un token de acceso usando el refresh token
   * 
   * @param refreshToken Refresh token del usuario
   * @returns Nuevo token de acceso
   */
  async refreshAccessToken(
    refreshToken: string
  ): Promise<{ accessToken: string }> {
    if (!this.oauth2Client) {
      throw new BadRequestException("Google OAuth no está configurado");
    }

    try {
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken,
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();

      return {
        accessToken: credentials.access_token || "",
      };
    } catch (error: any) {
      this.logger.error("Error refrescando token de Google:", error);
      throw new BadRequestException(
        `Error al refrescar token: ${error.message}`
      );
    }
  }

  /**
   * Elimina un evento de Google Calendar (y por ende, la reunión de Meet)
   * 
   * @param accessToken Token de acceso OAuth del usuario
   * @param eventId ID del evento a eliminar
   */
  async deleteMeeting(accessToken: string, eventId: string): Promise<void> {
    if (!this.oauth2Client) {
      throw new BadRequestException("Google OAuth no está configurado");
    }

    try {
      this.oauth2Client.setCredentials({
        access_token: accessToken,
      });

      const calendar = google.calendar({ version: "v3", auth: this.oauth2Client });

      await calendar.events.delete({
        calendarId: "primary",
        eventId: eventId,
      });

      this.logger.log(`Reunión de Google Meet eliminada: ${eventId}`);
    } catch (error: any) {
      this.logger.error("Error eliminando reunión de Google Meet:", error);
      throw new BadRequestException(
        `Error al eliminar reunión: ${error.message}`
      );
    }
  }
}

