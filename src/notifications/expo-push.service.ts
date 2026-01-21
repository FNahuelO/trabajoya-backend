import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

interface ExpoPushMessage {
  to: string;
  sound?: "default" | null;
  title?: string;
  body?: string;
  data?: any;
  badge?: number;
  priority?: "default" | "normal" | "high";
  channelId?: string;
  // TTL (Time To Live) en segundos - crítico para notificaciones cuando la app está cerrada
  // Permite que Expo mantenga la notificación en cola si el dispositivo está offline
  ttl?: number;
  // Expiration timestamp - alternativa a ttl
  expiration?: number;
  // Android: collapseKey para agrupar notificaciones similares
  collapseKey?: string;
  // IMPORTANTE: subtitle ayuda a que las notificaciones se muestren correctamente
  subtitle?: string;
  android?: {
    priority?: "default" | "normal" | "high";
    channelId?: string;
    // Android: ttl específico
    ttl?: number;
    // Android: collapseKey específico
    collapseKey?: string;
    // Android: sticky para que la notificación persista
    sticky?: boolean;
    // Android: visibility para mostrar en pantalla bloqueada
    visibility?: "default" | "public" | "secret" | "private";
  };
  ios?: {
    sound?: "default" | null;
    badge?: number;
    priority?: "default" | "normal" | "high";
    categoryId?: string;
    // iOS: mutableContent permite que las extensiones modifiquen el contenido
    mutableContent?: boolean;
    // iOS: interruptionLevel para notificaciones críticas (iOS 15+)
    interruptionLevel?: "passive" | "active" | "timeSensitive" | "critical";
    // iOS: subtitle para mejor presentación
    subtitle?: string;
  };
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: any;
}

interface ExpoPushReceipt {
  status: "ok" | "error";
  message?: string;
  details?: any;
}

@Injectable()
export class ExpoPushService {
  private logger = new Logger("ExpoPushService");
  private readonly EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
  private readonly MAX_BATCH_SIZE = 100; // Expo limit

  constructor(private prisma: PrismaService) {}

  /**
   * Enviar notificación push a un usuario
   */
  async sendToUser(
    userId: string,
    title: string,
    body: string,
    data?: any,
    options?: {
      badge?: number;
      priority?: "default" | "normal" | "high";
      channelId?: string;
    }
  ): Promise<void> {
    try {
      // Obtener tokens activos del usuario
      const tokens = await this.prisma.pushToken.findMany({
        where: {
          userId,
          isActive: true,
        },
      });

      if (tokens.length === 0) {
        this.logger.warn(`[ExpoPushService] No active push tokens found for user ${userId}. User may not have registered push token.`);
        return;
      }

      this.logger.log(`[ExpoPushService] Sending push notification to user ${userId} with ${tokens.length} token(s)`);

      // Enviar notificación a todos los tokens
      const pushTokens = tokens.map((t) => t.token);
      await this.sendPushNotifications(pushTokens, title, body, data, options);
    } catch (error) {
      this.logger.error(`Error sending push notification to user ${userId}:`, error);
    }
  }

  /**
   * Enviar notificaciones push en lote
   */
  async sendPushNotifications(
    expoPushTokens: string[],
    title: string,
    body: string,
    data?: any,
    options?: {
      badge?: number;
      priority?: "default" | "normal" | "high";
      channelId?: string;
    }
  ): Promise<void> {
    // Validar tokens
    const validTokens = expoPushTokens.filter((token) =>
      this.isValidExpoPushToken(token)
    );

    if (validTokens.length === 0) {
      this.logger.warn("No valid Expo push tokens provided");
      return;
    }

    // Dividir en lotes si es necesario
    const batches = this.chunkArray(validTokens, this.MAX_BATCH_SIZE);

    for (const batch of batches) {
      try {
        await this.sendBatch(batch, title, body, data, options);
      } catch (error) {
        this.logger.error("Error sending push notification batch:", error);
      }
    }
  }

