---
name: nodus-enterprise-ux
description: Patrones de UX empresarial para NODUS — tablas de uso intensivo, filtros, búsqueda, workflow de casos, Case Workspace, formularios, estados (loading/empty/error/success/disabled/processing), responsive y accesibilidad. Úsala al diseñar o cambiar cualquier listado, detalle, formulario o flujo en apps/web.
---

# NODUS — UX empresarial

Usuarios que gestionan **muchos casos durante muchas horas**. Se optimiza
lectura rápida, escaneo, comparación, acción y contexto — no el «wow».

## Tablas (la pantalla más usada)

- Densidad: fila cómoda 48px por defecto; compacta 40px como preferencia del
  usuario (se recuerda en `localStorage`, es comodidad personal).
- Una línea por celda siempre que se pueda. Segunda línea sólo para dato
  secundario real (p. ej. empresa bajo el título), en `text-caption`.
- Truncar con `truncate` **y** `title`/tooltip con el valor completo.
- Alineación: texto a la izquierda, números y fechas a la derecha con `tabular`.
- Cabeceras en `text-label`, sin mayúsculas. Las ordenables muestran el
  estado de orden (↑/↓) y usan `sortBy`/`sortDir` del backend — nunca ordenar
  sólo la página cargada.
- Hover de fila sutil; fila entera navega, y el enlace del título sigue siendo
  el objetivo de teclado.
- Sin pills por celda. Un estado = glifo + texto. Sin checkboxes de selección
  si no existe una acción masiva real (una selección sin acción es decoración).
- Cabecera fija al desplazar en listados largos.
- Estados de la tabla: skeleton con la forma de las filas · vacío con motivo
  y acción · error con «Reintentar».

## Filtros y búsqueda

- Una fila sobre la tabla: búsqueda primero, luego filtros por frecuencia de uso.
- El estado de filtros vive en la URL (compartible, «atrás» funciona).
- Mostrar cuántos resultados hay y un único «Limpiar filtros».
- Pocas opciones (≤5) → `SegmentedControl`; muchas → `Select` agrupado.
- Filtros sólo sobre lo que el backend soporta; nada de filtrar en cliente
  páginas parciales haciéndolo pasar por un filtro global.

## Workflow y estados del caso

- 17 estados en backend; en la UI se agrupan en **7 etapas**
  (`lib/case-stages.ts`): Entrada · Bolsa · Propuesta · Cliente ·
  Contratación · Ejecución · Cierre.
- La UI debe responder siempre: **dónde está · qué ya pasó · qué viene · qué
  acción hay disponible · qué lo bloquea**.
- Las acciones y sus bloqueos vienen de `availableTransitions` (backend). La
  razón del bloqueo se muestra textual, junto a la acción.
- Estado normal: neutro. Color sólo para riesgo, vencimiento, error o éxito.

## Case Workspace (centro operativo)

- Cabecera sobre el lienzo (no dentro de una tarjeta): código, título,
  empresa y una fila de hechos — Estado · Responsable · SLA · Actualizado.
- Debajo, el recorrido del workflow en una sola línea.
- Panel lateral fijo: **Siguiente paso** (acción o bloqueo) y contexto mínimo.
- Nada se muestra dos veces en la misma vista.
- El usuario debe entender el caso sin salir de esta pantalla.

## Formularios

- Herramientas de trabajo, no tarjetas enormes. `FormSection`: título y ayuda
  a la izquierda, campos a la derecha (apila en móvil).
- Etiqueta siempre visible; ayuda breve debajo; error en lugar de la ayuda.
- Mínimos de longitud: contador «faltan N caracteres», no sólo rojo.
- Botón de envío con estado *processing* («Registrando…», deshabilitado).
- Errores del servidor en `InlineNotice` de error, cerca del botón.

## Estados de interfaz — todos del mismo sistema

| Estado | Cómo |
|---|---|
| Loading | `Skeleton` con la forma del contenido final (no spinners sueltos) |
| Empty | Qué falta · por qué importa · qué puede hacer (acción si existe) |
| Error | Qué falló en lenguaje llano + «Reintentar» (refetch) |
| Success | Toast breve + el cambio visible en la propia pantalla |
| Disabled | Siempre con la razón visible o en tooltip |
| Processing | Botón con spinner, texto en gerundio, doble envío bloqueado |

## Responsive

Escritorio primero (1280–1600). En pantallas menores **priorizar**, no
comprimir: columnas de baja prioridad pasan a segunda línea o desaparecen,
el panel lateral baja bajo el contenido, las pestañas desplazan en horizontal.

## Accesibilidad (mínimos)

- Contraste AA en texto (≥4,5:1). `muted-foreground` es el gris más claro
  permitido para texto informativo.
- Nunca sólo color: SLA vencido = icono + «Vencido» + barra.
- Foco visible en todo. Botones de icono con `aria-label` y tooltip.
- Tablas con `<th>`; pestañas con roles ARIA y flechas de teclado.
