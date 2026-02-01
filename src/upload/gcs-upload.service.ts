import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Storage } from "@google-cloud/storage";

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
export class GCSUploadService {
  private storage: Storage;
  private _bucketName: string | null = null;

  constructor(private configService: ConfigService) {
    // Inicializar cliente de Cloud Storage
    // En Cloud Run, las credenciales se obtienen automáticamente del entorno
    this.storage = new Storage({
      projectId: this.configService.get<string>("GCP_PROJECT_ID"),
      // Las credenciales se pueden pasar via GOOGLE_APPLICATION_CREDENTIALS o usar default credentials
      keyFilename: this.configService.get<string>("GOOGLE_APPLICATION_CREDENTIALS"),
    });

    const bucketName = this.configService.get<string>("GCS_BUCKET_NAME");
    if (bucketName) {
      this._bucketName = bucketName;
      console.log(`[GCSUploadService] ✅ Bucket configurado: ${this._bucketName}`);
    } else {
      console.warn(
        "[GCSUploadService] ⚠️  GCS_BUCKET_NAME no está configurado. Las operaciones de GCS fallarán."
      );
    }
  }

  get bucketName(): string {
    if (this._bucketName === null) {
      this._bucketName = this.configService.get<string>("GCS_BUCKET_NAME") || "";
      if (!this._bucketName) {
        console.warn(
          "[GCSUploadService] ⚠️  GCS_BUCKET_NAME no está configurado. Las operaciones de GCS fallarán."
        );
      }
    }
    return this._bucketName;
  }

