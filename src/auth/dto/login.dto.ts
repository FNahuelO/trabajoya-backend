import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, IsNotEmpty } from "class-validator";
import { i18nValidationMessage } from "nestjs-i18n";

export class LoginDto {
  @ApiProperty({ example: "usuario@ejemplo.com" })
  @IsEmail({}, { message: i18nValidationMessage("validation.isEmail") })
  @IsNotEmpty({ message: i18nValidationMessage("validation.isNotEmpty") })
  email: string;

  @ApiProperty({ example: "Password123!" })
  @IsString({ message: i18nValidationMessage("validation.isString") })
  @IsNotEmpty({ message: i18nValidationMessage("validation.isNotEmpty") })
  password: string;
}
