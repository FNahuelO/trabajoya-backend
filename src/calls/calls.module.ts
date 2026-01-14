import { Module, forwardRef } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { CallsController } from "./calls.controller";
import { CallsService } from "./calls.service";
import { CallsGateway } from "./calls.gateway";
import { VideoMeetingsController } from "./video-meetings.controller";
import { VideoMeetingsService } from "./video-meetings.service";
import { GoogleMeetController } from "./google-meet.controller";
import { GoogleMeetService } from "./google-meet.service";
import { PrismaModule } from "../prisma/prisma.module";
import { MessagesModule } from "../messages/messages.module";
import { ConfigModule } from "@nestjs/config";
import { WebSocketAuthService } from "../common/services/websocket-auth.service";

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => MessagesModule),
    ConfigModule,
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET,
      signOptions: { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m" },
    }),
  ],
  controllers: [CallsController, VideoMeetingsController, GoogleMeetController],
  providers: [
    CallsService,
    CallsGateway,
    VideoMeetingsService,
    GoogleMeetService,
    WebSocketAuthService,
  ],
  exports: [
    CallsService,
    CallsGateway,
    VideoMeetingsService,
    GoogleMeetService,
  ],
})
export class CallsModule {}
