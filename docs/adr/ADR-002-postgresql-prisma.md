# ADR-002 — PostgreSQL + Prisma

- **Estado**: aceptada
- **Fecha**: 2026-09-17
- **Decide**: motor de base de datos y capa de acceso a datos

## Contexto

El dominio es fuertemente relacional (empresa → caso → propuesta → versión →
revisión), exige integridad referencial, transacciones multi-tabla e invariantes
que deben vivir en la base. El blueprint de arquitectura fija PostgreSQL y Prisma;
el brief lo confirma.

## Decisión

**PostgreSQL 16** como único almacén y **Prisma** como ORM, complementado con SQL
directo donde aporta.

## Justificación

**PostgreSQL da más que un almacén relacional.** Se usan cuatro capacidades suyas
que serían trabajo de aplicación en otro motor:

| Capacidad | Para qué |
|---|---|
| Índices únicos **parciales** | «un solo consultor responsable principal *activo*», «una sola clasificación *vigente*», «un solo borrador por propuesta» |
| `pg_trgm` + similitud | matching de empresa por nombre, con índice GIN |
| Triggers | inmutabilidad de la bitácora y de las versiones congeladas |
| Agregados y `GROUP BY` sobre índices | KPIs del dashboard sin traer filas a Node |

**Prisma, con dos límites conscientes.** Aporta tipos derivados del esquema —un
`select` mal escrito no compila—, migraciones versionadas y una API de
transacciones clara. Sus límites se asumen explícitamente:

- **No expresa índices parciales ni triggers.** Van en una migración SQL escrita
  a mano (`002_invariants_and_indexes`), que es donde deben estar: son
  invariantes de la base, no del ORM.
- **Su generador de consultas no siempre produce el SQL óptimo.** Donde importa
  —tiempos medios por etapa, cumplimiento de SLA— se usa `$queryRaw` con SQL
  parametrizado.

**El `select` explícito es la disciplina que evita el problema clásico.** Ningún
listado del sistema usa `include` sin acotar: se seleccionan las columnas
necesarias, y las relaciones se traen con `select` anidado en la misma consulta.
Eso elimina el N+1 por construcción, no por vigilancia.

## Consecuencias

**A favor**

- Un solo motor para datos, búsqueda por similitud e invariantes.
- Tipos end-to-end: el esquema es la fuente y el compilador la verifica.
- Migraciones reproducibles; `migrate deploy` es idempotente.

**En contra**

- Dos lenguajes de esquema: Prisma para la estructura, SQL para las invariantes.
  Se acepta porque la alternativa —invariantes sólo en la aplicación— es peor.
- Prisma abre su propio pool; el límite se fija en la cadena de conexión
  (`connection_limit=15` en la API, `5` en el worker) para no agotar
  `max_connections`.

## Alternativas descartadas

- **TypeORM.** Su soporte de migraciones y su tipado son más frágiles, y su
  `synchronize` invita a saltarse las migraciones.
- **Prisma sin SQL a mano.** Habría dejado fuera los índices parciales y los
  triggers, es decir, justo las garantías que el brief exige que viva en la base.
- **MongoDB.** Un dominio con esta densidad relacional y estas invariantes
  transaccionales no es un caso de documentos.
