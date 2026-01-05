-- AlterEnum
ALTER TYPE "ModerationStatus" ADD VALUE 'PENDING_PAYMENT';

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "isPaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paymentAmount" DOUBLE PRECISION,
ADD COLUMN     "paymentCurrency" TEXT DEFAULT 'USD',
ADD COLUMN     "paymentOrderId" TEXT,
ADD COLUMN     "paymentStatus" TEXT;
