import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

/**
 * Servicio para cargar configuración desde Google Cloud Secret Manager
 * Solo se ejecuta en producción (cuando NODE_ENV=production)
 */
@Injectable()
export class GcpConfigService implements OnModuleInit {
  private readonly logger = new Logger(GcpConfigService.name);
  private secretManagerClient: SecretManagerServiceClient;
  private loadedSecrets: Record<string, any> = {};
  private projectId: string;

  constructor(private configService: ConfigService) {
    this.projectId =
      this.configService.get<string>("GCP_PROJECT_ID") ||
      process.env.GCP_PROJECT_ID ||
      "";

    // Inicializar cliente de Secret Manager
    // En Cloud Run, las credenciales se obtienen automáticamente del entorno
    this.secretManagerClient = new SecretManagerServiceClient({
      projectId: this.projectId,
    });
  }

  async onModuleInit() {
    // Cargar secrets de forma asíncrona sin bloquear el inicio
    // En Cloud Run, es crítico que el servidor inicie rápidamente
    if (process.env.NODE_ENV === "production") {
      // Cargar en background sin await para no bloquear el inicio
      this.loadSecretsFromGCP().catch((error) => {
        this.logger.error("Error cargando secrets de GCP (no crítico):", error);
      });
    } else {
      this.logger.log("Modo desarrollo: usando variables de entorno locales");
    }
  }

