import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CloudFrontSignerService } from "../upload/cloudfront-signer.service";

@Injectable()
export class MediaService {
  constructor(
    private prisma: PrismaService,
    private cloudFrontSigner: CloudFrontSignerService
  ) {}

  /**
   * Obtiene acceso a un archivo de media mediante CloudFront signed cookies
   */
  async getMediaAccess(
    userId: string,
    userType: string,
    userRole: string | undefined,
    mediaAssetId: string
  ): Promise<{
    cloudFrontUrl: string;
    cookies: {
      "CloudFront-Policy": string;
      "CloudFront-Signature": string;
      "CloudFront-Key-Pair-Id": string;
    };
    expiresAt: Date;
  }> {
    // Buscar el MediaAsset
    const mediaAsset = await this.prisma.mediaAsset.findUnique({
      where: { id: mediaAssetId },
      include: {
        user: {
          include: {
            postulante: true,
            empresa: true,
          },
        },
      },
    });

    if (!mediaAsset) {
      throw new NotFoundException("Archivo no encontrado");
    }

    // Verificar permisos (RBAC)
    const hasAccess = this.checkAccess(
      userId,
      userType,
      userRole,
      mediaAsset.ownerUserId,
      mediaAsset.user
    );

    if (!hasAccess) {
      throw new ForbiddenException(
        "No tienes permisos para acceder a este archivo"
      );
    }

    // Generar cookies firmadas
    const resourcePath = `/${mediaAsset.key}`;
    const signedCookies = await this.cloudFrontSigner.getSignedCookies(
      resourcePath,
      {
        expiresIn: 900, // 15 minutos
      }
    );

    // Generar URL de CloudFront
    const cloudFrontUrl = this.cloudFrontSigner.getCloudFrontUrl(resourcePath);

    return {
      cloudFrontUrl,
      cookies: {
        "CloudFront-Policy": signedCookies["CloudFront-Policy"],
        "CloudFront-Signature": signedCookies["CloudFront-Signature"],
        "CloudFront-Key-Pair-Id": signedCookies["CloudFront-Key-Pair-Id"],
      },
      expiresAt: signedCookies.expiresAt,
    };
  }

  /**
   * Verifica si un usuario tiene acceso a un archivo (RBAC)
   */
  private checkAccess(
    requesterUserId: string,
    requesterUserType: string,
    requesterRole: string | undefined,
    ownerUserId: string,
    ownerUser: any
  ): boolean {
    // Admin tiene acceso a todo
    if (requesterRole === "admin" || requesterUserType === "ADMIN") {
      return true;
    }

    // Usuario puede acceder a sus propios archivos
    if (requesterUserId === ownerUserId) {
      return true;
    }

    // Empresa puede acceder a media de candidatos (si hay relación)
    // Por ahora, solo si el archivo es CV o VIDEO de un postulante
    if (requesterUserType === "EMPRESA" && ownerUser.postulante) {
      // Aquí podrías agregar lógica adicional para verificar si la empresa
      // tiene una relación con el postulante (ej: aplicación a un trabajo)
      // Por ahora, permitimos acceso si es CV o VIDEO
      return true; // Simplificado por ahora
    }

    return false;
  }

  /**
   * Obtiene acceso al video de presentación de un usuario
   */
  async getVideoAccess(
    requesterUserId: string,
    requesterUserType: string,
    requesterRole: string | undefined,
    targetUserId: string
  ): Promise<{
    cloudFrontUrl: string;
    cookies: {
      "CloudFront-Policy": string;
      "CloudFront-Signature": string;
      "CloudFront-Key-Pair-Id": string;
    };
    expiresAt: Date;
  }> {
    // Buscar el MediaAsset de tipo VIDEO del usuario objetivo
    const mediaAsset = await this.prisma.mediaAsset.findFirst({
      where: {
        ownerUserId: targetUserId,
        type: "VIDEO",
        status: "COMPLETED",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!mediaAsset) {
      throw new NotFoundException("Video no encontrado");
    }

    return this.getMediaAccess(
      requesterUserId,
      requesterUserType,
      requesterRole,
      mediaAsset.id
    );
  }
}
