import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";
import { CampaignTargetAudience } from "./send-campaign.dto";

export enum CampaignScheduleType {
  ONCE = "ONCE",
  RECURRING = "RECURRING",
}

export class ScheduleCampaignDto {
  @ApiProperty({ example: "¡Feliz Día del Padre!" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title: string;

  @ApiProperty({
    example: "Desde TrabajoYa te deseamos un excelente día.",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  body: string;

  @ApiPropertyOptional({
    enum: CampaignTargetAudience,
    default: CampaignTargetAudience.ALL,
  })
  @IsEnum(CampaignTargetAudience)
  targetAudience: CampaignTargetAudience = CampaignTargetAudience.ALL;

  @ApiPropertyOptional({
    type: [String],
    description: "IDs de usuarios destinatarios (requerido si targetAudience es SPECIFIC)",
  })
  @ValidateIf((dto) => dto.targetAudience === CampaignTargetAudience.SPECIFIC)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(50)
  @IsUUID("4", { each: true })
  userIds?: string[];

  @ApiProperty({ enum: CampaignScheduleType })
  @IsEnum(CampaignScheduleType)
  scheduleType: CampaignScheduleType;

  @ApiPropertyOptional({
    description: "Fecha y hora para envío único (ISO 8601)",
    example: "2026-06-24T20:00:00.000Z",
  })
  @ValidateIf((dto) => dto.scheduleType === CampaignScheduleType.ONCE)
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({
    type: [Number],
    description: "Días de la semana (0=Domingo, 1=Lunes, ..., 6=Sábado)",
    example: [2],
  })
  @ValidateIf((dto) => dto.scheduleType === CampaignScheduleType.RECURRING)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  recurrenceDays?: number[];

  @ApiPropertyOptional({
    description: "Hora de envío recurrente en formato HH:mm",
    example: "20:00",
  })
  @ValidateIf((dto) => dto.scheduleType === CampaignScheduleType.RECURRING)
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: "recurrenceTime debe tener formato HH:mm",
  })
  recurrenceTime?: string;

  @ApiPropertyOptional({
    default: "America/Argentina/Buenos_Aires",
  })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({
    description: "Cantidad máxima de envíos (solo recurrentes). Vacío = sin límite.",
    example: 4,
  })
  @ValidateIf((dto) => dto.scheduleType === CampaignScheduleType.RECURRING)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  maxRuns?: number;
}

export class UpdateCampaignScheduleDto extends ScheduleCampaignDto {}

export class UpdateCampaignScheduleStatusDto {
  @ApiProperty({ enum: ["ACTIVE", "PAUSED"] })
  @IsIn(["ACTIVE", "PAUSED"])
  status: "ACTIVE" | "PAUSED";
}
