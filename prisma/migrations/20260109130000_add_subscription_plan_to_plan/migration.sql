-- AlterTable
ALTER TABLE "Plan" ADD COLUMN "subscriptionPlan" "SubscriptionPlan" NOT NULL DEFAULT 'PREMIUM';

-- CreateIndex
CREATE INDEX "Plan_subscriptionPlan_idx" ON "Plan"("subscriptionPlan");

