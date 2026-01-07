import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, IsBoolean, IsObject, IsInt, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { i18nValidationMessage } from "nestjs-i18n";

class CatalogTranslationDto {
  @ApiProperty({ example: "Comercial, Ventas y Negocios", required: false })
  @IsOptional()
  @IsString({ message: i18nValidationMessage("validation.isString") })
  es?: string;

  @ApiProperty({ example: "Commercial, Sales & Business", required: false })
  @IsOptional()
  @IsString({ message: i18nValidationMessage("validation.isString") })
  en?: string;

  @ApiProperty({ example: "Comercial, Vendas e Negócios", required: false })
  @IsOptional()
  @IsString({ message: i18nValidationMessage("validation.isString") })
  pt?: string;
}

export class UpdateCatalogDto {
  @ApiProperty({ type: CatalogTranslationDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => CatalogTranslationDto)
  @IsObject()
  translations?: CatalogTranslationDto;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ example: 10, required: false })
  @IsOptional()
  @IsInt({ message: i18nValidationMessage("validation.isNumber") })
  order?: number;
}

