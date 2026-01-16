import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class VerifyGoogleDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsNotEmpty()
  purchaseToken: string;

  @IsString()
  @IsOptional()
  orderId?: string;

  @IsString()
  @IsOptional()
  jobPostDraftId?: string;
}

