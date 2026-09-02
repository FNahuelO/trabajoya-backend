-- Indexes to reduce full table scans and Disk IO on Supabase nano instance

-- Job: listings, moderation, cron approval
CREATE INDEX IF NOT EXISTS "Job_empresaId_idx" ON "Job"("empresaId");
CREATE INDEX IF NOT EXISTS "Job_status_moderationStatus_idx" ON "Job"("status", "moderationStatus");
CREATE INDEX IF NOT EXISTS "Job_moderationStatus_paymentStatus_paidAt_idx" ON "Job"("moderationStatus", "paymentStatus", "paidAt");

-- Application: empresa dashboards, postulante history
CREATE INDEX IF NOT EXISTS "Application_jobId_idx" ON "Application"("jobId");
CREATE INDEX IF NOT EXISTS "Application_postulanteId_idx" ON "Application"("postulanteId");
CREATE INDEX IF NOT EXISTS "Application_status_idx" ON "Application"("status");
CREATE INDEX IF NOT EXISTS "Application_jobId_status_idx" ON "Application"("jobId", "status");

-- PushToken: notification campaigns
CREATE INDEX IF NOT EXISTS "PushToken_isActive_userId_idx" ON "PushToken"("isActive", "userId");
