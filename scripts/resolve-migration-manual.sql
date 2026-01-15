-- Script SQL para resolver manualmente la migración fallida
-- Ejecutar este script directamente en la base de datos de producción

-- Primero, verificar si la columna phoneCountryCode existe
SELECT EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_name = 'EmpresaProfile'
  AND column_name = 'phoneCountryCode'
) as column_exists;

-- Si la columna existe, marcar la migración como aplicada:
UPDATE "_prisma_migrations"
SET finished_at = NOW(),
    applied_steps_count = 1
WHERE migration_name LIKE '%add_phone_country_code_to_empresa_profile%'
AND finished_at IS NULL;

-- Si la columna NO existe, eliminar la migración del registro:
-- DELETE FROM "_prisma_migrations"
-- WHERE migration_name LIKE '%add_phone_country_code_to_empresa_profile%'
-- AND finished_at IS NULL;

