import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { MessagesGateway } from "../messages.gateway";

@Injectable()
export class WebSocketMessageInterceptor implements NestInterceptor {
  constructor(private messagesGateway: MessagesGateway) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    return next.handle().pipe(
      tap(async (response) => {
        // Solo procesar si la respuesta es exitosa y contiene datos
        if (response?.success && response?.data) {
          const { data } = response;

          // Si es un mensaje nuevo, notificar via WebSocket
          if (data.id && data.fromUserId && data.toUserId) {
            await this.messagesGateway.notifyNewMessage(data.toUserId, data);

            // Actualizar contador de mensajes no leídos
            const unreadCount = await this.messagesGateway[
              "messagesService"
            ].getUnreadCount(data.toUserId);
            await this.messagesGateway.notifyUnreadCount(
              data.toUserId,
              unreadCount
            );
          }

          // Si es marcar como leído, notificar al remitente
          if (data.id && data.isRead && data.fromUserId) {
            await this.messagesGateway.notifyMessageRead(
              data.fromUserId,
              data.id,
              data.createdAt
            );
          }
        }
      })
    );
  }
}
