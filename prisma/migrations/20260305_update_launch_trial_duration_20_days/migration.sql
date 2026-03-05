UPDATE "Promotion"
SET
  "title" = 'Prueba gratis 20 días',
  "description" = 'Publica tu primer aviso gratis durante 20 días y accede a todos los CVs de los postulantes.',
  "durationDays" = 20,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'LAUNCH_TRIAL_4D';
