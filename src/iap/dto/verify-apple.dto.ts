import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class VerifyAppleDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsNotEmpty()
  transactionId: string;

  @IsString()
  @IsOptional()
  signedTransactionInfo?: string;

  @IsString()
  @IsOptional()
  signedRenewalInfo?: string;

  @IsString()
  @IsOptional()
  jobPostDraftId?: string;
}

