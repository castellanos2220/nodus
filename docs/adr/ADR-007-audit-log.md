# ADR-007 — Bitácora de auditoría append-only

- **Estado**: aceptada
- **Fecha**: 2026-09-17
- **Decide**: cómo se registra y se protege la trazabilidad

## Contexto

El blueprint operativo hace de la bitácora un componente estructural, no una
funcionalidad opcional, y fija una regla explícita: *«Los registros no pueden
eliminarse»* (RT-004, §26). La trazabilidad es, además, lo que diferencia a NODUS
de una consultoría informal: sin ella, la promesa de veeduría no se sostiene.

Una bitácora en la que alguien pueda editar una fila no es una bitácora.

## Decisión

**Tres candados independientes**, en tres capas distintas:

1. **Transaccional.** `AuditService.record()` exige un cliente de transacción y
   se invoca dentro de la misma transacción que el cambio que describe. Si el
   cambio hace rollback, su registro desaparece con él; si el cambio se confirma,
   es imposible que falte su rastro.

2. **De API.** No existe ningún endpoint de creación, actualización o borrado de
   registros de auditoría. El controlador `/audit` es sólo de lectura, y
   `AuditService` no expone ningún método de modificación.

3. **De base de datos.** La migración 002 instala dos triggers `BEFORE UPDATE` y
   `BEFORE DELETE` sobre `audit_logs` que abortan la operación con
   `restrict_violation`. Aunque un error de programación futuro intentara
   modificar la tabla, PostgreSQL lo rechaza.

Cada registro guarda: fecha, actor, rol, acción, entidad, id de entidad, caso,
empresa, valor anterior, valor nuevo, origen (`USER` / `SYSTEM`), IP, user-agent
y `requestId`.

## Justificación

**Escribir en la misma transacción es lo que hace la auditoría fiable.** El
patrón alternativo —emitir un evento y que un handler escriba la auditoría
después— produce huecos exactamente cuando más importa: si el proceso muere
entre el commit y el handler, el cambio existe y su rastro no.

**Los triggers no sobran.** Los otros dos candados dependen de que el código se
escriba bien. El trigger no depende de nada: es la única capa que sigue
protegiendo cuando el resto falla. Su coste es despreciable (no se ejecuta en
`INSERT`) y hay pruebas de integración que comprueban que funciona.

**Se guarda el delta, no el objeto entero.** `AuditService.diff()` calcula qué
cambió realmente. Una auditoría que copia el objeto completo en cada escritura es
ilegible y pesa una barbaridad; lo que un auditor necesita es «qué cambió, quién
y cuándo».

**El origen distingue persona de sistema.** Las transiciones encadenadas
automáticamente se registran con `origin = SYSTEM` y sin actor, de modo que en la
línea de tiempo se ve claramente qué hizo una persona y qué hizo la plataforma.

## Consecuencias

**A favor**

- La línea de tiempo del caso se alimenta de la misma tabla: es la misma verdad,
  no una copia que pueda desincronizarse.
- Los filtros exigidos (empresa, caso, usuario, acción, fecha) tienen cada uno su
  índice compuesto con `createdAt`.
- `TRUNCATE` sigue siendo posible para un DBA con privilegios, que es exactamente
  el nivel de acceso que una política de retención legítima requiere.

**En contra**

- La tabla sólo crece. A escala real haría falta particionado por rango de fecha
  y archivado en frío; el modelo ya lo admite porque todos los índices empiezan
  por un discriminador y terminan en `createdAt`.
- Las pruebas no pueden limpiar con `DELETE`: usan `TRUNCATE … CASCADE`, que no
  dispara triggers de fila. Documentado en `test/setup/test-app.ts`.
