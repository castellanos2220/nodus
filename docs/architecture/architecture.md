# NODUS — Arquitectura del MVP

> Fuente: `Nodus Mvp Web Architecture Blueprint.pdf`, `911MiPyme-BluePrint OperativoMVP.docx`,
> `Matriz Requerimientos Mvp 911mipyme.pdf`, `NODUS_Matriz_Completa_Requerimientos_Cliente_y_Sistema.xlsx`,
> `NODUS_Matriz_Dinamica.xlsx`, `Diagrama Desarrollo 911mipyme.pptx`.

## 1. Naturaleza del sistema

NODUS es una plataforma SaaS de **orquestación empresarial**. No es un marketplace ni un CRM: es un
motor de proceso que gobierna el ciclo de vida de un *caso* entre una Mipyme y un consultor, mientras
la plataforma actúa como **orquestador neutral y veedor metodológico**.

Cinco propiedades transversales definen toda decisión de arquitectura:

| Propiedad | Consecuencia arquitectónica |
|---|---|
| **workflow-driven** | El estado del caso solo cambia por *transiciones* declaradas y validadas en backend. No existe `PATCH /cases/:id { status }`. |
| **event-driven** | Cada transición emite un evento de dominio. Notificaciones, SLA y proyecciones reaccionan al evento, nunca al controlador HTTP. |
| **audit-first** | Toda acción relevante escribe `AuditLog` dentro de la misma transacción que la escribe el cambio. El log es append-only. |
| **document-centric** | Los documentos son entidades de primera clase, versionadas, nunca sobrescritas, con storage abstraído. |
| **SLA-oriented** | El tiempo es un dato de negocio. Las reglas de SLA son filas en base de datos, no constantes en código. |

## 2. Estilo arquitectónico: Modular Monolith

Un único despliegue de backend (`apps/api`) dividido en **módulos NestJS con frontera explícita**.

```
┌──────────────────────────────────────────────────────────────┐
│ apps/web — Next.js 15 (App Router, RSC + Client Components)  │
└───────────────────────────────┬──────────────────────────────┘
                                │ REST + JWT (Bearer) 
┌───────────────────────────────▼──────────────────────────────┐
│ apps/api — NestJS                                            │
│                                                              │
│  ┌── Interface layer ─────────────────────────────────────┐  │
│  │ Controllers · DTOs (class-validator) · Swagger         │  │
│  │ Guards: JwtAuthGuard → RolesGuard → PermissionsGuard   │  │
│  │         → CaseAccessGuard (autorización por recurso)   │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌── Application layer ───────────────────────────────────┐  │
│  │ Services de módulo · Transacciones · Orquestación      │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌── Domain layer ────────────────────────────────────────┐  │
│  │ WorkflowEngine (máquina de estados + guards)           │  │
│  │ Domain events · Reglas de negocio puras                │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌── Infrastructure layer ────────────────────────────────┐  │
│  │ PrismaService · StorageService (S3/MinIO adapter)      │  │
│  │ MailerService (SMTP adapter) · QueueService (BullMQ)   │  │
│  │ CacheService (Redis) · Pino logger                     │  │
│  └────────────────────────────────────────────────────────┘  │
└──────┬──────────────┬──────────────┬─────────────┬───────────┘
       │              │              │             │
  ┌────▼────┐   ┌─────▼────┐   ┌─────▼────┐  ┌─────▼─────┐
  │Postgres │   │  Redis   │   │  MinIO   │  │  Mailpit  │
  └─────────┘   └──────────┘   └──────────┘  └───────────┘
                      ▲
              ┌───────┴────────┐
              │ apps/api:worker │  (mismo código, arranque `worker`)
              │ BullMQ processors: email, notifications,       │
              │ sla-evaluation (repeatable), sla-alerts        │
              └────────────────────────────────────────────────┘
```

### Reglas de frontera entre módulos

1. Un módulo **nunca** importa el `*.service.ts` de otro módulo de negocio para escribir. Para
   comunicarse publica un evento o usa un puerto compartido (`core/`).
2. `core/` contiene lo genuinamente transversal: Prisma, auth, eventos, auditoría, storage, colas,
   cache, logging. Todo módulo puede depender de `core/`; `core/` no depende de ningún módulo.
3. Los módulos de negocio se comunican hacia "abajo" (a `core/`) o por eventos, nunca lateralmente en
   ciclo. Esto es exactamente la frontera que se convertiría en un límite de servicio si mañana se
   extrae un microservicio.

### Por qué no microservicios en el MVP

Ver [ADR-001](../adr/ADR-001-modular-monolith.md). En síntesis: el dominio comparte una sola
transacción crítica (transición + historial + auditoría + evento + SLA) y partirla en servicios
obligaría a sagas y consistencia eventual sin ningún beneficio a esta escala.

## 3. Módulos

