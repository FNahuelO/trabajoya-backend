-- Script para limpiar migraciones fallidas en producción
-- Ejecutar este script SOLO si estás seguro de que quieres resetear el estado de migraciones
-- 
-- USO:
-- 1. Conectarse a la base de datos de producción
-- 2. Ejecutar: psql -h HOST -U USER -d trabajoya -f clean-migrations.sql
-- O desde dentro del contenedor Docker:
--    docker exec -it trabajoya-prod-backend psql $DATABASE_URL -f /app/scripts/clean-migrations.sql

-- Eliminar el registro de la migración fallida
DELETE FROM "_prisma_migrations" 
WHERE migration_name = '20250115000000_add_has_ai_feature_to_plans' 
  AND finished_at IS NULL;

-- Si necesitas limpiar TODAS las migraciones (solo si la BD está vacía):
-- DELETE FROM "_prisma_migrations";

-- Verificar estado
SELECT migration_name, started_at, finished_at, applied_steps_count 
FROM "_prisma_migrations" 
ORDER BY started_at DESC;

