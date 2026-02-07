import { ApiProperty } from "@nestjs/swagger";
import {
  IsEmail,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  ValidateIf,
} from "class-validator";
import { i18nValidationMessage } from "nestjs-i18n";

export type LoginSource = "backoffice" | "app" | "web-empresas";

export class LoginDto {
  @ApiProperty({
    required: false,
    description:
      "Origen del login: backoffice (solo ADMIN), app (POSTULANTE/EMPRESA), web-empresas (solo EMPRESA)",
    enum: ["backoffice", "app", "web-empresas"],
  })
  @IsOptional()
  @IsIn(["backoffice", "app", "web-empresas"], {
    message: "source debe ser: backoffice, app o web-empresas",
  })
  source?: LoginSource;
  @ApiProperty({ example: "usuario@ejemplo.com", required: false })
  @ValidateIf(
    (dto) =>
      !dto.idToken &&
      !dto.identityToken &&
      !dto.authorizationCode &&
      !dto.googleAuthCode
  )
  @IsEmail({}, { message: i18nValidationMessage("validation.isEmail") })
  @IsNotEmpty({ message: i18nValidationMessage("validation.isNotEmpty") })
  email?: string;

  @ApiProperty({ example: "Password123!", required: false })
  @ValidateIf(
    (dto) =>
      !dto.idToken &&
      !dto.identityToken &&
      !dto.authorizationCode &&
      !dto.googleAuthCode
  )
  @IsString({ message: i18nValidationMessage("validation.isString") })
  @IsNotEmpty({ message: i18nValidationMessage("validation.isNotEmpty") })
  password?: string;

  @ApiProperty({ required: false, description: "Google ID Token" })
  @IsOptional()
  @IsString({ message: i18nValidationMessage("validation.isString") })
  idToken?: string;

  @ApiProperty({
    required: false,
    description: "Google Authorization Code (OAuth2 Code Flow)",
  })
  @IsOptional()
  @IsString({ message: i18nValidationMessage("validation.isString") })
  googleAuthCode?: string;

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

  @ApiProperty({
    required: false,
    description: "Google Redirect URI for code exchange",
  })
  @IsOptional()
  @IsString({ message: i18nValidationMessage("validation.isString") })
  googleRedirectUri?: string;

  @ApiProperty({
    required: false,
    description: "Google Client ID used for code exchange",
  })
  @IsOptional()
  @IsString({ message: i18nValidationMessage("validation.isString") })
  googleClientId?: string;
}
