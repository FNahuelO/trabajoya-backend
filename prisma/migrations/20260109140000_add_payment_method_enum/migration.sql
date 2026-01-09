-- CreateEnum: PaymentMethod
DO $$ BEGIN
    CREATE TYPE "PaymentMethod" AS ENUM ('PAYPAL', 'MERCADOPAGO', 'STRIPE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable: Cambiar paymentMethod de TEXT a PaymentMethod enum
-- Primero asegurarse de que todos los valores sean válidos
UPDATE "PaymentTransaction" 
SET "paymentMethod" = 'PAYPAL' 
WHERE "paymentMethod" NOT IN ('PAYPAL', 'MERCADOPAGO', 'STRIPE');

-- Eliminar el valor por defecto temporalmente
ALTER TABLE "PaymentTransaction" 
  ALTER COLUMN "paymentMethod" DROP DEFAULT;

-- Cambiar el tipo de la columna
ALTER TABLE "PaymentTransaction" 
  ALTER COLUMN "paymentMethod" TYPE "PaymentMethod" 
  USING CASE 
    WHEN "paymentMethod"::text = 'PAYPAL' THEN 'PAYPAL'::"PaymentMethod"
    WHEN "paymentMethod"::text = 'MERCADOPAGO' THEN 'MERCADOPAGO'::"PaymentMethod"
    WHEN "paymentMethod"::text = 'STRIPE' THEN 'STRIPE'::"PaymentMethod"
    ELSE 'PAYPAL'::"PaymentMethod"
  END;

-- Restaurar el valor por defecto con el tipo correcto
ALTER TABLE "PaymentTransaction" 
  ALTER COLUMN "paymentMethod" SET DEFAULT 'PAYPAL'::"PaymentMethod";

