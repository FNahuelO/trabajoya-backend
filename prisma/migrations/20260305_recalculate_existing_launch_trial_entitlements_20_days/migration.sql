-- Recalcular vencimientos de promociones LAUNCH_TRIAL existentes
-- para que usen el nuevo plazo de 20 días desde la publicación.
WITH recalculated AS (
  SELECT
    e."id",
    COALESCE(j."publishedAt", e."createdAt") + INTERVAL '20 days' AS "newExpiresAt"
  FROM "JobPostEntitlement" e
  JOIN "Job" j ON j."id" = e."jobPostId"
  WHERE e."source" = 'PROMO'
    AND e."planKey" = 'LAUNCH_TRIAL'
)
UPDATE "JobPostEntitlement" e
SET
  "expiresAt" = r."newExpiresAt",
  "status" = CASE
    WHEN r."newExpiresAt" > CURRENT_TIMESTAMP THEN 'ACTIVE'::"EntitlementStatus"
    ELSE e."status"
  END,
  "updatedAt" = CURRENT_TIMESTAMP
FROM recalculated r
WHERE e."id" = r."id";

-- Reactivar publicaciones que estaban inactivas por vencimiento
-- y que ahora, con el nuevo cálculo, vuelven a estar vigentes.
UPDATE "Job" j
SET
  "status" = 'active'
FROM "JobPostEntitlement" e
WHERE e."jobPostId" = j."id"
  AND e."source" = 'PROMO'
  AND e."planKey" = 'LAUNCH_TRIAL'
  AND e."status" = 'ACTIVE'
  AND e."expiresAt" > CURRENT_TIMESTAMP
  AND j."status" = 'inactive'
  AND j."moderationStatus" = 'APPROVED';
