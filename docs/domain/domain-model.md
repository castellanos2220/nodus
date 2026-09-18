# Modelo de dominio

## 1. Actores

| Rol | Quién es | Puede |
|---|---|---|
| `SUPER_ADMIN` | Administrador de plataforma | Todo, incluida la administración de LOV, SLA y usuarios |
| `ADVISORY` | Equipo advisory / PMO de NODUS | Debida diligencia, clasificación, publicación, asignación, QA, veeduría de contratación, cierre |
| `CONSULTOR` | Profesional del ecosistema curado | Ver oportunidades elegibles, postularse, diseñar propuesta, ejecutar, entregar |
| `CONSULTOR_REVISOR` | Consultor habilitado como peer reviewer | Revisión experta independiente de propuestas (one-time, sin responsabilidad sobre la solución) |
| `CLIENTE_MIPYME` | Contacto de la empresa solicitante | Crear caso, editarlo en `CREADO`, decidir sobre la propuesta, aceptar el cierre, evaluar |

Un usuario tiene **un** rol. La autorización efectiva es `rol → permisos` **más** una comprobación de
acceso al recurso concreto.

## 2. Agregados

### 2.1 Empresa (principio *Empresa Única – Casos Múltiples*)

```
Company (1) ──< CompanyContact
         (1) ──< Case
```

Antes de crear una empresa, `CompanyMatchingService` busca coincidencias por, en este orden de
confianza:

| Criterio | Peso | Regla |
|---|---|---|
| `taxId` (NIT/RUT) normalizado | `EXACT` | Coincidencia exacta ⇒ **bloquea** la creación y obliga a vincular |
| Correo del contacto (exacto) | `EXACT` | Coincidencia exacta ⇒ bloquea |
| Dominio del correo corporativo | `STRONG` | Dominios genéricos (gmail, hotmail, outlook, yahoo…) se ignoran |
| Nombre normalizado (sin tildes, sin sufijos societarios, `trigram similarity ≥ 0.6`) | `LIKELY` | Sugiere, no bloquea |

`POST /companies` devuelve `409` con la lista de candidatos si hay coincidencia `EXACT`; el cliente
debe reintentar con `linkToCompanyId` o con `forceCreate: true` (sólo `ADVISORY`/`SUPER_ADMIN`, y
queda auditado con el motivo).

### 2.2 Caso

```
Case ──1 Company              Case ──< Document
     ──1 CompanyContact       Case ──< AuditLog
     ──1 CaseStatus (LOV)     Case ──< SlaInstance
     ──< CaseClassification   Case ──< Notification
     ──< CaseStatusHistory    Case ──< Communication / Meeting
     ──< Application ──1 Consultant
     ──< CaseAssignment ──1 Consultant     (a lo sumo 1 activa con isPrimary)
     ──1 Proposal ──< ProposalVersion ──< ProposalReview / ProposalAdjustment
     ──1 ContractChecklist ──< ContractChecklistItem ──< ContractEvidence
     ──1 OperationalFramework
     ──< Activity / Milestone / Incident / Deliverable ──< DeliverableVersion
     ──1 CustomerEvaluation   ──1 ConsultantEvaluation
```

Campos de clasificación del caso (§11 del brief): área, estrategia/tecnología/finanzas/operaciones/
legal/talento se modelan como **valores de la LOV `AREA_PROBLEMA`** (no como columnas booleanas),
porque el gobierno de datos exige que sean administrables sin migración. `urgency`, `impact`,
`complexity` e `interventionType` también son referencias a LOV.

### 2.3 Consultor

```
Consultant ──1 User
           ──< ConsultantSpecialty (LOV especialidad + subespecialidad + años)
           ──1 ConsultantScope     (complejidad máx., tipos de intervención, puede ser revisor…)
           ──< ConsultantStatusHistory
           ──? Sponsor
           ──< Application / CaseAssignment / ConsultantEvaluation
```

Ciclo de vida: `REGISTRADO → EN_VALIDACION → HABILITADO → {CONDICIONADO | SUSPENDIDO | INACTIVO}`.
**Sólo `HABILITADO`** puede ver oportunidades, postularse, ser asignado o participar en propuestas.
Esto se valida en backend, no por ocultar botones.

### 2.4 Propuesta y versionamiento

`Proposal` es el expediente (1 por caso). `ProposalVersion` es **inmutable una vez congelada**:

- `BORRADOR` → editable por el consultor responsable.
- `EN_QA` → congelada (`frozenAt`), sólo lectura. Cualquier cambio exige una versión nueva.
- `ENVIADA` / `ACEPTADA` / `SUPERADA` → sólo lectura, para siempre.

Regla de base de datos: `@@unique([proposalId, versionNumber])` + comprobación de aplicación que
impide `UPDATE` sobre una versión con `frozenAt != null`. Nunca se sobrescribe historia (RF-042).

### 2.5 Documentos

