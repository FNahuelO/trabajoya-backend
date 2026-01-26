import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsUUID, IsEnum, IsOptional } from "class-validator";
import { ReportReason } from "@prisma/client";

/**
 * DTO para crear una denuncia
 * Requerido por Google Play para cumplir con políticas de seguridad
 */
export class CreateReportDto {
  @ApiProperty({
    description: "ID del usuario denunciado",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  reportedUserId: string;

  @ApiProperty({
    description: "ID del mensaje denunciado (opcional)",
    example: "123e4567-e89b-12d3-a456-426614174000",
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  messageId?: string;

  @ApiProperty({
    description: "Motivo de la denuncia",
    enum: ReportReason,
    example: ReportReason.SPAM,
  })
  @IsNotEmpty()
  @IsEnum(ReportReason)
  reason: ReportReason;

  @ApiProperty({
    description: "Descripción adicional (opcional)",
    example: "El usuario envió múltiples mensajes con contenido inapropiado",
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;
}

