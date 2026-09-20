# NODUS Design System

- **Versión**: 2.0 — *propuesta, pendiente de aprobación*
- **Fecha**: 2026-09-18
- **Sustituye a**: la sección de tokens de `ui-redesign.md` (iteración 1)
- **Skills**: `.claude/skills/nodus-design-system`, `nodus-ui-review`

La v1 estableció la dirección (neutros + turquesa, estados sin color, sidebar
claro). La v2 no cambia esa dirección: **la vuelve más rigurosa y más densa**.
La columna «Cambio» indica qué difiere de lo implementado hoy.

Implementación: variables en `apps/web/src/app/globals.css` → utilidades en
`apps/web/tailwind.config.ts` → componentes en `apps/web/src/components/ui`.

---

## 1. Color

### Neutros — estructura (≈85 % de la superficie)

| Token | Valor | Uso | Cambio |
|---|---|---|---|
| `background` | `#FAFAF9` | Lienzo | — |
| `card` | `#FFFFFF` | Paneles, tablas, diálogos | — |
| `muted` | `#F4F4F2` | Hover, pista de barras, código | — |
| `border` | `#E6E6E2` | Bordes de paneles | — |
| `border-subtle` | `#EFEFEB` | Separadores de filas | **nuevo** |
| `border-strong` | `#D4D4CF` | Bordes de controles | — |
| `foreground` | `#121212` | Títulos, cifras, texto principal | — |
| `ink-2` | `#3A3D42` | Texto de cuerpo | — |
| `muted-foreground` | `#6B6E73` | Etiquetas, metadatos (5,2:1) | — |
| `subtle-foreground` | `#9A9DA3` | Placeholders, iconos inactivos. **No para texto informativo** | uso restringido |

### Marca

| Token | Valor | Uso |
|---|---|---|
| `brand` | `#09B3AE` | Botón primario, indicador de selección, foco, progreso, símbolo N |
| `brand-strong` | `#07807C` | Enlaces y texto de marca (4,8:1) |
| `brand-soft` | `#E6F6F5` | Fondo de selección (ítem activo, fila elegida). **Sólo selección** |
| `brand-foreground` | `#042322` | Texto sobre `brand` (7,4:1) |

### Semánticos — sólo cuando significan algo

| Token | Valor | Significa |
|---|---|---|
| `success` / `-soft` | `#1F8A5B` / `#EEF7F2` | Completado, en tiempo, aprobado |
| `warning` / `-soft` | `#B7791F` / `#FDF6E7` | Riesgo, requiere atención |
| `danger` / `-soft` | `#C8372D` / `#FCEFEE` | Vencido, error, destructivo |

**Reglas**

1. Estados del caso: sin color (ver §9).
2. Un turquesa sólido por zona. El resto de acciones, secundarias.
3. `brand-soft` no es un color de relleno decorativo: sólo marca selección.
4. Un semántico siempre acompañado de icono y texto.

---

## 2. Tipografía

Familias: **Geist Sans** (interfaz) y **Geist Mono** (códigos e identificadores),
servidas desde el paquete `geist` (sin red en el build). Dos familias, ninguna más.

| Rol | Token | Tamaño / línea | Peso | Tracking | Uso | Cambio |
|---|---|---|---|---|---|---|
| Display | `text-display` | 28 / 34 | 600 | −0,02em | Saludo del dashboard, título del caso | — |
| H1 | `text-h1` | 22 / 28 | 600 | −0,015em | Título de página | **baja de 28** |
| H2 | `text-h2` | 16 / 24 | 600 | −0,01em | Sección | nuevo rol |
| H3 | `text-h3` | 14 / 20 | 600 | 0 | Panel, grupo, cabecera de tarjeta | nuevo rol |
| Body | `text-body` | 14 / 20 | 400 | 0 | Texto de interfaz | sube de 13,5 |
| Body small | `text-body-sm` | 13 / 18 | 400 | 0 | Tablas, listas densas | nuevo |
| Label | `text-label` | 12 / 16 | 500 | 0 | Etiquetas de campo, cabeceras de tabla | nuevo |
| Caption | `text-caption` | 12 / 16 | 400 | 0 | Metadatos, pies | — |
| Overline | `text-overline` | 11 / 16 | 600 | +0,08em, MAYÚSCULAS | **Sólo** grupos del sidebar | restringido |
| KPI | `text-kpi` | 32 / 36 | 600 | −0,025em | Cifras de indicadores | baja de 34 |
| Mono | `font-mono text-caption` | 12 / 16 | 500 | 0 | `CAS-000008`, `CON-000002` | — |

