-- AlterTable: Agregar campo schedule a Job
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Job' AND column_name = 'schedule') THEN
        ALTER TABLE "Job" ADD COLUMN "schedule" TEXT;
    END IF;
END $$;

-- AlterEnum: Agregar JOB_SCHEDULES al enum CatalogType
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'JOB_SCHEDULES' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'CatalogType')) THEN
        ALTER TYPE "CatalogType" ADD VALUE 'JOB_SCHEDULES';
    END IF;
END $$;

