import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, throwError } from "rxjs";
import { catchError, tap } from "rxjs/operators";

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger("AuditInterceptor");

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpCtx = context.switchToHttp();
    const req = httpCtx.getRequest();
    const res = httpCtx.getResponse();

    if (!req || !res) {
      return next.handle();
    }

    const method = String(req.method || "").toUpperCase();
    const path = String(req.originalUrl || req.url || "");
    const isSensitive = this.isSensitiveRoute(method, path);

    if (!isSensitive) {
      return next.handle();
    }

    const startedAt = Date.now();
    const userId = req.user?.sub || req.user?.id || "anonymous";
    const userType = req.user?.userType || "unknown";
    const ip = this.getClientIp(req);
    const userAgent = String(req.headers?.["user-agent"] || "unknown");
    const params = this.safeJson(req.params || {});
    const query = this.safeJson(req.query || {});

    this.logger.warn(
      `[AUDIT] request.start | method=${method} | path=${path} | userId=${userId} | userType=${userType} | ip=${ip} | userAgent="${userAgent}" | params=${params} | query=${query}`
    );

    return next.handle().pipe(
      tap(() => {
        const durationMs = Date.now() - startedAt;
        const statusCode = Number(res.statusCode || 0);
        this.logger.warn(
          `[AUDIT] request.success | method=${method} | path=${path} | userId=${userId} | status=${statusCode} | durationMs=${durationMs}`
        );
      }),
      catchError((error: any) => {
        const durationMs = Date.now() - startedAt;
        const statusCode = Number(error?.status || res.statusCode || 500);
        const errorMessage = String(error?.message || "unknown_error");
        this.logger.error(
          `[AUDIT] request.error | method=${method} | path=${path} | userId=${userId} | status=${statusCode} | durationMs=${durationMs} | error="${errorMessage}"`
        );
        return throwError(() => error);
      })
    );
  }

  private isSensitiveRoute(method: string, path: string): boolean {
    if (!path) return false;

    const rules: Array<{ method: string; regex: RegExp }> = [
      {
        method: "POST",
        regex: /^\/api\/postulantes\/applications\/[^/]+$/,
      },
      {
        method: "DELETE",
        regex: /^\/api\/postulantes\/applications\/[^/]+$/,
      },
      {
        method: "DELETE",
        regex: /^\/api\/users\/me$/,
      },
      {
        method: "DELETE",
        regex: /^\/api\/empresas\/jobs\/[^/]+$/,
      },
      {
        method: "DELETE",
        regex: /^\/api\/jobs\/[^/]+$/,
      },
      {
        method: "PATCH",
        regex: /^\/api\/empresas\/jobs\/[^/]+\/pause$/,
      },
      {
        method: "PATCH",
        regex: /^\/api\/empresas\/jobs\/[^/]+\/resume$/,
      },
    ];

    return rules.some((rule) => rule.method === method && rule.regex.test(path));
  }

  private getClientIp(req: any): string {
    const xff = req.headers?.["x-forwarded-for"];
    if (typeof xff === "string" && xff.length > 0) {
      return xff.split(",")[0].trim();
    }
    return String(req.ip || req.socket?.remoteAddress || "unknown");
  }

  private safeJson(value: any): string {
    try {
      return JSON.stringify(value);
    } catch {
      return "{}";
    }
  }
}

