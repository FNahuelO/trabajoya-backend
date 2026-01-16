-- Script para agregar la tabla UserPromotion a la base de datos
-- Ejecutar este script en la base de datos de producción si la tabla no existe

-- Verificar y crear el enum PromotionStatus si no existe
DO $$ BEGIN
    CREATE TYPE "PromotionStatus" AS ENUM ('AVAILABLE', 'CLAIMED', 'USED', 'EXPIRED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Crear la tabla UserPromotion si no existe
CREATE TABLE IF NOT EXISTS "UserPromotion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "promoKey" TEXT NOT NULL,
    "status" "PromotionStatus" NOT NULL DEFAULT 'AVAILABLE',
    "claimedAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPromotion_pkey" PRIMARY KEY ("id")
);

-- Crear índices únicos si no existen
CREATE UNIQUE INDEX IF NOT EXISTS "UserPromotion_userId_promoKey_key" ON "UserPromotion"("userId", "promoKey");

-- Crear índices si no existen
CREATE INDEX IF NOT EXISTS "UserPromotion_userId_idx" ON "UserPromotion"("userId");
CREATE INDEX IF NOT EXISTS "UserPromotion_promoKey_idx" ON "UserPromotion"("promoKey");
CREATE INDEX IF NOT EXISTS "UserPromotion_status_idx" ON "UserPromotion"("status");

-- Agregar foreign key si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'UserPromotion_userId_fkey'
    ) THEN
        ALTER TABLE "UserPromotion" 
        ADD CONSTRAINT "UserPromotion_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

