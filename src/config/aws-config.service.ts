import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

/**
 * Servicio para cargar configuración desde AWS Secrets Manager y SSM Parameter Store
 * Solo se ejecuta en producción (cuando NODE_ENV=production)
 */
@Injectable()
export class AwsConfigService implements OnModuleInit {
  private readonly logger = new Logger(AwsConfigService.name);
  private secretsManagerClient: SecretsManagerClient;
  private ssmClient: SSMClient;
  private loadedSecrets: Record<string, any> = {};

  constructor(private configService: ConfigService) {
    const region = this.configService.get<string>("AWS_REGION") || "us-east-1";

    this.secretsManagerClient = new SecretsManagerClient({ region });
    this.ssmClient = new SSMClient({ region });
  }

  async onModuleInit() {
    // Solo cargar secrets de AWS en producción
    if (process.env.NODE_ENV === "production") {
      await this.loadSecretsFromAWS();
    } else {
      this.logger.log("Modo desarrollo: usando variables de entorno locales");
    }
  }

  /**
   * Carga secretos desde AWS Secrets Manager y SSM Parameter Store
   */
  private async loadSecretsFromAWS(): Promise<void> {
    try {
      this.logger.log("Cargando configuración desde AWS...");

      // Cargar parámetros desde SSM Parameter Store primero (puede contener APP_CONFIG_SECRET_ID)
      await this.loadSSMParameters();

      // Cargar secretos de la aplicación desde Secrets Manager
      // Intentar con APP_SECRETS_ARN primero, luego con APP_CONFIG_SECRET_ID (que puede venir de SSM o env)
      // Si no se encuentra, usar el nombre del secreto por defecto
      const stackPrefix =
        this.configService.get<string>("STACK_PREFIX") || "trabajoya-prod";
      const defaultSecretName = `/${stackPrefix}/app/config`;

      const appSecretsArn =
        this.configService.get<string>("APP_SECRETS_ARN") ||
        this.configService.get<string>("APP_CONFIG_SECRET_ID") ||
        process.env.APP_CONFIG_SECRET_ID ||
        defaultSecretName; // Fallback al nombre del secreto por defecto

      if (appSecretsArn) {
        this.logger.log(
          `Cargando secretos de aplicación desde: ${appSecretsArn}`
        );
        try {
          await this.loadAppSecrets(appSecretsArn);
        } catch (error: any) {
          this.logger.warn(
            `⚠️  No se pudo cargar el secreto ${appSecretsArn}: ${
              error.message || error
            }. Los secretos de aplicación no se cargarán desde AWS.`
          );
        }
      } else {
        this.logger.warn(
          "⚠️  No se encontró APP_SECRETS_ARN ni APP_CONFIG_SECRET_ID. Los secretos de aplicación no se cargarán desde AWS."
        );
      }

      // Cargar credenciales de la base de datos desde Secrets Manager
      const dbSecretArn = this.configService.get<string>("DATABASE_SECRET_ARN");
      if (dbSecretArn) {
        await this.loadDatabaseSecrets(dbSecretArn);
      }

      this.logger.log("Configuración de AWS cargada correctamente");
    } catch (error) {
      this.logger.error("Error cargando configuración de AWS:", error);
      // No lanzar error para permitir que la app inicie con variables de entorno locales
      // en caso de que AWS no esté disponible
    }
  }

