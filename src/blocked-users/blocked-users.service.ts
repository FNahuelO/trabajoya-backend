import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { BlockUserDto } from "./dto";

/**
 * Servicio de bloqueo de usuarios
 * Implementa funcionalidad requerida por Google Play para cumplir con políticas de seguridad
 * Permite a los usuarios bloquear a otros usuarios para prevenir comunicación no deseada
 */
@Injectable()
export class BlockedUsersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Bloquear un usuario
   * Un usuario bloqueado no podrá enviar mensajes ni iniciar nuevos chats
   */
  async blockUser(blockerUserId: string, dto: BlockUserDto): Promise<void> {
    const { blockedUserId } = dto;

    // No permitir bloquearse a sí mismo
    if (blockerUserId === blockedUserId) {
      throw new BadRequestException("No puedes bloquearte a ti mismo");
    }

    // Verificar que el usuario a bloquear existe
    const blockedUser = await this.prisma.user.findUnique({
      where: { id: blockedUserId },
    });

    if (!blockedUser) {
      throw new NotFoundException("Usuario no encontrado");
    }

    // Verificar si ya está bloqueado
    const existingBlock = await this.prisma.blockedUser.findUnique({
      where: {
        blockerUserId_blockedUserId: {
          blockerUserId,
          blockedUserId,
        },
      },
    });

    if (existingBlock) {
      throw new ConflictException("Este usuario ya está bloqueado");
    }

    // Crear el bloqueo
    await this.prisma.blockedUser.create({
      data: {
        blockerUserId,
        blockedUserId,
      },
    });
  }

  /**
   * Desbloquear un usuario
   */
  async unblockUser(blockerUserId: string, blockedUserId: string): Promise<void> {
    const block = await this.prisma.blockedUser.findUnique({
      where: {
        blockerUserId_blockedUserId: {
          blockerUserId,
          blockedUserId,
        },
      },
    });

    if (!block) {
      throw new NotFoundException("Usuario no está bloqueado");
    }

    await this.prisma.blockedUser.delete({
      where: {
        blockerUserId_blockedUserId: {
          blockerUserId,
          blockedUserId,
        },
      },
    });
  }

  /**
   * Verificar si un usuario está bloqueado por otro
   * Retorna true si blockerUserId ha bloqueado a blockedUserId
   */
  async isBlocked(blockerUserId: string, blockedUserId: string): Promise<boolean> {
    const block = await this.prisma.blockedUser.findUnique({
      where: {
        blockerUserId_blockedUserId: {
          blockerUserId,
          blockedUserId,
        },
      },
    });

    return !!block;
  }

  /**
   * Verificar si hay bloqueo mutuo entre dos usuarios
   * Retorna true si alguno de los dos usuarios ha bloqueado al otro
   */
  async isBlockedMutually(userId1: string, userId2: string): Promise<boolean> {
    const [block1, block2] = await Promise.all([
      this.isBlocked(userId1, userId2),
      this.isBlocked(userId2, userId1),
    ]);

    return block1 || block2;
  }

  /**
   * Obtener lista de usuarios bloqueados por un usuario
   */
  async getBlockedUsers(userId: string) {
    const blockedUsers = await this.prisma.blockedUser.findMany({
      where: { blockerUserId: userId },
      include: {
        blockedUser: {
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
      orderBy: { createdAt: "desc" },
    });

    return blockedUsers.map((block) => ({
      id: block.id,
      blockedUser: block.blockedUser,
      createdAt: block.createdAt,
    }));
  }
}

