-- Migración para agregar campos de moderación a la tabla Job
-- Ejecuta este script en tu base de datos PostgreSQL

-- Crear el enum ModerationStatus si no existe
DO $$ BEGIN
    CREATE TYPE "ModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'AUTO_REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Agregar columnas a la tabla Job si no existen
DO $$ 
BEGIN
    -- Agregar moderationStatus
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='Job' AND column_name='moderationStatus') THEN
        ALTER TABLE "Job" ADD COLUMN "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'PENDING';
    END IF;

    -- Agregar moderationReason
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='Job' AND column_name='moderationReason') THEN
        ALTER TABLE "Job" ADD COLUMN "moderationReason" TEXT;
    END IF;

    -- Agregar moderatedBy
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='Job' AND column_name='moderatedBy') THEN
        ALTER TABLE "Job" ADD COLUMN "moderatedBy" TEXT;
    END IF;

    -- Agregar moderatedAt
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='Job' AND column_name='moderatedAt') THEN
        ALTER TABLE "Job" ADD COLUMN "moderatedAt" TIMESTAMP(3);
    END IF;

    -- Agregar autoRejectionReason
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='Job' AND column_name='autoRejectionReason') THEN
        ALTER TABLE "Job" ADD COLUMN "autoRejectionReason" TEXT;
    END IF;
END $$;

-- Verificar que las columnas se agregaron correctamente
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'Job' 
  AND column_name IN ('moderationStatus', 'moderationReason', 'moderatedBy', 'moderatedAt', 'autoRejectionReason')
ORDER BY column_name;











