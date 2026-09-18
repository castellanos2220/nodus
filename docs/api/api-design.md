# Diseño de la API

Documentación viva e interactiva: **http://localhost:4000/api/v1/docs**

Prefijo global: `/api/v1`. Autenticación: `Authorization: Bearer <access token>`.

---

## Principios

### 1. El estado del caso sólo cambia por una puerta

```
POST /cases/:id/transitions   { transition, note?, payload? }
```

No existe `PATCH /cases/:id { status }` ni nada equivalente. Es una propiedad
estructural, no una convención: ningún otro servicio del sistema escribe
`case.status`.

`PATCH /cases/:id` existe, pero sólo edita título, descripción y clasificación
declarada por el cliente, y **sólo mientras el caso está en `CREADO`**.

### 2. El backend dice qué se puede hacer

`GET /cases/:id` incluye `availableTransitions[]`:

```json
[
  {
    "code": "AUTHORIZE_EXECUTION",
    "label": "Autorizar ejecución",
    "toStatus": "AUTORIZADO_PARA_EJECUCION",
    "allowed": false,
    "blockedBy": ["GUARD_CONTRACT_CHECKLIST_COMPLETE"],
    "blockedReason": "El checklist de contratación tiene 2 ítems obligatorios pendientes.",
    "requiresPayload": false
  }
]
```

Se calcula ejecutando en seco los mismos guards que se aplicarían de verdad. El
frontend pinta botones con esto; no reimplementa ninguna regla.

### 3. Forma estable de error

```json
{
  "statusCode": 409,
  "code": "GUARD_CHECKLIST_INCOMPLETE",
  "message": "El checklist de contratación tiene 2 ítems obligatorios pendientes.",
  "details": { "pending": ["Contrato firmado", "Póliza de cumplimiento"] },
  "path": "/api/v1/cases/…/transitions",
  "timestamp": "2026-09-17T21:48:52.270Z",
  "requestId": "0b1e…"
}
```

El `code` es parte del contrato y no depende de la redacción del mensaje. El
`requestId` correlaciona con el log estructurado y con la columna homónima de la
bitácora.

| Estado | Cuándo |
|---|---|
| `400` | Validación de entrada, código fuera de las LOV |
| `401` | Sin token, token inválido o expirado |
| `403` | Autenticado pero sin autorización |
| `404` | No existe — **o no debe saberse que existe** |
| `409` | El estado actual no permite la operación (guard, transición inválida, duplicado) |
| `422` | Semánticamente imposible |
| `429` | Límite de tasa |

### 4. Paginación uniforme

```json
{ "data": [...],
  "meta": { "page": 1, "pageSize": 20, "total": 87,
            "totalPages": 5, "hasNext": true, "hasPrev": false } }
```

`pageSize` tiene un tope duro de 100. `sortBy` sólo admite campos de una lista
blanca por endpoint: sin esa comprobación sería una vía para ordenar por columnas
que el cliente no debería conocer.

---

## Catálogo de endpoints

### Autenticación

| Método | Ruta | Notas |
|---|---|---|
| `POST` | `/auth/login` | Público. 10 intentos / 5 min |
| `POST` | `/auth/refresh` | Público. Rotación con detección de reutilización |
| `POST` | `/auth/logout` | Sin `refreshToken` cierra todas las sesiones |
| `GET` | `/auth/me` | Usuario, rol y permisos efectivos |
| `POST` | `/auth/change-password` | Invalida todas las sesiones |

### Onboarding

| Método | Ruta | Notas |
|---|---|---|
| `POST` | `/intake` | **Público**, 5 / 10 min. T1 completo en una transacción |
| `GET` | `/lookups/public/intake` | **Público**. Sólo las tres listas del formulario |

### Casos

| Método | Ruta | Permiso |
|---|---|---|
| `GET` | `/cases` | `CASE_READ` — alcance según rol |
| `POST` | `/cases` | `CASE_CREATE` |
| `GET` | `/cases/:id` | `CASE_READ` + acceso al recurso |
| `PATCH` | `/cases/:id` | `CASE_UPDATE` — sólo en `CREADO` |
| `GET` | `/cases/:id/timeline` | `CASE_READ` |
| `GET` | `/cases/:id/status-history` | `CASE_READ` |
| **`POST`** | **`/cases/:id/transitions`** | `CASE_READ` + acceso completo + rol en la arista |
| `GET` | `/cases/:id/transitions` | Transiciones disponibles, con motivo de bloqueo |
| `GET` | `/workflow/transitions` | Catálogo completo de la máquina de estados |

