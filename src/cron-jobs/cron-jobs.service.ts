import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CronJobsService {
  private readonly logger = new Logger(CronJobsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Job que se ejecuta diariamente a las 2:00 AM
   * Aprobar automáticamente publicaciones pendientes que tengan más de 4 días
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async approvePendingJobsAfter4Days() {
    this.logger.log('Iniciando job: Aprobar publicaciones pendientes después de 4 días');

    try {
      // Calcular la fecha límite (4 días atrás)
      const fourDaysAgo = new Date();
      fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);

      // Buscar jobs que:
      // 1. Estén pendientes de moderación (PENDING)
      // 2. Tengan pago completado (PAID)
      // 3. Fueron pagados hace más de 4 días
      const jobsToApprove = await this.prisma.job.findMany({
        where: {
          moderationStatus: 'PENDING',
          paymentStatus: 'PAID',
          isPaid: true,
          paidAt: {
            lte: fourDaysAgo, // Pagado hace 4 días o más
          },
        },
        select: {
          id: true,
          title: true,
          paidAt: true,
        },
      });

      if (jobsToApprove.length === 0) {
        this.logger.log('No hay publicaciones pendientes que cumplan los criterios para aprobación automática');
        return;
      }

      this.logger.log(`Encontradas ${jobsToApprove.length} publicaciones para aprobar automáticamente`);

      // Actualizar todas las publicaciones encontradas
      const result = await this.prisma.job.updateMany({
        where: {
          id: {
            in: jobsToApprove.map((job) => job.id),
          },
        },
        data: {
          moderationStatus: 'APPROVED',
          moderatedAt: new Date(),
        },
      });

      this.logger.log(
        `✅ Aprobadas automáticamente ${result.count} publicaciones pendientes después de 4 días`,
      );

      // Log detallado de cada publicación aprobada
      jobsToApprove.forEach((job) => {
        this.logger.log(
          `  - Publicación "${job.title}" (ID: ${job.id}) aprobada automáticamente. Pagada el: ${job.paidAt?.toISOString()}`,
        );
      });
    } catch (error: any) {
      this.logger.error(
        `❌ Error al aprobar publicaciones pendientes automáticamente: ${error?.message}`,
        error?.stack,
      );
    }
  }
}

