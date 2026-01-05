import { Injectable, Inject } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";
import * as fs from "fs";
import {
  CloudFrontClient,
  GetPublicKeyCommand,
} from "@aws-sdk/client-cloudfront";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

export interface SignedCookieOptions {
  expiresIn?: number; // TTL en segundos (default: 900 = 15 minutos)
  path?: string; // Path del recurso (default: "*")
}

@Injectable()
export class CloudFrontSignerService {
  private privateKey: string;
  private keyPairId: string;
  private cloudFrontDomain: string;
  private readonly defaultExpiresIn = 900; // 15 minutos

  constructor(private configService: ConfigService) {
    this.keyPairId = this.configService.get<string>("CLOUDFRONT_KEY_PAIR_ID") || "";
    this.cloudFrontDomain = this.configService.get<string>("CLOUDFRONT_DOMAIN") || "";
  }

  /**
   * Inicializa el servicio cargando la clave privada desde Secrets Manager
   */
  async initialize(): Promise<void> {
    if (!this.privateKey) {
      await this.loadPrivateKey();
    }
  }

  /**
   * Carga la clave privada desde Secrets Manager
   */
  private async loadPrivateKey(): Promise<void> {
    const secretArn =
      this.configService.get<string>("CLOUDFRONT_PRIVATE_KEY_SECRET_ARN") ||
      "";

    if (!secretArn) {
      throw new Error(
        "CLOUDFRONT_PRIVATE_KEY_SECRET_ARN no está configurado"
      );
    }

    try {
      const client = new SecretsManagerClient({
        region: this.configService.get<string>("AWS_REGION") || "us-east-1",
      });

      const command = new GetSecretValueCommand({
        SecretId: secretArn,
      });

      const response = await client.send(command);
      const secretValue = JSON.parse(response.SecretString || "{}");
      this.privateKey = secretValue.privateKey || secretValue.PrivateKey || "";

      if (!this.privateKey) {
        throw new Error("Clave privada no encontrada en el secreto");
      }
    } catch (error) {
      console.error("Error cargando clave privada de CloudFront:", error);
      throw new Error(
        `No se pudo cargar la clave privada de CloudFront: ${error}`
      );
    }
  }

  /**
   * Genera cookies firmadas para CloudFront
   * @param resourcePath Path del recurso en CloudFront (ej: /videos/user123/video.mp4)
   * @param options Opciones adicionales
   * @returns Objeto con las cookies firmadas
   */
  async getSignedCookies(
    resourcePath: string,
    options: SignedCookieOptions = {}
  ): Promise<{
    "CloudFront-Policy": string;
    "CloudFront-Signature": string;
    "CloudFront-Key-Pair-Id": string;
    expiresAt: Date;
  }> {
    await this.initialize();

    const expiresIn = options.expiresIn || this.defaultExpiresIn;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    const expiresTimestamp = Math.floor(expiresAt.getTime() / 1000);

    // Crear política de acceso
    const policy = JSON.stringify({
      Statement: [
        {
          Resource: `${this.cloudFrontDomain}${resourcePath}`,
          Condition: {
            DateLessThan: {
              "AWS:EpochTime": expiresTimestamp,
            },
          },
        },
      ],
    });

    // Firmar la política con la clave privada
    const signature = this.signPolicy(policy);

    return {
      "CloudFront-Policy": this.base64Encode(policy).replace(/[+=\/]/g, (match) => {
        if (match === "+") return "-";
        if (match === "=") return "_";
        if (match === "/") return "~";
        return match;
      }),
      "CloudFront-Signature": signature.replace(/[+=\/]/g, (match) => {
        if (match === "+") return "-";
        if (match === "=") return "_";
        if (match === "/") return "~";
        return match;
      }),
      "CloudFront-Key-Pair-Id": this.keyPairId,
      expiresAt,
    };
  }

  /**
   * Firma una política usando RSA-SHA1
   */
  private signPolicy(policy: string): string {
    const sign = crypto.createSign("RSA-SHA1");
    sign.update(policy);
    const signature = sign.sign(this.privateKey, "base64");
    return signature;
  }

  /**
   * Codifica en base64
   */
  private base64Encode(str: string): string {
    return Buffer.from(str).toString("base64");
  }

  /**
   * Genera la URL completa del recurso en CloudFront
   */
  getCloudFrontUrl(resourcePath: string): string {
    const domain = this.cloudFrontDomain;
    // Asegurar que el path comience con /
    const path = resourcePath.startsWith("/") ? resourcePath : `/${resourcePath}`;
    return `https://${domain}${path}`;
  }
}
