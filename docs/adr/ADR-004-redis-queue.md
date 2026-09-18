# ADR-004 — Redis + BullMQ para trabajo asíncrono y caché

- **Estado**: aceptada
- **Fecha**: 2026-09-17
- **Decide**: cómo se ejecuta el trabajo que no cabe en un request HTTP

## Contexto

El brief lo prohíbe expresamente (§51): *«mandar emails dentro de requests
lentos»*. Y exige (§28) que la cadena sea
`evento → handler → RecipientResolver → plantilla → cola → email`.

Además, el módulo de SLA necesita un barrido periódico que recalcule consumos,
promueva estados y emita alertas.

## Decisión

**Redis** como almacén de colas y de caché. **BullMQ** como gestor de colas, con
tres colas separadas:

| Cola | Qué hace |
|---|---|
| `nodus.notifications` | resuelve destinatarios, renderiza la plantilla TCOM y crea las filas `Notification` |
| `nodus.email` | envía cada notificación por SMTP |
| `nodus.sla` | barridos periódicos de SLA e hitos (*repeatable jobs*) |

El worker es un proceso aparte (`worker.ts`) que comparte el árbol de módulos con
la API.

## Justificación

**Tres colas y no una, porque tienen perfiles distintos.** Resolver destinatarios
es rápido y consulta la base; enviar correo es lento y depende de un tercero;
el barrido de SLA es periódico y debe ejecutarse en un solo consumidor. Con una
sola cola, un SMTP caído bloquearía también las notificaciones in-app.

**El handler de eventos sólo encola.** No resuelve destinatarios ni renderiza: si
una plantilla estuviera mal escrita, el fallo ocurre en el worker y no afecta a la
petición que ya confirmó su transacción.

**La fila `Notification` se crea antes de enviar.** Así queda registro aunque el
envío falle, y `status`/`error`/`attempts` cuentan qué pasó — que es literalmente
lo que exige RT-013.

**Idempotencia explícita.** Los jobs llevan `jobId` derivado del evento; el envío
comprueba si la notificación ya está `ENVIADA`; y las alertas de SLA se protegen
con un único `(instanceId, kind)`. Un worker que se reinicia a mitad de trabajo no
duplica correos ni alertas.

**Los barridos usan *repeatable jobs* de BullMQ y no `@Cron` de Nest.** Con dos
réplicas del worker, `@Cron` dispararía en ambas; BullMQ garantiza que cada
ocurrencia la procese un solo consumidor.

**La caché degrada, no rompe.** `CacheService` captura los errores de Redis: si
Redis cae, se calcula y se sigue. Una caché que tumba el producto cuando falla no
es una optimización, es un punto único de fallo añadido.

**Qué se cachea y qué no.** LOV (se leen en todas las pantallas, cambian poco) y
KPIs del dashboard (60 s de desfase es aceptable en un tablero de gestión). **No**
se cachea nada relacionado con permisos ni con el estado de un caso: servir un
estado obsoleto en un sistema de workflow es peor que ser lento.

## Consecuencias

**A favor**

- El correo nunca está en el camino crítico de una petición.
- Reintentos con backoff exponencial ante un SMTP caído.
- El worker escala por separado de la API.

**En contra**

- Una dependencia de infraestructura más. Se acota: la caché degrada con
  elegancia, y sin Redis la API sigue sirviendo peticiones (lo que se pierde es el
  trabajo asíncrono, que es justamente lo que se puede perder).
- Hay que vigilar la cola. `/health/ready` reporta el estado de Redis.
