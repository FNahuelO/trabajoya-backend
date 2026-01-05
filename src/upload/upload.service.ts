import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { S3UploadService } from "./s3-upload.service";
import { CVParserService } from "./cv-parser.service";
import { ExtractedCVData } from "../cv/types/extracted-cv-data.type";

export type MediaType = "cv" | "avatar" | "video" | "logo";

export interface PresignUploadDto {
  type: MediaType;
  mimeType: string;
  fileSize?: number;
}

export interface CompleteUploadDto {
  key: string;
}

@Injectable()
export class UploadService {
  private readonly maxFileSizeByType: Record<MediaType, number> = {
    cv: 10 * 1024 * 1024, // 10MB
    avatar: 5 * 1024 * 1024, // 5MB
    video: 50 * 1024 * 1024, // 50MB
    logo: 5 * 1024 * 1024, // 5MB
  };

  private readonly allowedMimeTypesByType: Record<MediaType, string[]> = {
    cv: ["application/pdf"],
    avatar: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
    video: ["video/mp4", "video/mpeg", "video/quicktime", "video/x-msvideo"],
    logo: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
  };

  constructor(
    private prisma: PrismaService,
    private s3UploadService: S3UploadService,
    private cvParser: CVParserService
  ) {}

  /**
   * Genera una presigned URL para subir un archivo a S3
   */
  async presignUpload(
    userId: string,
    dto: PresignUploadDto
  ): Promise<{ uploadUrl: string; key: string }> {
    // Validar tipo
    if (!this.isValidMediaType(dto.type)) {
      throw new BadRequestException(`Tipo de archivo inválido: ${dto.type}`);
    }

    // Validar MIME type
    if (!this.allowedMimeTypesByType[dto.type].includes(dto.mimeType)) {
      throw new BadRequestException(
        `Tipo MIME no permitido para ${dto.type}: ${dto.mimeType}`
      );
    }

    // Validar tamaño
    if (dto.fileSize && dto.fileSize > this.maxFileSizeByType[dto.type]) {
      throw new BadRequestException(
        `El archivo excede el tamaño máximo permitido para ${dto.type} (${this.maxFileSizeByType[dto.type] / 1024 / 1024}MB)`
      );
    }

    // Generar key
    const fileExtension = this.getFileExtensionFromMimeType(dto.mimeType);
    const key = this.s3UploadService.generateKey(
      userId,
      dto.type,
      fileExtension
    );

    // Generar presigned URL
    const { uploadUrl } = await this.s3UploadService.generatePresignedUrl(
      key,
      {
        contentType: dto.mimeType,
        contentLength: dto.fileSize,
        expiresIn: 3600, // 1 hora
      }
    );

    // Obtener el nombre del bucket desde el servicio
    const bucketName = this.s3UploadService.bucketName;

    // Crear registro en base de datos con status PENDING
    await this.prisma.mediaAsset.create({
      data: {
        ownerUserId: userId,
        type: dto.type.toUpperCase() as any,
        bucket: bucketName,
        key,
        mimeType: dto.mimeType,
        size: dto.fileSize || 0,
        status: "PENDING",
      },
    });

    return { uploadUrl, key };
  }

  /**
   * Completa el proceso de upload verificando el archivo en S3
   */
  async completeUpload(
    userId: string,
    dto: CompleteUploadDto
  ): Promise<{ mediaAssetId: string; key: string }> {
    // Buscar el MediaAsset
    const mediaAsset = await this.prisma.mediaAsset.findUnique({
      where: { key: dto.key },
    });

    if (!mediaAsset) {
      throw new NotFoundException("Archivo no encontrado");
    }

    // Verificar que el usuario es el dueño
    if (mediaAsset.ownerUserId !== userId) {
      throw new BadRequestException("No tienes permisos para este archivo");
    }

    // Verificar que el archivo existe en S3
    const s3Object = await this.s3UploadService.headObject(dto.key);
    if (!s3Object.exists) {
      throw new NotFoundException("El archivo no existe en S3");
    }

    // Validar tamaño
    const maxSize = this.maxFileSizeByType[mediaAsset.type.toLowerCase() as MediaType];
    if (s3Object.contentLength && s3Object.contentLength > maxSize) {
      // Eliminar de S3
      await this.s3UploadService.deleteObject(dto.key);
      // Actualizar status a FAILED
      await this.prisma.mediaAsset.update({
        where: { id: mediaAsset.id },
        data: { status: "FAILED" },
      });
      throw new BadRequestException(
        `El archivo excede el tamaño máximo permitido (${maxSize / 1024 / 1024}MB)`
      );
    }

    // Actualizar MediaAsset con tamaño real y status COMPLETED
    const updated = await this.prisma.mediaAsset.update({
      where: { id: mediaAsset.id },
      data: {
        size: s3Object.contentLength || mediaAsset.size,
        status: "COMPLETED",
      },
    });

    // Si es un CV y existe el servicio de parsing, extraer datos (opcional)
    if (
      mediaAsset.type === "CV" &&
      this.cvParser
    ) {
      // Esto podría ejecutarse de forma asíncrona en un job
      // Por ahora lo dejamos como está
    }

    // Actualizar el perfil del usuario con la URL del archivo
    await this.updateUserProfileWithMediaUrl(userId, mediaAsset.type, dto.key);

    return {
      mediaAssetId: updated.id,
      key: updated.key,
    };
  }

  /**
   * Actualiza el perfil del usuario con la URL del archivo
   */
  private async updateUserProfileWithMediaUrl(
    userId: string,
    type: string,
    key: string
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { postulante: true, empresa: true },
    });

    if (!user) {
      return;
    }

    // Construir la URL (usando CloudFront, pero el cliente la construirá desde el endpoint de acceso)
    const mediaUrl = key;

    if (type === "CV" && user.postulante) {
      await this.prisma.postulanteProfile.update({
        where: { userId },
        data: { cvUrl: mediaUrl },
      });
    } else if (type === "AVATAR" && user.postulante) {
      await this.prisma.postulanteProfile.update({
        where: { userId },
        data: { profilePicture: mediaUrl },
      });
    } else if (type === "VIDEO" && user.postulante) {
      await this.prisma.postulanteProfile.update({
        where: { userId },
        data: { videoUrl: mediaUrl },
      });
    } else if (type === "LOGO" && user.empresa) {
      await this.prisma.empresaProfile.update({
        where: { userId },
        data: { logo: mediaUrl },
      });
    }
  }

  private isValidMediaType(type: string): type is MediaType {
    return ["cv", "avatar", "video", "logo"].includes(type);
  }

  private getFileExtensionFromMimeType(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      "application/pdf": ".pdf",
      "image/jpeg": ".jpg",
      "image/jpg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "video/mp4": ".mp4",
      "video/mpeg": ".mpeg",
      "video/quicktime": ".mov",
      "video/x-msvideo": ".avi",
    };
    return mimeToExt[mimeType] || "";
  }
}