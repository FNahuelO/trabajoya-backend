import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsNotEmpty, MinLength } from "class-validator";
import { i18nValidationMessage } from "nestjs-i18n";

export class SetPasswordDto {
  @ApiProperty({
    example: "nuevaContraseña123",
    description: "Nueva contraseña del usuario",
    minLength: 8,
  })
  @IsString({
    message: i18nValidationMessage("validation.isString", {
      property: "password",
    }),
  })
  @IsNotEmpty({
    message: i18nValidationMessage("validation.isNotEmpty", {
      property: "password",
    }),
  })
  @MinLength(8, {
    message: i18nValidationMessage("validation.minLength", {
      property: "password",
      constraints: { min: 8 },
    }),
  })
  password: string;

  @ApiProperty({
    example: "nuevaContraseña123",
    description: "Confirmación de la nueva contraseña",
    minLength: 8,
  })
  @IsString({
    message: i18nValidationMessage("validation.isString", {
      property: "passwordConfirm",
    }),
  })
  @IsNotEmpty({
    message: i18nValidationMessage("validation.isNotEmpty", {
      property: "passwordConfirm",
    }),
  })
  @MinLength(8, {
    message: i18nValidationMessage("validation.minLength", {
      property: "passwordConfirm",
      constraints: { min: 8 },
    }),
  })
  passwordConfirm: string;
}

