import { Injectable, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { Socket } from "socket.io";

export interface WebSocketAuthResult {
  isValid: boolean;
  userId?: string;
  error?: string;
}

@Injectable()
export class WebSocketAuthService {
  private logger = new Logger("WebSocketAuthService");

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService
  ) {}

  /**
   * Validar token JWT y autenticar conexión WebSocket
   */
  async validateConnection(client: Socket): Promise<WebSocketAuthResult> {
    try {
      // Extraer el token del handshake
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace("Bearer ", "");

      if (!token) {
        this.logger.warn(`No token provided for socket ${client.id}`);
        return {
          isValid: false,
          error: "No token provided",
        };
      }

      // Verificar y decodificar el token usando JwtService
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>("JWT_ACCESS_SECRET"),
      });

      if (!payload || !payload.sub) {
        this.logger.warn(`Invalid token payload for socket ${client.id}`);
        return {
          isValid: false,
          error: "Invalid token payload",
        };
      }

      return {
        isValid: true,
        userId: payload.sub,
      };
    } catch (error) {
      this.logger.error(`Error validating token for socket ${client.id}:`, error.message);
      return {
        isValid: false,
        error: error.message || "Token validation failed",
      };
    }
  }

  /**
   * Extraer userId de un socket ya autenticado
   */
  getUserId(client: any): string | null {
    return client.userId || null;
  }

  /**
   * Establecer userId en el socket
   */
  setUserId(client: any, userId: string): void {
    client.userId = userId;
  }
}