- **Se eliminan** los 20 tamaños arbitrarios actuales (`text-[11px]`,
  `text-[11.5px]`, `text-[10.5px]`, `text-[0.9375rem]`, `text-[3.25rem]`…).
- Mayúsculas: sólo `text-overline`. Estados, cabeceras de tabla y etiquetas en
  *sentence case* (hoy hay 16 usos de mayúsculas; quedan 1).
- Cifras aisladas: dígitos proporcionales. Columnas numéricas: `tabular`.

---

## 3. Espaciado (base 4px)

Escala permitida: **4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48**
(`1 2 3 4 5 6 8 10 12` en Tailwind).

| Contexto | Valor | Cambio |
|---|---|---|
| Padding de página | 32 horizontal · 24 superior (16 en móvil) | de 40/32 |
| Entre secciones | 32 | de 40 |
| Entre grupos de una sección | 16 | — |
| Padding de panel | 20 | de 24 |
| Cabecera de página → contenido | 24 | de 32 |
| Celda de tabla | 12 horizontal · 10 vertical | de 16/14 |

## 4. Tamaños

| Elemento | Valor |
|---|---|
| Control `sm` | 32px de alto |
| Control `md` (defecto) | 36px |
| Control `lg` | 40px — sólo login |
| Fila de tabla cómoda / compacta | 48px / 40px (hoy ≈ 76px) |
| Topbar | 56px |
| Sidebar | 240px |
| Panel lateral del workspace | 320px |
| Ancho de lectura | 68 caracteres |

## 5. Bordes y radios

| Token | Valor | Uso | Cambio |
|---|---|---|---|
| `rounded-xs` | 4px | Chips, `kbd`, contadores | nuevo |
| `rounded-sm` | 6px | Botones, inputs, ítems de menú y de navegación | de 8–10 |
| `rounded-md` | 8px | Paneles, tarjetas, popovers, tablas | de 12 |
| `rounded-lg` | 10px | Diálogos | de 12 |
| `rounded-full` | — | **Sólo** avatares, puntos de estado, contador de notificaciones | hoy 46 usos |

Bordes siempre de 1px. De color, sólo el foco (turquesa) y el error (rojo).

## 6. Sombras y elevación

| Nivel | Token | Uso | Cambio |
|---|---|---|---|
| 0 | — | Paneles, tablas, tarjetas, botones, inputs: **borde, sin sombra** | se quitan `shadow-card`/`shadow-xs` (26 usos) |
| 1 | `shadow-pop-sm` | Menús, popovers, tooltips | nuevo |
| 2 | `shadow-pop` | Diálogos, toasts | — |

La barra superior es sólida (sin `backdrop-blur`); los velos de diálogo, sin blur.

## 7. Iconografía

- Lucide, trazo **1,75** en todo el producto.
- 16px en navegación, botones y cabeceras · 14px en metadatos · 20px máximo
  (estado vacío). Sin iconos en cajas decorativas.
- Todo icono informa algo o acompaña una acción. Botón sólo-icono: `aria-label` + tooltip.

## 8. Foco, interacción y movimiento

| Aspecto | Regla |
|---|---|
| Foco | Contorno 2px `brand`, offset 2px, en todo lo interactivo |
| Hover | `bg-muted` en filas/ítems; texto `foreground`. Sin cambios de tamaño ni sombra |
| Pulsado | `bg-muted` más oscuro o `brand/85` en primario |
| `duration-fast` | 120ms — hover, pulsado |
| `duration-base` | 180ms — overlays, disclosure, indicador de pestaña |
| Easing | `cubic-bezier(0.2, 0, 0, 1)` |
| Permitido | Abrir/cerrar overlays, deslizar el indicador de pestaña/segmento, expandir/colapsar, toasts |
| Prohibido | Pulse/ping continuos (hoy 3), fade de página en cada navegación, cascadas de KPIs (hoy 14 usos de FadeIn/Stagger), rebote, zoom |

