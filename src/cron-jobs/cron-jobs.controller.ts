import { Controller, Post, UseGuards } from '@nestjs/common';
import { CronJobsService } from './cron-jobs.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('cron-jobs')
@Controller('api/cron-jobs')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class CronJobsController {
  constructor(private readonly cronJobsService: CronJobsService) {}

  @Post('approve-pending-jobs')
  @ApiOperation({
    summary: 'Ejecutar manualmente el job de aprobación automática de publicaciones pendientes',
    description:
      'Aprobar automáticamente publicaciones pendientes que tengan más de 4 días desde el pago. Solo para administradores.',
  })
  async approvePendingJobs() {
    await this.cronJobsService.approvePendingJobsAfter4Days();
    return {
      success: true,
      message: 'Job ejecutado exitosamente',
    };
  }
}