Filtros de `/cases`: `search`, `status`, `companyId`, `areaCode`,
`complexityCode`, `slaStatus`, `consultantId`, `createdFrom`, `createdTo`.

### Clasificación

| Método | Ruta | Permiso |
|---|---|---|
| `POST` | `/cases/:id/classification` | `CASE_CLASSIFY` |
| `GET` | `/cases/:id/classification/history` | `CASE_READ` |
| `GET` | `/cases/:id/classification/eligibility` | `CASE_READ` — qué falta para habilitar |

### Empresas

| Método | Ruta | Permiso |
|---|---|---|
| `GET` | `/companies` | `COMPANY_READ` |
| `POST` | `/companies/match` | `COMPANY_READ` — coincidencias antes de crear |
| `POST` | `/companies` | `COMPANY_CREATE` — 409 con candidatas si hay coincidencia exacta |
| `GET` | `/companies/:id` | `COMPANY_READ` |
| `GET` | `/companies/:id/cases` | `COMPANY_READ` — historial empresarial |
| `POST` | `/companies/:id/contacts` | `COMPANY_UPDATE` |

### Consultores y bolsa interna

| Método | Ruta | Permiso |
|---|---|---|
| `GET` | `/consultants` | `CONSULTANT_READ` |
| `GET` | `/consultants/opportunities` | `APPLICATION_CREATE` — bolsa elegible |
| `GET` | `/consultants/me/applications` | `APPLICATION_CREATE` |
| `GET` | `/consultants/me` | `CONSULTANT_SELF` |
| `GET` | `/consultants/sponsors` | `CONSULTANT_READ` |
| `POST` | `/consultants` | `CONSULTANT_MANAGE` — TC1 |
| `GET` | `/consultants/:id` | `CONSULTANT_READ` |
| `GET` | `/consultants/:id/performance` | `CONSULTANT_READ` — base de la futura reputación |
| `PATCH` | `/consultants/:id/classification` | `CONSULTANT_MANAGE` — TC3 |
| `PATCH` | `/consultants/:id/status` | `CONSULTANT_MANAGE` — TC2/TC7 |

### Postulaciones

| Método | Ruta | Permiso |
|---|---|---|
| `POST` | `/cases/:id/applications` | `APPLICATION_CREATE` — T3C |
| `GET` | `/cases/:id/applications` | `APPLICATION_READ` — advisory ve todas; el consultor, la suya |
| `DELETE` | `/cases/:id/applications/me` | `APPLICATION_CREATE` |

### Propuestas y QA

| Método | Ruta | Permiso |
|---|---|---|
| `GET` | `/cases/:id/proposal` | `PROPOSAL_READ` |
| `GET` | `/cases/:id/proposal/diff?from&to` | `PROPOSAL_READ` |
| `GET` | `/proposals/pending-review` | `PROPOSAL_REVIEW` |
| `GET` | `/proposals/versions/:versionId` | `PROPOSAL_READ` |
| `PATCH` | `/proposals/versions/:versionId` | `PROPOSAL_CREATE` — sólo borrador, sólo el responsable |
| `POST` | `/cases/:id/proposal/reviews` | `PROPOSAL_REVIEW` — TP4H o peer |
| `GET` | `/cases/:id/proposal/reviews` | `PROPOSAL_READ` |

### Contratación

| Método | Ruta | Permiso |
|---|---|---|
| `GET` | `/cases/:id/contract/checklist` | `CASE_READ` — con progreso |
| `PATCH` | `/cases/:id/contract/checklist/items/:itemId` | `CONTRACT_MANAGE` |
| `POST` | `/cases/:id/contract/evidences` | `CONTRACT_MANAGE` — T7C |
| `GET` | `/cases/:id/contract/evidences` | `CASE_READ` |
| `PUT` | `/cases/:id/contract/operational-framework` | `CASE_EXECUTE` — T7B |
| `GET` | `/cases/:id/contract/operational-framework` | `CASE_READ` |
| `GET` | `/checklist-templates` | `CONTRACT_MANAGE` |

### Ejecución

