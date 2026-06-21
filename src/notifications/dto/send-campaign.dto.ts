import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from "class-validator";

export enum CampaignTargetAudience {
  ALL = "ALL",
  POSTULANTE = "POSTULANTE",
  EMPRESA = "EMPRESA",
  SPECIFIC = "SPECIFIC",
}

export class SendCampaignDto {
  @ApiProperty({ example: "¡Feliz Día del Padre!" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title: string;

  @ApiProperty({
    example: "Desde TrabajoYa te deseamos un excelente día. ¡Gracias por confiar en nosotros!",
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
}
