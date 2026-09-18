# Optimización del backend

El brief es explícito (§6): *«NO confundir Docker con optimización de
rendimiento»*. Docker resuelve reproducibilidad. Lo que sigue es lo que
realmente determina cómo se comporta el sistema bajo carga.

Cada punto documenta **qué se hizo y por qué**, no una lista de buenas prácticas.

---

## 1. Paginación con tope duro

`PaginationDto` limita `pageSize` a **100** con `@Max(100)`.

No es una preferencia de interfaz: es protección. Sin ese tope, un cliente puede
pedir `?pageSize=999999` y forzar al servidor a materializar toda la tabla de
casos en memoria. El límite vive en el DTO, de modo que se aplica antes de que la
consulta se construya.

Los listados devuelven `{ data, meta }` con `total`, `totalPages`, `hasNext` y
`hasPrev`, calculados con un `count` que corre en la misma transacción que la
consulta de datos — una sola ida a la base.

---

## 2. `select` explícitos: nunca `include` sin acotar

Ningún listado del sistema trae entidades completas.

El caso concreto que lo motiva: `Case.description` puede tener 5 000 caracteres.
Un listado de 20 casos con `include` traería 100 KB de texto que la tabla no
muestra. El listado selecciona `id, code, title, status, areaCode…` y deja
`description` fuera.

Lo mismo con las relaciones: en lugar de `include: { assignments: true }` se usa

```ts
assignments: {
  where: { isActive: true, isPrimary: true },
  take: 1,
  select: { consultant: { select: { id: true, code: true, user: { select: { fullName: true } } } } },
}
```

Se traen exactamente tres columnas del consultor responsable, y sólo del activo.

---

## 3. N+1 eliminado por construcción

Prisma resuelve los `select` anidados con **una sola consulta** usando joins
laterales (`relationJoins` está activado en el generador). El listado de casos
con empresa, consultor responsable, SLA abierto y conteo de incidencias es **una**
consulta, no 20 + 20 + 20 + 20.

Donde el patrón podría reaparecer —el resolver de destinatarios de
notificaciones— se resuelve con un `findMany` acotado y filtrado en memoria sobre
un conjunto ya limitado (`take: 200`), no con una consulta por consultor.

---

## 4. Índices dictados por las consultas reales

No se indexó «por si acaso»: cada índice responde a una consulta que el producto
hace.

| Índice | Consulta que lo usa |
|---|---|
| `cases(status, createdAt)` | tablero principal: casos por estado, más antiguos primero |
| `cases(companyId, status)` | «mis casos» del cliente |
| `cases(status, areaCode, complexityCode)` | bolsa interna: elegibilidad sobre casos publicados |
| `sla_instances(status, deadline)` | barrido del worker: instancias abiertas por vencimiento |
| `notifications(recipientId, status, createdAt)` | campanita: no leídas del usuario |
| `audit_logs(caseId, createdAt)` y cuatro más | los cinco filtros que exige §26 |
| `milestones(status, targetDate)` | barrido de hitos vencidos |
| `case_status_history(caseId, createdAt)` | línea de tiempo y cálculo de permanencia |

### Índices parciales

Expresan invariantes que un índice normal no puede:

```sql
CREATE UNIQUE INDEX case_assignments_one_active_primary
  ON case_assignments (caseId)
  WHERE isPrimary = true AND isActive = true;
```

Permite todo el historial de asignaciones y prohíbe dos responsables principales
**activos**. Lo mismo para clasificación vigente, contacto principal, borrador de
propuesta e instancia de SLA abierta por etapa.

### Índices GIN de trigramas

```sql
CREATE INDEX companies_normalized_name_trgm ON companies USING GIN (normalizedName gin_trgm_ops);
```

Sin él, el matching por similitud de nombre haría un recorrido secuencial de toda
la tabla de empresas en cada intento de alta.

---

## 5. Agregados SQL para el dashboard

**Ninguna fila se trae a Node para contarla.** Los KPIs son `groupBy`, `count` y
`aggregate`, ejecutados en paralelo con `Promise.all`.

El caso que más lo justifica son los **tiempos medios por etapa**. La forma
ingenua sería leer todo el historial de todos los casos y restar pares de filas
consecutivas en JavaScript: O(n) filas transferidas por cada visita al tablero.

En su lugar, cada transición materializa `hoursInPreviousStatus` en el momento en
que ocurre —el dato ya está calculado— y el KPI es:

```sql
SELECT h."newStatus", AVG(h."hoursInPreviousStatus")::float
FROM case_status_history h JOIN cases c ON c.id = h."caseId"
WHERE h."hoursInPreviousStatus" IS NOT NULL
GROUP BY h."newStatus"
```

Un `AVG` sobre un índice, que devuelve 17 filas independientemente del volumen.

---

