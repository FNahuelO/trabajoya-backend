-- Migración: coordenadas para búsqueda por cercanía en empleos
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
