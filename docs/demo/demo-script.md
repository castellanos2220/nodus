# Guion de demostración

La historia que cuenta el sistema:

> Una Mipyme registra una necesidad → NODUS crea el caso → Advisory lo revisa y
> clasifica → lo publica → un consultor se postula → Advisory asigna → el
> consultor prepara la propuesta → Advisory hace QA → el cliente acepta → se
> valida la contratación → el consultor ejecuta, registra hitos y entrega → el
> cliente acepta → se cierra → **todo queda auditado**.

Hay dos formas de recorrerla. La primera muestra el resultado; la segunda lo
construye en vivo.

---

## Preparación

```bash
docker compose up -d
pnpm db:seed          # si no lo ha hecho ya
node infra/scripts/smoke.mjs   # 35 comprobaciones — conviene verlas pasar primero
```

Abra en pestañas: http://localhost:3000 · http://localhost:8025 (Mailpit) ·
http://localhost:4000/api/v1/docs (Swagger).

---

## Ruta A — El resultado (8 minutos)

### 1. El expediente completo · `advisory@nodus.local`

Entre y abra **`CAS-000001`** (Pérdida de trazabilidad de inventario).

- **Cabecera**: estado `CERRADO`, avance 100 %, empresa, consultor responsable.
- **Panel lateral**: ficha con la clasificación gobernada, SLA de la etapa e
  hitos del expediente con sus fechas reales.
- **Pestaña Resumen**: el relato original del cliente (que la plataforma nunca
  modifica) y la clasificación T2 con sus observaciones.
- **Recorrido por los estados**: las 15 transiciones, con quién las hizo y
  **cuánto tiempo permaneció el caso en cada etapa**. Fíjese en las filas con
  actor «Sistema»: son las transiciones encadenadas automáticamente.

### 2. Trazabilidad · misma pantalla, pestaña **Trazabilidad**

Veinte eventos en orden inverso, cada uno con actor, origen y el delta de lo que
cambió. Es la bitácora, no una copia: la misma tabla que consulta
`/audit`.

> Para demostrar que es inmutable: la prueba
> `test/integration/database-invariants.spec.ts` intenta modificarla y borrarla
> con Prisma, saltándose todos los servicios, y PostgreSQL lo rechaza.

### 3. Versionado de propuesta · pestaña **Propuesta**

Las versiones conviven en la tabla. Seleccione una: si está congelada, la
cabecera lo dice y el contenido es de sólo lectura. Más abajo, las revisiones de
QA con su checklist del «Go».

### 4. Ejecución · abra **`CAS-000002`**, pestaña **Ejecución**

Hitos con criticidad y estado, entregables **con su historial de versiones**,
actividades e incidencias. Si hay bloqueos para el cierre técnico, aparecen
arriba listados con su motivo.

### 5. Gobierno · menú **SLA**, **Auditoría** y **Configuración**

- **SLA**: los relojes con su consumo y las 18 reglas parametrizadas. Ninguna
  duración está en el código. El botón «Evaluar ahora» fuerza el barrido que
  normalmente hace el worker.
- **Auditoría**: filtre por acción `CASE_TRANSITION_` para ver sólo los cambios
  de estado. Despliegue «Ver» en cualquier fila: valor anterior, valor nuevo,
  metadatos, IP y `requestId`.
- **Configuración**: las 14 listas de valores, la matriz de roles y las 20
  plantillas TCOM con el evento que dispara cada una.

### 6. El dashboard

Casos activos y críticos, SLA vencidos y en riesgo, cumplimiento de SLA,
conversión de propuestas, tiempos medios por etapa y colas de atención. Todo
calculado con agregados SQL.

---

## Ruta B — Construirlo en vivo (12 minutos)

Esta ruta demuestra que el sistema **funciona**, no que tiene datos.

### 1. Una Mipyme abre un caso — sin cuenta previa

Abra http://localhost:3000/intake en una ventana privada.

Complete el bloque 1 con una empresa **nueva** y el bloque 2 con una necesidad.
Al enviar:

- se crea la empresa, el contacto, el usuario y el caso en **una sola
  transacción**;
- se genera el ID legible (`CAS-0000XX`) y la estructura documental;
- se devuelve una contraseña temporal;
- llega un correo a **Mailpit** (TCOM1).

**Repita el formulario con la misma empresa** escrita distinto —mayúsculas, sin
sufijo societario, con el NIT con puntos—. El segundo caso se vincula a la
empresa existente: no se duplica. Ese es el principio Empresa Única.

