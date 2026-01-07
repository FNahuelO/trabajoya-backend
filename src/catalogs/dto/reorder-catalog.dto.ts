import { ApiProperty } from "@nestjs/swagger";
import { IsArray, ValidateNested, IsString, IsInt } from "class-validator";
import { Type } from "class-transformer";
import { i18nValidationMessage } from "nestjs-i18n";

class ReorderItemDto {
  @ApiProperty({ example: "uuid-here" })
  @IsString({ message: i18nValidationMessage("validation.isString") })
  id: string;

  @ApiProperty({ example: 10 })
  @IsInt({ message: i18nValidationMessage("validation.isNumber") })
  order: number;
}

export class ReorderCatalogDto {
  @ApiProperty({ type: [ReorderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items: ReorderItemDto[];
}

