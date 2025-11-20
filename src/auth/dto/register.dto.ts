import { ApiProperty } from "@nestjs/swagger";
import {
  IsEmail,
  IsString,
  IsOptional,
  IsEnum,
  MinLength,
} from "class-validator";
import { i18nValidationMessage } from "nestjs-i18n";

export class RegisterDto {
  @ApiProperty({ example: "usuario@ejemplo.com" })
  @IsEmail({}, { message: i18nValidationMessage("validation.isEmail") })
  email: string;

  @ApiProperty({ example: "Password123!", required: false })
  @IsOptional()
  @IsString({ message: i18nValidationMessage("validation.isString") })
  @MinLength(6, { message: i18nValidationMessage("validation.minLength") })
  password?: string;

  @ApiProperty({ enum: ["POSTULANTE", "EMPRESA"], required: false })
  @IsOptional()
  @IsEnum(["POSTULANTE", "EMPRESA"], {
    message: i18nValidationMessage("validation.isEnum"),
  })
  userType?: "POSTULANTE" | "EMPRESA";

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString({ message: i18nValidationMessage("validation.isString") })
  fullName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString({ message: i18nValidationMessage("validation.isString") })
  companyName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString({ message: i18nValidationMessage("validation.isString") })
  cuit?: string;

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
}
