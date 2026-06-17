import { Global, Module } from '@nestjs/common'
import { ConfigModule as NestConfig } from '@nestjs/config'
import { ConfigService } from './config.service'
import { GcpConfigService } from './gcp-config.service'

@Global()
@Module({
  imports: [NestConfig.forRoot({ isGlobal: true })],
  providers: [
    ConfigService, 
    GcpConfigService
  ],
  exports: [ConfigService, GcpConfigService]
})
export class ConfigModule {}
