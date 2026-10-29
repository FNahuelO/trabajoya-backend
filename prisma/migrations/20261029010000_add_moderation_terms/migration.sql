-- CreateEnum
CREATE TYPE "ModerationTermCategory" AS ENUM ('SCAM', 'EXPLOITATION', 'DISCRIMINATION', 'OFFENSIVE', 'INAPPROPRIATE');

-- CreateTable
CREATE TABLE "ModerationTerm" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "category" "ModerationTermCategory" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationTerm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ModerationTerm_term_key" ON "ModerationTerm"("term");

-- CreateIndex
CREATE INDEX "ModerationTerm_active_idx" ON "ModerationTerm"("active");

-- Términos iniciales
INSERT INTO "ModerationTerm" ("id", "term", "category")
SELECT gen_random_uuid()::text, t.term, t.category::"ModerationTermCategory"
FROM (VALUES
    ('dinero fácil', 'SCAM'),
    ('gana dinero rápido', 'SCAM'),
    ('inversión inicial', 'SCAM'),
    ('multinivel', 'SCAM'),
    ('piramidal', 'SCAM'),
    ('ganancias garantizadas', 'SCAM'),
    ('mlm', 'SCAM'),
    ('ganar dinero sin trabajar', 'SCAM'),
    ('negocio propio sin inversión', 'SCAM'),
    ('ingresos pasivos fáciles', 'SCAM'),
    ('hazte rico', 'SCAM'),
    ('sin pago', 'EXPLOITATION'),
    ('trabajo gratis', 'EXPLOITATION'),
    ('sin sueldo', 'EXPLOITATION'),
    ('trabajo voluntario obligatorio', 'EXPLOITATION'),
    ('trabajo sin remuneración', 'EXPLOITATION'),
    ('pago en especie', 'EXPLOITATION'),
    ('trabajo informal', 'EXPLOITATION'),
    ('sin contrato', 'EXPLOITATION'),
    ('estado civil', 'DISCRIMINATION'),
    ('tonto', 'OFFENSIVE'),
    ('inútil', 'OFFENSIVE'),
    ('solo hombres', 'DISCRIMINATION'),
    ('solo mujeres', 'DISCRIMINATION'),
    ('edad máxima', 'DISCRIMINATION'),
    ('solo jóvenes', 'DISCRIMINATION'),
    ('no mayores de', 'DISCRIMINATION'),
    ('preferentemente hombres', 'DISCRIMINATION'),
    ('preferentemente mujeres', 'DISCRIMINATION'),
    ('buena presencia', 'DISCRIMINATION'),
    ('físico agradable', 'DISCRIMINATION'),
    ('sin hijos', 'DISCRIMINATION'),
    ('soltera', 'DISCRIMINATION'),
    ('soltero', 'DISCRIMINATION'),
    ('idiota', 'OFFENSIVE'),
    ('imbécil', 'OFFENSIVE'),
    ('estúpido', 'OFFENSIVE'),
    ('retrasado', 'OFFENSIVE'),
    ('pendejo', 'OFFENSIVE'),
    ('hijo de puta', 'OFFENSIVE'),
    ('mierda', 'OFFENSIVE'),
    ('carajo', 'OFFENSIVE'),
    ('envía dinero', 'INAPPROPRIATE'),
    ('modelo webcam', 'INAPPROPRIATE'),
    ('trabajo sexual', 'INAPPROPRIATE'),
    ('acompañante vip', 'INAPPROPRIATE'),
    ('dama de compañía', 'INAPPROPRIATE'),
    ('masajista sensual', 'INAPPROPRIATE'),
    ('servicios para adultos', 'INAPPROPRIATE'),
    ('entretenimiento adulto', 'INAPPROPRIATE'),
    ('contenido adulto', 'INAPPROPRIATE')
) AS t(term, category)
ON CONFLICT ("term") DO NOTHING;
