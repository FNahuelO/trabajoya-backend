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

      // Cargar secretos de la aplicación desde Secrets Manager
      const appSecretsArn = this.configService.get<string>("APP_SECRETS_ARN");
      if (appSecretsArn) {
        await this.loadAppSecrets(appSecretsArn);
      }

      // Cargar credenciales de la base de datos desde Secrets Manager
      const dbSecretArn = this.configService.get<string>("DATABASE_SECRET_ARN");
      if (dbSecretArn) {
        await this.loadDatabaseSecrets(dbSecretArn);
      }

      // Cargar parámetros desde SSM Parameter Store
      await this.loadSSMParameters();

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
      }
      if (secrets.PAYPAL_CLIENT_SECRET) {
        process.env.PAYPAL_CLIENT_SECRET = secrets.PAYPAL_CLIENT_SECRET;
      }

      this.loadedSecrets = { ...this.loadedSecrets, ...secrets };
      this.logger.log("Secretos de aplicación cargados correctamente");
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

    const parameters = [
      `${stackPrefix}/s3/bucket`,
      `${stackPrefix}/cloudfront/domain`,
      `${stackPrefix}/cloudfront/distribution-id`,
      `${stackPrefix}/cloudfront/keypair-id`,
    ];

    for (const paramName of parameters) {
      try {
        const command = new GetParameterCommand({ Name: paramName });
        const response = await this.ssmClient.send(command);

        if (paramName.includes("s3/bucket")) {
          process.env.S3_BUCKET_NAME = response.Parameter?.Value;
        } else if (paramName.includes("cloudfront/domain")) {
          process.env.CLOUDFRONT_DOMAIN = response.Parameter?.Value;
        } else if (paramName.includes("cloudfront/distribution-id")) {
          process.env.CLOUDFRONT_DISTRIBUTION_ID = response.Parameter?.Value;
        } else if (paramName.includes("cloudfront/keypair-id")) {
          process.env.CLOUDFRONT_KEY_PAIR_ID = response.Parameter?.Value;
        }
      } catch (error: any) {
        // Si el error es porque el parámetro no existe o tiene un nombre inválido, solo loguear warning
        if (
          error.name === "ParameterNotFound" ||
          error.name === "ValidationException"
        ) {
          this.logger.warn(
            `Parámetro SSM no encontrado o inválido: ${paramName}. Error: ${
              error.message || error
            }`
          );
        } else {
          this.logger.warn(
            `No se pudo cargar parámetro SSM ${paramName}: ${
              error.message || error
            }`
          );
        }
        // Continuar con otros parámetros
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
