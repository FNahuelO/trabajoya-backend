import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  SendMessageDto,
  MessageResponseDto,
  ConversationResponseDto,
} from "./dto";
import { CloudFrontSignerService } from "../upload/cloudfront-signer.service";
import { S3UploadService } from "../upload/s3-upload.service";
// import { I18nService } from "nestjs-i18n"; // Temporalmente deshabilitado

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private cloudFrontSigner: CloudFrontSignerService,
    private s3UploadService: S3UploadService
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
    // Obtener todas las conversaciones únicas
    const sentMessages = await this.prisma.message.findMany({
      where: { fromUserId: userId },
      distinct: ["toUserId"],
      orderBy: { createdAt: "desc" },
      include: {
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

    const receivedMessages = await this.prisma.message.findMany({
      where: { toUserId: userId },
      distinct: ["fromUserId"],
      orderBy: { createdAt: "desc" },
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
      },
    });

    // Combinar y obtener el último mensaje de cada conversación
    const userIds = new Set<string>();
    sentMessages.forEach((msg) => userIds.add(msg.toUserId));
    receivedMessages.forEach((msg) => userIds.add(msg.fromUserId));

    const conversations = await Promise.all(
      Array.from(userIds).map(async (otherUserId) => {
        const lastMessage = await this.prisma.message.findFirst({
          where: {
            OR: [
              { fromUserId: userId, toUserId: otherUserId },
              { fromUserId: otherUserId, toUserId: userId },
            ],
          },
          orderBy: { createdAt: "desc" },
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

        const unreadCount = await this.prisma.message.count({
          where: {
            fromUserId: otherUserId,
            toUserId: userId,
            isRead: false,
          },
        });

        const otherUser = await this.prisma.user.findUnique({
          where: { id: otherUserId },
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

        return {
          user: await this.mapUserToResponse(otherUser),
          lastMessage: await this.mapMessageToResponse(lastMessage),
          unreadCount,
        };
      })
    );

    return conversations.sort(
      (a, b) =>
        new Date(b.lastMessage.createdAt).getTime() -
        new Date(a.lastMessage.createdAt).getTime()
    );
  }

  async getConversationWith(
    userId: string,
    otherUserId: string
  ): Promise<MessageResponseDto[]> {
    const messages = await this.prisma.message.findMany({
      where: {
        OR: [
          { fromUserId: userId, toUserId: otherUserId },
          { fromUserId: otherUserId, toUserId: userId },
        ],
      },
      orderBy: { createdAt: "asc" },
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

    // Marcar como leídos los mensajes recibidos
    await this.prisma.message.updateMany({
      where: {
        fromUserId: otherUserId,
        toUserId: userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    return Promise.all(
      messages.map((message) => this.mapMessageToResponse(message))
    );
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
      data: { isRead: true },
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
        if (this.cloudFrontSigner.isCloudFrontConfigured()) {
          const picturePath = profilePicture.startsWith("/")
            ? profilePicture
            : `/${profilePicture}`;
          const cloudFrontUrl = this.cloudFrontSigner.getCloudFrontUrl(picturePath);
          if (
            cloudFrontUrl &&
            cloudFrontUrl.startsWith("https://") &&
            !cloudFrontUrl.includes("https:///")
          ) {
            profilePicture = cloudFrontUrl;
          } else {
            profilePicture = await this.s3UploadService.getObjectUrl(
              user.postulante.profilePicture,
              3600
            );
          }
        } else {
          profilePicture = await this.s3UploadService.getObjectUrl(
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
        if (this.cloudFrontSigner.isCloudFrontConfigured()) {
          const logoPath = logo.startsWith("/") ? logo : `/${logo}`;
          const cloudFrontUrl = this.cloudFrontSigner.getCloudFrontUrl(logoPath);
          if (
            cloudFrontUrl &&
            cloudFrontUrl.startsWith("https://") &&
            !cloudFrontUrl.includes("https:///")
          ) {
            logo = cloudFrontUrl;
          } else {
            logo = await this.s3UploadService.getObjectUrl(user.empresa.logo, 3600);
          }
        } else {
          logo = await this.s3UploadService.getObjectUrl(user.empresa.logo, 3600);
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
