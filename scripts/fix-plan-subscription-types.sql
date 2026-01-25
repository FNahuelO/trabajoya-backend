-- Script para actualizar los planes existentes con el subscriptionPlan correcto
-- Ejecutar este script en la base de datos para corregir los planes que tienen PREMIUM por defecto

-- Actualizar plan URGENT
UPDATE "Plan"
SET "subscriptionPlan" = 'URGENT'
WHERE code = 'URGENT';

-- Actualizar plan STANDARD
UPDATE "Plan"
SET "subscriptionPlan" = 'STANDARD'
WHERE code = 'STANDARD';

-- Actualizar plan PREMIUM
UPDATE "Plan"
SET "subscriptionPlan" = 'PREMIUM'
WHERE code = 'PREMIUM';

-- Actualizar plan CRYSTAL
UPDATE "Plan"
SET "subscriptionPlan" = 'CRYSTAL'
WHERE code = 'CRYSTAL';

-- Verificar los resultados
SELECT code, name, "subscriptionPlan" FROM "Plan" ORDER BY code;

