-- Script simple para agregar ADMIN al enum UserType
-- Ejecuta este comando directamente en tu cliente de PostgreSQL

-- Opción 1: Comando directo (si tienes PostgreSQL 9.5+)
-- Si falla, usa la Opción 2
ALTER TYPE "UserType" ADD VALUE 'ADMIN';

-- Opción 2: Si el comando anterior falla, usa este bloque:
/*
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'UserType' 
        AND e.enumlabel = 'ADMIN'
    ) THEN
        ALTER TYPE "UserType" ADD VALUE 'ADMIN';
    END IF;
END $$;
*/

