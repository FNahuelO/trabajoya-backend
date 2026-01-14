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
        this.logger.debug(`No active push tokens found for user ${userId}`);
        return;
      }

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
    const messages: ExpoPushMessage[] = tokens.map((token) => ({
      to: token,
      sound: "default",
      title,
      body,
      data,
      badge: options?.badge,
      priority: options?.priority || "high",
      channelId: options?.channelId,
    }));

    try {
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
        this.logger.error("Expo push notification error:", result);
        return;
      }

      // Procesar tickets
      const tickets: ExpoPushTicket[] = result.data || [];
      await this.processTickets(tokens, tickets);
    } catch (error) {
      this.logger.error("Error calling Expo push API:", error);
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
        this.logger.debug(`Push notification sent successfully to ${token}`);
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
        priority: "high",
        channelId: "calls",
      }
    );
  }
}

