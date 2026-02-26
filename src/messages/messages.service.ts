import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  SendMessageDto,
  MessageResponseDto,
  ConversationResponseDto,
} from "./dto";
import { GcpCdnService } from "../upload/gcp-cdn.service";
import { GCSUploadService } from "../upload/gcs-upload.service";
import { BlockedUsersService } from "../blocked-users/blocked-users.service";
// import { I18nService } from "nestjs-i18n"; // Temporalmente deshabilitado

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private gcpCdnService: GcpCdnService,
    private gcsUploadService: GCSUploadService,
    private blockedUsersService: BlockedUsersService
  ) {}

  async sendMessage(
    fromUserId: string,
    dto: SendMessageDto
  ): Promise<MessageResponseDto> {
    const { toUserId, message } = dto;

    // Validar que no se envíe mensaje a sí mismo
    if (fromUserId === toUserId) {
      throw new BadRequestException("No puedes enviarte un mensaje a ti mismo");
    }

    // Verificar que el usuario destinatario existe
    const toUser = await this.prisma.user.findUnique({
      where: { id: toUserId },
    });

    if (!toUser) {
      throw new NotFoundException("Usuario destinatario no encontrado");
    }

    // Verificar que el usuario remitente existe
    const fromUser = await this.prisma.user.findUnique({
      where: { id: fromUserId },
    });

    if (!fromUser) {
      throw new NotFoundException("Usuario remitente no encontrado");
    }

    // Verificar bloqueos - Requerido por Google Play
    // Si el destinatario bloqueó al remitente, no permitir enviar mensaje
    const isBlockedByRecipient = await this.blockedUsersService.isBlocked(
      toUserId,
      fromUserId
    );
    if (isBlockedByRecipient) {
      throw new ForbiddenException(
        "No puedes enviar mensajes a este usuario. Has sido bloqueado."
      );
    }

    // Si el remitente bloqueó al destinatario, no permitir enviar mensaje
    const isBlockedBySender = await this.blockedUsersService.isBlocked(
      fromUserId,
      toUserId
    );
    if (isBlockedBySender) {
      throw new ForbiddenException(
        "No puedes enviar mensajes a este usuario. Lo has bloqueado."
      );
    }

    // Crear el mensaje
    const newMessage = await this.prisma.message.create({
      data: {
        fromUserId,
        toUserId,
        content: message,
      },
      include: {
        fromUser: {
          select: {
            id: true,
            email: true,
            userType: true,
            postulante: {
              select: {
                id: true,
                fullName: true,
                profilePicture: true,
              },
            },
            empresa: {
              select: {
                id: true,
                companyName: true,
                logo: true,
              },
            },
          },
        },
        toUser: {
          select: {
            id: true,
            email: true,
            userType: true,
            postulante: {
              select: {
                id: true,
                fullName: true,
                profilePicture: true,
              },
            },
            empresa: {
              select: {
                id: true,
                companyName: true,
                logo: true,
              },
            },
          },
        },
      },
    });

    return await this.mapMessageToResponse(newMessage);
  }

  async getConversations(userId: string): Promise<ConversationResponseDto[]> {
    type ConversationRow = {
      otherUserId: string;
      id: string;
      fromUserId: string;
      toUserId: string;
      content: string;
      isDelivered: boolean;
      isRead: boolean;
      createdAt: Date;
      unreadCount: number;
    };

    // Obtener último mensaje + no leídos por conversación en una sola consulta.
    const rows = await this.prisma.$queryRaw<ConversationRow[]>(Prisma.sql`
      WITH scoped AS (
        SELECT
          CASE
            WHEN "fromUserId" = ${userId} THEN "toUserId"
            ELSE "fromUserId"
          END AS "otherUserId",
          "id",
          "fromUserId",
          "toUserId",
          "content",
          "isDelivered",
          "isRead",
          "createdAt"
        FROM "Message"
        WHERE "fromUserId" = ${userId} OR "toUserId" = ${userId}
      ),
      ranked AS (
        SELECT
          *,
          ROW_NUMBER() OVER (
            PARTITION BY "otherUserId"
            ORDER BY "createdAt" DESC
          ) AS rn
        FROM scoped
      ),
      unread AS (
        SELECT
          "fromUserId" AS "otherUserId",
          COUNT(*)::int AS "unreadCount"
        FROM "Message"
        WHERE "toUserId" = ${userId} AND "isRead" = false
        GROUP BY "fromUserId"
      )
      SELECT
        r."otherUserId",
        r."id",
        r."fromUserId",
        r."toUserId",
        r."content",
        r."isDelivered",
        r."isRead",
        r."createdAt",
        COALESCE(u."unreadCount", 0) AS "unreadCount"
      FROM ranked r
      LEFT JOIN unread u ON u."otherUserId" = r."otherUserId"
      WHERE r.rn = 1
      ORDER BY r."createdAt" DESC
    `);

    if (rows.length === 0) {
      return [];
    }

    const participantIds = new Set<string>([userId, ...rows.map((row) => row.otherUserId)]);

    const participants = await this.prisma.user.findMany({
      where: {
        id: { in: Array.from(participantIds) },
      },
      select: {
        id: true,
        email: true,
        userType: true,
        postulante: {
          select: {
            id: true,
            fullName: true,
            profilePicture: true,
          },
        },
        empresa: {
          select: {
            id: true,
            companyName: true,
            logo: true,
          },
        },
      },
    });

    const participantMap = new Map(participants.map((user) => [user.id, user]));
    const rowsWithUser = rows.filter((row) => participantMap.has(row.otherUserId));

    const conversations = await Promise.all(
      rowsWithUser.map(async (row) => {
        return {
          user: await this.mapUserToResponse(participantMap.get(row.otherUserId)),
          lastMessage: await this.mapMessageToResponse({
            ...row,
            fromUser: participantMap.get(row.fromUserId),
            toUser: participantMap.get(row.toUserId),
          }),
          unreadCount: row.unreadCount,
        };
      })
    );

    return conversations;
  }

  async getConversationWith(
    userId: string,
    otherUserId: string,
    limit: number = 50,
    before?: string
  ): Promise<MessageResponseDto[]> {
    const safeLimit = this.clampLimit(limit);
    const cursorDate = before ? new Date(before) : undefined;

    if (before && (!cursorDate || Number.isNaN(cursorDate.getTime()))) {
      throw new BadRequestException(
        "Parámetro before inválido. Debe ser una fecha ISO válida."
      );
    }

    const messages = await this.prisma.message.findMany({
      where: {
        AND: [
          {
            OR: [
              { fromUserId: userId, toUserId: otherUserId },
              { fromUserId: otherUserId, toUserId: userId },
            ],
          },
          ...(cursorDate
            ? [
                {
                  createdAt: {
                    lt: cursorDate,
                  },
                },
              ]
            : []),
        ],
      },
      orderBy: { createdAt: "desc" },
      take: safeLimit,
      include: {
        fromUser: {
          select: {
            id: true,
            email: true,
            userType: true,
            postulante: {
              select: {
                id: true,
                fullName: true,
                profilePicture: true,
              },
            },
            empresa: {
              select: {
                id: true,
                companyName: true,
                logo: true,
              },
            },
          },
        },
        toUser: {
          select: {
            id: true,
            email: true,
            userType: true,
            postulante: {
              select: {
                id: true,
                fullName: true,
                profilePicture: true,
              },
            },
            empresa: {
              select: {
                id: true,
                companyName: true,
                logo: true,
              },
            },
          },
        },
      },
    });

    // Marcar como entregados y leídos los mensajes recibidos
    await this.prisma.message.updateMany({
      where: {
        fromUserId: otherUserId,
        toUserId: userId,
        OR: [{ isRead: false }, { isDelivered: false }],
      },
      data: { isDelivered: true, isRead: true },
    });

    messages.reverse();

    return Promise.all(
      messages.map((message) => this.mapMessageToResponse(message))
    );
  }

  private clampLimit(limit: number): number {
    if (!Number.isFinite(limit)) return 50;
    return Math.min(Math.max(Math.floor(limit), 1), 100);
  }

  async markAsRead(
    userId: string,
    messageId: string
  ): Promise<MessageResponseDto> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException("Mensaje no encontrado");
    }

    if (message.toUserId !== userId) {
      throw new ForbiddenException(
        "No tienes permisos para marcar este mensaje como leído"
      );
    }

    const updatedMessage = await this.prisma.message.update({
      where: { id: messageId },
      data: { isDelivered: true, isRead: true },
      include: {
        fromUser: {
          select: {
            id: true,
            email: true,
            userType: true,
            postulante: {
              select: {
                id: true,
                fullName: true,
                profilePicture: true,
              },
            },
            empresa: {
              select: {
                id: true,
                companyName: true,
                logo: true,
              },
            },
          },
        },
        toUser: {
          select: {
            id: true,
            email: true,
            userType: true,
            postulante: {
              select: {
                id: true,
                fullName: true,
                profilePicture: true,
              },
            },
            empresa: {
              select: {
                id: true,
                companyName: true,
                logo: true,
              },
            },
          },
        },
      },
    });

    return await this.mapMessageToResponse(updatedMessage);
  }

  async markAsDelivered(
    messageId: string
  ): Promise<MessageResponseDto> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException("Mensaje no encontrado");
    }

    // Solo marcar como entregado si aún no lo está
    if (message.isDelivered) {
      // Ya está marcado, retornar sin actualizar
      const fullMessage = await this.prisma.message.findUnique({
        where: { id: messageId },
        include: {
          fromUser: {
            select: {
              id: true,
              email: true,
              userType: true,
              postulante: {
                select: { id: true, fullName: true, profilePicture: true },
              },
              empresa: {
                select: { id: true, companyName: true, logo: true },
              },
            },
          },
          toUser: {
            select: {
              id: true,
              email: true,
              userType: true,
              postulante: {
                select: { id: true, fullName: true, profilePicture: true },
              },
              empresa: {
                select: { id: true, companyName: true, logo: true },
              },
            },
          },
        },
      });
      return await this.mapMessageToResponse(fullMessage);
    }

    const updatedMessage = await this.prisma.message.update({
      where: { id: messageId },
      data: { isDelivered: true },
      include: {
        fromUser: {
          select: {
            id: true,
            email: true,
            userType: true,
            postulante: {
              select: { id: true, fullName: true, profilePicture: true },
            },
            empresa: {
              select: { id: true, companyName: true, logo: true },
            },
          },
        },
        toUser: {
          select: {
            id: true,
            email: true,
            userType: true,
            postulante: {
              select: { id: true, fullName: true, profilePicture: true },
            },
            empresa: {
              select: { id: true, companyName: true, logo: true },
            },
          },
        },
      },
    });

    return await this.mapMessageToResponse(updatedMessage);
  }

  /**
   * Marcar todos los mensajes no entregados para un usuario como entregados.
   * Retorna los IDs de los mensajes actualizados y sus remitentes para poder notificarlos.
   */
  async markPendingMessagesAsDelivered(
    userId: string
  ): Promise<{ messageId: string; fromUserId: string }[]> {
    // Obtener mensajes no entregados destinados a este usuario
    const undeliveredMessages = await this.prisma.message.findMany({
      where: {
        toUserId: userId,
        isDelivered: false,
      },
      select: {
        id: true,
        fromUserId: true,
      },
    });

    if (undeliveredMessages.length === 0) return [];

    // Marcar todos como entregados en batch
    await this.prisma.message.updateMany({
      where: {
        toUserId: userId,
        isDelivered: false,
      },
      data: { isDelivered: true },
    });

    return undeliveredMessages.map((msg) => ({
      messageId: msg.id,
      fromUserId: msg.fromUserId,
    }));
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.message.count({
      where: {
        toUserId: userId,
        isRead: false,
      },
    });
  }

  // Obtener información de un usuario para iniciar conversación
  async getUserInfo(userId: string, currentUserId: string): Promise<any> {
    // Validar que no se obtenga información de sí mismo
    if (userId === currentUserId) {
      throw new BadRequestException("No puedes obtener información de ti mismo");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        userType: true,
        postulante: {
          select: {
            id: true,
            fullName: true,
            profilePicture: true,
          },
        },
        empresa: {
          select: {
            id: true,
            companyName: true,
            logo: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException("Usuario no encontrado");
    }

    return await this.mapUserToResponse(user);
  }

  // Métodos de mapeo para transformar los datos de Prisma a DTOs
  private async mapMessageToResponse(message: any): Promise<MessageResponseDto> {
    return {
      id: message.id,
      fromUserId: message.fromUserId,
      toUserId: message.toUserId,
      content: message.content,
      isDelivered: message.isDelivered,
      isRead: message.isRead,
      createdAt: message.createdAt.toISOString(),
      fromUser: message.fromUser
        ? await this.mapUserToResponse(message.fromUser)
        : undefined,
      toUser: message.toUser
        ? await this.mapUserToResponse(message.toUser)
        : undefined,
    };
  }

  private async mapUserToResponse(user: any): Promise<any> {
    // Transformar profilePicture si existe
    let profilePicture = user.postulante?.profilePicture;
    if (profilePicture && !profilePicture.startsWith("http")) {
      try {
        // Usar GCP CDN si está configurado, si no usar URL firmada
        if (this.gcpCdnService.isCdnConfigured()) {
          profilePicture = await this.gcpCdnService.getCdnUrl(
            user.postulante.profilePicture
          );
        } else {
          profilePicture = await this.gcsUploadService.getObjectUrl(
            user.postulante.profilePicture,
            3600
          );
        }
      } catch (error) {
        console.error("Error generando URL para profilePicture:", error);
        // Mantener el key original si falla
      }
    }

    // Transformar logo si existe
    let logo = user.empresa?.logo;
    if (logo && !logo.startsWith("http")) {
      try {
        // Usar GCP CDN si está configurado, si no usar URL firmada
        if (this.gcpCdnService.isCdnConfigured()) {
          logo = await this.gcpCdnService.getCdnUrl(user.empresa.logo);
        } else {
          logo = await this.gcsUploadService.getObjectUrl(user.empresa.logo, 3600);
        }
      } catch (error) {
        console.error("Error generando URL para logo:", error);
        // Mantener el key original si falla
      }
    }

    return {
      id: user.id,
      email: user.email,
      userType: user.userType,
      postulante: user.postulante
        ? {
            id: user.postulante.id,
            fullName: user.postulante.fullName,
            profilePicture: profilePicture,
          }
        : undefined,
      empresa: user.empresa
        ? {
            id: user.empresa.id,
            companyName: user.empresa.companyName,
            logo: logo,
          }
        : undefined,
    };
  }

  // Método adicional para obtener estadísticas de mensajes
  async getMessageStats(userId: string) {
    const [totalMessages, unreadMessages, sentMessages, receivedMessages] =
      await Promise.all([
        this.prisma.message.count({
          where: {
            OR: [{ fromUserId: userId }, { toUserId: userId }],
          },
        }),
        this.prisma.message.count({
          where: {
            toUserId: userId,
            isRead: false,
          },
        }),
        this.prisma.message.count({
          where: {
            fromUserId: userId,
          },
        }),
        this.prisma.message.count({
          where: {
            toUserId: userId,
          },
        }),
      ]);

    return {
      totalMessages,
      unreadMessages,
      sentMessages,
      receivedMessages,
    };
  }

  // Método para buscar mensajes
  async searchMessages(
    userId: string,
    query: string,
    limit: number = 50
  ): Promise<MessageResponseDto[]> {
    const messages = await this.prisma.message.findMany({
      where: {
        OR: [{ fromUserId: userId }, { toUserId: userId }],
        content: {
          contains: query,
          mode: "insensitive",
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        fromUser: {
          select: {
            id: true,
            email: true,
            userType: true,
            postulante: {
              select: {
                id: true,
                fullName: true,
                profilePicture: true,
              },
            },
            empresa: {
              select: {
                id: true,
                companyName: true,
                logo: true,
              },
            },
          },
        },
        toUser: {
          select: {
            id: true,
            email: true,
            userType: true,
            postulante: {
              select: {
                id: true,
                fullName: true,
                profilePicture: true,
              },
            },
            empresa: {
              select: {
                id: true,
                companyName: true,
                logo: true,
              },
            },
          },
        },
      },
    });

    return Promise.all(
      messages.map((message) => this.mapMessageToResponse(message))
    );
  }

  // Método para obtener un mensaje por ID
  async getMessageById(messageId: string) {
    return this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        fromUser: {
          select: {
            id: true,
            email: true,
            userType: true,
            postulante: {
              select: {
                id: true,
                fullName: true,
                profilePicture: true,
              },
            },
            empresa: {
              select: {
                id: true,
                companyName: true,
                logo: true,
              },
            },
          },
        },
        toUser: {
          select: {
            id: true,
            email: true,
            userType: true,
            postulante: {
              select: {
                id: true,
                fullName: true,
                profilePicture: true,
              },
            },
            empresa: {
              select: {
                id: true,
                companyName: true,
                logo: true,
              },
            },
          },
        },
      },
    });
  }

  // Método para eliminar mensajes (soft delete)
  async deleteMessage(userId: string, messageId: string): Promise<void> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException("Mensaje no encontrado");
    }

    if (message.fromUserId !== userId) {
      throw new ForbiddenException(
        "No tienes permisos para eliminar este mensaje"
      );
    }

    await this.prisma.message.delete({
      where: { id: messageId },
    });
  }
}
