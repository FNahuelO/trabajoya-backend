import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, IsNotEmpty, IsOptional, ValidateIf } from "class-validator";
import { i18nValidationMessage } from "nestjs-i18n";

export class LoginDto {
  @ApiProperty({ example: "usuario@ejemplo.com", required: false })
  @ValidateIf((dto) => !dto.idToken && !dto.identityToken && !dto.authorizationCode)
  @IsEmail({}, { message: i18nValidationMessage("validation.isEmail") })
  @IsNotEmpty({ message: i18nValidationMessage("validation.isNotEmpty") })
  email?: string;

  @ApiProperty({ example: "Password123!", required: false })
  @ValidateIf((dto) => !dto.idToken && !dto.identityToken && !dto.authorizationCode)
  @IsString({ message: i18nValidationMessage("validation.isString") })
  @IsNotEmpty({ message: i18nValidationMessage("validation.isNotEmpty") })
  password?: string;

  @ApiProperty({ required: false, description: "Google ID Token" })
  @IsOptional()
  @IsString({ message: i18nValidationMessage("validation.isString") })
  idToken?: string;

  @ApiProperty({ required: false, description: "Apple Identity Token" })
  @IsOptional()
  @IsString({ message: i18nValidationMessage("validation.isString") })
  identityToken?: string;

  @ApiProperty({ required: false, description: "Apple Authorization Code" })
  @IsOptional()
  @IsString({ message: i18nValidationMessage("validation.isString") })
  authorizationCode?: string;

  @ApiProperty({ required: false, description: "Apple User ID" })
  @IsOptional()
  @IsString({ message: i18nValidationMessage("validation.isString") })
  appleUserId?: string;

  @ApiProperty({ required: false, description: "Full name for Apple login" })
  @IsOptional()
  @IsString({ message: i18nValidationMessage("validation.isString") })
  fullName?: string;
}
