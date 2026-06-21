-- CreateEnum
CREATE TYPE "NotificationCampaignScheduleType" AS ENUM ('ONCE', 'RECURRING');

-- CreateEnum
CREATE TYPE "NotificationCampaignScheduleStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateTable
CREATE TABLE "NotificationCampaignSchedule" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "targetAudience" "NotificationCampaignTarget" NOT NULL DEFAULT 'ALL',
    "targetUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scheduleType" "NotificationCampaignScheduleType" NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "recurrenceDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "recurrenceTime" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    "status" "NotificationCampaignScheduleStatus" NOT NULL DEFAULT 'ACTIVE',
    "nextRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "lastCampaignId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationCampaignSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationCampaignSchedule_status_nextRunAt_idx" ON "NotificationCampaignSchedule"("status", "nextRunAt");

-- CreateIndex
CREATE INDEX "NotificationCampaignSchedule_createdAt_idx" ON "NotificationCampaignSchedule"("createdAt");
