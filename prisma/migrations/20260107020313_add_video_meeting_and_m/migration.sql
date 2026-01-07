-- CreateEnum
CREATE TYPE "CallType" AS ENUM ('VOICE', 'VIDEO');

-- CreateEnum
CREATE TYPE "VideoMeetingStatus" AS ENUM ('SCHEDULED', 'ACCEPTED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'MISSED');

-- CreateEnum
CREATE TYPE "MediaAssetType" AS ENUM ('CV', 'AVATAR', 'VIDEO', 'LOGO');

-- CreateEnum
CREATE TYPE "MediaAssetStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "Call" ADD COLUMN     "callType" "CallType" NOT NULL DEFAULT 'VOICE';

-- CreateTable
CREATE TABLE "VideoMeeting" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "invitedUserId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER,
    "status" "VideoMeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "meetingUrl" TEXT,
    "callId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "VideoMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "type" "MediaAssetType" NOT NULL,
    "bucket" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "status" "MediaAssetStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VideoMeeting_createdById_idx" ON "VideoMeeting"("createdById");

-- CreateIndex
CREATE INDEX "VideoMeeting_invitedUserId_idx" ON "VideoMeeting"("invitedUserId");

-- CreateIndex
CREATE INDEX "VideoMeeting_scheduledAt_idx" ON "VideoMeeting"("scheduledAt");

-- CreateIndex
CREATE INDEX "VideoMeeting_status_idx" ON "VideoMeeting"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_key_key" ON "MediaAsset"("key");

-- CreateIndex
CREATE INDEX "MediaAsset_ownerUserId_idx" ON "MediaAsset"("ownerUserId");

-- CreateIndex
CREATE INDEX "MediaAsset_type_idx" ON "MediaAsset"("type");

-- CreateIndex
CREATE INDEX "MediaAsset_status_idx" ON "MediaAsset"("status");

-- CreateIndex
CREATE INDEX "MediaAsset_key_idx" ON "MediaAsset"("key");

-- AddForeignKey
ALTER TABLE "VideoMeeting" ADD CONSTRAINT "VideoMeeting_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoMeeting" ADD CONSTRAINT "VideoMeeting_invitedUserId_fkey" FOREIGN KEY ("invitedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
