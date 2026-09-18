-- CreateEnum
CREATE TYPE "RoleCode" AS ENUM ('SUPER_ADMIN', 'ADVISORY', 'CONSULTOR', 'CONSULTOR_REVISOR', 'CLIENTE_MIPYME');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVO', 'INACTIVO', 'BLOQUEADO');

-- CreateEnum
CREATE TYPE "CaseStatusCode" AS ENUM ('CREADO', 'EN_REVISION', 'CLASIFICADO', 'EN_POSTULACION', 'ASIGNADO', 'PROPUESTA_EN_DISENO', 'PROPUESTA_LISTA_PARA_QA', 'PROPUESTA_ENVIADA', 'EN_DECISION_CLIENTE', 'AJUSTES_DE_PROPUESTA', 'PROPUESTA_ACEPTADA', 'PENDIENTE_CONTRATACION', 'AUTORIZADO_PARA_EJECUCION', 'EN_EJECUCION', 'LISTO_PARA_CIERRE', 'CERRADO', 'CERRADO_SIN_CONTRATACION');

-- CreateEnum
CREATE TYPE "EligibilityResult" AS ENUM ('ELEGIBLE', 'NO_ELEGIBLE', 'INFORMACION_INSUFICIENTE');

-- CreateEnum
CREATE TYPE "ConsultantStatus" AS ENUM ('REGISTRADO', 'EN_VALIDACION', 'HABILITADO', 'CONDICIONADO', 'SUSPENDIDO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "EngagementMode" AS ENUM ('INDEPENDIENTE', 'SPONSOR', 'PROPIO');

-- CreateEnum
CREATE TYPE "ConsultantTier" AS ENUM ('VALIDADO', 'HABILITADO', 'PREMIUM', 'ESTRATEGICO');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PRESENTADA', 'EN_EVALUACION', 'ACEPTADA', 'NO_SELECCIONADA', 'RETIRADA');

-- CreateEnum
CREATE TYPE "ProposalVersionStatus" AS ENUM ('BORRADOR', 'EN_QA', 'ENVIADA', 'ACEPTADA', 'SUPERADA', 'DESCARTADA');

-- CreateEnum
CREATE TYPE "ReviewType" AS ENUM ('METODOLOGICA', 'PEER');

-- CreateEnum
CREATE TYPE "ReviewOutcome" AS ENUM ('APROBADA', 'AJUSTES_SOLICITADOS', 'OBSERVACIONES');

-- CreateEnum
CREATE TYPE "ClientDecisionType" AS ENUM ('ACEPTAR', 'SOLICITAR_AJUSTES', 'NO_CONTINUAR');

-- CreateEnum
CREATE TYPE "ChecklistItemStatus" AS ENUM ('PENDIENTE', 'EN_PROCESO', 'CUMPLIDO', 'NO_APLICA');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('NO_INICIADA', 'EN_CURSO', 'COMPLETADA', 'BLOQUEADA', 'REPROGRAMADA');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('PENDIENTE', 'EN_CURSO', 'CUMPLIDO', 'INCUMPLIDO', 'JUSTIFICADO', 'REPROGRAMADO');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('ABIERTA', 'EN_ATENCION', 'ESCALADA', 'RESUELTA', 'CERRADA');

-- CreateEnum
CREATE TYPE "ImpactLevel" AS ENUM ('BAJO', 'MEDIO', 'ALTO', 'CRITICO');

-- CreateEnum
CREATE TYPE "DeliverableStatus" AS ENUM ('PENDIENTE', 'EN_DESARROLLO', 'CARGADO', 'EN_REVISION', 'AJUSTADO', 'LISTO_PARA_CIERRE');

-- CreateEnum
CREATE TYPE "DocumentStage" AS ENUM ('INTAKE', 'EVALUACION', 'POSTULACION', 'PROPUESTA', 'DECISION', 'CONTRATACION', 'EJECUCION', 'CIERRE');

-- CreateEnum
CREATE TYPE "DocumentAccessLevel" AS ENUM ('LECTURA', 'ESCRITURA');

-- CreateEnum
CREATE TYPE "SlaStatus" AS ENUM ('ON_TRACK', 'AT_RISK', 'OVERDUE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SlaAlertKind" AS ENUM ('PREVENTIVA', 'VENCIMIENTO', 'ESCALAMIENTO');

-- CreateEnum
CREATE TYPE "AuditOrigin" AS ENUM ('USER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDIENTE', 'ENVIADA', 'FALLIDA', 'LEIDA');

-- CreateEnum
CREATE TYPE "CommunicationType" AS ENUM ('SOLICITUD_ACLARACION', 'SOLICITUD_INFORMACION', 'RESPUESTA', 'ACUERDO_OPERATIVO', 'OBSERVACION');

-- CreateEnum
CREATE TYPE "CommunicationAudience" AS ENUM ('CLIENTE', 'CONSULTOR', 'ADVISORY', 'INTERNO');

-- CreateEnum
CREATE TYPE "MeetingType" AS ENUM ('PRESENTACION_PROPUESTA', 'SEGUIMIENTO', 'CIERRE', 'OTRA');

-- CreateEnum
CREATE TYPE "ClosureResponseType" AS ENUM ('ACEPTACION', 'CIERRE_CON_OBSERVACIONES', 'SOLICITUD_AJUSTE_FINAL');

-- CreateEnum
CREATE TYPE "ChecklistKind" AS ENUM ('CONTRATACION', 'CIERRE');

-- CreateTable
CREATE TABLE "lookup_lists" (
    "id" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(140) NOT NULL,
    "description" VARCHAR(500),
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lookup_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lookup_values" (
    "id" UUID NOT NULL,
    "listId" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "label" VARCHAR(140) NOT NULL,
    "description" VARCHAR(500),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lookup_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "code" "RoleCode" NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(400),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "module" VARCHAR(40) NOT NULL,
    "description" VARCHAR(400),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(180) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "fullName" VARCHAR(140) NOT NULL,
    "phone" VARCHAR(40),
    "roleId" UUID NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVO',
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "companyId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedById" UUID,
    "userAgent" VARCHAR(400),
    "ip" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "normalizedName" VARCHAR(180) NOT NULL,
    "taxId" VARCHAR(40),
    "emailDomain" VARCHAR(120),
    "country" VARCHAR(80) NOT NULL,
    "city" VARCHAR(80) NOT NULL,
    "sectorCode" VARCHAR(60),
    "website" VARCHAR(200),
    "acceptedTermsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_contacts" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "userId" UUID,
    "fullName" VARCHAR(140) NOT NULL,
    "jobTitle" VARCHAR(120) NOT NULL,
    "email" VARCHAR(180) NOT NULL,
    "phone" VARCHAR(40) NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sponsors" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "taxId" VARCHAR(40),
    "country" VARCHAR(80) NOT NULL,
    "city" VARCHAR(80) NOT NULL,
    "contactName" VARCHAR(140) NOT NULL,
    "contactEmail" VARCHAR(180) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sponsors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultants" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "userId" UUID NOT NULL,
    "identityDocument" VARCHAR(40) NOT NULL,
    "phone" VARCHAR(40) NOT NULL,
    "country" VARCHAR(80) NOT NULL,
    "city" VARCHAR(80) NOT NULL,
    "professionalProfile" TEXT NOT NULL,
    "yearsOfExperience" INTEGER NOT NULL DEFAULT 0,
    "certifications" TEXT,
    "availability" VARCHAR(500) NOT NULL,
    "cvDocumentId" UUID,
    "status" "ConsultantStatus" NOT NULL DEFAULT 'REGISTRADO',
    "engagementMode" "EngagementMode" NOT NULL DEFAULT 'INDEPENDIENTE',
    "tier" "ConsultantTier",
    "sponsorId" UUID,
    "experienceLevelCode" VARCHAR(60),
    "maxComplexityCode" VARCHAR(60),
    "dueDiligenceNotes" TEXT,
    "dueDiligenceDecidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultant_specialties" (
    "id" UUID NOT NULL,
    "consultantId" UUID NOT NULL,
    "specialtyCode" VARCHAR(60) NOT NULL,
    "subSpecialtyCode" VARCHAR(60),
    "yearsOfExperience" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultant_specialties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultant_scopes" (
    "id" UUID NOT NULL,
    "consultantId" UUID NOT NULL,
    "interventionTypeCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sectorCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "canBeLeadConsultant" BOOLEAN NOT NULL DEFAULT true,
    "canBeSupport" BOOLEAN NOT NULL DEFAULT true,
    "canBeReviewer" BOOLEAN NOT NULL DEFAULT false,
    "canHandleSensitive" BOOLEAN NOT NULL DEFAULT false,
    "notes" VARCHAR(2000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultant_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultant_status_history" (
    "id" UUID NOT NULL,
    "consultantId" UUID NOT NULL,
    "previousStatus" "ConsultantStatus",
    "newStatus" "ConsultantStatus" NOT NULL,
    "reason" VARCHAR(2000) NOT NULL,
    "changedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultant_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_statuses" (
    "id" UUID NOT NULL,
    "code" "CaseStatusCode" NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "description" VARCHAR(500),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isTerminal" BOOLEAN NOT NULL DEFAULT false,
    "colorToken" VARCHAR(40),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cases" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "companyId" UUID NOT NULL,
    "contactId" UUID,
    "createdById" UUID NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "description" TEXT NOT NULL,
    "areaCode" VARCHAR(60),
    "subAreaCode" VARCHAR(60),
    "interventionTypeCode" VARCHAR(60),
    "complexityCode" VARCHAR(60),
    "urgencyCode" VARCHAR(60),
    "impactCode" VARCHAR(60),
    "status" "CaseStatusCode" NOT NULL DEFAULT 'CREADO',
    "publishedAt" TIMESTAMP(3),
    "applicationDeadline" TIMESTAMP(3),
    "authorizedAt" TIMESTAMP(3),
    "authorizedById" UUID,
    "executionStartedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedById" UUID,
    "closureReason" VARCHAR(1000),
    "closureReasonCode" VARCHAR(60),
    "reactivationPotential" VARCHAR(20),
    "decisionOpenedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_classifications" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "areaCode" VARCHAR(60) NOT NULL,
    "subAreaCode" VARCHAR(60),
    "interventionTypeCode" VARCHAR(60) NOT NULL,
    "complexityCode" VARCHAR(60) NOT NULL,
    "impactCode" VARCHAR(60) NOT NULL,
    "urgencyCode" VARCHAR(60) NOT NULL,
    "eligibility" "EligibilityResult" NOT NULL,
    "reviewNotes" TEXT NOT NULL,
    "clarityScore" INTEGER,
    "completenessScore" INTEGER,
    "classifiedById" UUID,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_classifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_status_history" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "previousStatus" "CaseStatusCode",
    "newStatus" "CaseStatusCode" NOT NULL,
    "transitionCode" VARCHAR(60) NOT NULL,
    "note" VARCHAR(2000),
    "origin" "AuditOrigin" NOT NULL DEFAULT 'USER',
    "actorId" UUID,
    "hoursInPreviousStatus" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "consultantId" UUID NOT NULL,
    "interestStatement" TEXT NOT NULL,
    "availability" VARCHAR(500) NOT NULL,
    "relevantExperience" TEXT NOT NULL,
    "fitJustification" TEXT NOT NULL,
    "preliminaryApproach" TEXT NOT NULL,
    "acceptsConditions" BOOLEAN NOT NULL DEFAULT false,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PRESENTADA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_evaluations" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "specialtyFit" INTEGER NOT NULL,
    "experienceFit" INTEGER NOT NULL,
    "levelFit" INTEGER NOT NULL,
    "availabilityFit" INTEGER NOT NULL,
    "trackRecordFit" INTEGER NOT NULL,
    "totalScore" INTEGER NOT NULL,
    "notes" TEXT NOT NULL,
    "evaluatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_assignments" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "consultantId" UUID NOT NULL,
    "applicationId" UUID,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "assignedById" UUID,
    "decisionRationale" TEXT NOT NULL,
    "unassignedAt" TIMESTAMP(3),
    "unassignedReason" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "currentVersionNumber" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_versions" (
    "id" UUID NOT NULL,
    "proposalId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "analysis" JSONB,
    "content" JSONB,
    "status" "ProposalVersionStatus" NOT NULL DEFAULT 'BORRADOR',
    "changeNote" VARCHAR(1000),
    "createdById" UUID,
    "frozenAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposal_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_reviews" (
    "id" UUID NOT NULL,
    "proposalId" UUID NOT NULL,
    "versionId" UUID NOT NULL,
    "type" "ReviewType" NOT NULL,
    "outcome" "ReviewOutcome" NOT NULL,
    "checklist" JSONB NOT NULL,
    "observations" TEXT,
    "reviewerId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_adjustments" (
    "id" UUID NOT NULL,
    "proposalId" UUID NOT NULL,
    "versionId" UUID NOT NULL,
    "details" TEXT NOT NULL,
    "requestedById" UUID,
    "response" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_decisions" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "decision" "ClientDecisionType" NOT NULL,
    "comments" TEXT,
    "adjustmentDetails" TEXT,
    "declineReasonCode" VARCHAR(60),
    "reactivationPotential" VARCHAR(20),
    "decidedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "caseId" UUID,
    "stage" "DocumentStage" NOT NULL,
    "type" VARCHAR(60) NOT NULL,
    "name" VARCHAR(240) NOT NULL,
    "currentVersion" INTEGER NOT NULL DEFAULT 0,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_versions" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(160) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "storageKey" VARCHAR(600) NOT NULL,
    "uploadedById" UUID,
    "notes" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_accesses" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "level" "DocumentAccessLevel" NOT NULL DEFAULT 'LECTURA',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_accesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_templates" (
    "id" UUID NOT NULL,
    "kind" "ChecklistKind" NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_template_items" (
    "id" UUID NOT NULL,
    "templateId" UUID NOT NULL,
    "label" VARCHAR(240) NOT NULL,
    "description" VARCHAR(1000),
    "defaultResponsible" VARCHAR(140),
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "requiresEvidence" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "checklist_template_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_checklists" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "templateCode" VARCHAR(60) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_checklist_items" (
    "id" UUID NOT NULL,
    "checklistId" UUID NOT NULL,
    "label" VARCHAR(240) NOT NULL,
    "description" VARCHAR(1000),
    "responsible" VARCHAR(140),
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "requiresEvidence" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ChecklistItemStatus" NOT NULL DEFAULT 'PENDIENTE',
    "targetDate" TIMESTAMP(3),
    "completedDate" TIMESTAMP(3),
    "notes" VARCHAR(2000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_evidences" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "itemId" UUID,
    "title" VARCHAR(240) NOT NULL,
    "description" VARCHAR(1000),
    "documentId" UUID,
    "registeredById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_evidences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_frameworks" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "operatingConditions" TEXT NOT NULL,
    "estimatedDurationDays" INTEGER NOT NULL,
    "baselineSchedule" TEXT NOT NULL,
    "committedDeliverables" TEXT NOT NULL,
    "clientDependencies" TEXT NOT NULL,
    "assumptions" TEXT NOT NULL,
    "executionConstraints" TEXT,
    "primaryContact" VARCHAR(140) NOT NULL,
    "uploadedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operational_frameworks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "description" TEXT,
    "responsible" VARCHAR(140) NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "status" "ActivityStatus" NOT NULL DEFAULT 'NO_INICIADA',
    "notes" VARCHAR(2000),
    "evidenceDocumentId" UUID,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestones" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "description" TEXT,
    "responsible" VARCHAR(140) NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "criticality" "ImpactLevel" NOT NULL DEFAULT 'MEDIO',
    "status" "MilestoneStatus" NOT NULL DEFAULT 'PENDIENTE',
    "expectedResult" VARCHAR(2000),
    "justification" VARCHAR(2000),
    "completedAt" TIMESTAMP(3),
    "atRiskNotifiedAt" TIMESTAMP(3),
    "overdueNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "typeCode" VARCHAR(60) NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "description" TEXT NOT NULL,
    "impact" "ImpactLevel" NOT NULL,
    "suggestedAction" TEXT NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'ABIERTA',
    "decision" TEXT,
    "stage" "DocumentStage" NOT NULL DEFAULT 'EJECUCION',
    "reportedById" UUID,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliverables" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "description" TEXT,
    "typeCode" VARCHAR(60),
    "responsible" VARCHAR(140) NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "status" "DeliverableStatus" NOT NULL DEFAULT 'PENDIENTE',
    "notes" VARCHAR(2000),
    "currentVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deliverables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliverable_versions" (
    "id" UUID NOT NULL,
    "deliverableId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "documentVersionId" UUID,
    "notes" VARCHAR(2000),
    "uploadedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deliverable_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meetings" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "type" "MeetingType" NOT NULL,
    "heldAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "participants" TEXT NOT NULL,
    "topics" TEXT NOT NULL,
    "conclusions" TEXT NOT NULL,
    "commitments" TEXT,
    "registeredById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communications" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "type" "CommunicationType" NOT NULL,
    "stage" "DocumentStage" NOT NULL,
    "audience" "CommunicationAudience" NOT NULL,
    "subject" VARCHAR(180) NOT NULL,
    "body" TEXT NOT NULL,
    "parentId" UUID,
    "answeredAt" TIMESTAMP(3),
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advisory_reviews" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "findings" TEXT NOT NULL,
    "actionsTaken" TEXT,
    "riskLevel" "ImpactLevel" NOT NULL DEFAULT 'BAJO',
    "reviewedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "advisory_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "closure_declarations" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "statement" TEXT NOT NULL,
    "finalNotes" TEXT,
    "declaredById" UUID,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "closure_declarations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "closure_checklists" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "templateCode" VARCHAR(60) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "closure_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "closure_checklist_items" (
    "id" UUID NOT NULL,
    "checklistId" UUID NOT NULL,
    "label" VARCHAR(240) NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ChecklistItemStatus" NOT NULL DEFAULT 'PENDIENTE',
    "notes" VARCHAR(2000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "closure_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_closure_responses" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "response" "ClosureResponseType" NOT NULL,
    "observations" TEXT,
    "respondedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_closure_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_evaluations" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "overallSatisfaction" INTEGER NOT NULL,
    "serviceClarity" INTEGER NOT NULL,
    "expectationFulfilment" INTEGER NOT NULL,
    "perceivedValue" INTEGER NOT NULL,
    "wouldReuse" BOOLEAN NOT NULL,
    "comments" TEXT,
    "submittedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultant_evaluations" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "consultantId" UUID NOT NULL,
    "scopeCompliance" INTEGER NOT NULL,
    "timeCompliance" INTEGER NOT NULL,
    "documentationOrder" INTEGER NOT NULL,
    "processConsistency" INTEGER NOT NULL,
    "qaOutcome" INTEGER NOT NULL,
    "overallScore" DECIMAL(4,2) NOT NULL,
    "caseComplexityCode" VARCHAR(60),
    "comments" TEXT,
    "evaluatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultant_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_rules" (
    "id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "stage" VARCHAR(60) NOT NULL,
    "durationHours" INTEGER NOT NULL,
    "warningThresholdPercent" INTEGER NOT NULL DEFAULT 75,
    "escalationAfterHours" INTEGER,
    "complexityCode" VARCHAR(60),
    "interventionTypeCode" VARCHAR(60),
    "consultantLevelCode" VARCHAR(60),
    "clientSegmentCode" VARCHAR(60),
    "priorityCode" VARCHAR(60),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sla_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_instances" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "ruleId" UUID NOT NULL,
    "stage" VARCHAR(60) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "status" "SlaStatus" NOT NULL DEFAULT 'ON_TRACK',
    "percentConsumed" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sla_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_alerts" (
    "id" UUID NOT NULL,
    "instanceId" UUID NOT NULL,
    "kind" "SlaAlertKind" NOT NULL,
    "message" VARCHAR(600) NOT NULL,
    "percentAtAlert" DECIMAL(6,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sla_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_escalations" (
    "id" UUID NOT NULL,
    "instanceId" UUID NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "reason" VARCHAR(600) NOT NULL,
    "escalatedToId" UUID,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sla_escalations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "eventName" VARCHAR(80) NOT NULL,
    "audiences" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "subjectTemplate" VARCHAR(300) NOT NULL,
    "bodyTemplate" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'EMAIL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "templateId" UUID,
    "recipientId" UUID NOT NULL,
    "caseId" UUID,
    "eventName" VARCHAR(80) NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDIENTE',
    "subject" VARCHAR(300) NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "error" VARCHAR(1000),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "actorRole" "RoleCode",
    "action" VARCHAR(80) NOT NULL,
    "entity" VARCHAR(80) NOT NULL,
    "entityId" VARCHAR(64),
    "caseId" UUID,
    "companyId" UUID,
    "previousValue" JSONB,
    "newValue" JSONB,
    "origin" "AuditOrigin" NOT NULL DEFAULT 'USER',
    "ip" VARCHAR(64),
    "userAgent" VARCHAR(400),
    "requestId" VARCHAR(64),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_sequences" (
    "prefix" VARCHAR(10) NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "code_sequences_pkey" PRIMARY KEY ("prefix")
);

-- CreateIndex
CREATE UNIQUE INDEX "lookup_lists_code_key" ON "lookup_lists"("code");

-- CreateIndex
CREATE INDEX "lookup_values_listId_isActive_sortOrder_idx" ON "lookup_values"("listId", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "lookup_values_listId_code_key" ON "lookup_values"("listId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "permissions_module_idx" ON "permissions"("module");

-- CreateIndex
CREATE INDEX "role_permissions_permissionId_idx" ON "role_permissions"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_roleId_idx" ON "users"("roleId");

-- CreateIndex
CREATE INDEX "users_companyId_idx" ON "users"("companyId");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_revokedAt_idx" ON "refresh_tokens"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "companies_code_key" ON "companies"("code");

-- CreateIndex
CREATE INDEX "companies_emailDomain_idx" ON "companies"("emailDomain");

-- CreateIndex
CREATE INDEX "companies_normalizedName_idx" ON "companies"("normalizedName");

-- CreateIndex
CREATE INDEX "companies_createdAt_idx" ON "companies"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "companies_taxId_key" ON "companies"("taxId");

-- CreateIndex
CREATE UNIQUE INDEX "company_contacts_userId_key" ON "company_contacts"("userId");

-- CreateIndex
CREATE INDEX "company_contacts_email_idx" ON "company_contacts"("email");

-- CreateIndex
CREATE INDEX "company_contacts_companyId_isPrimary_idx" ON "company_contacts"("companyId", "isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "company_contacts_companyId_email_key" ON "company_contacts"("companyId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "sponsors_code_key" ON "sponsors"("code");

-- CreateIndex
CREATE UNIQUE INDEX "consultants_code_key" ON "consultants"("code");

-- CreateIndex
CREATE UNIQUE INDEX "consultants_userId_key" ON "consultants"("userId");

-- CreateIndex
CREATE INDEX "consultants_status_idx" ON "consultants"("status");

-- CreateIndex
CREATE INDEX "consultants_status_maxComplexityCode_idx" ON "consultants"("status", "maxComplexityCode");

-- CreateIndex
CREATE INDEX "consultants_sponsorId_idx" ON "consultants"("sponsorId");

-- CreateIndex
CREATE INDEX "consultants_tier_idx" ON "consultants"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "consultants_identityDocument_key" ON "consultants"("identityDocument");

-- CreateIndex
CREATE INDEX "consultant_specialties_specialtyCode_idx" ON "consultant_specialties"("specialtyCode");

-- CreateIndex
CREATE UNIQUE INDEX "consultant_specialties_consultantId_specialtyCode_subSpecia_key" ON "consultant_specialties"("consultantId", "specialtyCode", "subSpecialtyCode");

-- CreateIndex
CREATE UNIQUE INDEX "consultant_scopes_consultantId_key" ON "consultant_scopes"("consultantId");

-- CreateIndex
CREATE INDEX "consultant_status_history_consultantId_createdAt_idx" ON "consultant_status_history"("consultantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "case_statuses_code_key" ON "case_statuses"("code");

-- CreateIndex
CREATE UNIQUE INDEX "cases_code_key" ON "cases"("code");

-- CreateIndex
CREATE INDEX "cases_companyId_idx" ON "cases"("companyId");

-- CreateIndex
CREATE INDEX "cases_status_idx" ON "cases"("status");

-- CreateIndex
CREATE INDEX "cases_createdAt_idx" ON "cases"("createdAt");

-- CreateIndex
CREATE INDEX "cases_status_createdAt_idx" ON "cases"("status", "createdAt");

-- CreateIndex
CREATE INDEX "cases_companyId_status_idx" ON "cases"("companyId", "status");

-- CreateIndex
CREATE INDEX "cases_status_areaCode_complexityCode_idx" ON "cases"("status", "areaCode", "complexityCode");

-- CreateIndex
CREATE INDEX "case_classifications_caseId_isCurrent_idx" ON "case_classifications"("caseId", "isCurrent");

-- CreateIndex
CREATE INDEX "case_classifications_caseId_createdAt_idx" ON "case_classifications"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "case_status_history_caseId_createdAt_idx" ON "case_status_history"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "case_status_history_newStatus_createdAt_idx" ON "case_status_history"("newStatus", "createdAt");

-- CreateIndex
CREATE INDEX "applications_caseId_idx" ON "applications"("caseId");

-- CreateIndex
CREATE INDEX "applications_consultantId_idx" ON "applications"("consultantId");

-- CreateIndex
CREATE INDEX "applications_caseId_status_idx" ON "applications"("caseId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "applications_caseId_consultantId_key" ON "applications"("caseId", "consultantId");

-- CreateIndex
CREATE UNIQUE INDEX "application_evaluations_applicationId_key" ON "application_evaluations"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "case_assignments_applicationId_key" ON "case_assignments"("applicationId");

-- CreateIndex
CREATE INDEX "case_assignments_caseId_isActive_idx" ON "case_assignments"("caseId", "isActive");

-- CreateIndex
CREATE INDEX "case_assignments_consultantId_isActive_idx" ON "case_assignments"("consultantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "proposals_caseId_key" ON "proposals"("caseId");

-- CreateIndex
CREATE INDEX "proposal_versions_proposalId_status_idx" ON "proposal_versions"("proposalId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_versions_proposalId_versionNumber_key" ON "proposal_versions"("proposalId", "versionNumber");

-- CreateIndex
CREATE INDEX "proposal_reviews_proposalId_createdAt_idx" ON "proposal_reviews"("proposalId", "createdAt");

-- CreateIndex
CREATE INDEX "proposal_reviews_versionId_type_idx" ON "proposal_reviews"("versionId", "type");

-- CreateIndex
CREATE INDEX "proposal_adjustments_proposalId_createdAt_idx" ON "proposal_adjustments"("proposalId", "createdAt");

-- CreateIndex
CREATE INDEX "customer_decisions_caseId_createdAt_idx" ON "customer_decisions"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "documents_caseId_idx" ON "documents"("caseId");

-- CreateIndex
CREATE INDEX "documents_companyId_idx" ON "documents"("companyId");

-- CreateIndex
CREATE INDEX "documents_caseId_stage_idx" ON "documents"("caseId", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_storageKey_key" ON "document_versions"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_documentId_versionNumber_key" ON "document_versions"("documentId", "versionNumber");

-- CreateIndex
CREATE INDEX "document_accesses_userId_idx" ON "document_accesses"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "document_accesses_documentId_userId_key" ON "document_accesses"("documentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "checklist_templates_code_key" ON "checklist_templates"("code");

-- CreateIndex
CREATE INDEX "checklist_templates_kind_isActive_idx" ON "checklist_templates"("kind", "isActive");

-- CreateIndex
CREATE INDEX "checklist_template_items_templateId_sortOrder_idx" ON "checklist_template_items"("templateId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "contract_checklists_caseId_key" ON "contract_checklists"("caseId");

-- CreateIndex
CREATE INDEX "contract_checklist_items_checklistId_sortOrder_idx" ON "contract_checklist_items"("checklistId", "sortOrder");

-- CreateIndex
CREATE INDEX "contract_checklist_items_checklistId_status_idx" ON "contract_checklist_items"("checklistId", "status");

-- CreateIndex
CREATE INDEX "contract_evidences_caseId_idx" ON "contract_evidences"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "operational_frameworks_caseId_key" ON "operational_frameworks"("caseId");

-- CreateIndex
CREATE INDEX "activities_caseId_status_idx" ON "activities"("caseId", "status");

-- CreateIndex
CREATE INDEX "activities_caseId_targetDate_idx" ON "activities"("caseId", "targetDate");

-- CreateIndex
CREATE INDEX "milestones_caseId_status_idx" ON "milestones"("caseId", "status");

-- CreateIndex
CREATE INDEX "milestones_status_targetDate_idx" ON "milestones"("status", "targetDate");

-- CreateIndex
CREATE INDEX "incidents_caseId_status_idx" ON "incidents"("caseId", "status");

-- CreateIndex
CREATE INDEX "incidents_status_impact_idx" ON "incidents"("status", "impact");

-- CreateIndex
CREATE INDEX "deliverables_caseId_status_idx" ON "deliverables"("caseId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "deliverable_versions_deliverableId_versionNumber_key" ON "deliverable_versions"("deliverableId", "versionNumber");

-- CreateIndex
CREATE INDEX "meetings_caseId_heldAt_idx" ON "meetings"("caseId", "heldAt");

-- CreateIndex
CREATE INDEX "communications_caseId_createdAt_idx" ON "communications"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "advisory_reviews_caseId_createdAt_idx" ON "advisory_reviews"("caseId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "closure_declarations_caseId_key" ON "closure_declarations"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "closure_checklists_caseId_key" ON "closure_checklists"("caseId");

-- CreateIndex
CREATE INDEX "closure_checklist_items_checklistId_sortOrder_idx" ON "closure_checklist_items"("checklistId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "customer_closure_responses_caseId_key" ON "customer_closure_responses"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "customer_evaluations_caseId_key" ON "customer_evaluations"("caseId");

-- CreateIndex
CREATE INDEX "consultant_evaluations_consultantId_createdAt_idx" ON "consultant_evaluations"("consultantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "consultant_evaluations_caseId_consultantId_key" ON "consultant_evaluations"("caseId", "consultantId");

-- CreateIndex
CREATE UNIQUE INDEX "sla_rules_code_key" ON "sla_rules"("code");

-- CreateIndex
CREATE INDEX "sla_rules_stage_isActive_idx" ON "sla_rules"("stage", "isActive");

-- CreateIndex
CREATE INDEX "sla_instances_caseId_idx" ON "sla_instances"("caseId");

-- CreateIndex
CREATE INDEX "sla_instances_status_idx" ON "sla_instances"("status");

-- CreateIndex
CREATE INDEX "sla_instances_status_deadline_idx" ON "sla_instances"("status", "deadline");

-- CreateIndex
CREATE INDEX "sla_instances_caseId_stage_status_idx" ON "sla_instances"("caseId", "stage", "status");

-- CreateIndex
CREATE INDEX "sla_alerts_createdAt_idx" ON "sla_alerts"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "sla_alerts_instanceId_kind_key" ON "sla_alerts"("instanceId", "kind");

-- CreateIndex
CREATE INDEX "sla_escalations_instanceId_idx" ON "sla_escalations"("instanceId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_code_key" ON "notification_templates"("code");

-- CreateIndex
CREATE INDEX "notification_templates_eventName_isActive_idx" ON "notification_templates"("eventName", "isActive");

-- CreateIndex
CREATE INDEX "notifications_recipientId_idx" ON "notifications"("recipientId");

-- CreateIndex
CREATE INDEX "notifications_recipientId_status_createdAt_idx" ON "notifications"("recipientId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_caseId_idx" ON "notifications"("caseId");

-- CreateIndex
CREATE INDEX "notifications_status_createdAt_idx" ON "notifications"("status", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_caseId_createdAt_idx" ON "audit_logs"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_companyId_createdAt_idx" ON "audit_logs"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- AddForeignKey
ALTER TABLE "lookup_values" ADD CONSTRAINT "lookup_values_listId_fkey" FOREIGN KEY ("listId") REFERENCES "lookup_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_contacts" ADD CONSTRAINT "company_contacts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_contacts" ADD CONSTRAINT "company_contacts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultants" ADD CONSTRAINT "consultants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultants" ADD CONSTRAINT "consultants_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "sponsors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultant_specialties" ADD CONSTRAINT "consultant_specialties_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "consultants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultant_scopes" ADD CONSTRAINT "consultant_scopes_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "consultants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultant_status_history" ADD CONSTRAINT "consultant_status_history_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "consultants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultant_status_history" ADD CONSTRAINT "consultant_status_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "company_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_authorizedById_fkey" FOREIGN KEY ("authorizedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_classifications" ADD CONSTRAINT "case_classifications_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_classifications" ADD CONSTRAINT "case_classifications_classifiedById_fkey" FOREIGN KEY ("classifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_status_history" ADD CONSTRAINT "case_status_history_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_status_history" ADD CONSTRAINT "case_status_history_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "consultants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_evaluations" ADD CONSTRAINT "application_evaluations_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_evaluations" ADD CONSTRAINT "application_evaluations_evaluatedById_fkey" FOREIGN KEY ("evaluatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_assignments" ADD CONSTRAINT "case_assignments_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_assignments" ADD CONSTRAINT "case_assignments_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "consultants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_assignments" ADD CONSTRAINT "case_assignments_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_assignments" ADD CONSTRAINT "case_assignments_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_versions" ADD CONSTRAINT "proposal_versions_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_versions" ADD CONSTRAINT "proposal_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_reviews" ADD CONSTRAINT "proposal_reviews_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_reviews" ADD CONSTRAINT "proposal_reviews_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "proposal_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_reviews" ADD CONSTRAINT "proposal_reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_adjustments" ADD CONSTRAINT "proposal_adjustments_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_adjustments" ADD CONSTRAINT "proposal_adjustments_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "proposal_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_adjustments" ADD CONSTRAINT "proposal_adjustments_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_decisions" ADD CONSTRAINT "customer_decisions_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_decisions" ADD CONSTRAINT "customer_decisions_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_accesses" ADD CONSTRAINT "document_accesses_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_accesses" ADD CONSTRAINT "document_accesses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_template_items" ADD CONSTRAINT "checklist_template_items_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "checklist_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_checklists" ADD CONSTRAINT "contract_checklists_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_checklist_items" ADD CONSTRAINT "contract_checklist_items_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "contract_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_evidences" ADD CONSTRAINT "contract_evidences_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_evidences" ADD CONSTRAINT "contract_evidences_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "contract_checklist_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_evidences" ADD CONSTRAINT "contract_evidences_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_frameworks" ADD CONSTRAINT "operational_frameworks_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_frameworks" ADD CONSTRAINT "operational_frameworks_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliverable_versions" ADD CONSTRAINT "deliverable_versions_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "deliverables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliverable_versions" ADD CONSTRAINT "deliverable_versions_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "document_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliverable_versions" ADD CONSTRAINT "deliverable_versions_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "communications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisory_reviews" ADD CONSTRAINT "advisory_reviews_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisory_reviews" ADD CONSTRAINT "advisory_reviews_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "closure_declarations" ADD CONSTRAINT "closure_declarations_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "closure_declarations" ADD CONSTRAINT "closure_declarations_declaredById_fkey" FOREIGN KEY ("declaredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "closure_checklists" ADD CONSTRAINT "closure_checklists_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "closure_checklist_items" ADD CONSTRAINT "closure_checklist_items_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "closure_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_closure_responses" ADD CONSTRAINT "customer_closure_responses_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_closure_responses" ADD CONSTRAINT "customer_closure_responses_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_evaluations" ADD CONSTRAINT "customer_evaluations_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_evaluations" ADD CONSTRAINT "customer_evaluations_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultant_evaluations" ADD CONSTRAINT "consultant_evaluations_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultant_evaluations" ADD CONSTRAINT "consultant_evaluations_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "consultants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultant_evaluations" ADD CONSTRAINT "consultant_evaluations_evaluatedById_fkey" FOREIGN KEY ("evaluatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_instances" ADD CONSTRAINT "sla_instances_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_instances" ADD CONSTRAINT "sla_instances_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "sla_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_alerts" ADD CONSTRAINT "sla_alerts_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "sla_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_escalations" ADD CONSTRAINT "sla_escalations_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "sla_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_escalations" ADD CONSTRAINT "sla_escalations_escalatedToId_fkey" FOREIGN KEY ("escalatedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "notification_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