## 6. Caché con invalidación por evento

Se cachean dos cosas, y por motivos distintos:

| Qué | TTL | Por qué |
|---|---|---|
| Listas de valores | 10 min | Se leen en casi todas las pantallas y cambian muy poco. Toda escritura invalida el prefijo. |
| KPIs del dashboard | 60 s | Agregados sobre miles de filas. Un tablero de gestión tolera 60 s de desfase; recalcular en cada visita se nota. |

**Qué no se cachea**: nada relacionado con permisos ni con el estado de un caso.
Servir un estado obsoleto en un sistema de workflow es peor que ser lento.

La caché **degrada, no rompe**: `CacheService` captura los errores de Redis y
calcula. Una caché que tumba el producto cuando falla no es una optimización, es
un punto único de fallo añadido.

La invalidación por prefijo usa `SCAN`, nunca `KEYS` — `KEYS` bloquea el servidor
Redis entero mientras recorre el espacio de claves.

---

## 7. Transacciones y control de concurrencia

Las operaciones críticas son atómicas: transición de caso, asignación de
consultor, aceptación de propuesta, autorización de ejecución y cierre.

El **bloqueo pesimista** se usa sólo donde hay carrera real:

```sql
SELECT id FROM cases WHERE id = $1 FOR UPDATE
```

Es la primera sentencia de toda transición. Sin él, dos advisories pulsando
«asignar» simultáneamente pasarían ambos la comprobación de estado. Con él se
serializan; y si aun así algo se colara, el índice único parcial lo rechaza.

No se usa bloqueo en lecturas ni en escrituras de entidades hijas (actividades,
hitos): ahí no hay invariante que dos escrituras simultáneas puedan romper.

El `timeout` de la transacción es de 15 s: holgado para lo que tarda
milisegundos, y acota cuánto puede durar el bloqueo si algo va mal.

---

## 8. El trabajo pesado nunca está en el request

Tres cosas que serían latencia visible y no lo son:

| Trabajo | Dónde ocurre |
|---|---|
| Envío de correo | Cola `nodus.email`, en el worker |
| Resolución de destinatarios y renderizado | Cola `nodus.notifications` |
| Barrido de SLA y de hitos | Cola `nodus.sla`, *repeatable job* |

El handler de eventos **sólo encola**. Una transición de caso no espera al SMTP.

---

## 9. Pool de conexiones

`connection_limit=15` para la API y `5` para el worker, fijados en la cadena de
conexión. PostgreSQL arranca con `max_connections=200`.

El worker necesita menos porque su concurrencia está acotada por cola (5, 3 y 1
respectivamente), y sobredimensionar su pool sólo restaría conexiones a la API.

---

## 10. Límites de entrada

| Límite | Valor | Por qué |
|---|---|---|
| Cuerpo JSON | 2 MB | Cualquier formulario del producto cabe de sobra |
| Archivo subido | 25 MB (30 en multer) | Documentos de oficina |
| `pageSize` | 100 | Ver punto 1 |
| Rate limit global | 120 / min | Uso normal muy por debajo |
| Rate limit de autenticación | 10 / 5 min | El login es lo que se martillea |
| Intake público | 5 / 10 min | Es el único endpoint sin sesión que crea datos |

La validación de archivos comprueba **tres cosas**: el MIME contra una lista
blanca, la extensión contra el MIME declarado y los primeros bytes contra la
firma del formato. El `Content-Type` lo elige quien sube; no es una fuente de
verdad.

---

## 11. Observabilidad

- **Consultas lentas**: `PrismaService` registra las que superan 300 ms. El log
  completo de queries en desarrollo es ruido que oculta justamente lo que
  importa.
- **`requestId`** en cada petición, propagado al log, al cuerpo de los errores y
  a la columna `requestId` de la bitácora. Dado un error que ve un usuario, se
  puede reconstruir exactamente qué hizo el sistema.
- **`/health/ready`** informa del estado de PostgreSQL, Redis, storage y SMTP por
  separado, no con un booleano agregado.

---

## Lo que deliberadamente **no** se optimizó

Anotarlo importa tanto como lo anterior:

- **No hay paginación por cursor.** Con `pageSize ≤ 100` y los índices
  existentes, `OFFSET` es perfectamente razonable. Se volvería un problema a
  partir de decenas de miles de filas por página profunda; los índices ya están
  ordenados para migrar a keyset sin cambiar el modelo.
- **No hay réplicas de lectura.** Un solo PostgreSQL basta a esta escala, y
  añadirlas traería consistencia eventual en un producto que la evita a
  propósito.
- **No se cachean entidades individuales.** La invalidación sería más compleja
  que el problema que resolvería.
- **No hay CDN ni optimización de assets más allá de lo que hace Next.** La
  aplicación es interna, no una web pública.
