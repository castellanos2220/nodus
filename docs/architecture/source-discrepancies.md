# Discrepancias entre documentos fuente y decisiones tomadas

El brief exige: *«Cuando exista una diferencia entre documentos: no inventes una regla; identifica la
diferencia; prioriza los requerimientos funcionales completos; documenta la decisión; mantén una
arquitectura que permita evolucionar el comportamiento».* Este documento registra cada caso.

---

### D-01 — Número y nombre de los estados del caso

| Fuente | Lista |
|---|---|
| `NODUS_Matriz_Dinamica.xlsx` → hoja *Workflow* | 11 estados, `EN DECISIÓN`, `PENDIENTE CONTRATACIÓN` |
| `NODUS_Matriz_Completa...xlsx` → *Workflow_Estados* | 14 estados, incluye `PROPUESTA LISTA PARA QA`, `AUTORIZADO PARA EJECUCIÓN`, `LISTO PARA CIERRE` |
| `Nodus Mvp Web Architecture Blueprint.pdf` §4 | 9 estados («estados iniciales») |
| `911MiPyme-BluePrint OperativoMVP.docx` Punto 6 | añade `AJUSTES DE PROPUESTA`, `PROPUESTA ACEPTADA`, `CERRADO SIN CONTRATACIÓN` |
| Brief del cliente §12 | 17 estados |

**Decisión.** Se adopta el superconjunto de 17 estados del brief §12, que es el único que cubre las
tres rutas de decisión del cliente y las dos terminales. Las listas más cortas son subconjuntos
compatibles: ningún estado de las otras fuentes queda sin representar. `AUTORIZADO` del PDF se mapea a
`AUTORIZADO_PARA_EJECUCION`; `EN DECISIÓN` a `EN_DECISION_CLIENTE`.

**Evolución.** Los estados son filas en `CaseStatus` (LOV), y el registro de transiciones es un módulo
aislado. Añadir `EN_SEGUIMIENTO` o `EN_RIESGO` (sugeridos como granularidad futura en el Punto 8) es
insertar filas y aristas, no migrar lógica.

---

### D-02 — `ENTREGABLE EN REVISIÓN` como estado del caso

El capítulo de principios del blueprint operativo lista `ENTREGABLE EN REVISIÓN` dentro del ciclo de
vida del caso. El Punto 8 del mismo documento recomienda explícitamente **no** crear estados globales
para la ejecución y usar subestados/atributos.

**Decisión.** Se sigue el Punto 8, que es el capítulo específico y posterior. `EN_REVISION` de un
entregable es un estado de `Deliverable`, no del caso. El caso permanece en `EN_EJECUCION`.
Documentado en [case-lifecycle.md §5](../workflow/case-lifecycle.md).

---

### D-03 — Peer review: ¿MVP o Fase 2?

| Fuente | Dice |
|---|---|
| Ambas matrices Excel (REQ-006 / REQ-011) | Prioridad **Media**, Estado MVP: **Fase 2** |
| Matriz de requerimientos PDF (RF-050, RF-051) | Prioridad **Media**, sin excluir del MVP |
| Brief §19 | «Peer Review debe existir como arquitectura preparada. El MVP puede implementar una versión simplificada. NO eliminar la posibilidad futura.» |
| Brief §37 | Exige el rol `CONSULTOR_REVISOR` |

**Decisión.** Se implementa la **versión simplificada**: el modelo de datos (`ProposalReview` con
`type = PEER`), el rol, los permisos y el endpoint existen y funcionan; Advisory puede activar un peer
review y el revisor registra observaciones. Lo que **no** se construye es la selección automática de
revisor, el scoring del revisor ni el flujo de invitación por correo con aceptación. Queda como
`REVIEWER_ASSIGNMENT_STRATEGY` = `MANUAL` en configuración.

---

### D-04 — Stack de infraestructura

El blueprint de arquitectura recomienda Vercel + Railway + Supabase + AWS S3 + Resend. El brief §5
exige Docker Compose local con `postgres`, `redis`, `minio`, `mailpit`.

