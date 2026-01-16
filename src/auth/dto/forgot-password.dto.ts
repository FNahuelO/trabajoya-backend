import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty } from "class-validator";
import { i18nValidationMessage } from "nestjs-i18n";

export class ForgotPasswordDto {
  @ApiProperty({ example: "usuario@ejemplo.com" })
  @IsEmail({}, { message: i18nValidationMessage("validation.isEmail") })
  @IsNotEmpty({ message: i18nValidationMessage("validation.isNotEmpty") })
  email: string;
}

