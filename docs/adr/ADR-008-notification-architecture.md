# ADR-008 — Arquitectura de notificaciones dirigida por eventos

- **Estado**: aceptada
- **Fecha**: 2026-09-17
- **Decide**: cómo se comunican los cambios a los actores

## Contexto

El blueprint operativo define un componente transversal de comunicaciones con
plantillas oficiales TCOM1–TCOM12, destinatarios por evento y registro
obligatorio en bitácora. El brief (§27) añade una restricción de diseño: *«Los
eventos no deben acoplarse directamente a proveedores externos»*.

## Decisión

La cadena completa, con cuatro piezas desacopladas:

```
transición/acción
   └─ evento de dominio (tras el commit)
        └─ DomainEventNotificationHandler   → sólo encola
             └─ cola nodus.notifications
                  └─ RecipientResolverService  → audiencia → personas
                       └─ NotificationTemplate (fila en BD) → renderizado
                            └─ fila Notification + cola nodus.email
                                 └─ MailerService (puerto) → adaptador SMTP
```

## Justificación

**El evento no sabe que existe el correo.** `CaseClassified` describe un hecho:
qué caso, qué clasificación, quién y cuándo. Que eso produzca un correo, una
notificación in-app o nada es decisión del módulo de notificaciones. Si mañana se
añade WhatsApp, el dominio no se entera.

**Las plantillas son datos, no código.** Asunto, cuerpo, audiencias y canal viven
en la tabla `notification_templates`. Un administrador cambia el texto de TCOM5
sin desplegar. La sintaxis es deliberadamente mínima —`{{variable}}` y nada
más—: dar un motor con lógica a una plantilla editable desde la administración
sería convertir una fila de una tabla en código ejecutable sin revisión.

**Los destinatarios se resuelven en el momento del envío.** La plantilla declara
una audiencia (`CONSULTOR_ASIGNADO`, `CLIENTE`, `CONSULTORES_ELEGIBLES`), no
personas. Quién ocupa cada papel se sabe cuando el evento ocurre, no cuando se
configuró la plantilla.

**`CONSULTORES_ELEGIBLES` aplica la misma regla que la bolsa interna.** Notificar
una oportunidad a quien no puede postularse sería ruido y, peor, una filtración
de información del caso a alguien sin acceso.

**La fila `Notification` nace antes del envío.** Queda registro aunque el correo
falle, con `status`, `error` y `attempts` — exactamente lo que pide RT-013:
evento origen, destinatario, canal, estado, fecha y error.

**El correo va por un puerto.** `MailerService` es abstracto; hoy hay un
adaptador SMTP que sirve para Mailpit en local y para cualquier SMTP en
producción. Añadir Resend sería otro adaptador y una línea en el módulo.

## Consecuencias

**A favor**

- Un fallo de SMTP no afecta a ninguna petición HTTP ni a ninguna transición.
- Las 20 plantillas sembradas (TCOM1–TCOM12 más ocho complementarias para eventos
  que el blueprint exige comunicar) son editables desde la administración.
- Añadir un canal es añadir un adaptador, no tocar el dominio.

**En contra**

- La entrega es asíncrona: entre la acción y el correo pasan segundos. Es lo
  correcto, pero conviene saberlo al demostrar el flujo (Mailpit en
  `http://localhost:8025` lo muestra en cuanto llega).
- Requiere que el worker esté vivo. Si no lo está, los jobs se acumulan en Redis
  y se procesan cuando vuelve: nada se pierde, se retrasa.

## Alternativa descartada

**Enviar el correo en el mismo servicio que aplica el cambio.** Es lo más simple
de escribir y lo peor de operar: acopla el dominio al proveedor, mete latencia de
red en el request, y hace que un SMTP lento convierta una transición de 80 ms en
una de varios segundos. El brief lo prohíbe con razón.
