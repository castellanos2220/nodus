# NODUS — Plataforma de orquestación empresarial

MVP funcional de NODUS: la gestión trazable y gobernada del ciclo completo de
atención de casos entre Mipymes y consultores, desde el registro de una necesidad
hasta el cierre formal con evaluación.

No es una maqueta. Todo lo que se ve en la interfaz está respaldado por
persistencia real y aplicada, permisos verificados en backend, reglas de negocio que
bloquean de verdad y una bitácora que no se puede alterar.

---

## Tabla de contenido

1. [Qué hace el sistema](#1-qué-hace-el-sistema)
2. [Arranque rápido](#2-arranque-rápido)
3. [Credenciales de demostración](#3-credenciales-de-demostración)
4. [Recorrido de la demo](#4-recorrido-de-la-demo)
5. [Arquitectura](#5-arquitectura)
6. [Stack](#6-stack)
7. [Estructura del repositorio](#7-estructura-del-repositorio)
8. [Variables de entorno](#8-variables-de-entorno)
9. [Comandos](#9-comandos)
10. [Ciclo de vida del caso](#10-ciclo-de-vida-del-caso)
11. [Módulos](#11-módulos)
12. [Decisiones de arquitectura](#12-decisiones-de-arquitectura)
13. [Optimización](#13-optimización)
14. [Seguridad](#14-seguridad)
15. [Pruebas](#15-pruebas)
16. [Documentación](#16-documentación)
17. [Resolución de problemas](#17-resolución-de-problemas)

---

## 1. Qué hace el sistema

NODUS es una plataforma **orquestadora neutral**: no ejecuta la consultoría ni es
parte contractual. Gobierna el proceso, la trazabilidad y los tiempos.

```
Mipyme → Caso → Debida diligencia → Clasificación → Bolsa de consultores
   → Postulación → Asignación → Propuesta → QA → Decisión del cliente
   → Contratación → Ejecución → Seguimiento → Cierre
```

Cinco propiedades transversales lo definen y condicionan cada decisión técnica:

| Propiedad | Cómo se materializa |
|---|---|
| **workflow-driven** | 17 estados y 21 transiciones declaradas. `POST /cases/:id/transitions` es la **única** puerta de cambio de estado en todo el sistema. |
| **event-driven** | Cada transición emite un evento de dominio tras el commit. Notificaciones y SLA reaccionan al evento, nunca al controlador HTTP. |
| **audit-first** | Toda acción relevante escribe en `AuditLog` dentro de la misma transacción. Append-only, protegido por triggers de PostgreSQL. |
| **document-centric** | Documentos y propuestas versionados. Ninguna versión se sobrescribe jamás. |
| **SLA-oriented** | Las reglas de SLA son filas de base de datos. **Cero horas escritas en código.** |

---

## 2. Arranque rápido

### Requisitos

- **Docker Desktop** (con Docker Compose v2)
- **Node.js ≥ 20.11** y **pnpm ≥ 9** (`npm i -g pnpm`)

### Opción A — Todo en contenedores

```bash
git clone <repositorio> && cd NODUS-Ingenieria-SAS
cp .env.example .env

docker compose up -d                 # infraestructura + api + worker + web
docker compose exec api pnpm db:seed # datos de demostración
```

### Opción B — Infraestructura en Docker, aplicación en el host *(recomendada para desarrollar)*

```bash
cp .env.example .env
pnpm install

docker compose up -d postgres redis minio mailpit

pnpm --filter @nodus/types build   # contratos compartidos
pnpm prisma:migrate                # aplica migraciones
pnpm db:seed                       # datos de demostración
pnpm dev                           # API :4000 + Web :3000
```

> El worker es un proceso aparte: `pnpm dev:worker`. Sin él, la API funciona y
> los casos avanzan; lo que se detiene es el envío de correo y los barridos de
> SLA (los jobs se acumulan en Redis y se procesan cuando el worker vuelve).

### URLs

| Servicio | URL |
|---|---|
| **Aplicación web** | http://localhost:3000 |
| **API** | http://localhost:4000/api/v1 |
| **Swagger** | http://localhost:4000/api/v1/docs |
| **Salud detallada** | http://localhost:4000/api/v1/health/ready |
| **Mailpit** (correos) | http://localhost:8025 |
| **MinIO** (consola) | http://localhost:9001 |

### Verificación

```bash
node infra/scripts/smoke.mjs
```

Comprueba 35 cosas contra la API en ejecución: salud de las cuatro dependencias,
autenticación, alcance de datos por rol, cálculo de transiciones, trazabilidad,
SLA, notificaciones, dashboard, bolsa interna, empresa única y —lo más
importante— **que un actor sin autorización no puede mover un caso**.

---

## 3. Credenciales de demostración

Contraseña para todas las cuentas: **`Nodus2026*`**

| Correo | Rol | Qué demuestra |
|---|---|---|
| `admin@nodus.local` | Super administrador | Gobierno de plataforma: LOV, roles, plantillas, SLA |
| `advisory@nodus.local` | Advisory / PMO | Debida diligencia, clasificación, asignación, QA, veeduría, cierre |
| `revisor@nodus.local` | Consultor revisor | Peer review de propuestas |
| `ana.velez@consultor.nodus.local` | Consultora (operaciones) | Bolsa, postulación, propuesta, ejecución |
| `bruno.salcedo@consultor.nodus.local` | Consultor (finanzas, con sponsor) | Modalidad sponsor, complejidad estratégica |
| `claudia.ibanez@consultor.nodus.local` | Consultora (tecnología) | Caso en decisión del cliente |
| `maria.restrepo@acerosdelnorte.com` | Cliente Mipyme | Crea casos, decide sobre propuestas, acepta el cierre |
| `carlos.duarte@vitalissalud.com` | Cliente Mipyme (otra empresa) | Aislamiento entre empresas |

Detalle completo, con el reparto de casos por cuenta, en
[`docs/demo/credentials.md`](docs/demo/credentials.md).

---

## 4. Recorrido de la demo

El seed deja **8 casos en 8 estados distintos**, generados ejecutando las
transiciones reales del motor de workflow — no insertados con su estado final
escrito a mano. El guion completo está en
[`docs/demo/demo-script.md`](docs/demo/demo-script.md); en síntesis:

| Caso | Estado | Qué mirar |
|---|---|---|
| `CAS-000001` | **CERRADO** | El ciclo completo: 15 transiciones, 20 eventos en la bitácora, dos versiones de entregable, evaluaciones de cliente y consultor |
| `CAS-000002` | **EN EJECUCIÓN** | Agenda activa, hitos, una incidencia abierta y entregables en curso |
| `CAS-000003` | **EN DECISIÓN DEL CLIENTE** | Entrar como cliente y aceptar, pedir ajustes o declinar |
| `CAS-000004` | **EN POSTULACIÓN** | Dos postulaciones recibidas, listas para evaluar y asignar |
| `CAS-000005` | **PROPUESTA LISTA PARA QA** | Bandeja de QA con un peer review ya registrado |
| `CAS-000006` | **EN REVISIÓN** | Debida diligencia en curso, con solicitud de ampliación al cliente |
| `CAS-000007` | **CREADO** | Editable por el cliente sólo en este estado |
| `CAS-000008` | **CERRADO SIN CONTRATACIÓN** | Ruta comercial alternativa, con motivo y potencial de reactivación |

**Lo que conviene mirar en dos minutos**

1. Entre como `advisory@nodus.local` → abra `CAS-000001` → pestaña
   **Trazabilidad**: 20 eventos, con actor, origen (usuario o sistema) y delta.
2. En el mismo caso, pestaña **Propuesta**: las versiones conviven; la congelada
   no admite edición.
3. Abra `CAS-000004` y mire el panel de **Acciones**: «Asignar consultor» está
   disponible; otras aparecen bloqueadas **con el motivo que da el backend**.
4. Entre ahora como `ana.velez@consultor.nodus.local` y abra ese mismo caso: ve
   la versión controlada, sin identidad del cliente.
5. Vuelva a advisory, asigne el consultor y vea cómo el caso avanza, se abre un
   reloj de SLA nuevo y llega un correo a Mailpit.

---

## 5. Arquitectura

**Monolito modular** con worker separado. Detalle en
[`docs/architecture/architecture.md`](docs/architecture/architecture.md).

```
┌────────────────────────────────────────────────────────────┐
│ apps/web — Next.js 15 (App Router)                         │
│  · el token vive en cookie httpOnly; el navegador no lo ve │
│  · /api/proxy adjunta el token y rota el refresh solo      │
└───────────────────────────┬────────────────────────────────┘
                            │ REST + JWT
┌───────────────────────────▼────────────────────────────────┐
│ apps/api — NestJS                                          │
│  Interface  : Controllers · DTOs · Swagger                 │
│               Guards: Jwt → Throttler → Permissions        │
│                       → CaseAccess (por recurso)           │
│  Application: Services · Transacciones                     │
│  Domain     : WorkflowEngine · Guards · Eventos            │
│  Infra      : Prisma · Storage(S3) · Mailer(SMTP)          │
│               Queue(BullMQ) · Cache(Redis)                 │
└────┬─────────────┬─────────────┬───────────────┬───────────┘
     │             │             │               │
 ┌───▼────┐  ┌─────▼────┐  ┌─────▼────┐  ┌───────▼───────┐
 │Postgres│  │  Redis   │  │  MinIO   │  │   Mailpit     │
 └────────┘  └─────▲────┘  └──────────┘  └───────────────┘
                   │
           ┌───────┴────────────────────────────┐
           │ apps/api:worker (mismo código)     │
           │ email · notificaciones · SLA       │
           └────────────────────────────────────┘
```

### El corazón: una transición de caso

```
POST /cases/:id/transitions  { transition: "ASSIGN_CONSULTANT", payload: {…} }
   │
   ├─ JwtAuthGuard        ¿token válido?
   ├─ PermissionsGuard    ¿el rol tiene CASE_ASSIGN?
   ├─ CaseAccessGuard     ¿puede tocar ESTE caso?
   │
   ▼  prisma.$transaction:
      1. SELECT … FOR UPDATE            ← bloqueo pesimista
      2. buscar arista desde el estado actual
      3. rol + ámbito en esa arista
      4. guards de negocio
      5. efecto propio
      6. estado + CaseStatusHistory
      7. AuditLog                       ← atómico con el cambio
      8. relojes de SLA
      9. transición encadenada, si la hay
   │
   └─ eventBus.publish()  ← DESPUÉS del commit
        └─ NotificationHandler → RecipientResolver → Template → BullMQ → email
```

Los pasos 1–9 son atómicos. Los efectos externos ocurren sólo tras el commit: un
correo enviado por un cambio que luego hace rollback no se puede deshacer.

---

## 6. Stack

| Capa | Tecnología | Por qué |
|---|---|---|
| Frontend | Next.js 15, React 19, TypeScript, TailwindCSS, shadcn/ui | App Router; el estado de servidor lo lleva TanStack Query |
| Formularios | React Hook Form + Zod | Esquemas compartidos con el backend en `packages/types` |
| Backend | NestJS 11, TypeScript | Módulos con frontera explícita, DI, guards componibles |
| Base de datos | PostgreSQL 16 + Prisma 6 | Índices parciales, `pg_trgm`, triggers, tipos derivados del esquema |
| Colas y caché | Redis 7 + BullMQ | Trabajo asíncrono con reintentos e idempotencia |
| Documentos | MinIO (S3) tras `StorageService` | Un adaptador sirve para local y producción |
| Correo | Mailpit (SMTP) tras `MailerService` | Mismo adaptador para cualquier SMTP |
| Auth | JWT + refresh rotativo, Argon2id, RBAC | Detección de reutilización de token |

---

## 7. Estructura del repositorio

```
NODUS-Ingenieria-SAS/
├── apps/
│   ├── api/                  NestJS
│   │   ├── prisma/           esquema, migraciones y seed
│   │   ├── src/core/         transversal: prisma, auth, eventos, auditoría…
│   │   ├── src/modules/      25 módulos de negocio
│   │   └── test/             unit · integration · e2e
│   └── web/                  Next.js 15
├── packages/
│   ├── types/                enums, esquemas Zod y contratos compartidos
│   └── config/               presets de TypeScript y ESLint
├── infra/
│   ├── docker/               Dockerfiles y init de PostgreSQL
│   └── scripts/              bootstrap y smoke test
├── docs/                     architecture · domain · workflow · database ·
│                             api · adr · security · demo
├── docker-compose.yml
└── .env.example
```

Dos desviaciones respecto de la estructura propuesta en el brief, justificadas en
[`docs/architecture/repo-structure.md`](docs/architecture/repo-structure.md):
`prisma/` vive dentro de `apps/api`, y no existe `packages/ui`.

---

## 8. Variables de entorno

Un único `.env` en la raíz. Partir de `.env.example`; `.env` **nunca** se
commitea.

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL, con `connection_limit` y `pool_timeout` |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Firma de tokens. Deben ser distintos entre sí |
| `JWT_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | Vigencias (`15m` / `7d`) |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_URL` | Colas y caché |
| `S3_ENDPOINT` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` / `S3_BUCKET` | Almacenamiento documental |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` | Envío de correo |
| `APP_URL` / `API_URL` / `CORS_ORIGINS` | URLs públicas y orígenes permitidos |
| `MAX_FILE_SIZE_MB` / `MAX_REQUEST_BODY_MB` | Límites de carga |
| `SLA_EVALUATION_CRON` | Frecuencia del barrido de SLA |
| `THROTTLE_*` | Límites de tasa (global y de autenticación) |

En producción, el arranque **falla** si `JWT_SECRET` conserva un valor de ejemplo
o coincide con `JWT_REFRESH_SECRET`. Es deliberado: un secreto de ejemplo en
producción es un fallo de despliegue, no un aviso.

Genere secretos reales con:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

---

## 9. Comandos

```bash
# Infraestructura
pnpm docker:up            # levanta los servicios
pnpm docker:down          # los detiene
pnpm docker:reset         # los detiene y borra los volúmenes
pnpm docker:logs          # sigue los logs

# Base de datos
pnpm prisma:migrate       # aplica migraciones (deploy)
pnpm prisma:migrate:dev   # crea y aplica una migración nueva
pnpm prisma:studio        # explorador visual de datos
pnpm db:seed              # datos de demostración
pnpm db:reset             # reinicia la base y vuelve a sembrar

# Desarrollo
pnpm dev                  # API + Web
pnpm dev:api              # sólo API
pnpm dev:web              # sólo Web
pnpm dev:worker           # worker de colas y SLA

# Calidad
pnpm lint                 # ESLint en todos los paquetes
pnpm typecheck            # TypeScript en modo estricto
pnpm format               # Prettier
pnpm build                # compila types, api y web

# Pruebas
pnpm test                 # unitarias        (44)
pnpm test:integration     # integración      (25)
pnpm test:e2e             # end-to-end       (54)
pnpm test:all             # las 123
pnpm smoke                # verificación contra la API en ejecución (35)
```

---

## 10. Ciclo de vida del caso

17 estados, 21 transiciones. Especificación completa en
[`docs/workflow/case-lifecycle.md`](docs/workflow/case-lifecycle.md) y
[`docs/workflow/transitions.md`](docs/workflow/transitions.md).

```
CREADO ──► EN REVISIÓN ──► CLASIFICADO ──► EN POSTULACIÓN ──► ASIGNADO
                │                                                  │
                └──► CERRADO SIN CONTRATACIÓN ◄──┐                  ▼
                                                 │        PROPUESTA EN DISEÑO
                                                 │                  │
                                                 │                  ▼
                                                 │     PROPUESTA LISTA PARA QA ◄─┐
                                                 │                  │            │
                                                 │                  ▼            │
                                                 │        PROPUESTA ENVIADA      │
                                                 │                  │ (auto)     │
                                                 │                  ▼            │
                                                 └──── EN DECISIÓN DEL CLIENTE ──┤
                                                                    │            │
                                          AJUSTES DE PROPUESTA ─────┘            │
                                                    └────────────────────────────┘
                                                                    │
                                                    PROPUESTA ACEPTADA
                                                                    │ (auto)
                                                                    ▼
                                                    PENDIENTE DE CONTRATACIÓN
                                                                    ▼
                                                  AUTORIZADO PARA EJECUCIÓN
                                                                    ▼
                                                            EN EJECUCIÓN
                                                                    ▼
                                                        LISTO PARA CIERRE
                                                                    ▼
                                                                CERRADO
```

**Puntos de control que bloquean de verdad**

- Sin clasificación completa y elegible → no se publica.
- Sin postulaciones, o con un consultor no habilitado o fuera de su complejidad
  → no se asigna.
- Sin los bloques mínimos de la propuesta → no pasa a QA.
- Sin revisión metodológica aprobada → no se envía al cliente.
- Sin checklist T7A completo **y** marco operativo T7B cargado → no se autoriza
  la ejecución.
- Sin agenda → no arranca la ejecución.
- Con entregables, hitos o incidencias críticas pendientes → no hay cierre
  técnico.
- Sin revisión final, aceptación del cliente y ambas evaluaciones → no se cierra.

---

## 11. Módulos

| Módulo | Responsabilidad |
|---|---|
| `auth` · `users` · `roles` | Sesión, RBAC, matriz rol → permisos |
| `companies` | Empresa única, matching de duplicados, contactos |
| `consultants` | Ciclo de vida del consultor, clasificación, alcance, sponsor |
| `cases` | Intake T1, edición restringida, listados por rol, timeline |
| `workflow` | Máquina de estados, guards, efectos, transiciones disponibles |
| `classifications` | T2 y su historial de reclasificaciones |
| `applications` | Bolsa interna, postulación T3C, evaluación T3D |
| `proposals` | Propuesta, versiones inmutables, QA y peer review |
| `contracts` | Checklist T7A, evidencias T7C, marco operativo T7B |
| `execution` | Agenda T8A, actividades, hitos, incidencias, entregables y cierre T9 |
| `documents` | Repositorio versionado, validación de contenido, URLs firmadas |
| `communications` | Interacción estructurada y reuniones |
| `notifications` | Eventos → destinatarios → plantillas TCOM → cola → correo |
| `sla` | Reglas parametrizadas, instancias, alertas y escalamiento |
| `audit` | Consulta de la bitácora inmutable |
| `lookups` | Gobierno de listas de valores |
| `dashboard` | KPIs agregados por SQL |

---

## 12. Decisiones de arquitectura

| ADR | Decisión |
|---|---|
| [ADR-001](docs/adr/ADR-001-modular-monolith.md) | Monolito modular con worker separado |
| [ADR-002](docs/adr/ADR-002-postgresql-prisma.md) | PostgreSQL + Prisma, con SQL a mano donde aporta |
| [ADR-003](docs/adr/ADR-003-docker.md) | Docker Compose para desarrollo y evaluación |
| [ADR-004](docs/adr/ADR-004-redis-queue.md) | Redis + BullMQ para trabajo asíncrono y caché |
| [ADR-005](docs/adr/ADR-005-document-storage-abstraction.md) | Abstracción de almacenamiento documental |
| [ADR-006](docs/adr/ADR-006-workflow-state-machine.md) | Máquina de estados declarativa como única puerta |
| [ADR-007](docs/adr/ADR-007-audit-log.md) | Bitácora append-only con tres candados |
| [ADR-008](docs/adr/ADR-008-notification-architecture.md) | Notificaciones dirigidas por eventos |

Cuando los documentos fuente se contradecían, la diferencia y la decisión tomada
están registradas en
[`docs/architecture/source-discrepancies.md`](docs/architecture/source-discrepancies.md)
(diez casos documentados).

---

## 13. Optimización

Detalle y justificación en
[`docs/architecture/performance.md`](docs/architecture/performance.md). En
resumen:

- **Paginación con tope duro** (100): ningún cliente puede pedir «todo».
- **`select` explícitos**: los listados no traen descripciones de 5 000
  caracteres ni relaciones completas.
- **Sin N+1**: las relaciones se resuelven con `select` anidado en la misma
  consulta.
- **Índices dictados por las consultas reales**, incluidos compuestos
  (`status, createdAt`), parciales e índices GIN de trigramas.
- **Agregados SQL para el dashboard**: `groupBy`, `count` y `AVG`; nunca se traen
  filas a Node para contarlas.
- **`hoursInPreviousStatus` materializado** en cada transición: los tiempos
  medios por etapa son un `AVG` sobre un índice, no una reconstrucción del
  historial.
- **Caché con invalidación por evento** (LOV y KPIs), que degrada sin romper si
  Redis cae.
- **Bloqueo pesimista sólo en transiciones**, que es donde hay carrera real.
- **Trabajo pesado siempre fuera del request HTTP.**
- **Límites de payload y de archivo**; validación de MIME, extensión y firma
  binaria.
- **Logs estructurados** con `requestId` correlacionado con la bitácora.

---

## 14. Seguridad

Detalle en [`docs/security/security.md`](docs/security/security.md).

- **Argon2id** para contraseñas; bloqueo temporal tras 5 intentos fallidos.
- **Refresh rotativo con detección de reutilización**: presentar un token ya
  rotado revoca toda la cadena de sesiones del usuario.
- Sólo se almacena el **SHA-256** del refresh token.
- **El frontend no decide permisos.** Calcula qué pintar a partir de
  `availableTransitions`, que el backend calcula; si se equivoca, el backend
  responde 403.
- **Tres capas de autorización**: permiso de rol, acceso al recurso y rol
  autorizado en la arista concreta.
- Token en **cookie `httpOnly`**: no es accesible al JavaScript del navegador.
- `whitelist` + `forbidNonWhitelisted` en la validación: un campo no declarado
  es un error, no algo que se ignora en silencio (anti mass-assignment).
- Rate limiting global y específico en autenticación.
- Helmet, CORS acotado por lista, secretos sólo por variables de entorno.
- URLs firmadas de corta duración; el bucket nunca es público.

---

## 15. Pruebas

```
Unitarias      44  registro de transiciones, normalización de nombres, resolución de SLA
Integración    25  matching de empresa (pg_trgm real) e invariantes de base de datos
End-to-end     54  ciclo completo de 15 estados + autorización
──────────────────
Total         123
```

Ejecutar todo: `pnpm test:all`

Las pruebas de integración y E2E corren contra una base **propia** (`nodus_test`),
creada y migrada automáticamente, para no tocar los datos de demostración.

Tres cosas que estas pruebas demuestran y que conviene destacar:

1. **`test/e2e/authorization.e2e-spec.ts`** — un consultor **asignado al caso**
   recibe 403 al intentar clasificarlo, y el estado del caso **no cambia**. El
   rechazo es por rol en la arista, no por falta de acceso: el consultor sí puede
   leer ese caso.
2. **`test/e2e/full-lifecycle.e2e-spec.ts`** — recorre CREADO → CERRADO por HTTP
   real, y en cada etapa intenta primero el atajo y comprueba que el guard lo
   rechaza con su código.
3. **`test/integration/database-invariants.spec.ts`** — escribe con Prisma
   saltándose todos los servicios y guards, para comprobar que la base sigue
   rechazando un segundo responsable principal, la edición de la bitácora y la
   modificación de una versión congelada.

---

## 16. Documentación

| Documento | Contenido |
|---|---|
| [`docs/architecture/architecture.md`](docs/architecture/architecture.md) | Arquitectura general y flujo de una transición |
| [`docs/architecture/repo-structure.md`](docs/architecture/repo-structure.md) | Estructura y desviaciones justificadas |
| [`docs/architecture/source-discrepancies.md`](docs/architecture/source-discrepancies.md) | Contradicciones entre documentos fuente y decisiones |
| [`docs/architecture/performance.md`](docs/architecture/performance.md) | Optimizaciones y su justificación |
| [`docs/domain/domain-model.md`](docs/domain/domain-model.md) | Agregados, plantillas oficiales → entidades |
| [`docs/workflow/case-lifecycle.md`](docs/workflow/case-lifecycle.md) | Los 17 estados |
| [`docs/workflow/transitions.md`](docs/workflow/transitions.md) | Las 21 transiciones con guards y efectos |
| [`docs/database/erd.md`](docs/database/erd.md) | Modelo entidad-relación e índices |
| [`docs/api/api-design.md`](docs/api/api-design.md) | Diseño de la API y catálogo de endpoints |
| [`docs/security/security.md`](docs/security/security.md) | Modelo de seguridad y RBAC |
| [`docs/demo/credentials.md`](docs/demo/credentials.md) | Cuentas y datos de demostración |
| [`docs/demo/demo-script.md`](docs/demo/demo-script.md) | Guion de demostración paso a paso |
| [`docs/adr/`](docs/adr/) | Ocho registros de decisión de arquitectura |

---

## 17. Resolución de problemas

**`docker compose up` falla al descargar MinIO**
Las imágenes `minio/minio` de Docker Hub ya no son accesibles de forma anónima. El
compose usa `quay.io/minio/minio`, que es el registro oficial vigente.

**La API no arranca: «Configuración de entorno inválida»**
Falta o es inválida alguna variable. El mensaje dice exactamente cuál. Verifique
que copió `.env.example` a `.env`.

**`prisma migrate` no encuentra `DATABASE_URL`**
El monorepo mantiene un único `.env` en la raíz; `apps/api/prisma.config.ts` lo
carga. Ejecute los comandos desde la raíz (`pnpm prisma:migrate`) o desde
`apps/api`.

**El seed dice que ya existen casos**
Es idempotente por diseño: no duplica los datos de demostración. Para regenerar
desde cero, `pnpm db:reset`.

**No llegan los correos**
Compruebe que el worker está corriendo (`pnpm dev:worker` o el contenedor
`worker`) y abra Mailpit en http://localhost:8025.

**El dashboard muestra datos antiguos**
Los KPIs se cachean 60 segundos. La caché se invalida por evento; si Redis está
caído, se calculan siempre (más lento, nunca incorrecto).

**Puerto ocupado**
Cambie `API_PORT`, `WEB_PORT` o `POSTGRES_PORT` en `.env`.

**Estado de las dependencias**

```bash
curl http://localhost:4000/api/v1/health/ready
```

Devuelve el estado de PostgreSQL, Redis, storage y SMTP por separado.

---

**NODUS Ingeniería SAS** · Plataforma orquestadora neutral
