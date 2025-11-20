import { Module } from "@nestjs/common";
import { PublicController } from "./public.controller";
import { LocationService } from "./location.service";
import { GeorefService } from "./georef.service";

@Module({
  controllers: [PublicController],
  providers: [LocationService, GeorefService],
})
export class PublicModule {}
