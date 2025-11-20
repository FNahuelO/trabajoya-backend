import { IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateOrderDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  planType?: string;
}
