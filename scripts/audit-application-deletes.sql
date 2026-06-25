-- ============================================================
-- AUDITORÍA DE BORRADO DE POSTULACIONES (Application)
-- ============================================================
-- Objetivo: detectar QUÉ está borrando filas de "Application",
-- incluso cuando el borrado ocurre por CASCADA (al borrar un Job
-- o un usuario) o directamente en la base (Supabase / psql / DBeaver).
--
-- El monitoreo del código NestJS NO ve estos casos. Este trigger sí.
--
-- Cómo usarlo:
--   1) Ejecutar este script UNA vez en la base de PRODUCCIÓN.
--   2) Esperar a que vuelva a ocurrir el borrado.
--   3) Consultar la tabla application_delete_audit (ver al final).
-- ============================================================

-- 1) Tabla donde se registran los borrados
CREATE TABLE IF NOT EXISTS application_delete_audit (
  audit_id         bigserial PRIMARY KEY,
  deleted_at       timestamptz NOT NULL DEFAULT now(),
  application_id   text,
  postulante_id    text,
  job_id           text,
  applied_at       timestamptz,
  db_user          text,        -- usuario de Postgres que ejecutó el borrado
  application_name text,        -- nombre de la app/conexión (Prisma, DBeaver, etc.)
  client_addr      inet,        -- IP de origen de la conexión
  top_query        text         -- consulta SQL que disparó el borrado (clave para cascadas)
);

-- 2) Función que se ejecuta por cada fila borrada
CREATE OR REPLACE FUNCTION log_application_delete() RETURNS trigger AS $$
BEGIN
  INSERT INTO application_delete_audit(
    application_id, postulante_id, job_id, applied_at,
    db_user, application_name, client_addr, top_query
  ) VALUES (
    OLD.id, OLD."postulanteId", OLD."jobId", OLD."appliedAt",
    current_user,
    current_setting('application_name', true),
    inet_client_addr(),
    current_query()
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 3) Trigger BEFORE DELETE (captura también borrados por cascada)
DROP TRIGGER IF EXISTS trg_log_application_delete ON "Application";
CREATE TRIGGER trg_log_application_delete
  BEFORE DELETE ON "Application"
  FOR EACH ROW EXECUTE FUNCTION log_application_delete();

-- ============================================================
-- CONSULTAS DE DIAGNÓSTICO (correr cuando vuelva a pasar)
-- ============================================================

-- A) Ver los últimos borrados registrados
-- SELECT * FROM application_delete_audit ORDER BY deleted_at DESC LIMIT 200;

-- B) Resumen: cuántos borrados, por usuario/app y qué query los originó
-- SELECT date_trunc('minute', deleted_at) AS minuto,
--        db_user, application_name, client_addr,
--        left(top_query, 200) AS query,
--        count(*) AS filas
-- FROM application_delete_audit
-- GROUP BY 1,2,3,4,5
-- ORDER BY 1 DESC;

-- ============================================================
-- DIAGNÓSTICO RÁPIDO DEL ESTADO ACTUAL (no requiere el trigger)
-- ============================================================

-- C) Distribución de postulaciones por día (¿de verdad solo hay del 18?)
-- SELECT date_trunc('day', "appliedAt") AS dia, count(*)
-- FROM "Application" GROUP BY 1 ORDER BY 1;

-- D) ¿Hay postulaciones posteriores al 18 de junio?
-- SELECT count(*) FROM "Application" WHERE "appliedAt" > '2026-06-19';

-- E) Para desactivar la auditoría más adelante:
-- DROP TRIGGER IF EXISTS trg_log_application_delete ON "Application";
-- DROP FUNCTION IF EXISTS log_application_delete();
-- DROP TABLE IF EXISTS application_delete_audit;
