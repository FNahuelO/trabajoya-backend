import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Request, Response, NextFunction } from "express";

interface RateLimitInfo {
  count: number;
  resetTime: number;
}

@Injectable()
export class MessageRateLimitMiddleware implements NestMiddleware {
  private rateLimitMap = new Map<string, RateLimitInfo>();
  private readonly MAX_MESSAGES_PER_MINUTE = 10; // Límite de 10 mensajes por minuto
  private readonly WINDOW_SIZE = 60 * 1000; // 1 minuto en milisegundos

  use(req: Request, res: Response, next: NextFunction) {
    const userId = (req as any).user?.sub;

    if (!userId) {
      return next();
    }

    const now = Date.now();
    const userLimit = this.rateLimitMap.get(userId);

    if (!userLimit) {
      // Primera vez que el usuario envía un mensaje
      this.rateLimitMap.set(userId, {
        count: 1,
        resetTime: now + this.WINDOW_SIZE,
      });
      return next();
    }

    if (now > userLimit.resetTime) {
      // La ventana de tiempo ha expirado, resetear contador
      this.rateLimitMap.set(userId, {
        count: 1,
        resetTime: now + this.WINDOW_SIZE,
      });
      return next();
    }

    if (userLimit.count >= this.MAX_MESSAGES_PER_MINUTE) {
      const remainingTime = Math.ceil((userLimit.resetTime - now) / 1000);
      throw new HttpException(
        {
          message: `Has alcanzado el límite de mensajes. Intenta nuevamente en ${remainingTime} segundos`,
          remainingTime,
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    // Incrementar contador
    userLimit.count++;
    this.rateLimitMap.set(userId, userLimit);

    next();
  }

  // Método para limpiar entradas expiradas (opcional, para optimización de memoria)
  cleanup() {
    const now = Date.now();
    for (const [userId, limit] of this.rateLimitMap.entries()) {
      if (now > limit.resetTime) {
        this.rateLimitMap.delete(userId);
      }
    }
  }
}
