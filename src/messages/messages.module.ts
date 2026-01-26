import { Module, forwardRef } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { MessagesController } from "./messages.controller";
import { MessagesService } from "./messages.service";
import { MessagesGateway } from "./messages.gateway";
import { PrismaModule } from "../prisma/prisma.module";
import { UploadModule } from "../upload/upload.module";
import { WebSocketAuthService } from "../common/services/websocket-auth.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { WebSocketMessageInterceptor } from "./interceptors/websocket-message.interceptor";
import { BlockedUsersModule } from "../blocked-users/blocked-users.module";

@Module({
  imports: [
    PrismaModule,
    UploadModule,
    forwardRef(() => NotificationsModule),
    BlockedUsersModule, // Para verificar bloqueos antes de enviar mensajes
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET,
      signOptions: { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m" },
    }),
  ],
  controllers: [MessagesController],
  providers: [
    MessagesService,
    MessagesGateway,
    WebSocketAuthService,
    WebSocketMessageInterceptor, // Registrar el interceptor como provider para inyección de dependencias
  ],
  exports: [MessagesService, MessagesGateway],
})
export class MessagesModule {}
