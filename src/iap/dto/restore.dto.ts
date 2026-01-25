import { IsString, IsNotEmpty, IsEnum, IsArray, IsOptional } from 'class-validator';

export enum RestorePlatform {
  IOS = 'IOS',
  ANDROID = 'ANDROID',
}

export class RestoreDto {
  @IsEnum(RestorePlatform)
  @IsNotEmpty()
  platform: RestorePlatform;

  @IsArray()
  @IsOptional()
  purchases?: Array<{
    productId: string;
    transactionId: string;
    signedTransactionInfo?: string; // iOS
    purchaseToken?: string; // Android
  }>;
}