  /**
   * Carga secretos desde Google Cloud Secret Manager
   */
  private async loadSecretsFromGCP(): Promise<void> {
    try {
      if (!this.projectId) {
        this.logger.warn(
          "⚠️  GCP_PROJECT_ID no está configurado. No se cargarán secrets de GCP."
        );
        return;
      }

      this.logger.log(`Cargando configuración desde Google Cloud Secret Manager (proyecto: ${this.projectId})...`);

      // Primero intentar cargar TRABAJOYA_SECRETS si está disponible como variable de entorno
      // (viene de Cloud Run cuando se configura como secret)
      if (process.env.TRABAJOYA_SECRETS) {
        try {
          this.logger.log("📦 Cargando configuración desde TRABAJOYA_SECRETS (secret único)...");
          const parsed = JSON.parse(process.env.TRABAJOYA_SECRETS);
          if (typeof parsed === "object") {
            Object.keys(parsed).forEach((key) => {
              process.env[key] = parsed[key];
              this.loadedSecrets[key] = parsed[key];
            });
            // Establecer PRISMA_DATABASE_URL para compatibilidad (Prisma ahora usa DATABASE_URL)
            if (process.env.DATABASE_URL && !process.env.PRISMA_DATABASE_URL) {
              process.env.PRISMA_DATABASE_URL = process.env.DATABASE_URL;
            }
            this.logger.log(`✅ TRABAJOYA_SECRETS cargado con ${Object.keys(parsed).length} propiedades`);
            this.logger.log(
              `✅ Configuración de Google Cloud cargada correctamente (${Object.keys(this.loadedSecrets).length} secretos)`
            );
            return; // Ya cargamos todo desde el secret único, no necesitamos cargar más
          }
        } catch (error) {
          this.logger.warn("⚠️  Error parseando TRABAJOYA_SECRETS, intentando cargar secrets individuales...");
        }
      }

      // Si no hay TRABAJOYA_SECRETS, cargar secrets individuales (compatibilidad hacia atrás)
      const secretsToLoad = [
        "DATABASE_URL",
        "JWT_ACCESS_SECRET",
        "JWT_REFRESH_SECRET",
        "GOOGLE_CLIENT_ID",
        "GOOGLE_CLIENT_SECRET",
        "GOOGLE_IOS_CLIENT_ID",
        "GOOGLE_ANDROID_CLIENT_ID",
        "APPLE_CLIENT_ID",
        "APPLE_BUNDLE_ID",
        "APPLE_TEAM_ID",
        "APPLE_KEY_ID",
        "APPLE_PRIVATE_KEY",
        "APPLE_REDIRECT_URI",
        "OPENAI_API_KEY",
        "PAYPAL_CLIENT_ID",
        "PAYPAL_CLIENT_SECRET",
        "FRONTEND_URL",
        "GCS_BUCKET_NAME",
        "GCP_PROJECT_ID",
        // Secretos adicionales que pueden estar como JSON
        "APP_CONFIG",
        "trabajoya-secrets", // También intentar cargar directamente desde Secret Manager
      ];

      // Cargar secretos individuales
      for (const secretName of secretsToLoad) {
        try {
          const secretValue = await this.accessSecret(secretName);
          if (secretValue) {
            // Intentar parsear como JSON si es posible, si no usar como string
            try {
              const parsed = JSON.parse(secretValue);
              if (typeof parsed === "object") {
                // Si es un objeto, cargar cada propiedad
                Object.keys(parsed).forEach((key) => {
                  process.env[key] = parsed[key];
                  this.loadedSecrets[key] = parsed[key];
                });
                this.logger.log(`✅ Secreto ${secretName} cargado (JSON con ${Object.keys(parsed).length} propiedades)`);
              } else {
                process.env[secretName] = secretValue;
                this.loadedSecrets[secretName] = secretValue;
                this.logger.log(`✅ Secreto ${secretName} cargado`);
              }
            } catch {
              // No es JSON, usar como string
              process.env[secretName] = secretValue;
              this.loadedSecrets[secretName] = secretValue;
              this.logger.log(`✅ Secreto ${secretName} cargado`);
            }
          }
        } catch (error: any) {
          // Si el secreto no existe, solo loguear un warning (no es crítico)
          if (error.code === 5 || error.message?.includes("NOT_FOUND")) {
            this.logger.debug(`⚠️  Secreto ${secretName} no encontrado en Secret Manager`);
          } else {
            this.logger.warn(
              `⚠️  Error cargando secreto ${secretName}: ${error.message || error}`
            );
          }
        }
      }

      // Si hay un secreto trabajoya-secrets o APP_CONFIG con múltiples valores, cargarlo
      if (this.loadedSecrets["trabajoya-secrets"]) {
        try {
          const trabajoyaSecrets = JSON.parse(this.loadedSecrets["trabajoya-secrets"] as string);
          if (typeof trabajoyaSecrets === "object") {
            Object.keys(trabajoyaSecrets).forEach((key) => {
              if (!process.env[key]) {
                process.env[key] = trabajoyaSecrets[key];
                this.loadedSecrets[key] = trabajoyaSecrets[key];
              }
            });
            this.logger.log(
              `✅ trabajoya-secrets cargado con ${Object.keys(trabajoyaSecrets).length} propiedades`
            );
          }
        } catch (error) {
          this.logger.warn("⚠️  Error parseando trabajoya-secrets");
        }
      }

      if (this.loadedSecrets.APP_CONFIG) {
        try {
          const appConfig = JSON.parse(this.loadedSecrets.APP_CONFIG as string);
          Object.keys(appConfig).forEach((key) => {
            if (!process.env[key]) {
              process.env[key] = appConfig[key];
              this.loadedSecrets[key] = appConfig[key];
            }
          });
          this.logger.log(
            `✅ APP_CONFIG cargado con ${Object.keys(appConfig).length} propiedades`
          );
        } catch (error) {
          this.logger.warn("⚠️  Error parseando APP_CONFIG");
        }
      }

      // Establecer PRISMA_DATABASE_URL para compatibilidad (Prisma ahora usa DATABASE_URL)
      if (process.env.DATABASE_URL && !process.env.PRISMA_DATABASE_URL) {
        process.env.PRISMA_DATABASE_URL = process.env.DATABASE_URL;
        this.logger.log("✅ PRISMA_DATABASE_URL configurada desde DATABASE_URL (compatibilidad)");
      }
      
      this.logger.log(
        `✅ Configuración de Google Cloud cargada correctamente (${Object.keys(this.loadedSecrets).length} secretos)`
      );
    } catch (error) {
      this.logger.error("Error cargando configuración de Google Cloud:", error);
      // No lanzar error para permitir que la app inicie con variables de entorno locales
      // en caso de que GCP no esté disponible
    }
  }

  /**
   * Accede a un secreto específico desde Secret Manager
   */
  private async accessSecret(secretName: string): Promise<string | null> {
    try {
      const name = `projects/${this.projectId}/secrets/${secretName}/versions/latest`;
      const [version] = await this.secretManagerClient.accessSecretVersion({
        name,
      });

      const payload = version.payload?.data;
      if (!payload) {
        return null;
      }

      // Decodificar el payload (puede ser string o Buffer)
      if (typeof payload === "string") {
        return payload;
      } else if (Buffer.isBuffer(payload)) {
        return payload.toString("utf-8");
      } else {
        return String(payload);
      }
    } catch (error: any) {
      // Si el secreto no existe, retornar null (no es un error crítico)
      if (error.code === 5 || error.message?.includes("NOT_FOUND")) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Obtiene un secreto cargado (para uso interno)
   */
  getSecret(key: string): any {
    return this.loadedSecrets[key];
  }
}

