import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsIn, IsNotEmpty, IsOptional } from "class-validator";
import { i18nValidationMessage } from "nestjs-i18n";

export class ForgotPasswordDto {
  @ApiProperty({ example: "usuario@ejemplo.com" })
  @IsEmail({}, { message: i18nValidationMessage("validation.isEmail") })
  @IsNotEmpty({ message: i18nValidationMessage("validation.isNotEmpty") })
  email: string;

  @ApiProperty({
    example: "web-empresas",
    required: false,
    enum: ["app", "web-empresas"],
    description: "Origen del flujo de recuperación para elegir el frontend destino",
  })
  @IsOptional()
  @IsIn(["app", "web-empresas"], { message: "source inválido" })
  source?: "app" | "web-empresas";
}

