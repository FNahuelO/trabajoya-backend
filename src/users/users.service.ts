import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { I18nService } from "nestjs-i18n";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class UsersService {
  private readonly uploadDir = path.join(process.cwd(), "uploads");

  constructor(private prisma: PrismaService, private i18n: I18nService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        userType: true,
        isVerified: true,
        language: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(
        await this.i18n.translate("users.userNotFound")
      );
    }

    return user;
  }

  /**
   * Elimina todos los datos de un usuario (cumplimiento con políticas de privacidad)
   * Elimina: perfil, archivos, mensajes, aplicaciones, favoritos, llamadas, etc.
   */
  async deleteUserAccount(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        postulante: true,
        empresa: true,
      },
    });

    if (!user) {
      throw new NotFoundException("Usuario no encontrado");
    }

    // Eliminar archivos físicos
    if (user.postulante) {
      // Eliminar avatar
      if (user.postulante.profilePicture) {
        const avatarPath = path.join(
          this.uploadDir,
          user.postulante.profilePicture.replace("/uploads/", "")
        );
        if (fs.existsSync(avatarPath)) {
          fs.unlinkSync(avatarPath);
        }
      }

      // Eliminar CV
      if (user.postulante.cvUrl) {
        const cvPath = path.join(
          this.uploadDir,
          user.postulante.cvUrl.replace("/uploads/", "")
        );
        if (fs.existsSync(cvPath)) {
          fs.unlinkSync(cvPath);
        }
      }

      // Eliminar video
      if (user.postulante.videoUrl) {
        const videoPath = path.join(
          this.uploadDir,
          user.postulante.videoUrl.replace("/uploads/", "")
        );
        if (fs.existsSync(videoPath)) {
          fs.unlinkSync(videoPath);
        }
      }
    }

    if (user.empresa) {
      // Eliminar logo
      if (user.empresa.logo) {
        const logoPath = path.join(
          this.uploadDir,
          user.empresa.logo.replace("/uploads/", "")
        );
        if (fs.existsSync(logoPath)) {
          fs.unlinkSync(logoPath);
        }
      }
    }

    // Eliminar datos de la base de datos usando transacción
    await this.prisma.$transaction(async (tx) => {
      // Eliminar aplicaciones
      await tx.application.deleteMany({
        where: { postulanteId: user.postulante?.id },
      });

      // Eliminar favoritos de trabajos
      await tx.jobFavorite.deleteMany({
        where: { postulanteId: user.postulante?.id },
      });

      // Eliminar favoritos de empresas
      await tx.companyFavorite.deleteMany({
        where: { postulanteId: user.postulante?.id },
      });

      // Eliminar educación
      await tx.education.deleteMany({
        where: { postulanteId: user.postulante?.id },
      });

      // Eliminar experiencias
      await tx.experience.deleteMany({
        where: { postulanteId: user.postulante?.id },
      });

      // Eliminar certificaciones
      await tx.certification.deleteMany({
        where: { postulanteId: user.postulante?.id },
      });

      // Anonimizar mensajes (mantener para integridad de conversaciones)
      await tx.message.updateMany({
        where: { fromUserId: userId },
        data: {
          content: "[Mensaje eliminado]",
          fromUserId: userId, // Mantener referencia pero el usuario será eliminado
        },
      });

      await tx.message.updateMany({
        where: { toUserId: userId },
        data: {
          content: "[Mensaje eliminado]",
        },
      });

      // Eliminar llamadas
      await tx.call.deleteMany({
        where: {
          OR: [{ fromUserId: userId }, { toUserId: userId }],
        },
      });

      // Eliminar reuniones de video
      await (tx as any).videoMeeting.deleteMany({
        where: {
          OR: [{ createdById: userId }, { invitedUserId: userId }],
        },
      });

      // Eliminar trabajos publicados (si es empresa)
      if (user.empresa) {
        await tx.job.deleteMany({
          where: { empresaId: user.empresa.id },
        });
      }

      // Eliminar tokens de refresh
      await tx.refreshToken.deleteMany({
        where: { userId },
      });

      // Eliminar aceptaciones de términos
      await (tx as any).userTermsAcceptance.deleteMany({
        where: { userId },
      });

      // Eliminar perfil de postulante
      if (user.postulante) {
        await tx.postulanteProfile.delete({
          where: { userId },
        });
      }

      // Eliminar perfil de empresa
      if (user.empresa) {
        await tx.empresaProfile.delete({
          where: { userId },
        });
      }

      // Finalmente, eliminar el usuario
      await tx.user.delete({
        where: { id: userId },
      });
    });
  }
}
