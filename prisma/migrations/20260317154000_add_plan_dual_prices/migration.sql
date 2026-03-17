-- Agrega soporte de doble precio por plan:
-- - priceUsd: usado por PayPal
-- - priceArs: usado por Cobro Inmediato

ALTER TABLE "Plan"
ADD COLUMN IF NOT EXISTS "priceUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "priceArs" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Backfill desde campos legacy:
-- - Si la moneda legacy es USD, copiar a priceUsd
-- - Si la moneda legacy es ARS, copiar a priceArs
UPDATE "Plan"
SET
  "priceUsd" = CASE
    WHEN UPPER(COALESCE("currency", 'USD')) = 'USD' AND COALESCE("priceUsd", 0) = 0
      THEN COALESCE("price", 0)
    ELSE COALESCE("priceUsd", 0)
  END,
  "priceArs" = CASE
    WHEN UPPER(COALESCE("currency", 'USD')) = 'ARS' AND COALESCE("priceArs", 0) = 0
      THEN COALESCE("price", 0)
    ELSE COALESCE("priceArs", 0)
  END;
