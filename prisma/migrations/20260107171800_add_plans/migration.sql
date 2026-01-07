-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "unlimitedCvs" BOOLEAN NOT NULL DEFAULT true,
    "allowedModifications" INTEGER NOT NULL DEFAULT 0,
    "canModifyCategory" BOOLEAN NOT NULL DEFAULT false,
    "categoryModifications" INTEGER NOT NULL DEFAULT 0,
    "hasFeaturedOption" BOOLEAN NOT NULL DEFAULT false,
    "launchBenefitAvailable" BOOLEAN NOT NULL DEFAULT false,
    "launchBenefitDuration" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Plan_name_key" ON "Plan"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");

-- CreateIndex
CREATE INDEX "Plan_code_idx" ON "Plan"("code");

-- CreateIndex
CREATE INDEX "Plan_isActive_idx" ON "Plan"("isActive");

-- CreateIndex
CREATE INDEX "Plan_order_idx" ON "Plan"("order");

