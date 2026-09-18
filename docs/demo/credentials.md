# Credenciales y datos de demostración

> Generados por `pnpm db:seed`. El seed es **idempotente**: si ya existen casos,
> no vuelve a crear los datos de demostración. Para regenerar desde cero:
> `pnpm db:reset`.

## Contraseña

Todas las cuentas comparten la misma contraseña, definida en `.env`
(`SEED_DEFAULT_PASSWORD`):

```
Nodus2026*
```

## Cuentas

### Plataforma

| Correo | Nombre | Rol | Alcance |
|---|---|---|---|
| `admin@nodus.local` | Sofía Cárdenas | `SUPER_ADMIN` | Todo, incluido el gobierno de LOV, SLA, roles y plantillas |
| `advisory@nodus.local` | Julián Mesa | `ADVISORY` | Debida diligencia, clasificación, publicación, asignación, QA, veeduría de contratación y cierre |
| `revisor@nodus.local` | Patricia Quintero | `CONSULTOR_REVISOR` | Revisión experta independiente de propuestas |

### Consultores del ecosistema

| Correo | Nombre | Código | Especialidad principal | Complejidad habilitada | Vinculación |
|---|---|---|---|---|---|
| `ana.velez@consultor.nodus.local` | Ana Vélez | `CON-000001` | Operaciones / inventarios | Alto | Independiente |
| `bruno.salcedo@consultor.nodus.local` | Bruno Salcedo | `CON-000002` | Finanzas / flujo de caja | Estratégico | Sponsor (Andina Advisory Group) |
| `claudia.ibanez@consultor.nodus.local` | Claudia Ibáñez | `CON-000003` | Tecnología / ciberseguridad | Alto | Propio de la plataforma |

Los tres están en estado `HABILITADO` con su historial completo de ciclo de vida
(`REGISTRADO → EN_VALIDACION → HABILITADO`) registrado en
`consultant_status_history`.

### Clientes Mipyme

| Correo | Nombre | Empresa | Código |
|---|---|---|---|
| `maria.restrepo@acerosdelnorte.com` | María Restrepo | Aceros del Norte S.A.S. | `EMP-000001` |
| `carlos.duarte@vitalissalud.com` | Carlos Duarte | Vitalis Salud Integral Ltda. | `EMP-000002` |

Cada uno ve **sólo** los casos de su empresa. Ese aislamiento se comprueba en
`test/e2e/authorization.e2e-spec.ts` y en el smoke test.

---

## Casos sembrados

Los ocho casos se generaron **ejecutando las transiciones reales del motor de
workflow** con el usuario correcto en cada paso, no insertando su estado final.
Si una regla de negocio, un guard o un permiso estuvieran mal, el seed fallaría.

| Código | Estado | Empresa | Consultor | Qué demuestra |
|---|---|---|---|---|
| `CAS-000001` | **CERRADO** | Aceros del Norte | Ana Vélez | Ciclo completo: 15 transiciones, dos versiones de entregable, aceptación del cliente y ambas evaluaciones |
| `CAS-000002` | **EN EJECUCIÓN** | Vitalis Salud | Bruno Salcedo | Agenda activa, hitos, incidencia abierta, entregables en desarrollo |
| `CAS-000003` | **EN DECISIÓN DEL CLIENTE** | Aceros del Norte | Claudia Ibáñez | Propuesta enviada esperando decisión: aceptar, ajustar o declinar |
| `CAS-000004` | **EN POSTULACIÓN** | Vitalis Salud | — | Dos postulaciones recibidas, listas para evaluar (T3D) y asignar |
| `CAS-000005` | **PROPUESTA LISTA PARA QA** | Aceros del Norte | Claudia Ibáñez | Bandeja de QA con un peer review ya registrado |
| `CAS-000006` | **EN REVISIÓN** | Vitalis Salud | — | Debida diligencia con solicitud de ampliación al cliente |
| `CAS-000007` | **CREADO** | Aceros del Norte | — | Editable por el cliente sólo en este estado (RF-013) |
| `CAS-000008` | **CERRADO SIN CONTRATACIÓN** | Vitalis Salud | Claudia Ibáñez | Ruta comercial alternativa, con motivo y potencial de reactivación |

### Volumen de datos generado

| Entidad | Cantidad |
|---|---|
| Empresas | 2 |
| Usuarios | 8 |
| Consultores habilitados | 3 |
| Sponsors | 1 |
| Casos | 8, en 8 estados distintos |
| Postulaciones | 12 |
| Versiones de propuesta | 5 |
| Documentos (estructura) | 8 |
| **Registros de auditoría** | **~95** |
| Instancias de SLA | ~60 |
| Notificaciones | ~112 |

---

## Configuración de plataforma sembrada

| Elemento | Cantidad | Nota |
|---|---|---|
| Listas de valores (LOV) | 14 listas, ~100 valores | Ninguna clasificación crítica acepta texto libre |
| Roles | 5 | Con su matriz completa de permisos |
| Permisos | 31 | Derivados de `@nodus/types` |
| Estados del caso | 17 | Con etiqueta, orden, color y terminalidad |
| Plantillas de checklist | 2 | T7A (contratación) y T9C (revisión final) |
| Reglas de SLA | 18 | 15 generales por etapa + 3 específicas por complejidad y urgencia |
| Plantillas de comunicación | 20 | TCOM1–TCOM12 más ocho complementarias |

Las tres reglas de SLA específicas existen para demostrar la **resolución por
especificidad**: a igual etapa, gana la regla con más dimensiones coincidentes.

---

## Dónde ver los efectos

| Qué | Dónde |
|---|---|
| Correos generados por los eventos | http://localhost:8025 (Mailpit) |
| Archivos del repositorio documental | http://localhost:9001 (MinIO) — usuario y contraseña en `.env` |
| API y contratos | http://localhost:4000/api/v1/docs (Swagger) |
| Estado de las dependencias | http://localhost:4000/api/v1/health/ready |

---

## Nota sobre las contraseñas temporales

El onboarding público (`/intake`) crea la cuenta del contacto con una contraseña
temporal aleatoria, que se devuelve **una sola vez** en la respuesta del alta y
viaja en la notificación TCOM1. Nunca se almacena en claro: sólo su hash Argon2id.

Las cuentas de demostración listadas arriba llevan `mustChangePassword = false`
para que la evaluación no exija cambiarla en el primer acceso.
