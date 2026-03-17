-- Persistir el link de Cobro Inmediato para pagos pendientes.
ALTER TABLE "Job"
ADD COLUMN IF NOT EXISTS "coinPaymentLinkUrl" TEXT;
