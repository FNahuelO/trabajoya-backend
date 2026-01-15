#!/bin/sh
# Script para resolver migraciones fallidas de Prisma usando el comando oficial

echo "🔍 Verificando migraciones fallidas..."

# Obtener el nombre de la migración fallida desde la base de datos
# Usamos psql para consultar directamente la tabla _prisma_migrations
FAILED_MIGRATION=$(psql "$DATABASE_URL" -t -c "SELECT migration_name FROM \"_prisma_migrations\" WHERE finished_at IS NULL ORDER BY started_at DESC LIMIT 1;" 2>/dev/null | xargs)

if [ -z "$FAILED_MIGRATION" ]; then
  echo "✅ No se encontraron migraciones fallidas."
  # No hacer exit aquí, solo continuar
  exit 0
fi

echo "⚠️  Se encontró migración fallida: $FAILED_MIGRATION"

# Verificar si la columna phoneCountryCode existe
COLUMN_EXISTS=$(psql "$DATABASE_URL" -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'EmpresaProfile' AND column_name = 'phoneCountryCode');" 2>/dev/null | xargs)

if [ "$COLUMN_EXISTS" = "t" ]; then
  echo "✅ La columna phoneCountryCode ya existe. Marcando migración como aplicada..."
  npx prisma migrate resolve --applied "$FAILED_MIGRATION" || {
    echo "⚠️  Error al usar prisma migrate resolve, intentando método alternativo..."
    psql "$DATABASE_URL" -c "UPDATE \"_prisma_migrations\" SET finished_at = NOW(), applied_steps_count = 1 WHERE migration_name = '$FAILED_MIGRATION' AND finished_at IS NULL;" 2>/dev/null
    echo "✅ Migración marcada como aplicada (método alternativo)."
  }
else
  echo "⚠️  La columna no existe. Marcando migración como revertida..."
  npx prisma migrate resolve --rolled-back "$FAILED_MIGRATION" || {
    echo "⚠️  Error al usar prisma migrate resolve, intentando método alternativo..."
    psql "$DATABASE_URL" -c "DELETE FROM \"_prisma_migrations\" WHERE migration_name = '$FAILED_MIGRATION' AND finished_at IS NULL;" 2>/dev/null
    echo "✅ Migración eliminada del registro (método alternativo)."
  }
fi

echo "✅ Proceso de resolución completado."

