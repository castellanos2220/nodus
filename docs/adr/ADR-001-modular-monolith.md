# ADR-001 — Monolito modular para el MVP

- **Estado**: aceptada
- **Fecha**: 2026-09-17
- **Decide**: arquitectura de despliegue del backend

## Contexto

NODUS tiene 25 módulos de negocio, 5 actores y un ciclo de vida de 17 estados. El
blueprint de arquitectura menciona microservicios como evolución posterior, y el
brief (§4) exige explícitamente **no** implementarlos en el MVP, dejando la
arquitectura preparada para una separación futura.

La pregunta real no es "monolito o microservicios", sino **dónde están las
fronteras** y **cuánta consistencia necesita cada operación**.

## Decisión

Un único despliegue de backend (`apps/api`), dividido en módulos NestJS con
frontera explícita, más un **proceso worker separado** que ejecuta el mismo
código con otro entrypoint.

Reglas de frontera:

1. Un módulo de negocio nunca importa el servicio de otro módulo de negocio para
   escribir. Se comunica publicando un evento de dominio o a través de un puerto
   en `core/`.
2. `core/` contiene lo transversal (Prisma, auth, eventos, auditoría, storage,
   colas, caché, configuración). Todo módulo puede depender de `core/`; `core/`
   no depende de ningún módulo.
3. Las dependencias entre módulos son explícitas en cada `imports` y no hay
   ciclos.

## Justificación

**La transacción crítica del producto no se puede partir.** Una transición de
caso hace, atómicamente: validar precondiciones, aplicar el efecto, cambiar el
estado, escribir el historial, escribir la bitácora y actualizar los relojes de
SLA. Repartir eso entre servicios exigiría una saga con compensaciones —y
compensar una entrada de auditoría es una contradicción: el registro
"deshecho" seguiría siendo parte de la historia—. El coste sería real y el
beneficio, cero a esta escala.

**El worker sí se separa, porque ahí la frontera es real.** El trabajo asíncrono
(correo, notificaciones, barridos de SLA) tiene un perfil de carga distinto,
tolera fallo y reintento, y no debe competir por el event loop con las peticiones
HTTP. Esa separación se hizo desde el primer día.

**Las fronteras declaradas son las que se extraerían.** Si mañana el módulo de
notificaciones se convierte en un servicio, ya está desacoplado: escucha eventos
y no lo llama nadie directamente. Lo mismo con documentos y con SLA. La
preparación para microservicios no consiste en tenerlos, sino en que las
costuras estén en el sitio correcto.

## Consecuencias

**A favor**

- Consistencia transaccional donde el dominio la exige.
- Un despliegue, una migración, un log: el evaluador levanta el sistema completo
  con `docker compose up -d`.
- Refactorizar una frontera cuesta un `git mv`, no un contrato de red.

**En contra**

- Escalado en bloque: no se puede dar más CPU sólo a propuestas. Irrelevante a
  esta escala, y el worker ya escala por separado, que es donde se notaría.
- Disciplina manual en las fronteras: nada impide técnicamente que alguien
  importe el servicio de otro módulo. Se mitiga con revisión y con la regla
  escrita aquí.

## Alternativas descartadas

- **Microservicios desde el inicio.** Añade sagas, consistencia eventual,
  descubrimiento de servicios y trazabilidad distribuida para un producto que
  aún está validando su modelo operativo. El brief lo prohíbe con razón.
- **Monolito sin módulos.** Más simple hoy, imposible de separar mañana: sin
  fronteras declaradas, todo acaba importando todo.
