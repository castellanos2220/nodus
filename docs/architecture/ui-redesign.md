# Rediseño visual de NODUS — iteración 1

> **Documento histórico.** Registra el primer rediseño (dirección visual,
> estados sin color, sidebar claro). La fuente vigente es
> [`nodus-design-system.md`](nodus-design-system.md), con
> [`nodus-ui-principles.md`](nodus-ui-principles.md) y
> [`nodus-ux-principles.md`](nodus-ux-principles.md).

- **Estado**: implementado
- **Fecha**: 2026-09-18
- **Alcance**: exclusivamente UI/UX. No cambia endpoints, servicios, Prisma,
  workflow, permisos, guards, eventos, auditoría, motor de SLA, notificaciones
  ni colas.

## 1. Problema visual de partida

La primera versión de la interfaz era correcta en función y genérica en forma:

| Síntoma | Consecuencia |
|---|---|
| Un color distinto por estado de caso (12 tonos para 17 estados: slate, amber, sky, indigo, violet, blue, orange, emerald, teal, lime, rose…) | Las tablas parecían un arcoíris; el color dejaba de significar algo. Ámbar podía ser «en revisión», «lista para QA», «pendiente de contratación» o «SLA en riesgo». |
| Estado, alerta y marca mezclados en la misma paleta | Un caso *cerrado* (verde) competía visualmente con un SLA *en tiempo* (verde) y con un botón de éxito (verde). |
| Sidebar azul marino a pantalla completa | El elemento con más peso visual de la pantalla era la navegación, no el contenido. |
| KPIs en fuente monoespaciada, cada uno con un icono coloreado | Aspecto de panel administrativo; los números no tenían jerarquía propia. |
| Cabeceras de tabla con fondo gris, badges en mayúsculas de colores | Densidad visual alta sin aportar información. |
| Workflow representado sólo con un badge y una barra de porcentaje | No se entendía *dónde* estaba el caso dentro del ciclo. |
| Tipografía del sistema | Distinta en cada sistema operativo; sin personalidad. |

## 2. Principios

1. **Neutral por defecto.** El 80–90 % de la interfaz es blanco cálido, grafito y
   grises. Si todo destaca, nada destaca.
2. **El color tiene un trabajo, y sólo uno.** Tres familias que nunca se mezclan:
   - **Marca** (turquesa): identidad, acción principal, selección, foco, progreso.
   - **Alerta** (ámbar/rojo/verde discreto): SLA en riesgo o vencido, errores,
     confirmaciones. Siempre acompañadas de icono y texto — nunca color solo.
   - **Estado** (del caso): **no usa color**. Se comunica con texto, forma del
     indicador y posición en el workflow.
3. **Jerarquía por tipografía y espacio, no por cajas.** Menos bordes, menos
   fondos; más aire y contraste de peso.
4. **Un solo lenguaje.** Cada pantalla se construye con los mismos componentes;
   ninguna define estilos propios para cosas que ya existen.
5. **Movimiento con propósito.** Aparición de contenido, indicador de pestaña
   activa y apertura de paneles. Nada decorativo. Se respeta
   `prefers-reduced-motion`.

## 3. Paleta

Todos los colores son variables CSS en `apps/web/src/app/globals.css` y se
exponen a Tailwind en `apps/web/tailwind.config.ts`. Ningún componente usa un hex
ni un color de la paleta por defecto de Tailwind.

### Neutros (estructura — ~85 % de la superficie)

| Token | Valor | Uso |
|---|---|---|
| `background` | `#FAFAF9` | Lienzo de la aplicación (blanco cálido) |
| `card` / `surface` | `#FFFFFF` | Tarjetas, tablas, diálogos |
| `muted` | `#F4F4F2` | Fondos sutiles: hover, pistas de progreso, código |
| `border` | `#E6E6E2` | Separadores y bordes de 1px |
| `border-strong` | `#D4D4CF` | Bordes de controles de formulario |
| `foreground` (ink) | `#121212` | Títulos, cifras, texto principal |
| `ink-2` | `#3A3D42` | Texto de cuerpo secundario |
| `muted-foreground` | `#6B6E73` | Etiquetas, metadatos (contraste 5,2:1 sobre blanco) |
| `subtle-foreground` | `#9A9DA3` | Placeholders, iconos inactivos |

