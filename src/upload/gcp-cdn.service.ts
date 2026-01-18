import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GCSUploadService } from "./gcs-upload.service";

export interface SignedUrlOptions {
  expiresIn?: number; // TTL en segundos (default: 3600 = 1 hora)
  contentType?: string;
}

@Injectable()
export class GcpCdnService {
  private cdnDomain: string | null = null;
  private readonly defaultExpiresIn = 3600; // 1 hora

  constructor(
    private configService: ConfigService,
    private gcsUploadService: GCSUploadService
  ) {}

  /**
   * Obtiene el dominio de Cloud CDN de forma lazy (cuando se necesita)
   */
  private getCdnDomain(): string {
    if (this.cdnDomain === null) {
      this.cdnDomain =
        this.configService.get<string>("GCP_CDN_DOMAIN") ||
        this.configService.get<string>("CLOUD_CDN_DOMAIN") ||
        "";

      if (this.cdnDomain) {
        // Normalizar dominio (remover protocolo y barras finales)
        this.cdnDomain = this.cdnDomain
          .replace(/^https?:\/\//, "")
          .replace(/\/+$/, "");
        console.log(
          `[GcpCdnService] ✅ CDN Domain configurado: ${this.cdnDomain}`
        );
      } else {
        console.warn(
          "[GcpCdnService] ⚠️  GCP_CDN_DOMAIN no está configurado. Se usarán URLs firmadas de Cloud Storage directamente."
        );
      }
    }
    return this.cdnDomain;
  }

  /**
   * Verifica si Cloud CDN está configurado
   */
  isCdnConfigured(): boolean {
    const domain = this.getCdnDomain();
    return !!domain && domain.length > 0;
  }

  /**
   * Genera la URL completa del recurso usando Cloud CDN o Cloud Storage
   * @param resourcePath Path del recurso (ej: avatars/user123/avatar.jpg)
   * @param expiresIn Tiempo de expiración en segundos (opcional)
   */
  async getCdnUrl(
    resourcePath: string,
    expiresIn?: number
  ): Promise<string> {
    const domain = this.getCdnDomain();

    // Si CDN está configurado, usar CDN
    if (domain) {
      // Normalizar path (remover barras iniciales)
      const normalizedPath = resourcePath.startsWith("/")
        ? resourcePath.substring(1)
        : resourcePath;

      // Construir URL de CDN
      const cdnUrl = `https://${domain}/${normalizedPath}`;
      return cdnUrl;
    }

    // Si no hay CDN, usar URL firmada de Cloud Storage
    return await this.gcsUploadService.getObjectUrl(
      resourcePath,
      expiresIn || this.defaultExpiresIn
    );
  }

  /**
   * Genera una URL firmada para un recurso
   * Similar a getCdnUrl pero siempre genera URL firmada
   * @param resourcePath Path del recurso
   * @param expiresIn Tiempo de expiración en segundos (default: 1 hora)
   * @param contentType Tipo de contenido (opcional)
   */
  async getSignedUrl(
    resourcePath: string,
    expiresIn: number = this.defaultExpiresIn,
    contentType?: string
  ): Promise<string> {
    // Siempre usar URL firmada de Cloud Storage
    return await this.gcsUploadService.getObjectUrl(resourcePath, expiresIn);
  }

  /**
   * Genera URL pública del recurso (si el bucket es público)
   * @param resourcePath Path del recurso
   */
  getPublicUrl(resourcePath: string): string {
    const domain = this.getCdnDomain();
    const bucketName = this.gcsUploadService.bucketName;

    // Si CDN está configurado, usar CDN
    if (domain) {
      const normalizedPath = resourcePath.startsWith("/")
        ? resourcePath.substring(1)
        : resourcePath;
      return `https://${domain}/${normalizedPath}`;
    }

    // Si no hay CDN, usar URL directa de Cloud Storage
    // Formato: https://storage.googleapis.com/BUCKET_NAME/path
    const normalizedPath = resourcePath.startsWith("/")
      ? resourcePath.substring(1)
      : resourcePath;
    return `https://storage.googleapis.com/${bucketName}/${normalizedPath}`;
  }

  /**
   * Verifica si un recurso existe y retorna su URL
   * @param resourcePath Path del recurso
   * @param useSignedUrl Si true, genera URL firmada; si false, usa URL pública/CDN
   */
  async getResourceUrl(
    resourcePath: string,
    useSignedUrl: boolean = false
  ): Promise<string> {
    if (useSignedUrl) {
      return await this.getSignedUrl(resourcePath);
    }

    // Verificar si el recurso existe
    const headResult = await this.gcsUploadService.headObject(resourcePath);
    if (!headResult.exists) {
      throw new Error(`Resource not found: ${resourcePath}`);
    }

    // Retornar URL pública o CDN
    return this.getPublicUrl(resourcePath);
  }

  /**
   * Genera URL para diferentes tipos de recursos
   * @param type Tipo de recurso: 'avatar', 'logo', 'cv', 'video'
   * @param key Key del recurso en storage
   * @param useSignedUrl Si true, genera URL firmada
   */
  async getResourceUrlByType(
    type: "avatar" | "logo" | "cv" | "video",
    key: string,
    useSignedUrl: boolean = false
  ): Promise<string> {
    return await this.getResourceUrl(key, useSignedUrl);
  }
}

