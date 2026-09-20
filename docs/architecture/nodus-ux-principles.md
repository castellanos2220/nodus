# NODUS — Principios de UX empresarial

- **Fecha**: 2026-09-18
- **Skills**: `.claude/skills/nodus-enterprise-ux`, `nodus-product-design`
- **Relacionado**: `nodus-ui-principles.md`, `nodus-design-system.md`

NODUS lo usan personas que gestionan **muchos casos durante muchas horas**. Se
optimiza para lectura rápida, escaneo, comparación, acción y contexto.

## 1. Pensar la pantalla antes de dibujarla

Para cada pantalla, responder:

1. ¿Quién la usa? 2. ¿Qué quiere hacer? 3. ¿Qué necesita ver primero?
4. ¿Qué es secundario? 5. ¿Qué acción quiere ejecutar? 6. ¿Qué puede salir mal?
7. ¿Qué contexto necesita para decidir?

Arquitectura: **Design System → Layout → Componentes → Páginas → Experiencia
por rol.** Nunca páginas aisladas con estilos propios.

## 2. Roles

| Rol | Trabajo | Primero |
|---|---|---|
| Advisory / PMO | Gobernar muchos casos | Lo que requiere su intervención |
| Consultor | Postularse, proponer, ejecutar | Sus casos y su próximo entregable |
| Revisor | QA de propuestas | Bandeja, lo más antiguo primero |
| Cliente Mipyme | Seguir y decidir | En qué va su caso y qué se espera de él |
| Super admin | Gobierno | Configuración, roles, auditoría |

La visibilidad por rol es presentación; el backend decide permisos.

## 3. Workflow

17 estados → 7 etapas (`lib/case-stages.ts`). Cualquier vista de un caso debe
contestar:

| Pregunta | Fuente |
|---|---|
| ¿Dónde está? | `status` + etapa |
| ¿Qué ya pasó? | `/cases/:id/status-history` |
| ¿Qué viene? | Siguiente etapa del recorrido |
| ¿Qué puedo hacer yo? | `availableTransitions` (backend, calculado para este usuario) |
| ¿Quién debe actuar si no soy yo? | Catálogo `GET /workflow/transitions` (roles y alcance por transición) + responsable/contacto del caso |
| ¿Qué lo bloquea? | `blockedReason` de cada transición · `closureBlockers` de ejecución |

La UI no replica reglas de negocio: todo lo anterior sale del backend.

## 4. Case Workspace

El centro operativo. Debe entenderse el caso **sin navegar a otra página**.

```
← Casos
CAS-000008 · Cerrado sin contratación
Implementación de historia clínica electrónica interoperable
Vitalis Salud Integral Ltda. · Medellín

Estado ─ Responsable ─ SLA ─ Actualizado            [fila de hechos]
Entrada ✓ ─ Bolsa ✓ ─ Propuesta ✓ ─ Cliente ⊘ ─ …   [recorrido en una línea]
──────────────────────────────────────────────────
Resumen · Workflow · Actividad · Propuesta · …      [pestañas]
──────────────────────────────────────────────────
Contenido de la pestaña                  │ Siguiente paso
                                         │   acción o «Esperando a…»
                                         │   bloqueos
                                         │ Contexto
                                         │   contacto, clasificación breve
```

Reglas:
- La cabecera vive sobre el lienzo, no dentro de una tarjeta.
- El recorrido del workflow ocupa **una línea**; el detalle por sub-estado vive
  en la pestaña *Workflow* junto a fechas, transiciones y bloqueos.
- **Siguiente paso** nunca queda vacío: si el usuario no tiene acciones, dice
  quién las tiene y desde cuándo espera.
- Nada se muestra dos veces (hoy la clasificación aparece en *Resumen* y en
  *Ficha*, y las fechas clave repiten el recorrido).

## 5. Listados y tablas

- Búsqueda y filtros en una fila, con el estado en la URL.
- Orden por columna con `sortBy`/`sortDir` del backend (casos: código, título,
  estado, creado, actualizado; empresas: nombre, código, país, alta;
  consultores: código, estado, alta).
- Densidad cómoda 48px / compacta 40px, preferencia personal recordada.
- Una línea por celda; truncado con tooltip; números a la derecha.
- Sin selección masiva mientras no exista una acción masiva real.

## 6. Formularios

- Secciones con título y ayuda a la izquierda, campos a la derecha.
- Etiquetas siempre visibles; ayuda breve; errores específicos.
- Mínimos de longitud con contador, no sólo color.
- Envío con estado *processing*; error del servidor junto al botón.
- Formularios largos por pasos o secciones (el intake ya usa dos bloques).

## 7. Estados de interfaz

| Estado | Diseño |
|---|---|
| Loading | Skeleton con la forma final |
| Empty | Qué falta · por qué importa · qué hacer |
| Error | Qué falló, en llano · «Reintentar» |
| Success | Toast breve + cambio visible en pantalla |
| Disabled | Razón visible o en tooltip |
| Processing | Spinner en el botón, gerundio, doble envío bloqueado |
| Sin datos suficientes | Decirlo («aún no hay casos cerrados»), nunca mostrar 0 como si fuera un dato |

## 8. Visualización de datos

Antes de un gráfico: **¿qué decisión ayuda a tomar?** Si ninguna, no se hace.

| Dato | Forma | Decisión |
|---|---|---|
| Casos por etapa | Barra por etapa (una serie, turquesa) | Dónde se acumula el trabajo |
| SLA | Cifra + barra de consumo por reloj | Qué intervenir primero |
| Tiempos de ciclo | Cifra por tramo | Qué etapa es lenta |
| Conversión | Porcentaje + barra | Calidad de las propuestas |

Sin 3D, sin gráficos decorativos, sin leyendas para una sola serie.

## 9. Responsive

Escritorio primero (1280–1600px). En menos ancho se prioriza: columnas
secundarias pasan a segunda línea o desaparecen, el panel lateral baja bajo
el contenido, las pestañas desplazan. En móvil, la navegación es un panel
lateral y las tablas muestran sólo las columnas esenciales.

## 10. Lenguaje

Español neutro, verbos concretos («Registrar revisión», no «Enviar»), estados
en *sentence case*, errores que dicen qué hacer. Nada de jerga técnica hacia
el cliente Mipyme.
