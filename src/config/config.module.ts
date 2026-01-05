import { Module } from '@nestjs/common'
import { ConfigModule as NestConfig } from '@nestjs/config'
import { ConfigService } from './config.service'
import { AwsConfigService } from './aws-config.service'

@Module({
  imports: [NestConfig.forRoot({ isGlobal: true })],
  providers: [ConfigService, AwsConfigService],
  exports: [ConfigService, AwsConfigService]
})
export class ConfigModule {}
