import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsNumber,
  IsInt,
  Min,
} from "class-validator";
import { i18nValidationMessage } from "nestjs-i18n";

export class UpdatePlanDto {
  @ApiProperty({ example: "Reclutamiento Urgente", required: false })
  @IsOptional()
  @IsString({ message: i18nValidationMessage("validation.isString") })
  name?: string;

  @ApiProperty({ example: 25000, required: false })
  @IsOptional()
  @IsNumber({}, { message: i18nValidationMessage("validation.isNumber") })
  @Min(0, { message: i18nValidationMessage("validation.min") })
  price?: number;

  @ApiProperty({ example: 7, required: false })
  @IsOptional()
  @IsInt({ message: i18nValidationMessage("validation.isNumber") })
  @Min(1, { message: i18nValidationMessage("validation.min") })
  durationDays?: number;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  unlimitedCvs?: boolean;

  @ApiProperty({ example: 0, required: false })
  @IsOptional()
  @IsInt({ message: i18nValidationMessage("validation.isNumber") })
  @Min(0, { message: i18nValidationMessage("validation.min") })
  allowedModifications?: number;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  canModifyCategory?: boolean;

  @ApiProperty({ example: 0, required: false })
  @IsOptional()
  @IsInt({ message: i18nValidationMessage("validation.isNumber") })
  @Min(0, { message: i18nValidationMessage("validation.min") })
  categoryModifications?: number;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  hasFeaturedOption?: boolean;

  @ApiProperty({ example: false, required: false, description: "Si el plan tiene acceso a funcionalidades de IA (generación de descripciones)" })
  @IsOptional()
  @IsBoolean()
  hasAIFeature?: boolean;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  launchBenefitAvailable?: boolean;

  @ApiProperty({ example: 4, required: false })
  @IsOptional()
  @IsInt({ message: i18nValidationMessage("validation.isNumber") })
  @Min(1, { message: i18nValidationMessage("validation.min") })
  launchBenefitDuration?: number;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ example: 0, required: false })
  @IsOptional()
  @IsInt({ message: i18nValidationMessage("validation.isNumber") })
  order?: number;

  @ApiProperty({ example: "Plan de reclutamiento urgente", required: false })
  @IsOptional()
  @IsString({ message: i18nValidationMessage("validation.isString") })
  description?: string;
}

