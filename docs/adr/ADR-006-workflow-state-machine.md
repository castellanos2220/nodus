# ADR-006 — Máquina de estados declarativa como única puerta de cambio

- **Estado**: aceptada
- **Fecha**: 2026-09-17
- **Decide**: cómo cambia el estado de un caso

## Contexto

El caso es la unidad de negocio y su estado gobierna permisos, documentos,
responsabilidades y SLA. El brief es tajante (§12): *«El estado NO puede ser
cambiado arbitrariamente desde frontend»*, y exige que cada transición valide,
persista, audite, emita evento y actualice SLA.

El riesgo clásico es que el cambio de estado se disperse: un `UPDATE` aquí, un
`if` allá, y a los tres meses nadie sabe qué combinaciones son posibles.

## Decisión

**El grafo de transiciones se declara como datos** en
`transitions.registry.ts`, y **existe un único camino de escritura**:
`POST /cases/:id/transitions`.

Cada arista declara: estado origen y destino, roles autorizados, ámbito sobre el
recurso, lista de guards, evento de dominio, transición encadenada y si requiere
payload.

`WorkflowService.execute()` ejecuta, dentro de una sola transacción:

1. `SELECT … FOR UPDATE` sobre el caso (bloqueo pesimista);
2. búsqueda de la arista desde el estado **actual**;
3. autorización por rol y por ámbito;
4. guards de negocio;
5. efecto propio de la transición;
6. estado + `CaseStatusHistory`;
7. `AuditLog`;
8. relojes de SLA;
9. encadenado automático si la arista lo declara.

Los eventos de dominio se publican **después** del commit.

## Justificación

**Declarativo, no imperativo.** El grafo se puede validar automáticamente: hay
pruebas que comprueban que todo estado no terminal tiene salida, que todo estado
es alcanzable desde `CREADO`, que los terminales no tienen salida y que cada
guard referenciado existe. Un `if` repartido por servicios no admite esa
comprobación.

**Un único camino significa una única cosa que auditar.** No hay ningún otro
punto del sistema que escriba `case.status`. Eso hace que "toda transición queda
auditada" sea una propiedad estructural, no una promesa.

**El bloqueo pesimista es necesario, no decorativo.** Dos advisories pulsando
"asignar consultor" en el mismo segundo pasarían ambos la comprobación de estado
sin él. Con `FOR UPDATE` se serializan; y si aun así algo se colara, el índice
único parcial de la migración 002 lo rechaza en la base.

**Publicar eventos tras el commit es la diferencia entre un correo correcto y uno
imposible de deshacer.** Si el evento saliera dentro de la transacción y ésta
hiciera rollback, el cliente ya habría recibido "su propuesta fue aceptada".

**El frontend no reimplementa nada.** `GET /cases/:id` devuelve
`availableTransitions[]` con `allowed`, `blockedBy` y `blockedReason`, calculados
ejecutando los mismos guards en seco. La interfaz pinta lo que el backend dice.

## Consecuencias

**A favor**

- Añadir una etapa es añadir una fila al registro y sus guards.
- La documentación (`docs/workflow/transitions.md`) y el código no pueden
  divergir en silencio: hay un test que los compara.
- Los mensajes de bloqueo son útiles: «El checklist de contratación tiene 2 ítems
  obligatorios pendientes», no «operación no permitida».

**En contra**

- Toda acción que cambie estado pasa por un punto único: un cuello de botella de
  diseño deliberado, que obliga a pensar cada excepción en lugar de colarla.
- Los efectos de transición escriben con el cliente de transacción en lugar de
  llamar a los servicios de cada módulo. Es lo que evita el ciclo
  `proposals ↔ workflow`, y está documentado en el propio archivo de efectos.

## Alternativas descartadas

- **Una librería de máquinas de estados (XState y similares).** Aporta un modelo
  potente que aquí no se necesita —no hay estados paralelos ni jerárquicos— y a
  cambio introduce una dependencia entre el dominio y su representación.
- **Estado como columna libre con validación en el servicio.** Es exactamente el
  escenario que el brief prohíbe: el estado acabaría cambiándose desde varios
  sitios.
