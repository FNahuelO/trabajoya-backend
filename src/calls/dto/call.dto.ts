import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";

export enum CallType {
  VOICE = "VOICE",
  VIDEO = "VIDEO",
}

export enum CallStatus {
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
  MISSED = "MISSED",
  ENDED = "ENDED",
  CANCELLED = "CANCELLED",
}

export class InitiateCallDto {
  @ApiProperty({ description: "ID del usuario que recibirá la llamada" })
  @IsNotEmpty()
  @IsString()
  toUserId: string;

  @ApiProperty({
    description: "Tipo de llamada",
    enum: CallType,
    default: CallType.VOICE,
    required: false,
  })
  @IsOptional()
  @IsEnum(CallType)
  callType?: CallType;
}

export class CallResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  fromUserId: string;

  @ApiProperty()
  toUserId: string;

  @ApiProperty({ enum: CallType, default: CallType.VOICE })
  callType: CallType;

  @ApiProperty({ enum: CallStatus })
  status: CallStatus;

  @ApiProperty({ required: false })
  startedAt?: Date;

  @ApiProperty({ required: false })
  endedAt?: Date;

  @ApiProperty({ required: false, description: "Duración en segundos" })
  duration?: number;

  @ApiProperty()
  createdAt: Date;
}

export class UpdateCallStatusDto {
  @ApiProperty({ enum: CallStatus })
  @IsEnum(CallStatus)
  status: CallStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}
