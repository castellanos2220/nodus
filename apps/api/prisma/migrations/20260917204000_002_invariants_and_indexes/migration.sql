-- ============================================================================
-- 002 — Invariantes de negocio que deben vivir en la base de datos, e índices
--       que Prisma no puede expresar de forma declarativa.
--
-- El brief exige explícitamente (§17): "Debe existir un único CONSULTOR
-- RESPONSABLE PRINCIPAL. La base de datos debe proteger esa regla." Un check en
-- el servicio no basta: dos peticiones concurrentes pueden pasarlo a la vez.
-- ============================================================================

-- Extensiones requeridas. `infra/docker/postgres/init` las instala en la base
-- principal, pero la shadow database que Prisma crea para validar migraciones no
-- pasa por ese init: declararlas aquí hace la migración autosuficiente y
-- reproducible en cualquier PostgreSQL (incluido uno gestionado).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ---------------------------------------------------------------------------
-- 1. Un único consultor responsable principal ACTIVO por caso.
--    Índice único parcial: permite historial (asignaciones inactivas, apoyos)
--    pero impide dos responsables principales activos simultáneos.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX "case_assignments_one_active_primary"
  ON "case_assignments" ("caseId")
  WHERE "isPrimary" = true AND "isActive" = true;

-- ---------------------------------------------------------------------------
-- 2. Una única clasificación vigente por caso.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX "case_classifications_one_current"
  ON "case_classifications" ("caseId")
  WHERE "isCurrent" = true;

-- ---------------------------------------------------------------------------
-- 3. Un único contacto principal activo por empresa.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX "company_contacts_one_primary"
  ON "company_contacts" ("companyId")
  WHERE "isPrimary" = true AND "isActive" = true;

-- ---------------------------------------------------------------------------
-- 4. Una única versión de propuesta editable (BORRADOR) por propuesta.
--    Evita que dos borradores paralelos compitan por ser "la versión actual".
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX "proposal_versions_one_draft"
  ON "proposal_versions" ("proposalId")
  WHERE "status" = 'BORRADOR';

-- ---------------------------------------------------------------------------
-- 5. Una única instancia de SLA abierta por (caso, etapa).
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX "sla_instances_one_open_per_stage"
  ON "sla_instances" ("caseId", "stage")
  WHERE "status" IN ('ON_TRACK', 'AT_RISK', 'OVERDUE');

-- ---------------------------------------------------------------------------
-- 6. Índices de trigramas para el matching de empresa única (RF-002, RF-003).
--    Sin ellos, la comparación por similitud hace secuencial sobre toda la tabla.
-- ---------------------------------------------------------------------------
CREATE INDEX "companies_normalized_name_trgm"
  ON "companies" USING GIN ("normalizedName" gin_trgm_ops);

-- Búsqueda de casos por título y por código desde la barra de búsqueda.
CREATE INDEX "cases_title_trgm"
  ON "cases" USING GIN ("title" gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- 7. La bitácora de auditoría es APPEND-ONLY (RT-004, §26).
--    Se protege en la propia base de datos, no sólo en la aplicación: un
--    trigger BEFORE UPDATE OR DELETE aborta la operación pase lo que pase.
--    Sigue siendo posible DROP/TRUNCATE por un DBA con privilegios, que es
--    exactamente el nivel de acceso que una operación de retención requiere.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION nodus_audit_logs_append_only()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'audit_logs es append-only: la operación % está prohibida (registro %)',
    TG_OP, COALESCE(OLD."id"::text, '?')
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "audit_logs_no_update"
  BEFORE UPDATE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION nodus_audit_logs_append_only();

CREATE TRIGGER "audit_logs_no_delete"
  BEFORE DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION nodus_audit_logs_append_only();

-- ---------------------------------------------------------------------------
-- 8. Una versión de propuesta congelada es inmutable (RF-042).
--    Sólo se permite avanzar su estado y sellar marcas de tiempo; el contenido
--    (analysis/content) y el número de versión no pueden cambiar nunca más.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION nodus_proposal_versions_frozen_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."frozenAt" IS NOT NULL THEN
    IF NEW."analysis" IS DISTINCT FROM OLD."analysis"
       OR NEW."content" IS DISTINCT FROM OLD."content"
       OR NEW."versionNumber" IS DISTINCT FROM OLD."versionNumber"
       OR NEW."proposalId" IS DISTINCT FROM OLD."proposalId" THEN
      RAISE EXCEPTION
        'La versión % de la propuesta está congelada: cree una versión nueva en lugar de sobrescribir',
        OLD."versionNumber"
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "proposal_versions_frozen_immutable"
  BEFORE UPDATE ON "proposal_versions"
  FOR EACH ROW EXECUTE FUNCTION nodus_proposal_versions_frozen_immutable();

-- ---------------------------------------------------------------------------
-- 9. Las versiones documentales nunca se modifican ni se borran: cada carga
--    escribe una fila nueva con una storageKey distinta (§32).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION nodus_document_versions_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'document_versions es inmutable: la operación % está prohibida',
    TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "document_versions_no_update"
  BEFORE UPDATE ON "document_versions"
  FOR EACH ROW EXECUTE FUNCTION nodus_document_versions_immutable();

CREATE TRIGGER "document_versions_no_delete"
  BEFORE DELETE ON "document_versions"
  FOR EACH ROW EXECUTE FUNCTION nodus_document_versions_immutable();
