-- Add dedicated column for free publications per promotion
ALTER TABLE "Promotion"
ADD COLUMN "freePublications" INTEGER NOT NULL DEFAULT 2;

-- Keep launch trial aligned with requested behavior
UPDATE "Promotion"
SET "freePublications" = 2
WHERE "code" = 'LAUNCH_TRIAL_4D';
