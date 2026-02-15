import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";

@Injectable()
export class EmpresaGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || user.userType !== "EMPRESA") {
      throw new ForbiddenException(
        "Solo las empresas pueden acceder a este recurso."
      );
    }

    return true;
  }
}

