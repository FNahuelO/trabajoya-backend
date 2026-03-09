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
      const calendar = google.calendar({
        version: "v3",
        auth: this.oauth2Client,
      });

      // Crear el evento con Google Meet
      const event = {
        summary: title,
        description: description,
        start: {
          dateTime: startTime.toISOString(),
        },
        end: {
          dateTime: endTime.toISOString(),
        },
        attendees: attendees.map((email) => ({ email })),
        conferenceData: {
          createRequest: {
            requestId: `meet-${Date.now()}-${Math.random()
              .toString(36)
              .substring(7)}`,
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
   * Crea un evento en Google Calendar SIN crear un nuevo Google Meet.
   * Útil para reflejar la reunión en el calendario del invitado usando el mismo meetingUrl.
   */
  async createCalendarEvent(
    userEmail: string,
    accessToken: string,
    title: string,
    description: string,
    startTime: Date,
    endTime: Date,
    attendees: string[] = [],
    meetingUrl?: string
  ): Promise<{ eventId: string }> {
    if (!this.oauth2Client) {
      throw new BadRequestException(
        "Google OAuth no está configurado. Por favor, configura GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET."
      );
    }

    try {
      this.oauth2Client.setCredentials({
        access_token: accessToken,
      });

      const calendar = google.calendar({
        version: "v3",
        auth: this.oauth2Client,
      });

      const finalDescription = meetingUrl
        ? `${description || ""}\n\n🔗 Link de la reunión: ${meetingUrl}`.trim()
        : description;

      const event: any = {
        summary: title,
        description: finalDescription,
        start: {
          dateTime: startTime.toISOString(),
        },
        end: {
          dateTime: endTime.toISOString(),
        },
        attendees: attendees.map((email) => ({ email })),
        location: meetingUrl,
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 24 * 60 },
            { method: "popup", minutes: 15 },
          ],
        },
      };

      const response = await calendar.events.insert({
        calendarId: "primary",
        requestBody: event,
        sendUpdates: "all",
      });

      this.logger.log(
        `Evento de calendario creado (sin Meet): ${response.data.id} para usuario ${userEmail}`
      );

      return { eventId: response.data.id || "" };
    } catch (error: any) {
      this.logger.error("Error creando evento de calendario:", error);
      throw new BadRequestException(
        `Error al crear evento de calendario: ${error.message}`
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
      throw new BadRequestException("Google OAuth no está configurado");
    }

    // Solo solicitar el scope mínimo necesario para crear eventos de calendario
    // (requerido por la verificación de Google OAuth - permisos mínimos)
    const scopes = [
      "https://www.googleapis.com/auth/calendar.events",
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
    redirectUri: string,
    frontendClientId?: string
  ): Promise<{ accessToken: string; refreshToken?: string }> {
    if (!this.oauth2Client) {
      throw new BadRequestException("Google OAuth no está configurado");
    }

    const webClientId = this.configService.get<string>("GOOGLE_CLIENT_ID");
    const webClientSecret = this.configService.get<string>(
      "GOOGLE_CLIENT_SECRET"
    );

    if (!webClientId || !webClientSecret) {
      throw new BadRequestException("Google OAuth credentials no configuradas");
    }

    // Si el frontend envió un clientId (ej: iOS/Android nativo), usarlo para el intercambio.
    // Los clientes nativos de Google no necesitan client_secret.
    const isNativeClient =
      frontendClientId && frontendClientId !== webClientId;
    const clientId = frontendClientId || webClientId;
    const clientSecret = isNativeClient ? undefined : webClientSecret;

    try {
      // Para serverAuthCode de SDKs nativos (Android/iOS), el redirectUri es vacío.
      // En ese caso usamos el redirectUri por defecto del constructor ("urn:ietf:wg:oauth:2.0:oob")
      // o simplemente no lo enviamos en el request body.
      const isServerAuthCode = !redirectUri || redirectUri === "";
      const effectiveRedirectUri = isServerAuthCode ? "" : redirectUri;

      // IMPORTANTE: Crear un nuevo OAuth2Client con el clientId y redirectUri exactos
      // que se usaron en la autorización. El código está vinculado al client_id que lo generó.
      const oauth2Client = new OAuth2Client({
        clientId,
        clientSecret: clientSecret || "",
        // Para serverAuthCode de SDKs nativos, no necesitamos redirectUri
        ...(isServerAuthCode ? {} : { redirectUri: effectiveRedirectUri }),
      });

      this.logger.log(
        `[GoogleCalendar] Intercambiando código con clientId: ${clientId.substring(0, 30)}..., redirectUri: ${effectiveRedirectUri || "(vacío/serverAuthCode)"}, isNativeClient: ${isNativeClient}, isServerAuthCode: ${isServerAuthCode}`
      );

      // Para clientes nativos, Google permite el intercambio sin client_secret
      // Para serverAuthCode, no incluir redirect_uri en el body
      const tokenRequestBody: any = {
        code,
        ...(isServerAuthCode ? {} : { redirect_uri: effectiveRedirectUri }),
      };

      const { tokens } = await oauth2Client.getToken(tokenRequestBody);

      if (!tokens.access_token) {
        this.logger.error(
          `[GoogleCalendar] Token exchange exitoso pero access_token vacío. Tokens recibidos: ${JSON.stringify({
            has_access_token: !!tokens.access_token,
            has_refresh_token: !!tokens.refresh_token,
            has_id_token: !!tokens.id_token,
            token_type: tokens.token_type,
            scope: tokens.scope,
          })}`
        );
        throw new BadRequestException(
          "El intercambio de tokens fue exitoso pero no se recibió un access_token válido de Google."
        );
      }

      this.logger.log(
        `[GoogleCalendar] Tokens obtenidos exitosamente (access_token: ${tokens.access_token.substring(0, 20)}..., refresh_token: ${tokens.refresh_token ? "sí" : "no"})`
      );

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || undefined,
      };
    } catch (error: any) {
      this.logger.error("Error obteniendo tokens de Google:", error);
      this.logger.error(`[GoogleCalendar] redirectUri usado: ${redirectUri}`);
      this.logger.error(
        `[GoogleCalendar] Error completo:`,
        JSON.stringify(error, null, 2)
      );

      throw new BadRequestException(
        `Error al obtener tokens: ${error.message || "unknown_error"}`
      );
    }
  }

  /**
   * Refresca un token de acceso usando el refresh token
   *
   * @param refreshToken Refresh token del usuario
   * @param storedClientId Client ID que se usó al autorizar (para clientes nativos iOS/Android)
   * @returns Nuevo token de acceso
   */
  async refreshAccessToken(
    refreshToken: string,
    storedClientId?: string | null
  ): Promise<{ accessToken: string }> {
    if (!this.oauth2Client) {
      throw new BadRequestException("Google OAuth no está configurado");
    }

    try {
      const webClientId = this.configService.get<string>("GOOGLE_CLIENT_ID");
      const webClientSecret = this.configService.get<string>("GOOGLE_CLIENT_SECRET");

      // Si el token fue obtenido con un clientId diferente al web (ej: iOS/Android nativo),
      // crear un OAuth2Client específico con ese clientId para que el refresh funcione.
      // Los refresh tokens están vinculados al clientId que los generó.
      const isNativeClient = storedClientId && storedClientId !== webClientId;

      let client: OAuth2Client;
      if (isNativeClient) {
        this.logger.log(
          `[Refresh] Usando clientId nativo para refrescar: ${storedClientId.substring(0, 30)}...`
        );
        // Clientes nativos no usan client_secret para refresh
        client = new OAuth2Client({
          clientId: storedClientId,
          clientSecret: "",
        });
      } else {
        client = this.oauth2Client;
      }

      client.setCredentials({
        refresh_token: refreshToken,
      });

      const { credentials } = await client.refreshAccessToken();

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
   * Actualiza un evento de Google Calendar
   *
   * @param accessToken Token de acceso OAuth del usuario
   * @param eventId ID del evento a actualizar
   * @param title Nuevo título
   * @param description Nueva descripción
   * @param startTime Nueva fecha/hora de inicio
   * @param endTime Nueva fecha/hora de fin
   * @param attendees Lista de emails de los asistentes
   * @returns URL de la reunión de Google Meet actualizada
   */
  async updateMeeting(
    accessToken: string,
    eventId: string,
    title: string,
    description: string,
    startTime: Date,
    endTime: Date,
    attendees: string[] = []
  ): Promise<{ meetingUrl: string }> {
    if (!this.oauth2Client) {
      throw new BadRequestException("Google OAuth no está configurado");
    }

    try {
      this.oauth2Client.setCredentials({
        access_token: accessToken,
      });

      const calendar = google.calendar({
        version: "v3",
        auth: this.oauth2Client,
      });

      // Obtener el evento actual para preservar el conferenceData
      const existingEvent = await calendar.events.get({
        calendarId: "primary",
        eventId: eventId,
      });

      // Actualizar el evento
      const updatedEvent = {
        summary: title,
        description: description,
        start: {
          dateTime: startTime.toISOString(),
        },
        end: {
          dateTime: endTime.toISOString(),
        },
        attendees: attendees.map((email) => ({ email })),
        // Preservar el conferenceData existente si existe
        conferenceData: existingEvent.data.conferenceData || undefined,
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 24 * 60 }, // 1 día antes
            { method: "popup", minutes: 15 }, // 15 minutos antes
          ],
        },
      };

      const response = await calendar.events.update({
        calendarId: "primary",
        eventId: eventId,
        requestBody: updatedEvent,
        conferenceDataVersion: 1,
        sendUpdates: "all", // Enviar actualizaciones a los asistentes
      });

      const meetingUrl =
        response.data.conferenceData?.entryPoints?.[0]?.uri ||
        response.data.hangoutLink ||
        existingEvent.data.hangoutLink;

      if (!meetingUrl) {
        throw new BadRequestException(
          "No se pudo obtener el enlace de Google Meet actualizado"
        );
      }

      this.logger.log(
        `Reunión de Google Meet actualizada: ${eventId} para usuario`
      );

      return {
        meetingUrl,
      };
    } catch (error: any) {
      this.logger.error("Error actualizando reunión de Google Meet:", error);

      if (error.code === 401) {
        throw new BadRequestException(
          "Token de acceso inválido o expirado. Por favor, re-autoriza la aplicación."
        );
      }

      if (error.code === 403) {
        throw new BadRequestException(
          "No tienes permisos para actualizar eventos de calendario."
        );
      }

      if (error.code === 404) {
        throw new BadRequestException(
          "El evento no se encontró en Google Calendar."
        );
      }

      throw new BadRequestException(
        `Error al actualizar reunión de Google Meet: ${error.message}`
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

      const calendar = google.calendar({
        version: "v3",
        auth: this.oauth2Client,
      });

      await calendar.events.delete({
        calendarId: "primary",
        eventId: eventId,
        sendUpdates: "all", // Notificar a los asistentes sobre la cancelación
      });

      this.logger.log(`Reunión de Google Meet eliminada: ${eventId}`);
    } catch (error: any) {
      this.logger.error("Error eliminando reunión de Google Meet:", error);

      // Si el evento ya no existe, no es un error crítico
      if (error.code === 404) {
        this.logger.warn(
          `El evento ${eventId} ya no existe en Google Calendar`
        );
        return;
      }

      if (error.code === 401) {
        throw new BadRequestException(
          "Token de acceso inválido o expirado. Por favor, re-autoriza la aplicación."
        );
      }

      if (error.code === 403) {
        throw new BadRequestException(
          "No tienes permisos para eliminar eventos de calendario."
        );
      }

      throw new BadRequestException(
        `Error al eliminar reunión: ${error.message}`
      );
    }
  }
}
