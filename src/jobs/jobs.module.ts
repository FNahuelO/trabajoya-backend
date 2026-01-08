import { Module } from '@nestjs/common'
import { JobsService } from './jobs.service'
import { JobsController } from './jobs.controller'
import { JobDescriptionService } from './job-description.service'
import { SubscriptionsModule } from '../subscriptions/subscriptions.module'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from '../prisma/prisma.module'

@Module({ 
  controllers: [JobsController], 
  providers: [JobsService, JobDescriptionService],
  exports: [JobDescriptionService],
  imports: [SubscriptionsModule, ConfigModule, PrismaModule],
})
export class JobsModule {}
