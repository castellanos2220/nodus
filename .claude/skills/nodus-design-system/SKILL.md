---
name: nodus-design-system
description: Tokens y reglas del Design System de NODUS (color, tipografía, espaciado, tamaños, bordes, radios, sombras, elevación, iconos, estados, foco, movimiento). Úsala SIEMPRE que escribas o modifiques clases de Tailwind, CSS o componentes en apps/web, para no introducir valores arbitrarios ni estilos fuera del sistema.
---

# NODUS — Design System

Fuente de verdad: `docs/architecture/nodus-design-system.md`.
Implementación: `apps/web/src/app/globals.css` (variables) →
`apps/web/tailwind.config.ts` (utilidades) → `apps/web/src/components/ui/*`.

## Regla cero

**No hay valores arbitrarios.** Nada de `text-[11.5px]`, `tracking-[0.07em]`,
`rounded-[14px]`, `#hex` o `shadow-[...]` en páginas o features. Si hace falta
un valor que no existe, se añade **un token** con nombre y razón, y se usa en
todas partes. La paleta por defecto de Tailwind (`blue-500`, `amber-50`…) está
prohibida en componentes.

## Color — tres familias que no se mezclan

| Familia | Tokens | Para qué |
|---|---|---|
| Neutros (≈85 %) | `background` `card` `muted` `border` `border-subtle` `border-strong` `foreground` `ink-2` `muted-foreground` `subtle-foreground` | Estructura, texto, superficies |
| Marca | `brand` `brand-strong` `brand-soft` `brand-foreground` | Acción principal, selección, foco, progreso, identidad |
| Semántico | `success*` `warning*` `danger*` | Completado · riesgo · vencido/error/destructivo |

- Los **estados del caso no tienen color**. Nunca «CREADO = azul».
- Texto siempre en tokens de tinta; el color va en el indicador de al lado.
- Máximo **un** elemento turquesa sólido por zona (normalmente el botón primario).
- Botón primario: turquesa con texto `brand-foreground` (7,4:1). No blanco (2,6:1).

## Tipografía — Geist Sans / Geist Mono

| Rol | Clase | Uso |
|---|---|---|
| Display | `text-display` | Saludo del dashboard, título del caso. Uno por vista |
| H1 | `text-h1` | Título de página |
| H2 | `text-h2` | Sección |
| H3 | `text-h3` | Grupo, panel, cabecera de tarjeta |
| Body | `text-body` | Texto de interfaz |
| Body small | `text-body-sm` | Tablas densas, metadatos principales |
| Label | `text-label` | Etiquetas de campo, cabeceras de tabla |
| Caption | `text-caption` | Metadatos secundarios, pies |
| KPI | `text-kpi` | Cifras de indicadores (dígitos proporcionales) |

- Mayúsculas sólo en `text-overline` (grupos del sidebar). Ni estados, ni
  cabeceras de tabla, ni etiquetas de campo en mayúsculas.
- Columnas numéricas: `tabular`. Códigos (`CAS-000008`): `font-mono text-caption`.

## Espaciado y tamaños (base 4px)

Escala permitida: `1 2 3 4 5 6 8 10 12` (4–48px). Nada intermedio.

| Contexto | Valor |
|---|---|
| Página | `px-8 py-6` escritorio · `px-4` móvil |
| Entre secciones | `gap-8` |
| Dentro de un grupo | `gap-4` |
| Panel | `p-5` |
| Celda de tabla | `px-3 py-2.5` (cómoda, 48px) · `py-1.5` (compacta, 40px) |
| Controles | alto `h-8` (sm) · `h-9` (md, defecto) · `h-10` sólo login |
| Iconos | 16px en controles y navegación · 14px en metadatos · 20px máximo |

## Bordes, radios, sombras, elevación

- Bordes: siempre 1px. `border` por defecto, `border-subtle` entre filas,
  `border-strong` en controles. Bordes de color sólo foco y error.
- Radios: `rounded-xs` 4px (chips, kbd) · `rounded-sm` 6px (botones, inputs,
  items de menú) · `rounded-md` 8px (paneles, tarjetas, popovers) ·
  `rounded-lg` 10px (diálogos). `rounded-full` **sólo** avatares, puntos de
  estado y contador de notificaciones.
- Elevación: 0 = plano con borde (paneles, tablas, tarjetas — **sin sombra**) ·
  1 = `shadow-pop-sm` (menús, popovers) · 2 = `shadow-pop` (diálogos, toasts).

## Foco, interacción, movimiento

- Foco: contorno 2px `brand` con offset 2px en todo elemento interactivo.
- Hover: `bg-muted` en filas e ítems; nunca cambiar tamaño ni sombra.
- Movimiento: `duration-fast` 120ms (hover/press) · `duration-base` 180ms
  (overlays, disclosure, indicador de pestaña). Permitido: abrir/cerrar
  overlays, deslizar el indicador de pestaña, expandir/colapsar, toasts.
  **Prohibido**: animaciones continuas (pulse, ping), entradas de página,
  cascadas de tarjetas, rebotes, zoom. Respetar `prefers-reduced-motion`.

## Componentes base (usar, no reinventar)

`Button` · `Badge` · `StatusBadge` · `SlaIndicator` · `Panel`/`Section` ·
`DataTable` · `Tabs` · `SegmentedControl` · `FilterBar`/`SearchInput` ·
`Pagination` · `Field`/`Input`/`Select`/`Textarea`/`Checkbox` · `FormSection` ·
`Dialog` · `EmptyState` · `ErrorState` · `InlineNotice` · `Skeleton` ·
`UserAvatar`/`EntityMark` · `Kpi`/`KpiStrip` · `WorkflowRail` · `Tooltip`.

Si un componente no cubre un caso, se **extiende el componente**; no se copia
su estilo en la página.
