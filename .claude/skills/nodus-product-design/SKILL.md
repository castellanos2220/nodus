---
name: nodus-product-design
description: Principios de producto para cualquier trabajo de interfaz en NODUS (apps/web). Úsala ANTES de diseñar, rediseñar o añadir una pantalla, sección, componente o flujo — define para quién es cada pantalla, qué debe resolver primero y qué no debe añadirse. Complementa a nodus-design-system (tokens), nodus-enterprise-ux (patrones) y nodus-ui-review (revisión).
---

# NODUS — diseño de producto

NODUS es software **B2B de operación**: orquesta casos entre Mipymes y
consultores bajo veeduría de un equipo Advisory. La gente pasa horas dentro.
La interfaz es una herramienta de trabajo, no una pieza de marketing.

> **Diseñar como producto, no decorar como template.**

## La pregunta que decide todo

Antes de añadir cualquier elemento:

> **¿Esto ayuda al usuario a entender, decidir o ejecutar algo?**

Si la respuesta es no, no se añade. Si es «se ve mejor», tampoco.

## Diez principios (en orden de prioridad cuando chocan)

1. **Claridad antes que decoración.**
2. **Jerarquía antes que color.** Peso tipográfico, tamaño y posición ordenan;
   el color es el último recurso.
3. **Información antes que ornamentación.**
4. **Densidad controlada.** Aireado pero eficiente; nunca «landing page».
5. **Consistencia antes que variedad.** Un patrón resuelto se reutiliza.
6. **Estados comprensibles sin depender del color** (texto + forma + posición).
7. **Acciones claras.** Una acción principal por zona; las demás, secundarias.
8. **Navegación predecible.** Misma estructura en cada página.
9. **Feedback inmediato.** Toda acción responde: procesando → resultado.
10. **Cada elemento tiene una razón funcional.** Si no la puedes decir en una
    frase, sobra.

## Procedimiento antes de diseñar una pantalla

Responde por escrito (en el PR o en tu razonamiento) estas siete preguntas:

1. **¿Quién la usa?** (rol — ver tabla abajo)
2. **¿Qué quiere hacer?** (el trabajo, en un verbo)
3. **¿Qué información necesita primero?** → arriba a la izquierda, mayor peso.
4. **¿Qué es secundario?** → menor peso, colapsado o en otra pestaña.
5. **¿Qué acción quiere ejecutar?** → un botón primario, visible sin scroll.
6. **¿Qué puede salir mal?** → diseña el error, el vacío y el bloqueo.
7. **¿Qué contexto necesita para decidir?** → al lado de la acción, no en otra página.

## Roles y su trabajo principal

| Rol | Trabajo | Lo primero que necesita ver |
|---|---|---|
| Advisory / PMO | Gobernar el flujo de muchos casos a la vez | Qué requiere su intervención: SLA vencido, postulaciones por evaluar, QA, decisiones pendientes |
| Consultor | Postularse, diseñar propuestas, ejecutar | Sus casos, su siguiente entregable, hitos próximos |
| Consultor revisor | Revisar propuestas | Bandeja de QA con lo más antiguo primero |
| Cliente Mipyme | Seguir sus casos y decidir | En qué va su caso y qué se espera de él |
| Super admin | Gobierno de plataforma | Configuración, roles, auditoría |

La navegación por rol es **presentación**. Permisos y transiciones los decide
el backend (`availableTransitions`, 403/404). La UI nunca deduce permisos.

## Lo que NODUS debe transmitir

Sobrio · moderno · operativo · tecnológico · humano · empresarial.

Nunca: futurista, neón, «AI», glassmorphism, template SaaS.

## Identidad

- Palabra **NODUS** + símbolo **N** (grafo de cuatro nodos, el de llegada en
  turquesa). Se usa como logo, favicon, avatar de sistema y marca en la
  navegación. No se complica ni se reinterpreta sin una razón real.
- Paleta: blanco cálido, grafito, grises y **un** turquesa de marca.

## Referencias

- Tokens y componentes: `docs/architecture/nodus-design-system.md`
- Reglas visuales y anti-AI: `docs/architecture/nodus-ui-principles.md`
- Patrones de UX empresarial: `docs/architecture/nodus-ux-principles.md`
- Skills hermanas: `nodus-design-system`, `nodus-enterprise-ux`, `nodus-ui-review`