### 2. Advisory hace la debida diligencia · `advisory@nodus.local`

Abra el caso nuevo. En **Acciones** verá «Iniciar revisión» disponible y
«Clasificar y habilitar» **bloqueada**, con el motivo que da el backend.

1. Pulse **Iniciar revisión**.
2. Intente **Clasificar** → el diálogo se abre, pero el backend responde 409
   porque no hay clasificación registrada. El motivo se muestra literal.
3. Registre la clasificación (por API o desde Swagger:
   `POST /cases/{id}/classification`) y vuelva: ahora «Clasificar» está
   disponible.
4. Clasifique y publique con una ventana de 7 días.

### 3. El consultor ve la oportunidad · `ana.velez@consultor.nodus.local`

Menú **Oportunidades**. El caso aparece **sólo si** el área, la complejidad y el
tipo de intervención están dentro de su alcance habilitado; y aparece con la
identidad de la empresa reservada y la descripción recortada.

Púlse **Postularme** y complete la plantilla T3C.

> Pruebe a entrar como `maria.restrepo@acerosdelnorte.com` y navegar a
> `/opportunities`: 403. La bolsa no es un marketplace abierto.

### 4. Advisory asigna · `advisory@nodus.local`

En el caso, **Acciones → Asignar consultor responsable**. El diálogo lista las
postulaciones con el perfil del consultor y cinco criterios de evaluación (T3D).
Puntúe, elija y justifique.

Al confirmar: cambia el estado, se crea la asignación, se evalúan todas las
postulaciones, se cierra el reloj de SLA de la etapa anterior, se abre el de la
siguiente y llega el correo TCOM5.

### 5. La propuesta · como el consultor asignado

**Acciones → Abrir expediente de propuesta**. Se crea la versión 1 en borrador.

Rellene el contenido (por Swagger: `PATCH /proposals/versions/{id}`) e intente
**Enviar a QA** con algún bloque vacío: el guard lo rechaza diciendo exactamente
qué falta.

Complete y envíe. La versión queda **congelada**.

### 6. QA · `advisory@nodus.local`, menú **QA de propuestas**

El caso aparece en la bandeja. Registre la revisión metodológica con el checklist
del «Go».

- Si elige **Ajustes solicitados**: se crea la versión n+1 copiando la anterior,
  que se conserva intacta.
- Si elige **Aprobada**: la acción «Aprobar y enviar al cliente» se habilita.

Apruebe y envíe. Observe que el caso pasa por `PROPUESTA ENVIADA` **y** llega a
`EN DECISIÓN DEL CLIENTE`: la transición encadenada queda en el historial con
origen «Sistema».

### 7. El cliente decide · `maria.restrepo@acerosdelnorte.com`

Abra el caso. Tres acciones: aceptar, solicitar ajustes o no continuar.

**Acepte.** El caso pasa a `PROPUESTA ACEPTADA` y encadena a
`PENDIENTE DE CONTRATACIÓN`, instanciando el checklist T7A.

### 8. Contratación · `advisory@nodus.local`

Pestaña **Contratación**: el checklist con su progreso. Intente **Autorizar
ejecución** ahora: bloqueado, con el número de ítems pendientes.

Complete los ítems (los que exigen evidencia no se marcan sin ella), haga que el
consultor cargue el marco operativo T7B, y autorice.

### 9. Ejecución y cierre

Como consultor: cargue al menos un hito o una actividad (sin agenda, la ejecución
no arranca) e inicie. Registre entregables y cargue versiones. Intente el cierre
técnico con algo pendiente: bloqueado, con el detalle.

Complete todo, declare el cierre técnico, y como advisory complete la revisión
final T9C. El cliente registra su aceptación T9F y la encuesta T9G; advisory
evalúa al consultor T9H. Sólo entonces **Cerrar caso** se habilita.

### 10. El resultado

Vuelva a la pestaña **Trazabilidad**: todo el recorrido que acaba de hacer está
ahí, con actor, fecha y delta. En **Mailpit**, los correos que se generaron por
el camino.

---

## Qué mostrar si sólo hay tres minutos

1. `CAS-000001` → pestaña **Trazabilidad**: veinte eventos auditados.
2. `CAS-000004` → panel de **Acciones**: una disponible, otras bloqueadas **con
   el motivo que calcula el backend**.
3. El mismo caso como consultor: versión controlada, sin identidad del cliente.
4. `pnpm test:e2e` → 54 pruebas, incluida la que demuestra que un consultor
   asignado al caso **no puede** clasificarlo y que el estado no cambia.
