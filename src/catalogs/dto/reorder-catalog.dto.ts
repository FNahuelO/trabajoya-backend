import { ApiProperty } from "@nestjs/swagger";
import { IsArray, ValidateNested, IsString, IsInt, IsNotEmpty } from "class-validator";
import { Type } from "class-transformer";
import { i18nValidationMessage } from "nestjs-i18n";

class ReorderItemDto {
  @ApiProperty({ example: "uuid-here" })
  @IsNotEmpty({ message: i18nValidationMessage("validation.isNotEmpty") })
  @IsString({ message: i18nValidationMessage("validation.isString") })
  id: string;

  @ApiProperty({ example: 10 })
  @IsNotEmpty({ message: i18nValidationMessage("validation.isNotEmpty") })
  @IsInt({ message: i18nValidationMessage("validation.isNumber") })
  order: number;
}

export class ReorderCatalogDto {
  @ApiProperty({ type: [ReorderItemDto], description: "Array of catalog items with id and order" })
  @IsNotEmpty({ message: i18nValidationMessage("validation.isNotEmpty") })
  @IsArray({ message: i18nValidationMessage("validation.isArray") })
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items: ReorderItemDto[];
}

