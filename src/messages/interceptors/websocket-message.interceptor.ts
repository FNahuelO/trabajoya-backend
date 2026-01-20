import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
  forwardRef,
  Logger,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { MessagesGateway } from "../messages.gateway";
import { NotificationsService } from "../../notifications/notifications.service";

@Injectable()
export class WebSocketMessageInterceptor implements NestInterceptor {
  private logger = new Logger("WebSocketMessageInterceptor");

  constructor(
    private messagesGateway: MessagesGateway,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService
  ) {}

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

            // SIEMPRE enviar notificación push, incluso si el usuario está conectado
            // Esto asegura que las notificaciones funcionen cuando la app está en segundo plano o cerrada
            try {
              // Obtener nombre del remitente
              const fromUser = (data as any).fromUser;
              const senderName =
                fromUser?.postulante?.fullName ||
                fromUser?.empresa?.companyName ||
                fromUser?.email ||
                "Alguien";

              // Obtener contenido del mensaje
              const messageContent = (data as any).content || "";

              this.logger.log(
                `[WebSocketMessageInterceptor] Sending push notification to user ${data.toUserId} from ${senderName} (messageId: ${data.id})`
              );

              // Enviar notificación push
              await this.notificationsService.sendMessageNotification(
                data.toUserId,
                senderName,
                messageContent,
                {
                  messageId: data.id,
                  fromUserId: data.fromUserId,
                  toUserId: data.toUserId,
                }
              );
              
              this.logger.log(
                `[WebSocketMessageInterceptor] Push notification request sent successfully to user ${data.toUserId}`
              );
            } catch (error) {
              this.logger.error(
                `[WebSocketMessageInterceptor] Error sending push notification to user ${data.toUserId}:`,
                error
              );
            }
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
