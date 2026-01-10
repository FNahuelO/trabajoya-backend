-- Script para limpiar completamente la base de datos
-- ⚠️ ADVERTENCIA: Esto eliminará TODAS las tablas, tipos, índices, etc.
-- ⚠️ Solo usar si estás seguro de que no hay datos importantes

-- Eliminar todas las foreign keys primero
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') 
    LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END $$;

-- Eliminar todos los tipos enum
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT typname FROM pg_type WHERE typtype = 'e' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public'))
    LOOP
        EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
    END LOOP;
END $$;

-- Eliminar todas las secuencias
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public')
    LOOP
        EXECUTE 'DROP SEQUENCE IF EXISTS public.' || quote_ident(r.sequence_name) || ' CASCADE';
    END LOOP;
END $$;

-- Eliminar tabla de migraciones de Prisma (opcional, solo si quieres empezar desde cero)
-- DELETE FROM "_prisma_migrations";

