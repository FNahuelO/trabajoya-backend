# Resolver Migraciones Fallidas en Producción

## Problema
La base de datos de producción tiene una migración fallida (`20250115000000_add_has_ai_feature_to_plans`) que impide aplicar nuevas migraciones.

## Solución

### Opción 1: Resolver la migración fallida (Recomendado si hay datos)

1. Conectarse al contenedor de producción:
```bash
docker exec -it trabajoya-prod-backend sh
```

2. Resolver la migración fallida:
```bash
npx prisma migrate resolve --rolled-back 20250115000000_add_has_ai_feature_to_plans
```

3. Verificar el estado:
```bash
npx prisma migrate status
```

4. Aplicar las nuevas migraciones:
```bash
npx prisma migrate deploy
```

### Opción 2: Limpiar todas las migraciones (Solo si la BD está vacía)

**⚠️ SOLO usar esta opción si la base de datos está completamente vacía o no te importa perder los datos**

1. Conectarse al contenedor de producción:
```bash
docker exec -it trabajoya-prod-backend sh
```

2. Conectarse a la base de datos y limpiar la tabla de migraciones:
```bash
# Obtener DATABASE_URL del contenedor
echo $DATABASE_URL

# O usar psql directamente (ajusta los parámetros según tu configuración)
psql "$DATABASE_URL" -c "DELETE FROM \"_prisma_migrations\";"
```

3. Aplicar la nueva migración inicial:
```bash
npx prisma migrate deploy
```

### Opción 3: Usar script SQL

Si prefieres usar el script SQL proporcionado:

1. Copiar el script al contenedor:
```bash
docker cp scripts/clean-migrations.sql trabajoya-prod-backend:/app/clean-migrations.sql
```

2. Ejecutar el script:
```bash
docker exec -it trabajoya-prod-backend sh -c "psql \$DATABASE_URL -f /app/clean-migrations.sql"
```

3. Aplicar migraciones:
```bash
docker exec -it trabajoya-prod-backend npx prisma migrate deploy
```

## Verificación

Después de resolver las migraciones, verifica que todo esté correcto:

```bash
docker exec -it trabajoya-prod-backend npx prisma migrate status
```

Deberías ver que la nueva migración inicial (`20260110161211_init`) está aplicada.

## Nota Importante

Después de resolver el problema, la próxima vez que se despliegue la nueva imagen Docker, solo contendrá la migración inicial unificada (`20260110161211_init`), que incluye todo el schema completo desde cero.