  /**
   * Carga secretos de la aplicación desde Secrets Manager
   */
  private async loadAppSecrets(secretArn: string): Promise<void> {
    try {
      const command = new GetSecretValueCommand({ SecretId: secretArn });
      const response = await this.secretsManagerClient.send(command);
      const secrets = JSON.parse(response.SecretString || "{}");
      // Establecer variables de entorno desde los secretos
      if (secrets.JWT_ACCESS_SECRET) {
        process.env.JWT_ACCESS_SECRET = secrets.JWT_ACCESS_SECRET;
      }
      if (secrets.JWT_REFRESH_SECRET) {
        process.env.JWT_REFRESH_SECRET = secrets.JWT_REFRESH_SECRET;
      }
      if (secrets.JWT_ACCESS_EXPIRES_IN) {
        process.env.JWT_ACCESS_EXPIRES_IN = secrets.JWT_ACCESS_EXPIRES_IN;
      }
      if (secrets.JWT_REFRESH_EXPIRES_IN) {
        process.env.JWT_REFRESH_EXPIRES_IN = secrets.JWT_REFRESH_EXPIRES_IN;
      }
      if (secrets.MAIL_FROM) {
        process.env.MAIL_FROM = secrets.MAIL_FROM;
      }
      if (secrets.GOOGLE_CLIENT_ID) {
        process.env.GOOGLE_CLIENT_ID = secrets.GOOGLE_CLIENT_ID;
      }
      if (secrets.GOOGLE_CLIENT_SECRET) {
        process.env.GOOGLE_CLIENT_SECRET = secrets.GOOGLE_CLIENT_SECRET;
      }
      if (secrets.GOOGLE_IOS_CLIENT_ID) {
        process.env.GOOGLE_IOS_CLIENT_ID = secrets.GOOGLE_IOS_CLIENT_ID;
      }
      if (secrets.GOOGLE_ANDROID_CLIENT_ID) {
        process.env.GOOGLE_ANDROID_CLIENT_ID = secrets.GOOGLE_ANDROID_CLIENT_ID;
      }
      if (secrets.APPLE_CLIENT_ID) {
        process.env.APPLE_CLIENT_ID = secrets.APPLE_CLIENT_ID;
      }
      if (secrets.APPLE_TEAM_ID) {
        process.env.APPLE_TEAM_ID = secrets.APPLE_TEAM_ID;
      }
      if (secrets.APPLE_KEY_ID) {
        process.env.APPLE_KEY_ID = secrets.APPLE_KEY_ID;
      }
      if (secrets.APPLE_PRIVATE_KEY) {
        process.env.APPLE_PRIVATE_KEY = secrets.APPLE_PRIVATE_KEY;
      }
      if (secrets.APPLE_REDIRECT_URI) {
        process.env.APPLE_REDIRECT_URI = secrets.APPLE_REDIRECT_URI;
      }
      if (secrets.OPENAI_API_KEY) {
        process.env.OPENAI_API_KEY = secrets.OPENAI_API_KEY;
      }
      if (secrets.PAYPAL_CLIENT_ID) {
        process.env.PAYPAL_CLIENT_ID = secrets.PAYPAL_CLIENT_ID;
        this.logger.log("✅ PAYPAL_CLIENT_ID cargado desde Secrets Manager");
      } else {
        this.logger.warn(
          "⚠️  PAYPAL_CLIENT_ID no encontrado en Secrets Manager"
        );
      }
      if (secrets.PAYPAL_CLIENT_SECRET) {
        process.env.PAYPAL_CLIENT_SECRET = secrets.PAYPAL_CLIENT_SECRET;
        this.logger.log(
          "✅ PAYPAL_CLIENT_SECRET cargado desde Secrets Manager"
        );
      } else {
        this.logger.warn(
          "⚠️  PAYPAL_CLIENT_SECRET no encontrado en Secrets Manager"
        );
      }
      if (secrets.FRONTEND_URL) {
        process.env.FRONTEND_URL = secrets.FRONTEND_URL;
        this.logger.log("✅ FRONTEND_URL cargado desde Secrets Manager");
      } else {
        this.logger.warn("⚠️  FRONTEND_URL no encontrado en Secrets Manager");
      }

      this.loadedSecrets = { ...this.loadedSecrets, ...secrets };
      this.logger.log("✅ Secretos de aplicación cargados correctamente");
    } catch (error) {
      this.logger.error(`Error cargando secretos de aplicación: ${error}`);
      throw error;
    }
  }

