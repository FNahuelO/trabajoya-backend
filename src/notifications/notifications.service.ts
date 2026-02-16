import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ExpoPushService } from "./expo-push.service";
import { NotificationPreferencesDto } from "./dto/notification-preferences.dto";

interface PostulanteNotificationPreferences {
  newJobs: boolean;
  companyMessages: boolean;
  applicationUpdates: boolean;
  tipsAdvice: boolean;
  calls: boolean;
}

interface EmpresaNotificationPreferences {
  newApplications: boolean;
  applicantMessages: boolean;
  interviewReminders: boolean;
  systemUpdates: boolean;
  calls: boolean;
}

type NotificationPreferences =
  | PostulanteNotificationPreferences
  | EmpresaNotificationPreferences;

const DEFAULT_POSTULANTE_PREFERENCES: PostulanteNotificationPreferences = {
  newJobs: true,
  companyMessages: true,
  applicationUpdates: true,
  tipsAdvice: true,
  calls: true,
};

const DEFAULT_EMPRESA_PREFERENCES: EmpresaNotificationPreferences = {
  newApplications: true,
  applicantMessages: true,
  interviewReminders: true,
  systemUpdates: true,
  calls: true,
};

@Injectable()
export class NotificationsService {
  private logger = new Logger("NotificationsService");

  constructor(
    private prisma: PrismaService,
    private expoPushService: ExpoPushService
  ) {}

  /**
   * Registrar token de push
   */
  async registerPushToken(
    userId: string,
    token: string,
    platform: string,
    deviceId?: string
  ): Promise<void> {
    try {
      // Usar upsert para evitar condiciones de carrera
      // Si el token existe, actualizar; si no, crear
      await this.prisma.pushToken.upsert({
        where: { token },
        update: {
          userId,
          deviceId,
          platform, // Actualizar plataforma por si cambió
          isActive: true,
          updatedAt: new Date(),
        },
        create: {
          userId,
          token,
          platform,
          deviceId,
          isActive: true,
        },
      });
      this.logger.log(`Registered/updated push token for user ${userId}`);
    } catch (error) {
      this.logger.error(`Error registering push token for user ${userId}:`, error);
      // No lanzar el error para evitar que falle el registro del token
      // El token puede seguir funcionando aunque haya un error en la BD
    }
  }

  /**
   * Desregistrar token de push
   */
  async unregisterPushToken(token: string): Promise<void> {
    try {
      await this.prisma.pushToken.updateMany({
        where: { token },
        data: { isActive: false },
      });
      this.logger.log(`Unregistered push token: ${token}`);
    } catch (error) {
      this.logger.error(`Error unregistering push token:`, error);
      throw error;
    }
  }

