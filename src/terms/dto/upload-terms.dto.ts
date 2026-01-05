import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsString, IsOptional } from "class-validator";
import { TermsType } from "@prisma/client";

export class UploadTermsDto {
  @ApiProperty({
    enum: TermsType,
    description: "Tipo de términos",
  })
  @IsEnum(TermsType)
  type: TermsType;

  @ApiProperty({
    description: "Versión de los términos (formato semántico, ej: 1.0.0)",
    example: "1.0.0",
  })
  @IsString()
  version: string;

  @ApiProperty({
    description: "Descripción de cambios en esta versión",
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;
}