  /**
   * Genera una presigned URL para subir un archivo a Cloud Storage
   */
  async generatePresignedUrl(
    key: string,
    options: PresignedUrlOptions = {}
  ): Promise<PresignedUrlResponse> {
    if (!this.bucketName) {
      throw new Error(
        "GCS_BUCKET_NAME no está configurado. Configure la variable de entorno."
      );
    }

    const expiresIn = options.expiresIn || 3600; // 1 hora por defecto
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(key);

    const [url] = await file.getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + expiresIn * 1000,
      contentType: options.contentType,
    });

    return {
      uploadUrl: url,
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
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(key);
      const [metadata] = await file.getMetadata();

      return {
        exists: true,
        contentType: metadata.contentType,
        contentLength: typeof metadata.size === 'string' 
          ? parseInt(metadata.size, 10) 
          : (metadata.size || 0),
        lastModified: metadata.updated ? new Date(metadata.updated) : undefined,
      };
    } catch (error: any) {
      if (error.code === 404) {
        return { exists: false };
      }
      throw error;
    }
  }

  /**
   * Elimina un objeto de Cloud Storage
   */
  async deleteObject(key: string): Promise<void> {
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(key);
    await file.delete();
  }

  /**
   * Sube un archivo directamente a Cloud Storage desde un buffer
   */
  async uploadBuffer(
    key: string,
    buffer: Buffer,
    contentType: string
  ): Promise<void> {
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(key);
    await file.save(buffer, {
      contentType,
      metadata: {
        cacheControl: "public, max-age=31536000",
      },
    });
  }

  /**
   * Obtiene un objeto de Cloud Storage como Buffer
   */
  async getObject(key: string): Promise<Buffer> {
    if (!this.bucketName) {
      throw new Error(
        "GCS_BUCKET_NAME no está configurado. Configure la variable de entorno."
      );
    }

    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(key);
    const [buffer] = await file.download();
    return buffer as Buffer;
  }

  /**
   * Genera una URL directa de Cloud Storage para leer un objeto
   * Si el bucket es público, retorna la URL directa
   * Si no, genera una presigned URL de lectura
   */
  async getObjectUrl(key: string, expiresIn: number = 3600): Promise<string> {
    if (!this.bucketName) {
      throw new Error(
        "GCS_BUCKET_NAME no está configurado. Configure la variable de entorno."
      );
    }

    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(key);

      // Verificar que el archivo existe antes de generar la URL firmada
      try {
        const [exists] = await file.exists();
        if (!exists) {
          throw new Error(`Archivo no encontrado: ${key}`);
        }
      } catch (error: any) {
        console.error(`[GCSUploadService] Error verificando existencia del archivo ${key}:`, error.message);
        throw new Error(`No se pudo verificar el archivo: ${error.message}`);
      }

      // Generar presigned URL de lectura
      // Asegurar que expiresIn no sea menor a 1 minuto ni mayor a 7 días (límite de GCS)
      const validExpiresIn = Math.max(60, Math.min(expiresIn, 604800)); // Entre 1 min y 7 días
      const expirationTime = Date.now() + validExpiresIn * 1000;

      const [url] = await file.getSignedUrl({
        version: "v4",
        action: "read",
        expires: expirationTime,
      });

      if (!url) {
        throw new Error("No se pudo generar la URL firmada");
      }

      return url;
    } catch (error: any) {
      console.error(`[GCSUploadService] Error generando URL firmada para ${key}:`, {
        message: error.message,
        code: error.code,
        key,
        bucketName: this.bucketName,
      });
      
      // Si hay un error de permisos, lanzar un error más descriptivo
      if (error.code === 403 || error.message?.includes('403') || error.message?.includes('Forbidden')) {
        throw new Error(
          `Permisos insuficientes: La cuenta de servicio no tiene permisos para acceder al bucket ${this.bucketName}. ` +
          `Verifica que la cuenta de servicio tenga el rol "Storage Object Viewer" en el bucket. ` +
          `Error: ${error.message}`
        );
      }
      
      throw error;
    }
  }

  /**
   * Genera una key consistente para un archivo
   */
  generateKey(
    userId: string,
    type: "cv" | "avatar" | "video" | "logo",
    fileExtension: string,
    customUuid?: string,
    originalFileName?: string
  ): string {
    const typePrefix =
      type === "cv"
        ? "cvs"
        : type === "avatar"
        ? "avatars"
        : type === "video"
        ? "videos"
        : "logos";
    
    // Si hay un nombre de archivo original, usarlo (sanitizado)
    // Si no, usar UUID como antes
    let fileName: string;
    if (originalFileName) {
      // Sanitizar el nombre del archivo: eliminar caracteres especiales y espacios
      // Mantener solo letras, números, guiones y puntos
      fileName = this.sanitizeFileName(originalFileName, fileExtension);
    } else {
      const uuid = customUuid || this.generateUUID();
      fileName = `${uuid}${fileExtension}`;
    }
    
    return `${typePrefix}/${userId}/${fileName}`;
  }

  /**
   * Sanitiza el nombre del archivo para que sea seguro para usar en URLs y storage
   */
  private sanitizeFileName(fileName: string, fileExtension: string): string {
    // Obtener el nombre sin la extensión
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
    
    // Reemplazar espacios con guiones y eliminar caracteres especiales
    // Mantener solo letras, números, guiones, guiones bajos y puntos
    let sanitized = nameWithoutExt
      .normalize("NFD") // Normalizar caracteres unicode
      .replace(/[\u0300-\u036f]/g, "") // Eliminar diacríticos
      .replace(/[^a-zA-Z0-9._-]/g, "-") // Reemplazar caracteres especiales con guiones
      .replace(/-+/g, "-") // Reemplazar múltiples guiones con uno solo
      .replace(/^-|-$/g, ""); // Eliminar guiones al inicio y final
    
    // Si después de sanitizar está vacío, usar un UUID
    if (!sanitized || sanitized.length === 0) {
      sanitized = this.generateUUID();
    }
    
    // Limitar la longitud del nombre (máximo 200 caracteres)
    if (sanitized.length > 200) {
      sanitized = sanitized.substring(0, 200);
    }
    
    // Asegurar que la extensión sea la correcta
    return `${sanitized}${fileExtension}`;
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

  /**
   * Prueba los permisos de Cloud Storage para diagnosticar problemas
   */
  async testGCSPermissions(): Promise<{
    canList: boolean;
    canPut: boolean;
    canGet: boolean;
    error?: string;
  }> {
    const results: {
      canList: boolean;
      canPut: boolean;
      canGet: boolean;
      error?: string;
    } = {
      canList: false,
      canPut: false,
      canGet: false,
    };

    try {
      const bucket = this.storage.bucket(this.bucketName);

      // Probar ListBucket
      try {
        await bucket.getMetadata();
        results.canList = true;
      } catch (e) {
        results.canList = false;
      }

      // Probar PutObject con un objeto de prueba
      const testKey = `test-${Date.now()}.txt`;
      try {
        const file = bucket.file(testKey);
        await file.save("test", {
          contentType: "text/plain",
        });
        results.canPut = true;

        // Limpiar
        try {
          await file.delete();
        } catch (e) {
          // Ignorar error de limpieza
        }
      } catch (error: any) {
        results.canPut = false;
        results.error = error.message || String(error);
      }

      return results;
    } catch (error: any) {
      return {
        ...results,
        error: error.message || String(error),
      };
    }
  }
}

