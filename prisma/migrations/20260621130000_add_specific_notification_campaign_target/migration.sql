-- AlterEnum
ALTER TYPE "NotificationCampaignTarget" ADD VALUE 'SPECIFIC';

-- AlterTable
ALTER TABLE "NotificationCampaign" ADD COLUMN "targetUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
