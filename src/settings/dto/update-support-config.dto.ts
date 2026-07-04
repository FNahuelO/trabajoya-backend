import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateSupportConfigDto {
  @ApiPropertyOptional({
    example: "5491133902772",
    description:
      "Número de WhatsApp con código de país. Puede incluir + y espacios; se guarda solo con dígitos. Vacío = deshabilitar WhatsApp.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  whatsappNumber?: string;

  @ApiPropertyOptional({ example: "soporte@trabajo-ya.com" })
  @IsOptional()
  @IsEmail()
  @MaxLength(120)
  email?: string;
}
