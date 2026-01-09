-- CreateEnum: PaymentMethod
DO $$ BEGIN
    CREATE TYPE "PaymentMethod" AS ENUM ('PAYPAL', 'MERCADOPAGO', 'STRIPE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable: Cambiar paymentMethod de TEXT a PaymentMethod enum
ALTER TABLE "PaymentTransaction" 
  ALTER COLUMN "paymentMethod" TYPE "PaymentMethod" 
  USING "paymentMethod"::"PaymentMethod";