**Decisión.** No hay conflicto real: son el mismo diseño en dos entornos. Se construye contra
**interfaces** (`StorageService`, `MailerService`) y se resuelve el adaptador por variable de entorno.
MinIO habla el protocolo S3, así que el adaptador S3 sirve para local y para producción cambiando
`S3_ENDPOINT`. Mailpit habla SMTP, así que el adaptador SMTP sirve para local; Resend se añadiría como
un segundo adaptador sin tocar los módulos de negocio. Ver [ADR-005](../adr/ADR-005-document-storage-abstraction.md).

---

### D-05 — Zustand vs. TanStack Query para estado

El blueprint de arquitectura lista ambos. El brief §4 sólo lista TanStack Query.

**Decisión.** TanStack Query para **todo** el estado de servidor. No se añade Zustand: introducir un
store global junto a una caché de servidor es la receta habitual para duplicar la verdad. El poco
estado de UI verdaderamente global (sidebar colapsado, filtros de una tabla) vive en `useState`/URL
search params. Es una dependencia menos, justificada por §40 («No crear clases o abstracciones
innecesarias», «No agregar dependencias sin justificar»).

---

### D-06 — Framer Motion y Lucide

El blueprint de arquitectura los lista. El brief no.

**Decisión.** Se incluye `lucide-react` (es la dependencia de iconos que shadcn/ui asume por defecto;
no incluirla obligaría a reescribir cada componente generado). **No** se incluye Framer Motion: no hay
requerimiento funcional que dependa de animación y añade ~30 kB al bundle sin beneficio evaluable.

---

### D-07 — «NODUS» vs. «911MiPyme»

Los documentos operativos hablan de *911MiPyme*; los documentos de arquitectura y el brief hablan de
*NODUS*. La plataforma web de referencia es `nodus-project-eta.vercel.app`.

**Decisión.** El producto es **NODUS**; *911MiPyme* se trata como el nombre del modelo operativo /
marca previa. En el código y la UI se usa NODUS. Donde una plantilla oficial dice «911MiPyme» se
conserva la redacción original del documento fuente (p. ej. en el texto de las plantillas TCOM), para
no alterar el contenido metodológico aprobado.

---

### D-08 — Tres bloques de onboarding vs. dos

El PPTX muestra el Punto 1 con «Bloque 1» + «Bloque 2 — Plantilla T1» + dos cajas de sistema
(verificación de identidad y creación automática de registros). El DOCX describe explícitamente **dos**
bloques, siendo las dos cajas restantes efectos automáticos, no pasos del formulario.

**Decisión.** Dos bloques de formulario (RF-001: «menos de 3 minutos»); la verificación de identidad y
la creación de registros son efectos del `POST /intake` dentro de una transacción. El formulario
muestra el resultado del matching entre bloque 1 y bloque 2 sin pedir datos adicionales.

---

### D-09 — `T3` vs. `T3A/T3B/T3C/T3D`

El Punto 3 del blueprint operativo menciona primero «Plantilla T3 — Publicación, Postulación y
Asignación» y más adelante desglosa T3A–T3D. El brief §16 exige T3C.

**Decisión.** Se implementa el desglose (T3A, T3B, T3C, T3D), que es el más específico y completo. «T3»
se entiende como el nombre del conjunto, no como una plantilla adicional.

---

### D-10 — Rol contractual de la plataforma

Consistente en todos los documentos, pero merece registro porque condiciona el modelo de datos:
**NODUS no es parte contractual**. Por eso no existen entidades `Contract`, `Invoice` ni `Payment`. Lo
que existe es `ContractChecklist` (veeduría del proceso), `ContractEvidence` (soporte documental sin
asumir su contenido legal) y `OperationalFramework` (base de seguimiento). Cualquier futura modalidad
en que NODUS sí contrate exigiría entidades nuevas, no modificar éstas.
