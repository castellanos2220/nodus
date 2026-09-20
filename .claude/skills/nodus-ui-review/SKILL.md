---
name: nodus-ui-review
description: Revisión visual obligatoria antes de dar por terminada cualquier pantalla o componente de NODUS. Incluye el checklist de 15 puntos, las reglas anti-AI/anti-template y el procedimiento para capturar pantallas autenticadas y revisarlas. Úsala después de implementar o modificar UI en apps/web y antes de reportar el trabajo como terminado.
---

# NODUS — revisión de UI

**No se acepta el primer resultado.** Toda pantalla se abre, se mira y se
contrasta con este checklist. Si parece un template, se rediseña.

## 1. Capturar

Con el stack levantado (`docker compose up -d`):

```bash
node infra/scripts/ui-shots.mjs                  # todas las pantallas
node infra/scripts/ui-shots.mjs cases detail     # sólo algunas
```

Genera PNG autenticados (Chrome headless vía CDP, sin dependencias) en
`.ui-shots/` (ignorado por git), a 1440px y a 390px. En modo desarrollo la
primera carga compila: si salen esqueletos, repetir con `WAIT=9000`.

> Aviso conocido: el throttler `auth` del backend limita cada ruta a 10
> peticiones/5 min por IP. Tras muchas capturas aparecen 429; `docker compose
> restart api` restablece los contadores (almacenamiento en memoria).

## 2. Checklist (responder cada punto)

1. ¿Hay demasiados colores? (marca + como mucho un semántico por zona)
2. ¿Hay demasiadas tarjetas? (¿cada caja delimita un objeto real?)
3. ¿Hay demasiados badges? (¿algún dato que sería mejor como texto?)
4. ¿Hay demasiados bordes redondeados? (`rounded-full` sólo avatar/punto)
5. ¿Hay demasiadas sombras? (paneles planos; sombra sólo en overlays)
6. ¿La jerarquía visual es clara? (entrecerrar los ojos: ¿qué se ve primero?)
7. ¿El usuario sabe qué hacer? (una acción principal visible)
8. ¿El contenido importante destaca?
9. ¿La interfaz parece genérica?
10. ¿Parece una plantilla de IA?
11. ¿Existe ruido visual? (líneas, iconos, etiquetas que no informan)
12. ¿Hay elementos decorativos sin función?
13. ¿La densidad es correcta para uso intensivo?
14. ¿Parece software empresarial real?
15. ¿La identidad NODUS es reconocible? (N, grafito, un turquesa)

Además: estados de carga/vacío/error revisados · 390px revisado ·
teclado (tab/foco) revisado · nada duplicado en la misma vista.

## 3. Reglas anti-AI (rechazo automático)

Gradientes innecesarios · glassmorphism · blur decorativo · blobs o círculos
de fondo · glow · neón · morado/azul-morado «AI» · tarjetas flotantes por todas
partes · sombras apiladas · botones gigantes · todo en forma de píldora ·
badge de color por cada dato · iconos gigantes · emojis como UI ·
ilustraciones genéricas · bento box sin necesidad · espacio vacío sin
propósito · números gigantes con decoración · radios excesivos · todo dentro
de una tarjeta · pestañas que parecen botones · botones dentro de botones ·
exceso de divisores · simetría artificial · animación continua o de entrada.

**Patrón prohibido:** «Card + icono + número + badge + sombra» repetido.

## 4. Anti-template

No debe parecer Linear, Notion, Stripe, Vercel, AdminLTE, Material, demo de
shadcn ni boilerplate SaaS. shadcn/Radix/Tailwind son infraestructura: su
aspecto por defecto no se conserva.

## 5. Informe

Al terminar, reportar por pantalla: capturas revisadas, puntos del checklist
que fallaron y cómo se corrigieron, y lo que queda pendiente. Sin maquillar.
