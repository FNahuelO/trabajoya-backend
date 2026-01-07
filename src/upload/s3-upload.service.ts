import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface PresignedUrlOptions {
  expiresIn?: number; // TTL en segundos (default: 3600 = 1 hora)
  contentType?: string;
  contentLength?: number;
}

export interface PresignedUrlResponse {
  uploadUrl: string;
  key: string;
  bucket: string;
}

@Injectable()
export class S3UploadService {
  private s3Client: S3Client;
  private _bucketName: string | null = null;

  constructor(private configService: ConfigService) {
    const region = this.configService.get<string>("AWS_REGION") || "us-east-1";

    this.s3Client = new S3Client({
      region,
      // Las credenciales se obtienen automáticamente desde el IAM Role de EC2
      // o desde variables de entorno AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY
    });
  }

  /**
   * Obtiene el nombre del bucket de forma lazy (cuando se necesita)
   * Esto permite que AwsConfigService cargue los parámetros SSM primero
   */
  get bucketName(): string {
    if (this._bucketName === null) {
      this._bucketName = this.configService.get<string>("S3_BUCKET_NAME") || "";
      
      if (!this._bucketName) {
        console.warn(
          "[S3UploadService] ⚠️  S3_BUCKET_NAME no está configurado. Las operaciones de S3 fallarán."
        );
      } else {
        const region = typeof this.s3Client.config.region === 'function' 
          ? 'us-east-1' 
          : this.s3Client.config.region || 'us-east-1';
        console.log(
          `[S3UploadService] ✅ Bucket configurado: ${this._bucketName} (region: ${region})`
        );
      }
    }
    return this._bucketName;
  }

  /**
   * Genera una presigned URL para subir un archivo
   * NOTA: Si se especifica ContentLength, debe coincidir exactamente con el tamaño del archivo subido
   */
  async generatePresignedUrl(
    key: string,
    options: PresignedUrlOptions = {}
  ): Promise<PresignedUrlResponse> {
    if (!this.bucketName) {
      throw new Error(
        "S3_BUCKET_NAME no está configurado. Configure la variable de entorno o el parámetro SSM."
      );
    }

    const expiresIn = options.expiresIn || 3600; // 1 hora por defecto

    // Construir el comando con solo los parámetros necesarios
    // No incluir ContentLength si no se especifica, para evitar problemas de validación
    const commandParams: any = {
      Bucket: this.bucketName,
      Key: key,
    };

    if (options.contentType) {
      commandParams.ContentType = options.contentType;
    }

    // NOTA: No incluir ContentLength en la presigned URL
    // Si se especifica ContentLength, el tamaño del archivo subido DEBE coincidir exactamente
    // Esto causa problemas cuando el frontend calcula el tamaño de forma diferente
    // Es mejor dejar que S3 valide el tamaño después de la subida
    // if (options.contentLength !== undefined && options.contentLength !== null) {
    //   commandParams.ContentLength = options.contentLength;
    // }

    try {
      const command = new PutObjectCommand(commandParams);

      const uploadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });

      // Log detallado para debugging
      const urlParams = new URL(uploadUrl).searchParams;
      const allParams = Array.from(urlParams.keys());
      console.log(
        `[S3UploadService] Presigned URL generada para: ${key}`,
        {
          bucket: this.bucketName,
          contentType: options.contentType || "no especificado",
          expiresIn: `${expiresIn}s`,
          urlHasContentType: urlParams.has('ContentType') || urlParams.has('content-type'),
          contentTypeInUrl: urlParams.get('ContentType') || urlParams.get('content-type'),
          allUrlParams: allParams,
          commandParams: Object.keys(commandParams),
        }
      );
      
      // Advertencia si ContentType está en el comando pero no en la URL
      if (options.contentType && !urlParams.has('ContentType') && !urlParams.has('content-type')) {
        console.warn(
          `[S3UploadService] ⚠️  ContentType "${options.contentType}" está en el comando pero NO aparece en la URL. ` +
          `El frontend NO debe enviar el header Content-Type o causará 403 Access Denied.`
        );
      }

      return {
        uploadUrl,
        key,
        bucket: this.bucketName,
      };
    } catch (error: any) {
      console.error("[S3UploadService] Error generando presigned URL:", {
        error: error.message,
        bucket: this.bucketName,
        key,
        contentType: options.contentType,
        region: this.s3Client.config.region,
      });
      throw error;
    }
  }

  /**
   * Verifica si un objeto existe y obtiene sus metadatos
   */
  async headObject(key: string): Promise<{
    exists: boolean;
    contentType?: string;
    contentLength?: number;
    lastModified?: Date;
  }> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      return {
        exists: true,
        contentType: response.ContentType,
        contentLength: response.ContentLength,
        lastModified: response.LastModified,
      };
    } catch (error: any) {
      if (
        error.name === "NotFound" ||
        error.$metadata?.httpStatusCode === 404
      ) {
        return { exists: false };
      }
      throw error;
    }
  }

  /**
   * Elimina un objeto de S3
   */
  async deleteObject(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    await this.s3Client.send(command);
  }

  /**
   * Sube un archivo directamente a S3 desde un buffer
   */
  async uploadBuffer(
    key: string,
    buffer: Buffer,
    contentType: string
  ): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await this.s3Client.send(command);
  }

  /**
   * Genera una key consistente para un archivo
   */
  generateKey(
    userId: string,
    type: "cv" | "avatar" | "video" | "logo",
    fileExtension: string,
    customUuid?: string
  ): string {
    const uuid = customUuid || this.generateUUID();
    const typePrefix =
      type === "cv"
        ? "cvs"
        : type === "avatar"
        ? "avatars"
        : type === "video"
        ? "videos"
        : "logos";
    return `${typePrefix}/${userId}/${uuid}${fileExtension}`;
  }

  /**
   * Genera un UUID v4
   */
  private generateUUID(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