### Marca

| Token | Valor | Uso |
|---|---|---|
| `brand` | `#09B3AE` | Botón primario, indicador activo, foco, barras de progreso, marca |
| `brand-strong` | `#07807C` | Texto y enlaces de marca (contraste 4,8:1 sobre blanco) |
| `brand-soft` | `#E6F6F5` | Fondo de selección activa (sidebar, fila elegida) |
| `brand-foreground` | `#042322` | Texto sobre turquesa sólido |

**Decisión sobre el botón primario.** El turquesa `#09B3AE` con texto blanco da un
contraste de 2,6:1 — no cumple WCAG AA. Oscurecerlo hasta que lo cumpla lo
convierte en petróleo y pierde la identidad. Se resuelve al revés: turquesa
vivo con **texto casi negro** (7,4:1). Combina los dos colores de la marca —
grafito y turquesa — en el elemento más visible de la interfaz.

### Alertas (semánticas, con moderación)

| Token | Valor | Uso |
|---|---|---|
| `success` / `success-soft` | `#1F8A5B` / `#EEF7F2` | SLA en tiempo, checklist cumplido, confirmaciones |
| `warning` / `warning-soft` | `#B7791F` / `#FDF6E7` | SLA en riesgo, pendientes |
| `danger` / `danger-soft` | `#C8372D` / `#FCEFEE` | SLA vencido, errores, acciones destructivas |

## 4. Tipografía

**Geist Sans** y **Geist Mono**, servidas desde el paquete npm `geist` con
`next/font/local`: los archivos van dentro del bundle y el build **no** depende de
la red (la razón por la que se había descartado `next/font/google`).

| Rol | Tamaño / interlineado | Peso | Uso |
|---|---|---|---|
| `kpi` | 34 / 1 · tracking −0,025em | 600 | Cifras de indicadores |
| `3xl` | 28 / 34 · tracking −0,02em | 600 | Título de página |
| `xl` | 20 / 28 | 600 | Título del caso, secciones grandes |
| `base` | 15 / 24 | 400 | Texto largo (relatos, propuestas) |
| `sm` | 13,5 / 20 | 400–500 | Cuerpo de interfaz, tablas |
| `xs` | 12 / 16 | 400–500 | Metadatos |
| `2xs` | 11 / 16 · mayúsculas · tracking 0,08em | 600 | Etiquetas de sección y cabeceras de tabla |

- Las cifras grandes usan dígitos **proporcionales**; las columnas numéricas,
  `tabular-nums`.
- Los códigos (`CAS-000008`, `CON-000002`) van en Geist Mono a 11–12px, en gris.

## 5. Espaciado, radios, sombras

- **Espaciado** sobre la escala de 4px de Tailwind. Página: `px-6 lg:px-10`,
  `py-8`, ancho máximo 1440px. Tarjetas: `p-6` (cabecera `px-6 py-5`).
  Filas de tabla: `py-3.5`.
- **Radios** (`--radius: 10px`): tarjetas 12px (`rounded-xl`), controles 8px,
  badges 6px, indicadores circulares `rounded-full`.
- **Sombras** casi imperceptibles:
  - `shadow-xs` — tarjetas: `0 1px 2px rgb(18 18 18 / 0.04)`.
  - `shadow-pop` — menús, popovers y diálogos: sombra amplia y suave.
- **Bordes**: 1px `border` siempre. Nunca bordes de color salvo foco (turquesa)
  y error (rojo).

## 6. Estados del caso