  /**
   * Desregistrar todos los tokens de un usuario
   */
  async unregisterAllUserTokens(userId: string): Promise<void> {
    try {
      await this.prisma.pushToken.updateMany({
        where: { userId },
        data: { isActive: false },
      });
      this.logger.log(`Unregistered all push tokens for user ${userId}`);
    } catch (error) {
      this.logger.error(
        `Error unregistering all tokens for user ${userId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Obtener tokens activos de un usuario
   */
  async getUserActiveTokens(userId: string): Promise<string[]> {
    try {
      const tokens = await this.prisma.pushToken.findMany({
        where: {
          userId,
          isActive: true,
        },
        select: {
          token: true,
        },
      });

      return tokens.map((t) => t.token);
    } catch (error) {
      this.logger.error(
        `Error getting active tokens for user ${userId}:`,
        error
      );
      return [];
    }
  }

  /**
   * Verificar si un usuario tiene tokens activos
   */
  async hasActiveTokens(userId: string): Promise<boolean> {
    try {
      const count = await this.prisma.pushToken.count({
        where: {
          userId,
          isActive: true,
        },
      });

      return count > 0;
    } catch (error) {
      this.logger.error(
        `Error checking active tokens for user ${userId}:`,
        error
      );
      return false;
    }
  }

  /**
   * Enviar notificación push a un usuario
   */
  async sendPushToUser(
    userId: string,
    title: string,
    body: string,
    data?: any
  ): Promise<void> {
    await this.expoPushService.sendToUser(userId, title, body, data);
  }

  /**
   * Enviar notificación de mensaje
   * @param title Título de la notificación (opcional, por defecto "Nuevo mensaje")
   */
  async sendMessageNotification(
    toUserId: string,
    fromUserName: string,
    messageContent: string,
    messageData: any,
    title?: string
  ): Promise<void> {
    // Verificar preferencias del usuario
    const preferences = await this.getUserPreferences(toUserId);
    
    // Verificar según tipo de usuario
    const hasMessagesEnabled =
      (preferences as any).companyMessages ?? // Postulante
      (preferences as any).applicantMessages ?? // Empresa
      true;

    if (!hasMessagesEnabled) {
      this.logger.log(
        `[NotificationsService] User ${toUserId} has disabled message notifications, skipping push notification`
      );
      return;
    }

    this.logger.log(
      `[NotificationsService] Sending message notification to user ${toUserId} from ${fromUserName}`
    );

    await this.expoPushService.sendMessageNotification(
      toUserId,
      fromUserName,
      messageContent,
      messageData,
      title
    );
  }

  /**
   * Enviar notificación de nueva postulación a la empresa
   */
  async sendNewApplicationNotification(
    empresaUserId: string,
    applicantName: string,
    jobTitle: string,
    applicationData: {
      applicationId: string;
      jobId: string;
      postulanteId: string;
    }
  ): Promise<void> {
    // Verificar preferencias de la empresa
    const preferences = await this.getUserPreferences(empresaUserId);
    const empresaPrefs = preferences as EmpresaNotificationPreferences;

    if (!empresaPrefs.newApplications) {
      this.logger.log(
        `[NotificationsService] Empresa user ${empresaUserId} has disabled newApplications notifications, skipping push`
      );
      return;
    }

    this.logger.log(
      `[NotificationsService] Sending new application notification to empresa user ${empresaUserId} for job "${jobTitle}"`
    );

    const title = "Nueva postulación";
    const body = `${applicantName} se postuló a "${jobTitle}"`;

    await this.expoPushService.sendToUser(
      empresaUserId,
      title,
      body,
      {
        ...applicationData,
        type: "new_application",
      },
      {
        priority: "high",
        channelId: "general",
      }
    );
  }

  /**
   * Enviar notificación de cambio de estado de postulación al postulante
   */
  async sendApplicationStatusNotification(
    postulanteUserId: string,
    jobTitle: string,
    companyName: string,
    newStatus: string,
    applicationData: {
      applicationId: string;
      jobId: string;
    }
  ): Promise<void> {
    // Verificar preferencias del postulante
    const preferences = await this.getUserPreferences(postulanteUserId);
    const postulantePrefs = preferences as PostulanteNotificationPreferences;

    if (!postulantePrefs.applicationUpdates) {
      this.logger.log(
        `[NotificationsService] Postulante user ${postulanteUserId} has disabled applicationUpdates notifications, skipping push`
      );
      return;
    }

    // Mapear estados a etiquetas legibles
    const statusLabels: Record<string, { label: string; emoji: string }> = {
      PENDING: { label: "Pendiente", emoji: "⏳" },
      REVIEWED: { label: "Revisada", emoji: "👀" },
      INTERVIEW: { label: "Entrevista", emoji: "📅" },
      ACCEPTED: { label: "Aceptada", emoji: "🎉" },
      REJECTED: { label: "No seleccionada", emoji: "📋" },
    };

    const statusInfo = statusLabels[newStatus] || { label: newStatus, emoji: "📌" };

    this.logger.log(
      `[NotificationsService] Sending application status notification to postulante user ${postulanteUserId} for job "${jobTitle}" - status: ${newStatus}`
    );

    const title = `${statusInfo.emoji} Tu postulación fue actualizada`;
    const body = `Tu postulación a "${jobTitle}" en ${companyName} cambió a: ${statusInfo.label}`;

    await this.expoPushService.sendToUser(
      postulanteUserId,
      title,
      body,
      {
        ...applicationData,
        type: "application_status",
        newStatus,
        jobTitle,
        companyName,
      },
      {
        priority: "high",
        channelId: "general",
      }
    );
  }

  /**
   * Enviar notificación de llamada
   */
  async sendCallNotification(
    toUserId: string,
    fromUserName: string,
    callData: any
  ): Promise<void> {
    // Verificar preferencias del usuario
    const preferences = await this.getUserPreferences(toUserId);
    if (!preferences.calls) {
      this.logger.debug(`User ${toUserId} has disabled call notifications`);
      return;
    }

    await this.expoPushService.sendCallNotification(
      toUserId,
      fromUserName,
      callData
    );
  }

  /**
   * Obtener preferencias de notificaciones del usuario
   */
  async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          userType: true,
          postulante: {
            select: {
              notificationPreferences: true,
            },
          },
          empresa: {
            select: {
              notificationPreferences: true,
            },
          },
        },
      });

      if (!user) {
        return DEFAULT_POSTULANTE_PREFERENCES;
      }

      // Si es postulante
      if (user.userType === "POSTULANTE") {
        if (user.postulante?.notificationPreferences) {
          const prefs = user.postulante.notificationPreferences as any;
          return {
            newJobs:
              prefs.newJobs ?? DEFAULT_POSTULANTE_PREFERENCES.newJobs,
            companyMessages:
              prefs.companyMessages ??
              DEFAULT_POSTULANTE_PREFERENCES.companyMessages,
            applicationUpdates:
              prefs.applicationUpdates ??
              DEFAULT_POSTULANTE_PREFERENCES.applicationUpdates,
            tipsAdvice:
              prefs.tipsAdvice ?? DEFAULT_POSTULANTE_PREFERENCES.tipsAdvice,
            calls: prefs.calls ?? DEFAULT_POSTULANTE_PREFERENCES.calls,
          } as PostulanteNotificationPreferences;
        }
        return DEFAULT_POSTULANTE_PREFERENCES;
      }

      // Si es empresa
      if (user.userType === "EMPRESA") {
        if (user.empresa?.notificationPreferences) {
          const prefs = user.empresa.notificationPreferences as any;
          return {
            newApplications:
              prefs.newApplications ??
              DEFAULT_EMPRESA_PREFERENCES.newApplications,
            applicantMessages:
              prefs.applicantMessages ??
              DEFAULT_EMPRESA_PREFERENCES.applicantMessages,
            interviewReminders:
              prefs.interviewReminders ??
              DEFAULT_EMPRESA_PREFERENCES.interviewReminders,
            systemUpdates:
              prefs.systemUpdates ?? DEFAULT_EMPRESA_PREFERENCES.systemUpdates,
            calls: prefs.calls ?? DEFAULT_EMPRESA_PREFERENCES.calls,
          } as EmpresaNotificationPreferences;
        }
        return DEFAULT_EMPRESA_PREFERENCES;
      }

      return DEFAULT_POSTULANTE_PREFERENCES;
    } catch (error) {
      this.logger.error(
        `Error getting preferences for user ${userId}:`,
        error
      );
      return DEFAULT_POSTULANTE_PREFERENCES;
    }
  }

  /**
   * Actualizar preferencias de notificaciones del usuario
   */
  async updateUserPreferences(
    userId: string,
    preferences: NotificationPreferencesDto
  ): Promise<NotificationPreferences> {
    try {
      // Obtener usuario
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          postulante: {
            select: {
              id: true,
              notificationPreferences: true,
            },
          },
          empresa: {
            select: {
              id: true,
              notificationPreferences: true,
            },
          },
        },
      });

      if (!user) {
        throw new Error("Usuario no encontrado");
      }

      // Si es postulante
      if (user.postulante) {
        const currentPrefs =
          (user.postulante.notificationPreferences as any) || {};

        const newPrefs: PostulanteNotificationPreferences = {
          newJobs: preferences.newJobs ?? currentPrefs.newJobs ?? true,
          companyMessages:
            preferences.companyMessages ?? currentPrefs.companyMessages ?? true,
          applicationUpdates:
            preferences.applicationUpdates ??
            currentPrefs.applicationUpdates ??
            true,
          tipsAdvice: preferences.tipsAdvice ?? currentPrefs.tipsAdvice ?? true,
          calls: preferences.calls ?? currentPrefs.calls ?? true,
        };

        await this.prisma.postulanteProfile.update({
          where: { id: user.postulante.id },
          data: {
            notificationPreferences: newPrefs as any,
          },
        });

        this.logger.log(
          `Updated postulante notification preferences for user ${userId}`
        );

        return newPrefs;
      }

      // Si es empresa
      if (user.empresa) {
        const currentPrefs =
          (user.empresa.notificationPreferences as any) || {};

        const newPrefs: EmpresaNotificationPreferences = {
          newApplications:
            preferences.newApplications ?? currentPrefs.newApplications ?? true,
          applicantMessages:
            preferences.applicantMessages ??
            currentPrefs.applicantMessages ??
            true,
          interviewReminders:
            preferences.interviewReminders ??
            currentPrefs.interviewReminders ??
            true,
          systemUpdates:
            preferences.systemUpdates ?? currentPrefs.systemUpdates ?? true,
          calls: preferences.calls ?? currentPrefs.calls ?? true,
        };

        await this.prisma.empresaProfile.update({
          where: { id: user.empresa.id },
          data: {
            notificationPreferences: newPrefs as any,
          },
        });

        this.logger.log(
          `Updated empresa notification preferences for user ${userId}`
        );

        return newPrefs;
      }

      throw new Error("Usuario no tiene perfil de postulante ni empresa");
    } catch (error) {
      this.logger.error(
        `Error updating preferences for user ${userId}:`,
        error
      );
      throw error;
    }
  }
}

