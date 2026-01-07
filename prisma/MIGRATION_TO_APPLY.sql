-- Migración para agregar tablas VideoMeeting y MediaAsset faltantes
-- Ejecutar este SQL manualmente si las migraciones automáticas no funcionan

-- CreateEnum: CallType (si no existe)
DO $$ BEGIN
    CREATE TYPE "CallType" AS ENUM ('VOICE', 'VIDEO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: VideoMeetingStatus (si no existe)
DO $$ BEGIN
    CREATE TYPE "VideoMeetingStatus" AS ENUM ('SCHEDULED', 'ACCEPTED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'MISSED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: MediaAssetType (si no existe)
DO $$ BEGIN
    CREATE TYPE "MediaAssetType" AS ENUM ('CV', 'AVATAR', 'VIDEO', 'LOGO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: MediaAssetStatus (si no existe)
DO $$ BEGIN
    CREATE TYPE "MediaAssetStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable: Agregar campo callType a la tabla Call existente
ALTER TABLE "Call" ADD COLUMN IF NOT EXISTS "callType" "CallType" NOT NULL DEFAULT 'VOICE';

-- CreateTable: VideoMeeting
CREATE TABLE IF NOT EXISTS "VideoMeeting" (
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

-- CreateTable: MediaAsset
CREATE TABLE IF NOT EXISTS "MediaAsset" (
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

-- CreateIndex (con IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS "VideoMeeting_createdById_idx" ON "VideoMeeting"("createdById");
CREATE INDEX IF NOT EXISTS "VideoMeeting_invitedUserId_idx" ON "VideoMeeting"("invitedUserId");
CREATE INDEX IF NOT EXISTS "VideoMeeting_scheduledAt_idx" ON "VideoMeeting"("scheduledAt");
CREATE INDEX IF NOT EXISTS "VideoMeeting_status_idx" ON "VideoMeeting"("status");

CREATE INDEX IF NOT EXISTS "MediaAsset_ownerUserId_idx" ON "MediaAsset"("ownerUserId");
CREATE INDEX IF NOT EXISTS "MediaAsset_type_idx" ON "MediaAsset"("type");
CREATE INDEX IF NOT EXISTS "MediaAsset_status_idx" ON "MediaAsset"("status");
CREATE INDEX IF NOT EXISTS "MediaAsset_key_idx" ON "MediaAsset"("key");

-- CreateUniqueIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MediaAsset_key_key" ON "MediaAsset"("key");

-- AddForeignKey (verificar si ya existen)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'VideoMeeting_createdById_fkey'
    ) THEN
        ALTER TABLE "VideoMeeting" ADD CONSTRAINT "VideoMeeting_createdById_fkey" 
            FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'VideoMeeting_invitedUserId_fkey'
    ) THEN
        ALTER TABLE "VideoMeeting" ADD CONSTRAINT "VideoMeeting_invitedUserId_fkey" 
            FOREIGN KEY ("invitedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'MediaAsset_ownerUserId_fkey'
    ) THEN
        ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_ownerUserId_fkey" 
            FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

