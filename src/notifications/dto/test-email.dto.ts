import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

export class TestEmailDto {
  @ApiProperty({
    description: "Email destino de Mail-Tester",
    example: "abc123@mail-tester.com",
  })
  @IsEmail()
  to: string;

  @ApiPropertyOptional({
    description: "Asunto personalizado para la prueba",
    example: "Prueba SPF/DKIM - TrabajoYa",
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  subject?: string;

  @ApiPropertyOptional({
    description: "Texto plano del correo",
    example: "Correo de prueba para validar entregabilidad.",
  })
  @IsOptional()
  @IsString()
  text?: string;

  @ApiPropertyOptional({
    description: "HTML opcional del correo",
    example: "<p>Correo de prueba para validar entregabilidad.</p>",
  })
  @IsOptional()
  @IsString()
  html?: string;
}
