# Catálogo de transiciones

Esta tabla es la **especificación normativa** del registro implementado en
`apps/api/src/modules/workflow/transitions.registry.ts`. El test
`workflow.registry.spec.ts` verifica que el código y esta tabla no diverjan en número de aristas,
estados alcanzables y terminales.

Leyenda de columnas:

- **Actores**: roles autorizados en la arista. Además del rol, se aplica autorización por recurso
  (`CaseAccessGuard`): p. ej. `CONSULTOR` significa *el consultor responsable asignado a este caso*.
- **Guards**: precondiciones de negocio verificadas dentro de la transacción. Si fallan → `409`.
- **Efecto**: escrituras propias de la transición, además de estado + historial + auditoría + SLA.
- **Evento**: evento de dominio publicado tras el commit.

---

| Código | Desde → Hacia | Actores | Guards | Efecto | Evento |
|---|---|---|---|---|---|
| `START_REVIEW` | `CREADO` → `EN_REVISION` | ADVISORY, SUPER_ADMIN | — | — | `CaseReviewStarted` |
| `REQUEST_INFO` | `EN_REVISION` → `EN_REVISION` | ADVISORY, SUPER_ADMIN | `note` obligatorio (≥10 chars) | Crea `Communication` tipo `SOLICITUD_INFORMACION` (T3B) | `CaseInformationRequested` |
| `CLASSIFY` | `EN_REVISION` → `CLASIFICADO` | ADVISORY, SUPER_ADMIN | Existe `CaseClassification` activa con área, tipo de intervención, complejidad e impacto (todos LOV); `eligibility = ELEGIBLE` | Marca la clasificación como confirmada | `CaseClassified` |
| `REJECT_INELIGIBLE` | `EN_REVISION` → `CERRADO_SIN_CONTRATACION` | ADVISORY, SUPER_ADMIN | `reason` obligatorio | Registra `closureReason` | `CaseClosedWithoutContracting` |
| `PUBLISH` | `CLASIFICADO` → `EN_POSTULACION` | ADVISORY, SUPER_ADMIN | Caso clasificado | Fija `publishedAt`, `applicationDeadline` | `CasePublished` |
| `ASSIGN_CONSULTANT` | `EN_POSTULACION` → `ASIGNADO` | ADVISORY, SUPER_ADMIN | ≥1 `Application` recibida; la postulación elegida pertenece a este caso; consultor en estado `HABILITADO`; `maxComplexity` del consultor ≥ complejidad del caso; **no existe otra `CaseAssignment` activa con `isPrimary = true`** | Crea `CaseAssignment(isPrimary=true)`; `ApplicationEvaluation` para todas las postulaciones; marca la ganadora `ACEPTADA` y el resto `NO_SELECCIONADA` | `ConsultantAssigned` |
| `OPEN_PROPOSAL` | `ASIGNADO` → `PROPUESTA_EN_DISENO` | CONSULTOR (asignado), ADVISORY | Existe asignación primaria activa | Crea `Proposal` + `ProposalVersion` v1 en `BORRADOR` | `ProposalCreated` |
| `SUBMIT_FOR_QA` | `PROPUESTA_EN_DISENO` → `PROPUESTA_LISTA_PARA_QA` | CONSULTOR (asignado) | La versión vigente tiene los bloques mínimos TP4C no vacíos: resumen, objetivo, alcance, exclusiones, actividades, entregables, cronograma, valoración, condiciones | Congela la versión (`status = EN_QA`, `frozenAt`) | `ProposalSubmitted` |
| `REQUEST_PROPOSAL_CHANGES` | `PROPUESTA_LISTA_PARA_QA` → `PROPUESTA_EN_DISENO` | ADVISORY, CONSULTOR_REVISOR, SUPER_ADMIN | Existe `ProposalReview` con `outcome = AJUSTES_SOLICITADOS` y ≥1 observación | Crea nueva `ProposalVersion` (n+1) en `BORRADOR` copiando la anterior | `ProposalAdjustmentRequested` |
| `APPROVE_AND_SEND` | `PROPUESTA_LISTA_PARA_QA` → `PROPUESTA_ENVIADA` | ADVISORY, SUPER_ADMIN | Existe `ProposalReview` tipo `METODOLOGICA` con `outcome = APROBADA` sobre la versión vigente | Marca versión `ENVIADA`, `sentAt` | `ProposalSent` |
| `OPEN_CLIENT_DECISION` *(auto)* | `PROPUESTA_ENVIADA` → `EN_DECISION_CLIENTE` | SYSTEM | — | Abre `decisionOpenedAt`; instancia SLA de respuesta de cliente | `ClientDecisionWindowOpened` |
| `CLIENT_REQUEST_ADJUSTMENTS` | `EN_DECISION_CLIENTE` → `AJUSTES_DE_PROPUESTA` | CLIENTE_MIPYME (de la empresa del caso) | `details` obligatorio | Crea `ProposalAdjustment` (TP6B) + nueva `ProposalVersion` en `BORRADOR` | `ClientDecisionReceived` |
| `SUBMIT_ADJUSTED` | `AJUSTES_DE_PROPUESTA` → `PROPUESTA_LISTA_PARA_QA` | CONSULTOR (asignado) | Existe `ProposalVersion` con número > versión enviada y bloques mínimos completos | Congela la nueva versión; responde el `ProposalAdjustment` (TP6C) | `ProposalSubmitted` |
| `CLIENT_ACCEPT` | `EN_DECISION_CLIENTE` → `PROPUESTA_ACEPTADA` | CLIENTE_MIPYME (de la empresa del caso) | Existe versión en estado `ENVIADA` | Marca versión `ACEPTADA`; registra `CustomerDecision` (TP6D) | `ClientDecisionReceived` |
| `CLIENT_DECLINE` | `EN_DECISION_CLIENTE` → `CERRADO_SIN_CONTRATACION` | CLIENTE_MIPYME (de la empresa del caso) | `reason` obligatorio | Registra `closureReason` y `reactivationPotential` (TP6E) | `CaseClosedWithoutContracting` |
| `START_CONTRACTING` *(auto)* | `PROPUESTA_ACEPTADA` → `PENDIENTE_CONTRATACION` | SYSTEM | — | Instancia `ContractChecklist` + ítems desde la plantilla T7A vigente | `ContractingStarted` |
| `AUTHORIZE_EXECUTION` | `PENDIENTE_CONTRATACION` → `AUTORIZADO_PARA_EJECUCION` | ADVISORY, SUPER_ADMIN | **Todos** los ítems obligatorios del checklist en `CUMPLIDO`; existe `OperationalFramework` (T7B) del caso | Fija `authorizedAt`, `authorizedById` | `ExecutionAuthorized` |
| `START_EXECUTION` | `AUTORIZADO_PARA_EJECUCION` → `EN_EJECUCION` | CONSULTOR (asignado), ADVISORY | Existe agenda: ≥1 `Milestone` **o** ≥1 `Activity` | Fija `executionStartedAt` | `ExecutionStarted` |
| `TECHNICAL_CLOSURE` | `EN_EJECUCION` → `LISTO_PARA_CIERRE` | CONSULTOR (asignado) | Todo `Deliverable` en `LISTO_PARA_CIERRE`; todo `Milestone` en `CUMPLIDO` o `JUSTIFICADO`; ninguna `Incident` en `ABIERTA`/`EN_ATENCION`/`ESCALADA` con impacto `ALTO`/`CRITICO` | Crea `ClosureDeclaration` (T9A) | `CaseReadyForClosure` |
| `REOPEN_EXECUTION` | `LISTO_PARA_CIERRE` → `EN_EJECUCION` | ADVISORY, SUPER_ADMIN | `reason` obligatorio | Revierte la declaración de cierre técnico | `ExecutionReopened` |
| `CLOSE_CASE` | `LISTO_PARA_CIERRE` → `CERRADO` | ADVISORY, SUPER_ADMIN | Checklist T9C completo; existe `CustomerClosureResponse` (T9F) con `ACEPTACION` o `CIERRE_CON_OBSERVACIONES`; existe `CustomerEvaluation` (T9G); existe `ConsultantEvaluation` (T9H) | Fija `closedAt`, `outcome` | `CaseClosed` |

