# NODUS — Principios de UI

- **Fecha**: 2026-09-18
- **Skills**: `.claude/skills/nodus-product-design`, `nodus-ui-review`
- **Relacionado**: `nodus-design-system.md` (tokens), `nodus-ux-principles.md` (patrones)

> **Diseñar como producto, no decorar como template.**

## 1. La pregunta

Antes de añadir cualquier elemento: **¿ayuda al usuario a entender, decidir o
ejecutar algo?** Si no, no se añade.

## 2. Principios

1. Claridad antes que decoración.
2. Jerarquía antes que color.
3. Información antes que ornamentación.
4. Densidad controlada: aireado pero eficiente.
5. Consistencia antes que variedad.
6. Estados comprensibles sin depender sólo del color.
7. Acciones claras: una principal por zona.
8. Navegación predecible.
9. Feedback inmediato.
10. Cada elemento con una razón funcional.

## 3. Carácter

NODUS debe sentirse **sobrio, moderno, operativo, tecnológico, humano y
empresarial**. Nunca futurista, neón, «AI», glassmorphism ni template SaaS.

- **Sobrio**: neutros dominan; el turquesa es escaso y por eso significa.
- **Operativo**: la información de trabajo va primero; el adorno, nunca.
- **Humano**: lenguaje llano, personas con nombre y avatar, errores que
  explican qué pasó y qué hacer.

## 4. Uso del color

| Pregunta | Respuesta |
|---|---|
| ¿Es la acción principal, una selección, el foco o un progreso? | Turquesa |
| ¿Significa riesgo, vencimiento, error o éxito? | Semántico + icono + texto |
| ¿Es un estado normal, un tipo, una categoría, una etiqueta? | **Neutro** |
| ¿Es texto? | Siempre tokens de tinta; el color va en el indicador |

**Sí:** `● En ejecución` (punto turquesa, texto grafito).
**No:** una píldora verde con «EN EJECUCIÓN» en verde.

## 5. Reglas anti-AI

Estas son las marcas de una interfaz generada sin criterio. Si aparecen, se
rechaza la pantalla.

**Nunca**

- Gradientes innecesarios, glassmorphism, blur decorativo.
- Fondos con blobs, círculos o retículas decorativas.
- Glow, neón, paletas morado/azul-morado «AI».
- Tarjetas flotantes por todas partes; sombras apiladas.
- Botones gigantes; todo en forma de píldora.
- Un badge de color para cada dato.
- Iconos gigantes; iconos dentro de cajas decorativas; emojis como UI.
- Ilustraciones genéricas.
- Bento box sin necesidad; simetría artificial «porque se ve bonito».
- Espacio vacío sin propósito; números gigantes con decoración.
- Radios excesivos (`rounded-2xl`, `rounded-3xl`, `rounded-full` en paneles).
- Todo dentro de una tarjeta; tarjetas dentro de tarjetas.
- Pestañas que parecen botones; botones dentro de botones.
- Exceso de líneas divisorias.
- Animaciones continuas (pulse, ping), entradas de página, cascadas.

**Patrón prohibido:** *Card + icono + número + badge + sombra*, repetido.

## 6. Reglas anti-template

NODUS no debe parecer Linear, Notion, Stripe, Vercel, AdminLTE, Material, la
demo de shadcn ni un boilerplate SaaS. Radix, shadcn y Tailwind son
**infraestructura**: su aspecto por defecto no se conserva. Lo que hace
reconocible a NODUS:

- El símbolo **N** como grafo de nodos y la palabra NODUS espaciada.
- Grafito + un turquesa, sobre blanco cálido (no blanco frío ni gris azulado).
- Estados por **forma** según la etapa del ciclo, no por color.
- El **recorrido del workflow** como elemento central del caso.
- Densidad de herramienta de trabajo con tipografía cuidada.

## 7. Jerarquía

Orden de herramientas para dar importancia, de primera a última:

1. **Posición** (arriba-izquierda primero).
2. **Tamaño y peso** tipográfico.
3. **Contraste** de tinta (foreground → ink-2 → muted).
4. **Espacio** (agrupar lo relacionado, separar lo distinto).
5. **Color** — último recurso, y sólo con significado.

Prueba rápida: entrecerrar los ojos. Lo primero que se ve debe ser lo más
importante de la pantalla.

## 8. Superficies

- **Sección** sobre el lienzo para contenido con título (sin caja).
- **Panel** para objetos delimitados: tablas, formularios, listas.
- **Tarjeta** sólo para colecciones de objetos equivalentes.
- Nunca una tarjeta dentro de otra. Nunca una tarjeta con una sola línea.

## 9. Iconografía

Lucide, trazo 1,75, 14–16px. Un icono acompaña al texto; no lo sustituye salvo
en botones de herramienta con etiqueta accesible. Nada de iconos grandes para
«llenar» estados vacíos o KPIs.

## 10. Movimiento

Mínimo y funcional: transición de overlays, indicador de pestaña, expandir y
colapsar, toasts. La interfaz debe sentirse **estable**: nada se mueve si el
usuario no hizo algo.

## 11. Accesibilidad

- Contraste AA (≥4,5:1) en texto. `subtle-foreground` no se usa para
  información.
- Nunca sólo color: *SLA vencido* = icono + «Vencido» + barra roja.
- Foco visible siempre (contorno turquesa de 2px).
- Botones de icono con `aria-label` y tooltip.
- Pestañas y segmentos con roles ARIA y navegación por flechas.
- `prefers-reduced-motion` respetado.

## 12. Ejemplos

| Situación | Sí | No |
|---|---|---|
| Estado en una tabla | `○ En revisión` en texto grafito | Píldora ámbar «EN REVISIÓN» |
| SLA vencido | `⚠ Vencido · 104%` en rojo + barra | Fila entera con fondo rojo |
| Caso sin responsable | «Sin asignar» en gris | Badge naranja «PENDIENTE» |
| Sin datos de tiempos | «Aún no hay casos cerrados para calcularlo» | «0.0 horas» |
| Acción bloqueada | Texto con la razón que devuelve el backend | Botón gris sin explicación |
| Bloque de texto con título | Sección sobre el lienzo | Tarjeta con sombra |
| KPI | Etiqueta, cifra, contexto en una línea | Icono en círculo de color + cifra + badge |
