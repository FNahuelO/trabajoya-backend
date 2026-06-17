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
  private readyResolve!: () => void;
  private readonly readyPromise = new Promise<void>((resolve) => {
    this.readyResolve = resolve;
  });

  private readyResolved = false;

  constructor(private configService: ConfigService) {
    this.projectId =
      this.configService.get<string>("GCP_PROJECT_ID") ||
      process.env.GCP_PROJECT_ID ||
      "";

    this.secretManagerClient = new SecretManagerServiceClient({
      projectId: this.projectId,
    });

    // Cloud Run monta DATABASE_URL antes del bootstrap: liberar de inmediato
    if (process.env.DATABASE_URL?.trim()) {
      this.markDatabaseUrlReady();
      this.resolveReady();
    }
  }

  private resolveReady() {
    if (this.readyResolved) {
      return;
    }
    this.readyResolved = true;
    this.readyResolve();
  }

  /** Esperar a que los secretos críticos estén disponibles */
  whenReady(): Promise<void> {
    return this.readyPromise;
  }

  async onModuleInit() {
    if (process.env.NODE_ENV !== "production") {
      this.logger.log("Modo desarrollo: usando variables de entorno locales");
      this.resolveReady();
      return;
    }

    // Ya resuelto en constructor si Cloud Run montó DATABASE_URL
    if (this.readyResolved) {
      this.loadRemainingSecrets().catch((error) => {
        this.logger.error(
          "Error cargando secretos adicionales (no crítico):",
          error
        );
      });
      return;
    }

    // Sin DATABASE_URL montada: cargar secretos sin bloquear más de lo necesario
    void this.loadSecretsFromGCP();
  }

  private markDatabaseUrlReady() {
    if (process.env.DATABASE_URL && !process.env.PRISMA_DATABASE_URL) {
      process.env.PRISMA_DATABASE_URL = process.env.DATABASE_URL;
    }
  }

  private async loadSecretsFromGCP(): Promise<void> {
    try {
      if (!this.projectId) {
        this.logger.warn(
          "⚠️  GCP_PROJECT_ID no está configurado. No se cargarán secrets de GCP."
        );
        this.markDatabaseUrlReady();
        this.resolveReady();
        return;
      }

      // Si Cloud Run ya montó DATABASE_URL, no bloquear el arranque
      if (process.env.DATABASE_URL?.trim()) {
        this.markDatabaseUrlReady();
        this.logger.log(
          "✅ DATABASE_URL ya disponible (montada en Cloud Run)"
        );
        this.resolveReady();

        // Cargar el resto de secretos en background
        this.loadRemainingSecrets().catch((error) => {
          this.logger.error(
            "Error cargando secretos adicionales (no crítico):",
            error
          );
        });
        return;
      }

      this.logger.log(
        `Cargando configuración desde Google Cloud Secret Manager (proyecto: ${this.projectId})...`
      );

      if (process.env.TRABAJOYA_SECRETS) {
        try {
          const parsed = JSON.parse(process.env.TRABAJOYA_SECRETS);
          if (typeof parsed === "object") {
            Object.keys(parsed).forEach((key) => {
              process.env[key] = parsed[key];
              this.loadedSecrets[key] = parsed[key];
            });
            this.markDatabaseUrlReady();
            this.logger.log(
              `✅ TRABAJOYA_SECRETS cargado con ${Object.keys(parsed).length} propiedades`
            );
            this.resolveReady();
            return;
          }
        } catch {
          this.logger.warn(
            "⚠️  Error parseando TRABAJOYA_SECRETS, intentando cargar secrets individuales..."
          );
        }
      }

      // Prioridad: DATABASE_URL primero para que Prisma pueda conectar
      const databaseUrl = await this.accessSecret("DATABASE_URL");
      if (databaseUrl) {
        process.env.DATABASE_URL = databaseUrl;
        this.loadedSecrets.DATABASE_URL = databaseUrl;
        this.logger.log("✅ Secreto DATABASE_URL cargado");
      }

      this.markDatabaseUrlReady();
      this.resolveReady();

      await this.loadRemainingSecrets();
    } catch (error) {
      this.logger.error("Error cargando configuración de Google Cloud:", error);
      this.markDatabaseUrlReady();
      this.resolveReady();
    }
  }

  private async loadRemainingSecrets(): Promise<void> {
    const secretsToLoad = [
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
      "APP_CONFIG",
      "trabajoya-secrets",
    ];

    for (const secretName of secretsToLoad) {
      if (process.env[secretName]) {
        continue;
      }

      try {
        const secretValue = await this.accessSecret(secretName);
        if (!secretValue) {
          continue;
        }

        try {
          const parsed = JSON.parse(secretValue);
          if (typeof parsed === "object") {
            Object.keys(parsed).forEach((key) => {
              if (!process.env[key]) {
                process.env[key] = parsed[key];
                this.loadedSecrets[key] = parsed[key];
              }
            });
            this.logger.log(
              `✅ Secreto ${secretName} cargado (JSON con ${Object.keys(parsed).length} propiedades)`
            );
          } else {
            process.env[secretName] = secretValue;
            this.loadedSecrets[secretName] = secretValue;
            this.logger.log(`✅ Secreto ${secretName} cargado`);
          }
        } catch {
          process.env[secretName] = secretValue;
          this.loadedSecrets[secretName] = secretValue;
          this.logger.log(`✅ Secreto ${secretName} cargado`);
        }
      } catch (error: any) {
        if (error.code !== 5 && !error.message?.includes("NOT_FOUND")) {
          this.logger.warn(
            `⚠️  Error cargando secreto ${secretName}: ${error.message || error}`
          );
        }
      }
    }

    if (this.loadedSecrets["trabajoya-secrets"]) {
      try {
        const trabajoyaSecrets = JSON.parse(
          this.loadedSecrets["trabajoya-secrets"] as string
        );
        if (typeof trabajoyaSecrets === "object") {
          Object.keys(trabajoyaSecrets).forEach((key) => {
            if (!process.env[key]) {
              process.env[key] = trabajoyaSecrets[key];
              this.loadedSecrets[key] = trabajoyaSecrets[key];
            }
          });
        }
      } catch {
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
      } catch {
        this.logger.warn("⚠️  Error parseando APP_CONFIG");
      }
    }

    this.markDatabaseUrlReady();
    this.logger.log(
      `✅ Configuración de Google Cloud cargada (${Object.keys(this.loadedSecrets).length} secretos desde API)`
    );
  }

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

      if (typeof payload === "string") {
        return payload;
      }
      if (Buffer.isBuffer(payload)) {
        return payload.toString("utf-8");
      }
      return String(payload);
    } catch (error: any) {
      if (error.code === 5 || error.message?.includes("NOT_FOUND")) {
        return null;
      }
      throw error;
    }
  }

  getSecret(key: string): any {
    return this.loadedSecrets[key];
  }
}
