import { ApiProperty } from "@nestjs/swagger";
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
  IsInt,
  Min,
  Max,
} from "class-validator";

export enum VideoMeetingStatus {
  SCHEDULED = "SCHEDULED",
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  MISSED = "MISSED",
}

export class CreateVideoMeetingDto {
  @ApiProperty({ description: "ID del usuario invitado" })
  @IsNotEmpty()
  @IsString()
  invitedUserId: string;

  @ApiProperty({ description: "Título de la reunión", required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ description: "Descripción de la reunión", required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: "Fecha y hora programada (ISO 8601)" })
  @IsNotEmpty()
  @IsDateString()
  scheduledAt: string;

  @ApiProperty({
    description: "Duración estimada en minutos",
    required: false,
    minimum: 5,
    maximum: 480,
  })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(480)
  duration?: number;
}

export class UpdateVideoMeetingDto {
  @ApiProperty({ description: "Título de la reunión", required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ description: "Descripción de la reunión", required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: "Fecha y hora programada (ISO 8601)",
    required: false,
  })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiProperty({
    description: "Duración estimada en minutos",
    required: false,
    minimum: 5,
    maximum: 480,
  })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(480)
  duration?: number;
}

export class VideoMeetingResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  createdById: string;

  @ApiProperty()
  invitedUserId: string;

  @ApiProperty({ required: false })
  title?: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty()
  scheduledAt: Date;

  @ApiProperty({ required: false })
  duration?: number;

  @ApiProperty({ enum: VideoMeetingStatus })
  status: VideoMeetingStatus;

  @ApiProperty({ required: false })
  meetingUrl?: string;

  @ApiProperty({ required: false })
  callId?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ required: false })
  startedAt?: Date;

  @ApiProperty({ required: false })
  endedAt?: Date;

  @ApiProperty({
    required: false,
    description: 'Indica si el evento se creó exitosamente en Google Calendar',
  })
  googleCalendarEventCreated?: boolean;

  @ApiProperty({
    required: false,
    description: 'Mensaje de advertencia si hubo un problema no crítico (ej: evento de calendario no creado)',
  })
  warning?: string;
}
