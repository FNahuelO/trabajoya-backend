import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { MessagesService } from "../messages.service";

@Injectable()
export class MessagePermissionGuard implements CanActivate {
  constructor(private messagesService: MessagesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const messageId = request.params.id;

    if (!user?.sub || !messageId) {
      throw new ForbiddenException(
        "Usuario no autenticado o ID de mensaje no válido"
      );
    }

    try {
      // Verificar que el mensaje existe y el usuario tiene permisos
      const message = await this.messagesService.getMessageById(messageId);

      if (!message) {
        throw new ForbiddenException("Mensaje no encontrado");
      }

      // Verificar que el usuario es el remitente o destinatario del mensaje
      if (message.fromUserId !== user.sub && message.toUserId !== user.sub) {
        throw new ForbiddenException(
          "No tienes permisos para acceder a este mensaje"
        );
      }

      // Agregar el mensaje al request para uso posterior
      request.message = message;

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new ForbiddenException("Error al verificar permisos del mensaje");
    }
  }
}
