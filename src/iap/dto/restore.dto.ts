import { IsString, IsNotEmpty, IsEnum, IsObject, IsOptional } from 'class-validator';

export enum RestorePlatform {
  IOS = 'IOS',
  ANDROID = 'ANDROID',
}

export class RestoreDto {
  @IsEnum(RestorePlatform)
  @IsNotEmpty()
  platform: RestorePlatform;

  @IsObject()
  @IsOptional()
  receipts?: any; // Para iOS: array de signedTransactionInfo
}

