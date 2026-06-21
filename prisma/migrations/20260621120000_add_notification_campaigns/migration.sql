-- CreateEnum
CREATE TYPE "NotificationCampaignTarget" AS ENUM ('ALL', 'POSTULANTE', 'EMPRESA');

-- CreateEnum
CREATE TYPE "NotificationCampaignStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "NotificationCampaign" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "targetAudience" "NotificationCampaignTarget" NOT NULL DEFAULT 'ALL',
    "status" "NotificationCampaignStatus" NOT NULL DEFAULT 'PENDING',
    "sentByUserId" TEXT,
    "tokensTargeted" INTEGER NOT NULL DEFAULT 0,
    "uniqueUsers" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "NotificationCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationCampaign_createdAt_idx" ON "NotificationCampaign"("createdAt");

-- CreateIndex
CREATE INDEX "NotificationCampaign_status_idx" ON "NotificationCampaign"("status");
