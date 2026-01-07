-- CreateEnum
CREATE TYPE "CatalogType" AS ENUM ('JOB_AREA', 'JOB_TYPE', 'JOB_LEVEL');

-- CreateEnum
CREATE TYPE "CatalogLanguage" AS ENUM ('ES', 'EN', 'PT');

-- CreateTable
CREATE TABLE "Catalog" (
    "id" TEXT NOT NULL,
    "type" "CatalogType" NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogTranslation" (
    "id" TEXT NOT NULL,
    "catalogId" TEXT NOT NULL,
    "lang" "CatalogLanguage" NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "CatalogTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Catalog_type_code_key" ON "Catalog"("type", "code");

-- CreateIndex
CREATE INDEX "Catalog_type_order_idx" ON "Catalog"("type", "order");

-- CreateIndex
CREATE INDEX "Catalog_type_isActive_idx" ON "Catalog"("type", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogTranslation_catalogId_lang_key" ON "CatalogTranslation"("catalogId", "lang");

-- CreateIndex
CREATE INDEX "CatalogTranslation_catalogId_idx" ON "CatalogTranslation"("catalogId");

-- AddForeignKey
ALTER TABLE "CatalogTranslation" ADD CONSTRAINT "CatalogTranslation_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "Catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

