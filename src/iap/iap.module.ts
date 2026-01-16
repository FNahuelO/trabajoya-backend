import { Module } from '@nestjs/common';
import { IapController } from './iap.controller';
import { IapService } from './iap.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [IapController],
  providers: [IapService],
  exports: [IapService],
})
export class IapModule {}