  /**
   * Carga credenciales de la base de datos desde Secrets Manager
   */
  private async loadDatabaseSecrets(secretArn: string): Promise<void> {
    try {
      const command = new GetSecretValueCommand({ SecretId: secretArn });
      const response = await this.secretsManagerClient.send(command);
      const secrets = JSON.parse(response.SecretString || "{}");

      // Construir DATABASE_URL desde los secretos
      const dbEndpoint = this.configService.get<string>("DATABASE_ENDPOINT");
      const dbName =
        this.configService.get<string>("DATABASE_NAME") || "trabajoya";

      if (dbEndpoint && secrets.username && secrets.password) {
        const databaseUrl = `postgresql://${secrets.username}:${secrets.password}@${dbEndpoint}:5432/${dbName}?schema=public`;
        process.env.DATABASE_URL = databaseUrl;
        this.logger.log("DATABASE_URL configurada desde Secrets Manager");
      }
    } catch (error) {
      this.logger.error(
        `Error cargando credenciales de base de datos: ${error}`
      );
      throw error;
    }
  }

  /**
   * Carga parámetros desde SSM Parameter Store
   */
  private async loadSSMParameters(): Promise<void> {
    const stackPrefix =
      this.configService.get<string>("STACK_PREFIX") || "trabajoya-prod";
    const region = this.configService.get<string>("AWS_REGION") || "us-east-1";

    this.logger.log(
      `[SSM] Cargando parámetros con prefijo: ${stackPrefix} en región: ${region}`
    );

    const parameters = [
      { name: `/${stackPrefix}/s3/bucket`, envVar: "S3_BUCKET_NAME" },
      {
        name: `/${stackPrefix}/cloudfront/domain`,
        envVar: "CLOUDFRONT_DOMAIN",
      },
      {
        name: `/${stackPrefix}/cloudfront/distribution-id`,
        envVar: "CLOUDFRONT_DISTRIBUTION_ID",
      },
      {
        name: `/${stackPrefix}/cloudfront/keypair-id`,
        envVar: "CLOUDFRONT_KEY_PAIR_ID",
      },
      // Nota: APP_CONFIG_SECRET_ID se carga directamente desde el nombre del secreto por defecto
      // No necesita estar en SSM Parameter Store
    ];

    for (const param of parameters) {
      // Validar que el nombre del parámetro no tenga prefijos inválidos
      // AWS SSM no permite nombres que empiecen con "ssm" (case-insensitive)
      const normalizedName = param.name.trim();

      if (/^ssm/i.test(normalizedName)) {
        this.logger.warn(
          `[SSM] Nombre inválido (no puede empezar con 'ssm'): ${param.name}. Omitiendo.`
        );
        continue;
      }

      try {
        const command = new GetParameterCommand({ Name: normalizedName });
        const response = await this.ssmClient.send(command);

        if (response.Parameter?.Value) {
          process.env[param.envVar] = response.Parameter.Value;
        } else {
          this.logger.warn(
            `[SSM] ⚠️  Encontrado pero sin valor: ${param.name}`
          );
        }
      } catch (error: any) {
        // Si el error es porque el parámetro no existe o tiene un nombre inválido
        if (
          error.name === "ParameterNotFound" ||
          error.$metadata?.httpStatusCode === 400
        ) {
          this.logger.warn(
            `[SSM] ❌ No encontrado: ${normalizedName} (buscando: ${param.name}). Error: ${error.name}`
          );
        } else if (
          error.name === "ValidationException" ||
          error.message?.includes("can't be prefixed with")
        ) {
          this.logger.warn(
            `[SSM] ⚠️  Nombre inválido: ${param.name}. ${error.message}`
          );
        } else {
          // Otros errores (permisos, red, etc.)
          this.logger.error(
            `[SSM] ❌ Error cargando ${param.name}: ${
              error.name || "Unknown"
            } - ${
              error.message || error
            }. Verifique permisos IAM y región ${region}.`
          );
          // Mostrar más detalles del error
          if (error.$metadata) {
            this.logger.error(
              `[SSM] Detalles: ${JSON.stringify(error.$metadata)}`
            );
          }
        }
        // Continuar con otros parámetros - no es crítico si fallan
      }
    }
  }

  /**
   * Obtiene un secreto cargado (para uso interno)
   */
  getSecret(key: string): any {
    return this.loadedSecrets[key];
  }
}
