-- AlterTable
ALTER TABLE "NotificationCampaignSchedule" ADD COLUMN "maxRuns" INTEGER;
ALTER TABLE "NotificationCampaignSchedule" ADD COLUMN "runsCompleted" INTEGER NOT NULL DEFAULT 0;