| Método | Ruta | Notas |
|---|---|---|
| `GET` | `/cases/:id/execution-summary` | Subestados y bloqueos para el cierre técnico |
| `GET` `POST` | `/cases/:id/activities` | T8B |
| `PATCH` | `/cases/:id/activities/:activityId` | |
| `GET` `POST` | `/cases/:id/milestones` | T8C |
| `PATCH` | `/cases/:id/milestones/:milestoneId` | Justificar exige explicación |
| `GET` `POST` | `/cases/:id/incidents` | T8D |
| `PATCH` | `/cases/:id/incidents/:incidentId` | Resolver exige decisión |
| `GET` `POST` | `/cases/:id/deliverables` | T8G |
| `PATCH` | `/cases/:id/deliverables/:deliverableId` | No admite «cargado» sin versión |
| `POST` | `/cases/:id/deliverables/:deliverableId/versions` | Versionado obligatorio |
| `GET` `POST` | `/cases/:id/meetings` | T8E / T9E |

### Cierre

| Método | Ruta | Permiso |
|---|---|---|
| `GET` | `/cases/:id/closure` | `CASE_READ` — qué falta para cerrar |
| `GET` | `/cases/:id/closure/declaration` | `CASE_READ` — T9A |
| `GET` | `/cases/:id/closure/checklist` | `CASE_READ` — T9C |
| `PATCH` | `/cases/:id/closure/checklist/items/:itemId` | `CASE_CLOSE` |
| `PUT` | `/cases/:id/closure/client-response` | `CASE_DECIDE` — T9F |
| `PUT` | `/cases/:id/closure/customer-evaluation` | `CASE_DECIDE` — T9G |
| `PUT` | `/cases/:id/closure/consultant-evaluation` | `CASE_CLOSE` — T9H |

### Documentos

| Método | Ruta | Permiso |
|---|---|---|
| `GET` | `/cases/:id/documents` | `DOCUMENT_READ` |
| `POST` | `/cases/:id/documents` | `DOCUMENT_UPLOAD` — multipart |
| `GET` | `/documents/:documentId` | `DOCUMENT_READ` |
| `GET` | `/documents/versions/:versionId/download-url` | `DOCUMENT_READ` — URL firmada 5 min |

### Comunicaciones

| Método | Ruta | Notas |
|---|---|---|
| `GET` `POST` | `/cases/:id/communications` | Un consultor en versión controlada no ve las internas |

### SLA

| Método | Ruta | Permiso |
|---|---|---|
| `GET` | `/sla` | `CASE_READ` — instancias con consumo y alertas |
| `GET` | `/sla/cases/:caseId` | `CASE_READ` — historial del caso |
| `GET` | `/sla/rules` | `CASE_READ` — parametrización vigente |
| `POST` | `/sla/rules` | `SLA_MANAGE` |
| `PATCH` | `/sla/evaluate` | `SLA_MANAGE` — fuerza el barrido del worker |

### Gobierno y transversales

| Método | Ruta | Permiso |
|---|---|---|
| `GET` | `/lookups` | `LOOKUP_READ` |
| `GET` | `/lookups/:listCode` | `LOOKUP_READ` |
| `POST` | `/lookups/:listCode/values` | `LOOKUP_MANAGE` |
| `DELETE` | `/lookups/:listCode/values/:code` | `LOOKUP_MANAGE` — desactiva, no borra |
| `GET` | `/audit` | `AUDIT_READ` — sólo lectura |
| `GET` | `/audit/actions` | `AUDIT_READ` |
| `GET` | `/notifications` | `NOTIFICATION_READ` |
| `GET` | `/notifications/unread-count` | `NOTIFICATION_READ` |
| `PATCH` | `/notifications/:id/read` | `NOTIFICATION_READ` |
| `POST` | `/notifications/read-all` | `NOTIFICATION_READ` |
| `GET` | `/notifications/templates` | `LOOKUP_MANAGE` |
| `GET` | `/dashboard/kpis` | `DASHBOARD_READ` |
| `GET` | `/dashboard/attention` | `DASHBOARD_READ` |
| `GET` | `/users` `/users/:id` `/roles` | `USER_MANAGE` |
| `GET` | `/health` `/health/ready` | Público |

---

## Nota sobre el orden de las rutas

`/consultants/opportunities` está declarada en `ConsultantsController`, no en
`ApplicationsController`, aunque pertenezca conceptualmente a postulaciones.

El motivo es concreto: Nest resuelve las rutas por orden de registro de módulos.
Declarada en otro controlador, `/consultants/:id` la habría capturado y
`opportunities` se habría interpretado como un id. Declararla en el controlador
que posee el prefijo `/consultants`, antes de la ruta paramétrica, elimina esa
dependencia de orden entre módulos en lugar de convivir con ella.
