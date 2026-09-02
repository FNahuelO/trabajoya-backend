import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationCampaignsService } from '../notifications/notification-campaigns.service';
import { CRON_LOCK_IDS, withCronLock } from './cron-lock.util';

@Injectable()
export class CronJobsService {
  private readonly logger = new Logger(CronJobsService.name);

  constructor(
    private prisma: PrismaService,
    private notificationCampaignsService: NotificationCampaignsService,
  ) {}

  /**
   * Job que se ejecuta diariamente a las 2:00 AM
   * Aprobar automáticamente publicaciones pendientes que tengan más de 4 días
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async approvePendingJobsAfter4Days() {
    await withCronLock(
      this.prisma,
      CRON_LOCK_IDS.APPROVE_PENDING_JOBS,
      async () => {
        this.logger.log('Iniciando job: Aprobar publicaciones pendientes después de 4 días');

        try {
          const fourDaysAgo = new Date();
          fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);

          const jobsToApprove = await this.prisma.job.findMany({
            where: {
              moderationStatus: 'PENDING',
              paymentStatus: 'PAID',
              isPaid: true,
              paidAt: {
                lte: fourDaysAgo,
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
      },
    );
  }

  /**
   * Job que se ejecuta cada hora
   * Expirar entitlements vencidos y desactivar las publicaciones asociadas
   */
  @Cron(CronExpression.EVERY_HOUR)
  async expireEntitlementsAndDeactivateJobs() {
    await withCronLock(
      this.prisma,
      CRON_LOCK_IDS.EXPIRE_ENTITLEMENTS,
      async () => {
        this.logger.log('Iniciando job: Expirar entitlements vencidos y desactivar publicaciones');

        try {
          const now = new Date();

          const expiredEntitlements = await this.prisma.jobPostEntitlement.findMany({
            where: {
              status: 'ACTIVE',
              expiresAt: {
                lte: now,
              },
            },
            select: {
              id: true,
              jobPostId: true,
              planKey: true,
              expiresAt: true,
              job: {
                select: {
                  id: true,
                  title: true,
                  status: true,
                },
              },
            },
          });

          if (expiredEntitlements.length === 0) {
            this.logger.log('No hay entitlements expirados para procesar');
            return;
          }

          this.logger.log(
            `Encontrados ${expiredEntitlements.length} entitlements expirados para procesar`,
          );

          const entitlementIds = expiredEntitlements.map((ent) => ent.id);
          const entitlementResult = await this.prisma.jobPostEntitlement.updateMany({
            where: {
              id: {
                in: entitlementIds,
              },
            },
            data: {
              status: 'EXPIRED',
            },
          });

          this.logger.log(
            `✅ ${entitlementResult.count} entitlements marcados como EXPIRED`,
          );

          const jobIdsToDeactivate = expiredEntitlements
            .filter((ent) => ent.job.status === 'active')
            .map((ent) => ent.jobPostId);

          if (jobIdsToDeactivate.length > 0) {
            const jobResult = await this.prisma.job.updateMany({
              where: {
                id: {
                  in: jobIdsToDeactivate,
                },
              },
              data: {
                status: 'inactive',
              },
            });

            this.logger.log(
              `✅ ${jobResult.count} publicaciones desactivadas por expiración de plan`,
            );
          }

          expiredEntitlements.forEach((ent) => {
            this.logger.log(
              `  - Entitlement "${ent.planKey}" (ID: ${ent.id}) expirado. ` +
              `Job: "${ent.job.title}" (ID: ${ent.jobPostId}). ` +
              `Expiró el: ${ent.expiresAt.toISOString()}. ` +
              `Estado del job: ${ent.job.status} → ${ent.job.status === 'active' ? 'inactive' : ent.job.status} (sin cambio)`,
            );
          });
        } catch (error: any) {
          this.logger.error(
            `❌ Error al expirar entitlements y desactivar publicaciones: ${error?.message}`,
            error?.stack,
          );
        }
      },
    );
  }

  /**
   * Job que se ejecuta cada 5 minutos
   * Procesa campañas de notificaciones programadas o recurrentes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async processScheduledNotificationCampaigns() {
    await withCronLock(
      this.prisma,
      CRON_LOCK_IDS.NOTIFICATION_CAMPAIGNS,
      async () => {
        try {
          const result = await this.notificationCampaignsService.processDueSchedules();

          if (result.processed > 0) {
            this.logger.log(
              `✅ ${result.processed} campaña(s) programada(s) procesada(s)`,
            );
          }
        } catch (error: any) {
          this.logger.error(
            `❌ Error al procesar campañas programadas: ${error?.message}`,
            error?.stack,
          );
        }
      },
    );
  }
}
