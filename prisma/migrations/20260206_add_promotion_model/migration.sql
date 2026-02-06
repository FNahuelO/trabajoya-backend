-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_code_key" ON "Promotion"("code");

-- CreateIndex
CREATE INDEX "Promotion_code_idx" ON "Promotion"("code");

-- CreateIndex
CREATE INDEX "Promotion_isActive_idx" ON "Promotion"("isActive");

-- Insert default promotion (LAUNCH_TRIAL_4D)
INSERT INTO "Promotion" ("id", "code", "title", "description", "durationDays", "isActive", "startAt", "endAt", "metadata", "createdAt", "updatedAt")
VALUES (
    gen_random_uuid(),
    'LAUNCH_TRIAL_4D',
    'Prueba gratis 4 días',
    'Publica tu primer aviso gratis durante 4 días y accede a todos los CVs de los postulantes.',
    4,
    true,
    '2026-01-01T00:00:00.000Z',
    '2026-12-31T23:59:59.000Z',
    '{"icon": "gift", "buttonText": "Activar prueba gratuita"}',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