  /**
   * Enviar un lote de notificaciones
   * IMPORTANTE: Las configuraciones aquí son críticas para que las notificaciones funcionen
   * cuando la app está completamente cerrada o en modo de ahorro de energía
   */
  private async sendBatch(
    tokens: string[],
    title: string,
    body: string,
    data?: any,
    options?: {
      badge?: number;
      priority?: "default" | "normal" | "high";
      channelId?: string;
    }
  ): Promise<void> {
    const messages: ExpoPushMessage[] = tokens.map((token) => {
      const channelId = options?.channelId || "general";
      const priority = options?.priority || "high";
      
      // TTL de 24 horas (86400 segundos) - permite que Expo mantenga la notificación
      // en cola si el dispositivo está offline o en modo de ahorro de energía
      const ttlSeconds = 86400;
      
      // Generar collapseKey único basado en el tipo de notificación
      // Esto ayuda a Android a agrupar notificaciones similares
      const collapseKey = data?.type 
        ? `${data.type}_${data.toUserId || data.fromUserId || 'general'}` 
        : undefined;
      
      return {
        to: token,
        sound: "default",
        title,
        body,
        data,
        badge: options?.badge,
        priority, // "high" es necesario para notificaciones en background
        channelId, // ChannelId a nivel raíz para compatibilidad
        // TTL crítico: permite que la notificación se entregue incluso si el dispositivo
        // está offline o en modo de ahorro de energía cuando la app está cerrada
        ttl: ttlSeconds,
        // collapseKey para Android: ayuda a agrupar notificaciones similares
        collapseKey,
        // Configuraciones adicionales para Android para asegurar que funcionen en background
        // IMPORTANTE: El channelId en android debe coincidir con el canal creado en el frontend
        // IMPORTANTE: Cuando uses FCM con Expo, estas configuraciones son críticas para que
        // las notificaciones funcionen cuando la app está completamente cerrada
        android: {
          priority, // "high" es necesario para notificaciones en background/cerrada
          channelId, // Usar el mismo channelId que se configuró en el frontend
          ttl: ttlSeconds, // TTL específico para Android
          collapseKey, // collapseKey específico para Android
          // visibility: "public" asegura que la notificación se muestre en pantalla bloqueada
          visibility: "public",
          // sticky: true hace que la notificación persista hasta que el usuario la descarte
          sticky: channelId === "calls", // Solo para llamadas
        },
        // Configuraciones específicas para iOS para asegurar que funcionen en background
        // IMPORTANTE: Para que las notificaciones funcionen cuando la app está cerrada,
        // necesitamos configurar correctamente los campos de iOS
        ios: {
          sound: "default",
          badge: options?.badge,
          priority: "high", // "high" es CRÍTICO para notificaciones en background/cerrada
          categoryId: channelId === "messages" ? "message" : undefined,
          // interruptionLevel: "timeSensitive" permite que las notificaciones se muestren
          // incluso cuando el dispositivo está en modo "No molestar" (iOS 15+)
          // Para mensajes, usar "active" (por defecto). Para llamadas, usar "timeSensitive"
          interruptionLevel: channelId === "calls" ? "timeSensitive" : "active",
          // mutableContent: true permite que las extensiones modifiquen el contenido de la notificación
          // Esto puede ayudar a mejorar la entrega cuando la app está cerrada
          mutableContent: true,
          // subtitle ayuda a que las notificaciones se muestren correctamente en iOS
          subtitle: channelId === "messages" ? "Nuevo mensaje" : undefined,
        },
      };
    });

    try {
      this.logger.log(`[ExpoPushService] Sending ${messages.length} push notification(s) to Expo Push API`);
      
      const response = await fetch(this.EXPO_PUSH_ENDPOINT, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
      });

      const result = await response.json();

      if (!response.ok) {
        this.logger.error("[ExpoPushService] Expo push notification error:", result);
        return;
      }

      this.logger.log(`[ExpoPushService] Expo Push API responded successfully. Processing ${result.data?.length || 0} ticket(s)`);

      // Procesar tickets
      const tickets: ExpoPushTicket[] = result.data || [];
      await this.processTickets(tokens, tickets);
    } catch (error) {
      this.logger.error("[ExpoPushService] Error calling Expo push API:", error);
    }
  }

  /**
   * Procesar tickets de respuesta
   */
  private async processTickets(
    tokens: string[],
    tickets: ExpoPushTicket[]
  ): Promise<void> {
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      const token = tokens[i];

      if (ticket.status === "error") {
        this.logger.warn(`Push notification error for token ${token}:`, ticket.message);

        // Si el token es inválido, marcarlo como inactivo
        if (
          ticket.details?.error === "DeviceNotRegistered" ||
          ticket.message?.includes("not registered")
        ) {
          await this.deactivateToken(token);
        }
      } else {
        this.logger.log(`[ExpoPushService] Push notification sent successfully to ${token.substring(0, 30)}...`);
      }
    }
  }

  /**
   * Desactivar token
   */
  private async deactivateToken(token: string): Promise<void> {
    try {
      await this.prisma.pushToken.updateMany({
        where: { token },
        data: { isActive: false },
      });
      this.logger.log(`Deactivated invalid push token: ${token}`);
    } catch (error) {
      this.logger.error(`Error deactivating token ${token}:`, error);
    }
  }

  /**
   * Validar si es un token válido de Expo
   */
  private isValidExpoPushToken(token: string): boolean {
    return (
      typeof token === "string" &&
      (token.startsWith("ExponentPushToken[") ||
        token.startsWith("ExpoPushToken["))
    );
  }

  /**
   * Dividir array en chunks
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Enviar notificación de mensaje
   */
  async sendMessageNotification(
    toUserId: string,
    fromUserName: string,
    messageContent: string,
    messageData: any
  ): Promise<void> {
    const truncatedMessage =
      messageContent.length > 100
        ? messageContent.substring(0, 100) + "..."
        : messageContent;

    await this.sendToUser(
      toUserId,
      fromUserName,
      truncatedMessage,
      {
        ...messageData,
        type: "message",
      },
      {
        priority: "high",
        channelId: "messages",
      }
    );
  }

  /**
   * Enviar notificación de llamada
   * IMPORTANTE: Las llamadas necesitan máxima prioridad para funcionar cuando la app está cerrada
   */
  async sendCallNotification(
    toUserId: string,
    fromUserName: string,
    callData: any
  ): Promise<void> {
    await this.sendToUser(
      toUserId,
      "Llamada entrante",
      `${fromUserName} te está llamando`,
      {
        ...callData,
        type: "call",
      },
      {
        priority: "high", // "high" es necesario para notificaciones en background
        channelId: "calls", // Canal específico para llamadas con MAX importance
      }
    );
  }
}

