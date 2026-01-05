import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Verificar si el endpoint es público ANTES de intentar validar el token
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si es público, permitir acceso sin validar token
    if (isPublic) {
      return true;
    }

    // Si no es público, validar el token
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    // Verificar nuevamente si es público (por si acaso)
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si es público, no lanzar error aunque no haya token
    if (isPublic) {
      return user || null;
    }

    // Si no es público y hay error o no hay usuario, lanzar excepción
    if (err || !user) {
      throw err || new UnauthorizedException("Token inválido o expirado");
    }
    return user;
  }
}
