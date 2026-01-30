-- AlterTable
-- Usar IF NOT EXISTS para evitar errores si las columnas ya existen
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Job' AND column_name = 'minSalary') THEN
        ALTER TABLE "Job" ADD COLUMN "minSalary" DOUBLE PRECISION;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Job' AND column_name = 'maxSalary') THEN
        ALTER TABLE "Job" ADD COLUMN "maxSalary" DOUBLE PRECISION;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Job' AND column_name = 'benefits') THEN
        ALTER TABLE "Job" ADD COLUMN "benefits" TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Job' AND column_name = 'company') THEN
        ALTER TABLE "Job" ADD COLUMN "company" TEXT;
    END IF;
END $$;