Los 17 estados **no** tienen 17 colores. Se agrupan en las 7 etapas del ciclo y
el indicador cambia de **forma**, no de color:

| Etapa | Estados | Indicador |
|---|---|---|
| Entrada | Creado, En revisión, Clasificado | ○ anillo gris |
| Bolsa | En postulación, Asignado | ● punto gris |
| Propuesta | En diseño, Lista para QA, Enviada | ● punto grafito |
| Decisión | En decisión del cliente, Ajustes, Aceptada | ● punto grafito |
| Contratación | Pendiente de contratación, Autorizado | ● punto grafito |
| Ejecución | En ejecución, Listo para cierre | ● punto **turquesa** (trabajo en curso = progreso) |
| Cierre | Cerrado · Cerrado sin contratación | ✓ check grafito · ⊘ gris, texto atenuado |

- En tablas: `StatusBadge variant="plain"` — punto + texto, sin pastilla.
- En cabeceras y diálogos: `variant="pill"` — pastilla blanca con borde de 1px.
- La etapa del ciclo se ve completa en el `WorkflowStepper` del detalle del caso.
- El mapeo estado → etapa vive en `apps/web/src/lib/case-stages.ts`.
  Es **presentación**: la máquina de estados real sigue siendo el registro de
  transiciones del backend.

## 7. SLA

El SLA es el único indicador de estado que sí usa color, porque su color
*significa* algo (urgencia):

| Estado | Indicador |
|---|---|
| En tiempo | punto verde discreto + «En tiempo» + % consumido en gris |
| En riesgo | punto ámbar + texto ámbar |
| Vencido | icono de alerta rojo + texto rojo |
| Cumplido / cancelado | check gris |

Nunca se colorea el fondo de una fila o de una tarjeta completa.

## 8. Componentes

Centralizados en `apps/web/src/components`:

| Componente | Archivo | Rol |
|---|---|---|
| `Button` | `ui/button.tsx` | `primary` (turquesa), `secondary` (blanco + borde), `ghost`, `danger`, `link` |
| `Card`, `CardHeader`, `CardTitle`… | `ui/primitives.tsx` | Superficie estándar |
| `Badge` | `ui/primitives.tsx` | Etiquetas neutras; tonos `neutral`, `outline`, `brand`, `success`, `warning`, `danger` |
| `Input`, `Textarea`, `Select`, `Field`, `Checkbox` | `ui/primitives.tsx` | Formularios con foco turquesa |
| `Table`, `THead`, `TR`, `TH`, `TD` | `ui/primitives.tsx` | Tablas minimalistas |
| `EmptyState`, `Skeleton`, `DefItem` | `ui/primitives.tsx` | Estados vacíos y fichas |
| `Dialog…` | `ui/dialog.tsx` | Diálogos |
| `Tabs` | `ui/tabs.tsx` | Pestañas con indicador animado |
| `SegmentedControl` | `ui/segmented.tsx` | Filtros de pocas opciones |
| `StatusBadge` | `ui/status.tsx` | Estado del caso (neutral) |
| `SlaIndicator` | `ui/status.tsx` | SLA (semántico) |
| `KpiCard`, `MetricStrip` | `ui/kpi.tsx` | Indicadores |
| `FilterBar`, `SearchInput` | `ui/filter-bar.tsx` | Barra de filtros |
| `Pagination` | `ui/pagination.tsx` | Paginación |
| `UserAvatar`, `EntityMark` | `ui/avatar.tsx` | Personas y empresas |
| `Motion` helpers | `ui/motion.tsx` | `FadeIn`, `Stagger` |
| `NodusLogo` | `brand/logo.tsx` | Marca |
| `Sidebar`, `Topbar`, `PageHeader` | `layout/` | Estructura |
| `WorkflowStepper` | `features/cases/workflow-stepper.tsx` | Ciclo de vida visual |
| `CaseHeader` | `features/cases/case-detail/case-header.tsx` | Cabecera del workspace |
| `CaseTimeline` | `features/cases/case-detail/case-timeline.tsx` | Recorrido por estados |
| `DocumentCard` | `features/cases/case-detail/case-tabs.tsx` | Documento versionado |
| `NodeField` | `brand/node-field.tsx` | Ilustración de marca (login) |