`Document` (metadatos + ACL) ──< `DocumentVersion` (bytes en storage). Cada carga crea una versión
nueva; `storageKey` incluye versión, de modo que un objeto nunca se sobrescribe en el bucket:

```
companies/{companyId}/cases/{caseId}/{stage}/{documentId}/v{n}/{filename}
```

`stage` ∈ `INTAKE | EVALUACION | POSTULACION | PROPUESTA | DECISION | CONTRATACION | EJECUCION | CIERRE`,
que es exactamente la estructura documental exigida por el blueprint operativo.

### 2.6 SLA

`SlaRule` (configuración) → `SlaInstance` (reloj de un caso en una etapa) → `SlaAlert` /
`SlaEscalation`.

La regla se **resuelve por especificidad**: se elige la `SlaRule` activa que coincida con el `stage` y
que tenga el mayor número de dimensiones opcionales coincidentes (`complexity`, `interventionType`,
`consultantLevel`, `clientSegment`, `priority`). Ninguna hora está escrita en código.

Estados de instancia: `ON_TRACK → AT_RISK → OVERDUE`, o `COMPLETED` / `CANCELLED`.

### 2.7 Auditoría

`AuditLog` es append-only. No existe endpoint de borrado ni de actualización; el `PrismaService`
instala una extensión de cliente que **lanza** si alguien intenta `update`/`delete`/`upsert` sobre
`auditLog`, de modo que el candado no depende de la disciplina del programador.

Campos: `id, createdAt, actorId, actorRole, action, entity, entityId, caseId?, companyId?,
previousValue (Json?), newValue (Json?), origin (USER|SYSTEM), ip?, userAgent?, metadata (Json?)`.

## 3. Plantillas oficiales → entidades

| Plantilla | Entidad / campo |
|---|---|
| T1 Registro de caso | `Case` (intake) + `Document(stage=INTAKE)` |
| T2 Evaluación y clasificación | `CaseClassification` |
| T3A / T3B Aclaraciones | `Communication(type=SOLICITUD_ACLARACION / SOLICITUD_INFORMACION)` |
| T3C Postulación | `Application` |
| T3D Evaluación de postulaciones | `ApplicationEvaluation` |
| TP4A Aclaración para diseño | `Communication(type=SOLICITUD_ACLARACION, stage=PROPUESTA)` |
| TP4B Análisis estructurado | `ProposalVersion.analysis` (Json estructurado) |
| TP4C Propuesta estructurada | `ProposalVersion.content` (10 bloques A–J) |
| TP4D–TP4G Anexos | `Document(stage=PROPUESTA, type=ANEXO_*)` |
| TP4H Revisión metodológica | `ProposalReview(type=METODOLOGICA)` + `checklist` |
| TP6A–TP6E Decisión cliente | `CustomerDecision`, `ProposalAdjustment` |
| T7A Checklist contratación | `ContractChecklist` + `ContractChecklistItem` |
| T7B Marco operativo | `OperationalFramework` |
| T7C Evidencia contractual | `ContractEvidence` |
| T7D Incidencia de contratación | `Incident(stage=CONTRATACION)` |
| T8A Agenda | `Milestone` + `Activity` |
| T8B Actividades | `Activity` |
| T8C Hitos | `Milestone` |
| T8D Incidencias | `Incident` |
| T8E Reuniones | `Meeting` |
| T8F Comunicaciones | `Communication` |
| T8G Entregables | `Deliverable` + `DeliverableVersion` |
| T8H Seguimiento ejecutivo | `AdvisoryReview` |
| T9A Cierre técnico | `ClosureDeclaration` |
| T9B Consolidado entregables | vista sobre `Deliverable` |
| T9C Checklist revisión final | `ClosureChecklist` + ítems |
| T9D Acta de entrega | `Document(stage=CIERRE, type=ACTA_ENTREGA)` |
| T9E Reunión de cierre | `Meeting(type=CIERRE)` |
| T9F Aceptación del cliente | `CustomerClosureResponse` |
| T9G Satisfacción | `CustomerEvaluation` |
| T9H Desempeño consultor | `ConsultantEvaluation` |
| TC1–TC7 Ciclo consultor | `Consultant`, `ConsultantStatusHistory`, `ConsultantScope`, `Sponsor` |
| TCOM1–TCOM12 | `NotificationTemplate` (filas en BD, parametrizables) |

## 4. Datos que el MVP **captura** pero no explota (preparación para reputación)

Siguiendo §48 del brief y el capítulo «ESTRELLA» del blueprint: no se construye sistema de estrellas,
pero sí se persiste todo lo que lo alimentaría — `ConsultantEvaluation` (cumplimiento de alcance,
tiempos, orden documental, satisfacción, resultado QA, complejidad atendida), conteo de casos,
incidencias imputables, tiempos de respuesta y resultados de QA. La vista
`consultant_performance_summary` los agrega; ningún cálculo de reputación se expone todavía.
