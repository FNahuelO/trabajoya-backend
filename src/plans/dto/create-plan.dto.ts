import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  IsNumber,
  IsInt,
  Min,
} from "class-validator";
import { i18nValidationMessage } from "nestjs-i18n";

export class CreatePlanDto {
  @ApiProperty({ example: "Reclutamiento Urgente" })
  @IsString({ message: i18nValidationMessage("validation.isString") })
  @IsNotEmpty({ message: i18nValidationMessage("validation.isNotEmpty") })
  name: string;

  @ApiProperty({ example: "URGENT" })
  @IsString({ message: i18nValidationMessage("validation.isString") })
  @IsNotEmpty({ message: i18nValidationMessage("validation.isNotEmpty") })
  code: string;

  @ApiProperty({ example: 25000 })
  @IsNumber({}, { message: i18nValidationMessage("validation.isNumber") })
  @Min(0, { message: i18nValidationMessage("validation.min") })
  price: number;

  @ApiProperty({ example: "USD", required: false, default: "USD", description: "Moneda del plan (USD para PayPal, ARS para otras pasarelas)" })
  @IsOptional()
  @IsString({ message: i18nValidationMessage("validation.isString") })
  currency?: string;

  @ApiProperty({ example: 7 })
  @IsInt({ message: i18nValidationMessage("validation.isNumber") })
  @Min(1, { message: i18nValidationMessage("validation.min") })
  durationDays: number;

  @ApiProperty({ example: true, required: false, default: true })
  @IsOptional()
  @IsBoolean()
  unlimitedCvs?: boolean;

  @ApiProperty({ example: 0, required: false, default: 0 })
  @IsOptional()
  @IsInt({ message: i18nValidationMessage("validation.isNumber") })
  @Min(0, { message: i18nValidationMessage("validation.min") })
  allowedModifications?: number;

  @ApiProperty({ example: false, required: false, default: false })
  @IsOptional()
  @IsBoolean()
  canModifyCategory?: boolean;

  @ApiProperty({ example: 0, required: false, default: 0 })
  @IsOptional()
  @IsInt({ message: i18nValidationMessage("validation.isNumber") })
  @Min(0, { message: i18nValidationMessage("validation.min") })
  categoryModifications?: number;

  @ApiProperty({ example: false, required: false, default: false })
  @IsOptional()
  @IsBoolean()
  hasFeaturedOption?: boolean;

  @ApiProperty({ example: false, required: false, default: false, description: "Si el plan tiene acceso a funcionalidades de IA (generación de descripciones)" })
  @IsOptional()
  @IsBoolean()
  hasAIFeature?: boolean;

  @ApiProperty({ example: false, required: false, default: false })
  @IsOptional()
  @IsBoolean()
  launchBenefitAvailable?: boolean;

  @ApiProperty({ example: 4, required: false })
  @IsOptional()
  @IsInt({ message: i18nValidationMessage("validation.isNumber") })
  @Min(1, { message: i18nValidationMessage("validation.min") })
  launchBenefitDuration?: number;

  @ApiProperty({ example: true, required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ example: 0, required: false, default: 0 })
  @IsOptional()
  @IsInt({ message: i18nValidationMessage("validation.isNumber") })
  order?: number;

  @ApiProperty({ example: "Plan de reclutamiento urgente", required: false })
  @IsOptional()
  @IsString({ message: i18nValidationMessage("validation.isString") })
  description?: string;

  @ApiProperty({ 
    example: "URGENT", 
    required: false, 
    default: "PREMIUM",
    enum: ["URGENT", "STANDARD", "PREMIUM", "CRYSTAL", "BASIC", "ENTERPRISE"],
    description: "Tipo de suscripción al que pertenece este plan" 
  })
  @IsOptional()
  @IsString({ message: i18nValidationMessage("validation.isString") })
  subscriptionPlan?: "URGENT" | "STANDARD" | "PREMIUM" | "CRYSTAL" | "BASIC" | "ENTERPRISE";
}

