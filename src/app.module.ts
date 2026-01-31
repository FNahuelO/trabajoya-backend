import { Module } from "@nestjs/common";
import { ConfigModule } from "./config/config.module";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { PostulantesModule } from "./postulantes/postulantes.module";
import { EmpresasModule } from "./empresas/empresas.module";
import { JobsModule } from "./jobs/jobs.module";
import { MessagesModule } from "./messages/messages.module";
import { UploadModule } from "./upload/upload.module";
import { MediaModule } from "./media/media.module";
import { I18nCustomModule } from "./i18n/i18n.module";
import { FavoritesModule } from "./favorites/favorites.module";
import { PublicModule } from "./public/public.module";
import { OptionsModule } from "./options/options.module";
import { CallsModule } from "./calls/calls.module";
import { PaymentsModule } from "./payments/payments.module";
import { ModerationModule } from "./moderation/moderation.module";
import { SubscriptionsModule } from "./subscriptions/subscriptions.module";
import { AdminModule } from "./admin/admin.module";
import { TermsModule } from "./terms/terms.module";
import { CatalogsModule } from "./catalogs/catalogs.module";
import { PlansModule } from "./plans/plans.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PromotionsModule } from "./promotions/promotions.module";
import { IapModule } from "./iap/iap.module";
import { BlockedUsersModule } from "./blocked-users/blocked-users.module";
import { ReportsModule } from "./reports/reports.module";
import { CronJobsModule } from "./cron-jobs/cron-jobs.module";

@Module({
  imports: [
    ConfigModule,
    I18nCustomModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    PostulantesModule,
    EmpresasModule,
    JobsModule,
    MessagesModule,
    UploadModule,
    MediaModule,
    FavoritesModule,
    PublicModule,
    OptionsModule,
    CallsModule,
    PaymentsModule,
    ModerationModule,
    SubscriptionsModule,
    AdminModule,
    TermsModule,
    CatalogsModule,
    PlansModule,
    NotificationsModule,
    PromotionsModule,
    IapModule,
    BlockedUsersModule,
    ReportsModule,
    CronJobsModule,
  ],
})
export class AppModule {}
