import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsUUID, MinLength } from "class-validator";
import { i18nValidationMessage } from "nestjs-i18n";

export class ResetPasswordDto {
  @ApiProperty({ description: "Token de recuperación", example: "550e8400-e29b-41d4-a716-446655440000" })
  @IsString({ message: i18nValidationMessage("validation.isString") })
  @IsNotEmpty({ message: i18nValidationMessage("validation.isNotEmpty") })
  @IsUUID("4", { message: i18nValidationMessage("validation.isUuid") })
  token: string;

  @ApiProperty({ description: "Nueva contraseña", example: "Password123!" })
  @IsString({ message: i18nValidationMessage("validation.isString") })
  @IsNotEmpty({ message: i18nValidationMessage("validation.isNotEmpty") })
  @MinLength(8, { message: i18nValidationMessage("validation.minLength") })
  password: string;
}
