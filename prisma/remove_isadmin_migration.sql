-- Migración para eliminar el campo isAdmin y usar userType = 'ADMIN' en su lugar
-- Ejecutar este script manualmente en la base de datos

-- 1. Agregar 'ADMIN' al enum UserType
-- Este bloque verifica si existe antes de agregarlo
DO $$ 
BEGIN
    -- Verificar si 'ADMIN' ya existe en el enum UserType
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'UserType' 
        AND e.enumlabel = 'ADMIN'
    ) THEN
        -- Agregar 'ADMIN' al enum
        ALTER TYPE "UserType" ADD VALUE 'ADMIN';
        RAISE NOTICE 'Valor ADMIN agregado al enum UserType';
    ELSE
        RAISE NOTICE 'El valor ADMIN ya existe en el enum UserType';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Si hay algún error, mostrar el mensaje pero continuar
        RAISE NOTICE 'Error al agregar ADMIN al enum: %', SQLERRM;
END $$;

-- 2. Actualizar usuarios existentes que tienen isAdmin = true
-- Solo si la columna isAdmin existe
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'User' 
        AND column_name = 'isAdmin'
    ) THEN
        UPDATE "User" SET "userType" = 'ADMIN' WHERE "isAdmin" = true;
        RAISE NOTICE 'Usuarios actualizados a userType = ADMIN';
    ELSE
        RAISE NOTICE 'La columna isAdmin no existe, saltando actualización';
    END IF;
END $$;

-- 3. Eliminar el índice si existe
DROP INDEX IF EXISTS "User_isAdmin_idx";

-- 4. Eliminar el campo isAdmin si existe
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'User' 
        AND column_name = 'isAdmin'
    ) THEN
        ALTER TABLE "User" DROP COLUMN "isAdmin";
        RAISE NOTICE 'Columna isAdmin eliminada';
    ELSE
        RAISE NOTICE 'La columna isAdmin no existe';
    END IF;
END $$;