| Módulo | Responsabilidad | Requerimientos cubiertos |
|---|---|---|
| `auth` | Login, refresh rotativo, logout, hash Argon2id | RNF-003 |
| `users` | Usuarios, perfil, alta por Advisory | RF-010 |
| `roles` / `permissions` | RBAC: rol → permisos | RNF-003, RF-036 |
| `companies` | Empresa única, matching de duplicados, contactos | RF-001..006, RT-018 |
| `consultants` | Ciclo de vida, especialidades, alcance, sponsor | TC1–TC7 |
| `cases` | Caso, intake T1, edición restringida, timeline | RF-007..014 |
| `workflow` | Máquina de estados, transiciones, guards | RF-016, 024, 034, 046, 056, 064, 072, 080, 087 |
| `classifications` | Clasificación T2 + historial de reclasificación | RF-019..025 |
| `applications` | Bolsa interna, postulación T3C, evaluación T3D | RF-026..031, 035 |
| `assignments` | Asignación, responsable principal único | RF-032, 033 |
| `proposals` | Propuesta + versiones inmutables (TP4B/TP4C) | RF-037..045 |
| `reviews` | QA metodológico TP4H + peer review | RF-049..055 |
| `documents` | Repositorio, versiones, ACL, signed URLs | RT-019..023 |
| `contracts` | Checklist T7A, evidencias T7C, marco operativo T7B | RF-066..072 |
| `execution` | Agenda T8A, autorización, cierre técnico T9A | RF-073, 080, 081 |
| `activities` / `milestones` / `incidents` / `deliverables` | T8B, T8C, T8D, T8G | RF-074..079 |
| `communications` | Reuniones T8E, comunicaciones T8F | RF-047, 048 |
| `notifications` | Handlers de eventos → plantillas TCOM → cola | RT-010..014 |
| `sla` | Reglas, instancias, alertas, escalamiento | RT-006..009 |
| `audit` | Bitácora inmutable, filtros, timeline | RT-001..005 |
| `lookups` | Gobierno de LOV | RT-015..017 |
| `dashboard` | KPIs agregados | §31 |

## 4. Flujo de una transición (el corazón del sistema)

```
POST /cases/:id/transitions  { transition: "ASSIGN_CONSULTANT", payload: {...} }
   │
   ├─ JwtAuthGuard          ── ¿token válido?
   ├─ PermissionsGuard      ── ¿el rol tiene CASE_ASSIGN?
   ├─ CaseAccessGuard       ── ¿este usuario puede tocar ESTE caso?
   │
   ▼
WorkflowService.execute()
   │
   └─ prisma.$transaction( async tx => {
         1. SELECT ... FOR UPDATE  ─ bloqueo pesimista del caso (control de concurrencia)
         2. transition = registry.find(from=case.status, code)   ─ ¿existe la arista?
         3. assertActorAllowed(transition, user)                 ─ ¿rol permitido en la arista?
         4. await guard.check(tx, case, payload)                 ─ precondiciones de negocio
         5. effect(tx, case, payload)                            ─ efecto propio (crear assignment…)
         6. case.status = to  +  CaseStatusHistory.create        ─ persistencia
         7. AuditLog.create(before, after, actor, origin=USER)   ─ auditoría atómica
         8. SlaService.onTransition(tx, case, from, to)          ─ cierra/abre SlaInstance
      })
   │
   └─ eventBus.publish(ConsultantAssignedEvent)   ← FUERA de la transacción, tras commit
         ├─ NotificationHandler → RecipientResolver → Template → BullMQ
         └─ (futuro) proyecciones, webhooks
```

**Invariante**: los pasos 1–8 son atómicos. Si algo falla, no hay cambio de estado, ni historial, ni
auditoría inconsistente. Los efectos externos (correo) ocurren sólo tras el commit, vía cola.

## 5. Frontend

Next.js 15 App Router. Decisiones:

- **El frontend nunca decide permisos.** Calcula *visibilidad* (qué botón pintar) a partir de
  `GET /cases/:id` que devuelve `availableTransitions[]` **calculado por el backend** para el usuario
  autenticado. Si el frontend se equivoca, el backend rechaza con 403.
- **TanStack Query** para todo el estado de servidor; nada de estado de servidor duplicado en stores.
- **React Hook Form + Zod**; los esquemas Zod viven en `packages/types` y son la misma fuente que
  documenta los DTOs del backend.
- Sesión en cookie `httpOnly` gestionada por route handlers de Next (`/api/session`), de modo que el
  access token no queda accesible a JavaScript del navegador.

## 6. Optimización (decisiones deliberadas)

Ver [`docs/architecture/performance.md`](./performance.md) para el detalle y la justificación de cada
una: paginación keyset-friendly, `select` explícitos, eliminación de N+1, índices compuestos,
agregados SQL para el dashboard, cache Redis con invalidación por evento, límites de payload,
bloqueo pesimista sólo en transiciones, y trabajo pesado siempre fuera del request HTTP.

## 7. Estructura del repositorio y desviaciones justificadas

Ver [`docs/architecture/repo-structure.md`](./repo-structure.md).
