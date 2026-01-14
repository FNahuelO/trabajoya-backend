import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsNotEmpty, MinLength } from "class-validator";
import { i18nValidationMessage } from "nestjs-i18n";

export class ChangePasswordDto {
  @ApiProperty({
    example: "contraseñaActual123",
    description: "Contraseña actual del usuario",
  })
  @IsString({
    message: i18nValidationMessage("validation.isString", {
      property: "currentPassword",
    }),
  })
  @IsNotEmpty({
    message: i18nValidationMessage("validation.isNotEmpty", {
      property: "currentPassword",
    }),
  })
  currentPassword: string;

  @ApiProperty({
    example: "nuevaContraseña123",
    description: "Nueva contraseña del usuario",
    minLength: 8,
  })
  @IsString({
    message: i18nValidationMessage("validation.isString", {
      property: "newPassword",
    }),
  })
  @IsNotEmpty({
    message: i18nValidationMessage("validation.isNotEmpty", {
      property: "newPassword",
    }),
  })
  @MinLength(8, {
    message: i18nValidationMessage("validation.minLength", {
      property: "newPassword",
      constraints: { min: 8 },
    }),
  })
  newPassword: string;
}