---

## Guards implementados como clases

Cada guard es una clase con `check(tx, ctx): Promise<void>` que lanza `WorkflowGuardError` con un
código estable y un mensaje en español. Esto permite que el frontend muestre exactamente **qué falta**
para poder avanzar, sin duplicar la regla:

```json
409 Conflict
{
  "statusCode": 409,
  "code": "GUARD_CHECKLIST_INCOMPLETE",
  "message": "El checklist de contratación tiene 2 ítems obligatorios pendientes.",
  "details": { "pending": ["Contrato firmado", "Póliza de cumplimiento"] }
}
```

`GET /cases/:id` incluye, para cada transición posible desde el estado actual, si el usuario podría
ejecutarla y, si no, por qué:

```json
"availableTransitions": [
  { "code": "AUTHORIZE_EXECUTION", "label": "Autorizar ejecución",
    "allowed": false, "blockedBy": ["GUARD_CHECKLIST_INCOMPLETE"] }
]
```

## Prueba de autorización obligatoria

`test/e2e/workflow-authorization.e2e-spec.ts` demuestra que un `CONSULTOR` recibe `403` al intentar
`CLASSIFY` y que un `CLIENTE_MIPYME` de otra empresa recibe `403` al intentar `CLIENT_ACCEPT` sobre un
caso ajeno — y que en ambos casos el estado del caso **no cambia**.
