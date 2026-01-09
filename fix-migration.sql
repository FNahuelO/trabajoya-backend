-- Script para verificar y aplicar migraciones pendientes

-- 1. Verificar si hasAIFeature existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'Plan' AND column_name = 'hasAIFeature'
    ) THEN
        -- Si no existe, agregarla
        ALTER TABLE "Plan" ADD COLUMN "hasAIFeature" BOOLEAN NOT NULL DEFAULT false;
        RAISE NOTICE 'Columna hasAIFeature agregada';
    ELSE
        RAISE NOTICE 'Columna hasAIFeature ya existe';
    END IF;
END $$;

-- 2. Verificar si currency existe y agregarla si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'Plan' AND column_name = 'currency'
    ) THEN
        -- Si no existe, agregarla
        ALTER TABLE "Plan" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD';
        RAISE NOTICE 'Columna currency agregada';
    ELSE
        RAISE NOTICE 'Columna currency ya existe';
    END IF;
END $$;