## 9. Layout

- **Sidebar claro** (248px): mismo blanco cálido que el lienzo, separado por una
  línea de 1px. Grupos *Operación / Ecosistema / Gobierno* en etiquetas de 11px.
  Ítem activo: fondo `brand-soft`, texto tinta, barra turquesa de 2px a la
  izquierda que se desliza entre ítems.
- **Topbar** mínimo (56px): migas de pan a la izquierda; búsqueda global de
  casos, acción rápida «Nuevo caso» (sólo si el usuario tiene `CASE_CREATE`),
  notificaciones y menú de usuario a la derecha. En móvil, el sidebar se abre
  como panel lateral.
- **Página**: `PageHeader` con eyebrow (grupo de navegación), título de 28px,
  descripción en gris a 65 caracteres de ancho y acciones a la derecha.
- **Case Workspace**: cabecera con código, título, empresa, estado, responsable y
  SLA; debajo el `WorkflowStepper`; luego nueve pestañas a todo el ancho
  (Resumen, Timeline, Postulaciones, Propuesta, Contratación, Ejecución,
  Documentos, Comunicaciones, Auditoría) y, bajo ellas, el panel activo con la
  columna de próximos pasos y ficha a la derecha (fija al hacer scroll).
  *Ejecución* agrupa Hitos, Actividades, Entregables e Incidencias con un
  control segmentado: cuatro pestañas más no caben sin desplazamiento.
- **Tabla de casos**: en pantallas < 1536px la empresa se muestra bajo el título
  del caso en lugar de en columna propia, para que la tabla quepa a 1280–1440px.

## 10. Reglas de uso del color (resumen operativo)

1. ¿Es una acción principal, selección, foco o progreso? → turquesa.
2. ¿Significa urgencia o error (SLA, validación, destructivo)? → alerta, con icono.
3. ¿Es un estado del caso, un tipo, una categoría, una etiqueta? → **neutral**.
4. Texto siempre en tokens de tinta; el color va en el indicador de al lado.
5. Máximo un elemento turquesa sólido por zona visual (normalmente el botón
   primario).
6. Prohibido usar las clases de la paleta por defecto de Tailwind
   (`amber-*`, `blue-*`, `emerald-*`…) en componentes.

## 11. Qué no cambia

La lógica de negocio queda intacta: los botones de transición se siguen pintando
a partir de `availableTransitions` calculado por el backend; los formularios
envían exactamente los mismos payloads a los mismos endpoints; la visibilidad de
navegación por rol sigue siendo presentación y el backend sigue respondiendo 403.

## 12. Hallazgo fuera de alcance (backend, no modificado)

Durante la verificación se detectó que el throttler con nombre `auth`
(`THROTTLE_AUTH_LIMIT=10` por 5 min) está registrado globalmente en
`ThrottlerModule.forRootAsync` (`apps/api/src/app.module.ts`). `@nestjs/throttler`
aplica **todos** los throttlers con nombre a **todas** las rutas, así que cada
endpoint queda limitado a 10 peticiones por IP cada 5 minutos: el healthcheck
de Docker (cada 10 s) acaba en 429 y el contenedor `api` pasa a *unhealthy*, y
la navegación normal recibe 429 (p. ej. `/notifications/unread-count`).

No se tocó por ser lógica de backend fuera del alcance del rediseño. Corrección
propuesta: dar al throttler `auth` un límite por defecto alto y restringirlo sólo
donde se declara `@Throttle({ auth: … })`, o marcar el resto con
`@SkipThrottle({ auth: true })`, y excluir `/health` con `@SkipThrottle()`.
