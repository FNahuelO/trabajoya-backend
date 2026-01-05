import { Module, forwardRef } from "@nestjs/common";
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

@Module({
  imports: [PrismaModule, forwardRef(() => MessagesModule), ConfigModule],
  controllers: [CallsController, VideoMeetingsController, GoogleMeetController],
  providers: [
    CallsService,
    CallsGateway,
    VideoMeetingsService,
    GoogleMeetService,
  ],
  exports: [
    CallsService,
    CallsGateway,
    VideoMeetingsService,
    GoogleMeetService,
  ],
})
export class CallsModule {}
