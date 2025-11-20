import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";

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
}

export class CallResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  fromUserId: string;

  @ApiProperty()
  toUserId: string;

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
