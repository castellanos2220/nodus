# ADR-009 — Límite de tasa por políticas

- **Estado**: aceptada
- **Fecha**: 2026-09-19
- **Decide**: cómo se limita la tasa de peticiones a la API sin romper la navegación
- **Sustituye**: la configuración de dos throttlers globales de la versión inicial

## Contexto

La primera versión registraba dos throttlers con nombre en `ThrottlerModule`:

| Throttler | Límite | Intención |
|---|---|---|
| `default` | 120 / min | Tráfico general |
| `auth` | 10 / 5 min | Sólo el login |

`@nestjs/throttler` aplica **todos** los throttlers con nombre a **todas** las
rutas salvo que se omitan explícitamente. El límite pensado para el login acabó
limitando cada endpoint a 10 peticiones cada 5 minutos:

- el healthcheck de Docker (cada 10 s) recibía 429 y el contenedor `api`
  quedaba *unhealthy*;
- la navegación normal devolvía 429 a partir de la décima visita a una
  pantalla (lo reprodujimos con `/notifications/unread-count`).

Había un segundo problema, independiente: toda llamada del navegador pasa por
los route handlers de Next, y la API veía siempre la IP del contenedor web. En
la bitácora, todos los logins figuraban desde `172.20.0.8`. Cualquier límite
«por IP» metía a todos los usuarios en el mismo cupo.

## Decisión

### 1. Una política por tipo de ruta

Cada ruta se resuelve a **una** política (`core/rate-limit/rate-limit.policy.ts`)
y consume sólo el cupo de esa política:

| Política | Rutas | Límite por defecto | Clave |
|---|---|---|---|
| `auth` | login, refresh (60/5 min), cambio de contraseña | 10 / 5 min | IP + cuenta, por ruta |
| `public` | rutas `@Public()` (LOV del registro); intake 5 / 10 min | 30 / min | IP, por ruta |
| `write` | POST/PATCH/PUT/DELETE autenticados | 120 / min | usuario, global |
| `read` | GET autenticados | 1200 / min | usuario, global |
| `internal` | `/health`, `/health/ready` | 120 / min | IP, por ruta |

Resolución: `@RatePolicy(...)` explícito → `@Public()` implica `public` → GET,
HEAD y OPTIONS son `read` → el resto, `write`.

`RateLimitGuard` extiende `ThrottlerGuard`: deja pasar sin contar los
throttlers que no son de la política de la ruta y fija el *tracker* y la clave.

**El worker no tiene superficie HTTP** (`createApplicationContext`): no hay
nada que limitar. `internal` cubre las sondas de salud de la infraestructura,
separadas del tráfico de usuarios en ambos sentidos.

### 2. Usuario antes que IP

`RateLimitGuard` se registra después de `JwtAuthGuard`, así que `req.user` ya
existe. En `read` y `write` el cupo es **por usuario** y **global** (no por
endpoint): lo que importa es cuántas peticiones hace una persona, y así la
navegación a través del proxy no mezcla usuarios.

En `auth` la clave es **IP + cuenta**: quien se equivoca de contraseña no
bloquea el login de todos los que comparten salida a internet. El bloqueo de la
cuenta tras intentos fallidos sigue en `AuthService`.

### 3. IP real a través del proxy

- Los route handlers de Next reenvían `X-Forwarded-For` (y `User-Agent`) a la
  API (`apps/web/src/lib/forwarding.ts`).
- La API confía sólo en saltos de red privada: `TRUST_PROXY` por defecto es
  `loopback, linklocal, uniquelocal`. Una petición directa desde una IP pública
  no puede falsear su origen con `X-Forwarded-For`.

### 4. Configurable, igual en pruebas

Cada política tiene `THROTTLE_<POLÍTICA>_LIMIT` y `THROTTLE_<POLÍTICA>_TTL_SECONDS`.
En `NODE_ENV=test` los techos se elevan a 100 000 en lugar de desactivar el
guard: el middleware que corre en pruebas es el mismo de producción.

## Consecuencias

**A favor**
- La navegación normal no produce 429; el login sigue siendo estricto.
- El healthcheck no puede dejar al contenedor *unhealthy* por tráfico propio.
- Auditoría y límites ven la IP real del usuario.
- `test/unit/rate-limit.spec.ts` lo demuestra con una app mínima y límites
  pequeños: la navegación no consume el cupo del login, cada usuario tiene su
  cupo, lecturas y escrituras son independientes, el login cuenta por cuenta y
  las sondas tienen su propio cupo.

**En contra / pendiente**
- **Almacenamiento en memoria.** Con varias réplicas de la API, cada una
  cuenta por separado. Para escalar horizontalmente hace falta
  `ThrottlerStorage` sobre Redis (ya disponible en el stack).
- **Next no puede verificar `X-Forwarded-For`.** Si el cliente envía la
  cabecera, Next la conserva. En producción el proxy de borde (nginx,
  balanceador) debe **sobrescribirla**; es la configuración estándar. La clave
  IP + cuenta del login y el bloqueo por intentos fallidos acotan el impacto
  mientras tanto.
