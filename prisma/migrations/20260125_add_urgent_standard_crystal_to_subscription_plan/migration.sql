-- AlterEnum
-- Agregar nuevos valores al enum SubscriptionPlan
-- Nota: ALTER TYPE ... ADD VALUE no puede ejecutarse en una transacción en PostgreSQL
-- Por lo tanto, cada comando debe ejecutarse por separado

-- Agregar URGENT si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'URGENT' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'SubscriptionPlan')
    ) THEN
        ALTER TYPE "SubscriptionPlan" ADD VALUE 'URGENT';
    END IF;
END $$;

-- Agregar STANDARD si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'STANDARD' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'SubscriptionPlan')
    ) THEN
        ALTER TYPE "SubscriptionPlan" ADD VALUE 'STANDARD';
    END IF;
END $$;

-- Agregar CRYSTAL si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'CRYSTAL' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'SubscriptionPlan')
    ) THEN
        ALTER TYPE "SubscriptionPlan" ADD VALUE 'CRYSTAL';
    END IF;
END $$;