`prefers-reduced-motion` desactiva todo movimiento no esencial.

## 9. Estados del caso

17 estados en backend → 7 etapas en la UI (`apps/web/src/lib/case-stages.ts`).
El indicador cambia de **forma**, no de color.

| Etapa | Estados | Glifo |
|---|---|---|
| Entrada | Creado · En revisión · Clasificado | ○ anillo gris |
| Bolsa | En postulación · Asignado | ● gris |
| Propuesta | En diseño · Lista para QA · Enviada | ● grafito |
| Cliente | En decisión · Ajustes · Aceptada | ● grafito |
| Contratación | Pendiente · Autorizado | ● grafito |
| Ejecución | En ejecución · Listo para cierre | ● turquesa (progreso) — **estático** |
| Cierre | Cerrado · Cerrado sin contratación | ✓ tinta · ⊘ gris |

- `StatusBadge variant="plain"` (glifo + texto, *sentence case*) en tablas y listas.
- `variant="pill"` (borde 1px, radio 4px) **sólo** en la cabecera del caso y en diálogos.
- Semántico sólo para SLA: En tiempo (punto verde + texto) · En riesgo (reloj
  ámbar + texto) · Vencido (triángulo rojo + texto + barra).

## 10. Componentes

### Botones

| Variante | Aspecto | Uso |
|---|---|---|
| `primary` | Turquesa, texto tinta | Una acción principal por zona |
| `secondary` | Blanco, borde `border-strong` | Acciones secundarias |
| `ghost` | Sin fondo | Barras de herramientas, iconos |
| `danger` | Rojo | Sólo destructivas |
| `link` | Texto `brand-strong` | Navegación en línea |

Tamaños `sm` 32 · `md` 36 · `lg` 40. Estado *processing*: spinner + gerundio +
deshabilitado.

### Superficies

| Componente | Cuándo | Aspecto |
|---|---|---|
| `Section` | Agrupar contenido **sobre el lienzo** | Título `h2` + contenido, sin caja |
| `Panel` | El contenido es un objeto delimitado (tabla, formulario, lista) | Borde 1px, radio 8, sin sombra, padding 20 |
| `Card` | Colecciones de objetos equivalentes (oportunidades, documentos) | Igual que `Panel`; clicable si navega |

Regla: **no todo va en una caja.** Un bloque de texto con título es una
`Section`, no una tarjeta.

### Tablas (`DataTable`)

Cabecera `text-label` sin mayúsculas, ordenable cuando el backend lo permite
(`sortBy`/`sortDir`), fija al desplazar. Filas 48/40px, separadores
`border-subtle`, hover `muted`. Truncado con tooltip. Estados integrados:
cargando (skeleton de filas), vacío, error con reintento. Columnas con
prioridad para responsive.

### Formularios

`FormSection` (título + ayuda a la izquierda, campos a la derecha; apila en
móvil) · `Field` (etiqueta, control, ayuda o error) · `InlineNotice` para
errores del servidor.

### Estados

`Skeleton` · `EmptyState` (sin caja de icono: título, motivo, acción) ·
`ErrorState` (mensaje + Reintentar) · `InlineNotice` (info/success/warning/danger) ·
toast (sonner con estilo NODUS).

### Navegación

Sidebar claro (grupos en `overline`, ítem activo con fondo `brand-soft` y
barra de 2px) · Topbar sólida con migas, búsqueda `/`, acción rápida,
notificaciones y usuario · `Tabs` subrayadas (no botones), contador en texto.

### Marca

Símbolo N (grafo de cuatro nodos, el de llegada turquesa): logo, **favicon**
(hoy no existe: el navegador pide `/favicon.ico` y recibe 404), avatar de
«Sistema» en bitácoras y marca en la navegación.
