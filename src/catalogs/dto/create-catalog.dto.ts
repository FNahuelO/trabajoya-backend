import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsObject,
  IsInt,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { i18nValidationMessage } from "nestjs-i18n";

export enum CatalogType {
  JOB_AREA = "JOB_AREA",
  JOB_TYPE = "JOB_TYPE",
  JOB_LEVEL = "JOB_LEVEL",
}

class CatalogTranslationDto {
  @ApiProperty({ example: "Comercial, Ventas y Negocios" })
  @IsString({ message: i18nValidationMessage("validation.isString") })
  @IsNotEmpty({ message: i18nValidationMessage("validation.isNotEmpty") })
  es: string;

  @ApiProperty({ example: "Commercial, Sales & Business" })
  @IsString({ message: i18nValidationMessage("validation.isString") })
  @IsNotEmpty({ message: i18nValidationMessage("validation.isNotEmpty") })
  en: string;

  @ApiProperty({ example: "Comercial, Vendas e Negócios" })
  @IsString({ message: i18nValidationMessage("validation.isString") })
  @IsNotEmpty({ message: i18nValidationMessage("validation.isNotEmpty") })
  pt: string;
}

export class CreateCatalogDto {
  @ApiProperty({ enum: CatalogType, example: CatalogType.JOB_AREA })
  @IsEnum(CatalogType, { message: i18nValidationMessage("validation.isEnum") })
  @IsNotEmpty({ message: i18nValidationMessage("validation.isNotEmpty") })
  type: CatalogType;

  @ApiProperty({ example: "COMERCIAL_VENTAS_NEGOCIOS" })
  @IsString({ message: i18nValidationMessage("validation.isString") })
  @IsNotEmpty({ message: i18nValidationMessage("validation.isNotEmpty") })
  code: string;

  @ApiProperty({ type: CatalogTranslationDto })
  @ValidateNested()
  @Type(() => CatalogTranslationDto)
  @IsObject()
  translations: CatalogTranslationDto;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ example: 10, required: false })
  @IsOptional()
  @IsInt({ message: i18nValidationMessage("validation.isNumber") })
  order?: number;
}

