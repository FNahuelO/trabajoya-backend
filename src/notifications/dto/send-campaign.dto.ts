import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsString, MaxLength } from "class-validator";

export enum CampaignTargetAudience {
  ALL = "ALL",
  POSTULANTE = "POSTULANTE",
  EMPRESA = "EMPRESA",
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
}
