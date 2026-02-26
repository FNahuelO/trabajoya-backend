UPDATE "Promotion"
SET
  "startAt" = '2026-03-01T00:00:00.000Z',
  "endAt" = '2026-03-31T23:59:59.000Z',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'LAUNCH_TRIAL_4D';
