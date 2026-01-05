import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || user.userType !== "ADMIN") {
      throw new ForbiddenException(
        "No tienes permisos para acceder a este recurso. Se requieren permisos de administrador."
      );
    }

    return true;
  }
}
