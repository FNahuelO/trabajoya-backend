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
  public readonly bucketName: string;

  constructor(private configService: ConfigService) {
    const region = this.configService.get<string>("AWS_REGION") || "us-east-1";
    this.bucketName =
      this.configService.get<string>("S3_BUCKET_NAME") || "";

    this.s3Client = new S3Client({
      region,
      // Las credenciales se obtienen automáticamente desde el IAM Role de EC2
      // o desde variables de entorno AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY
    });
  }

  /**
   * Genera una presigned URL para subir un archivo
   */
  async generatePresignedUrl(
    key: string,
    options: PresignedUrlOptions = {}
  ): Promise<PresignedUrlResponse> {
    const expiresIn = options.expiresIn || 3600; // 1 hora por defecto

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: options.contentType,
      ContentLength: options.contentLength,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn,
    });

    return {
      uploadUrl,
      key,
      bucket: this.bucketName,
    };
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
      if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
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
    const typePrefix = type === "cv" ? "cvs" : type === "avatar" ? "avatars" : type === "video" ? "videos" : "logos";
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
