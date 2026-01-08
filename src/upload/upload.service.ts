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

export interface CompleteUploadResult {
  mediaAssetId: string;
  key: string;
  extractedData?: ExtractedCVData; // Datos extraídos del CV si es aplicable
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

    // Si es un CV, extraer texto y parsear con OpenAI
    let extractedData: ExtractedCVData | undefined;
    if (mediaAsset.type === "CV" && this.cvParser) {
      try {
        // Descargar el PDF desde S3
        const pdfBuffer = await this.s3UploadService.getObject(dto.key);
        
        // Extraer texto del PDF
        const text = await this.extractTextFromPdf(pdfBuffer);
        
        // Parsear el CV con OpenAI
        extractedData = await this.cvParser.parseCVText(text);
        
        // Guardar los datos extraídos en el MediaAsset para referencia futura
        await this.prisma.mediaAsset.update({
          where: { id: updated.id },
          data: {
            metadata: extractedData as any, // Guardar como JSON
          },
        });
      } catch (error: any) {
        // Log del error pero no fallar el upload
        console.error("Error al extraer datos del CV:", error);
        // Continuar sin los datos extraídos
      }
    }

    // Actualizar el perfil del usuario con la URL del archivo
    await this.updateUserProfileWithMediaUrl(userId, mediaAsset.type, dto.key);

    return {
      mediaAssetId: updated.id,
      key: updated.key,
      extractedData, // Incluir datos extraídos en la respuesta
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

  /**
   * Extraer texto de un PDF usando pdfjs-dist
   */
  private async extractTextFromPdf(buffer: Buffer): Promise<string> {
    try {
      // Importar pdfjs-dist dinámicamente
      // Usar la versión legacy que funciona mejor en Node.js
      const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
      
      // Cargar el documento PDF desde el buffer
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        useSystemFonts: true,
        verbosity: 0, // Reducir logs
      });
      
      const pdfDocument = await loadingTask.promise;
      const numPages = pdfDocument.numPages;
      
      let fullText = "";
      
      // Extraer texto de cada página
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdfDocument.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Concatenar todos los items de texto de la página
        // Mantener el orden y espaciado básico
        const pageText = textContent.items
          .map((item: any) => item.str || "")
          .join(" ");
        
        fullText += pageText + "\n";
      }
      
      return fullText.trim();
    } catch (error: any) {
      console.error("Error al extraer texto del PDF:", error);
      throw new Error(`No se pudo extraer texto del PDF: ${error.message}`);
    }
  }

  /**
   * Parsear CV manualmente desde una key de S3
   */
  async parseCVFromKey(
    userId: string,
    key: string
  ): Promise<{ extractedData: ExtractedCVData }> {
    // Verificar que el archivo existe y pertenece al usuario
    const mediaAsset = await this.prisma.mediaAsset.findUnique({
      where: { key },
    });

    if (!mediaAsset) {
      throw new NotFoundException("Archivo no encontrado");
    }

    if (mediaAsset.ownerUserId !== userId) {
      throw new BadRequestException("No tienes permisos para este archivo");
    }

    if (mediaAsset.type !== "CV") {
      throw new BadRequestException("El archivo no es un CV");
    }

    // Descargar el PDF desde S3
    const pdfBuffer = await this.s3UploadService.getObject(key);
    
    // Extraer texto del PDF
    const text = await this.extractTextFromPdf(pdfBuffer);
    
    // Parsear el CV con OpenAI
    const extractedData = await this.cvParser.parseCVText(text);
    
    // Guardar los datos extraídos en el MediaAsset
    await this.prisma.mediaAsset.update({
      where: { id: mediaAsset.id },
      data: {
        metadata: extractedData as any,
      },
    });

    return { extractedData };
  }
}