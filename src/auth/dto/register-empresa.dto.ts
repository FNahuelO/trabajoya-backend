import { ApiProperty } from "@nestjs/swagger";
import {
  IsEmail,
  IsString,
  IsBoolean,
  IsOptional,
  MinLength,
  IsNotEmpty,
} from "class-validator";
import { i18nValidationMessage } from "nestjs-i18n";

export class RegisterEmpresaDto {
  // Company information
  @ApiProperty({ example: "Mi Empresa SA" })
  @IsString({ message: i18nValidationMessage("validation.isString") })
  @IsNotEmpty({ message: i18nValidationMessage("validation.isNotEmpty") })
  companyName: string;

  @ApiProperty({ example: "Mi Empresa Sociedad Anónima" })
  @IsString({ message: i18nValidationMessage("validation.isString") })
  @IsNotEmpty({ message: i18nValidationMessage("validation.isNotEmpty") })
  razonSocial: string;

  @ApiProperty({ example: "Responsable Inscripto" })
  @IsString({ message: i18nValidationMessage("validation.isString") })
  @IsNotEmpty({ message: i18nValidationMessage("validation.isNotEmpty") })
  condicionFiscal: string;

  @ApiProperty({ example: "20-12345678-9" })
  @IsString({ message: i18nValidationMessage("validation.isString") })
  @IsNotEmpty({ message: i18nValidationMessage("validation.isNotEmpty") })
  documento: string;

  @ApiProperty({ example: "Buenos Aires" })
  @IsString({ message: i18nValidationMessage("validation.isString") })
  @IsNotEmpty({ message: i18nValidationMessage("validation.isNotEmpty") })
  provincia: string;

  @ApiProperty({ example: "Ciudad Autónoma de Buenos Aires", required: false })
  @IsOptional()
  @IsString({ message: i18nValidationMessage("validation.isString") })
  localidad?: string;

  @ApiProperty({ example: "Ciudad Autónoma de Buenos Aires", required: false })
  @IsOptional()
  @IsString({ message: i18nValidationMessage("validation.isString") })
  ciudad?: string;

  @ApiProperty({ example: "Av. Corrientes" })
  @IsString({ message: i18nValidationMessage("validation.isString") })
  @IsNotEmpty({ message: i18nValidationMessage("validation.isNotEmpty") })
  calle: string;

  @ApiProperty({ example: "1234" })
  @IsString({ message: i18nValidationMessage("validation.isString") })
  @IsNotEmpty({ message: i18nValidationMessage("validation.isNotEmpty") })
  numero: string;

  @ApiProperty({ example: "C1000" })
  @IsString({ message: i18nValidationMessage("validation.isString") })
  @IsNotEmpty({ message: i18nValidationMessage("validation.isNotEmpty") })
  codigoPostal: string;

  @ApiProperty({ example: "+54" })
  @IsString({ message: i18nValidationMessage("validation.isString") })
  @IsNotEmpty({ message: i18nValidationMessage("validation.isNotEmpty") })
  phoneCountryCode: string;

  @ApiProperty({ example: "1123456789" })
  @IsString({ message: i18nValidationMessage("validation.isString") })
  @IsNotEmpty({ message: i18nValidationMessage("validation.isNotEmpty") })
  telefono: string;

  @ApiProperty({ example: "Tecnología" })
  @IsString({ message: i18nValidationMessage("validation.isString") })
  @IsNotEmpty({ message: i18nValidationMessage("validation.isNotEmpty") })
  industria: string;

  @ApiProperty({ example: "1-10" })
  @IsString({ message: i18nValidationMessage("validation.isString") })
  @IsNotEmpty({ message: i18nValidationMessage("validation.isNotEmpty") })
  cantidadEmpleados: string;

  @ApiProperty({ example: false })
  @IsBoolean({ message: i18nValidationMessage("validation.isBoolean") })
  contribuyenteIngresosBrutos: boolean;

  // User information
  @ApiProperty({ example: "Juan" })
  @IsString({ message: i18nValidationMessage("validation.isString") })
  @IsNotEmpty({ message: i18nValidationMessage("validation.isNotEmpty") })
  nombre: string;

  @ApiProperty({ example: "Pérez" })
  @IsString({ message: i18nValidationMessage("validation.isString") })
  @IsNotEmpty({ message: i18nValidationMessage("validation.isNotEmpty") })
  apellido: string;

  @ApiProperty({ example: "contacto@miempresa.com" })
  @IsEmail({}, { message: i18nValidationMessage("validation.isEmail") })
  @IsNotEmpty({ message: i18nValidationMessage("validation.isNotEmpty") })
  email: string;

  @ApiProperty({ example: "Password123!" })
  @IsString({ message: i18nValidationMessage("validation.isString") })
  @MinLength(8, { message: i18nValidationMessage("validation.minLength") })
  @IsNotEmpty({ message: i18nValidationMessage("validation.isNotEmpty") })
  password: string;

  @ApiProperty({ example: "Password123!" })
  @IsString({ message: i18nValidationMessage("validation.isString") })
  @IsNotEmpty({ message: i18nValidationMessage("validation.isNotEmpty") })
  passwordConfirm: string;

  @ApiProperty({ example: true })
  @IsBoolean({ message: i18nValidationMessage("validation.isBoolean") })
  aceptaTerminos: boolean;
}
