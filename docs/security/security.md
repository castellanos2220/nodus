# Modelo de seguridad

Principio que gobierna todo lo que sigue: **el frontend no decide permisos**. La
interfaz calcula qué mostrar; el backend decide qué se puede hacer. Si el
frontend se equivoca, el backend responde 403.

---

## 1. Autenticación

### Contraseñas

**Argon2id** con `memoryCost: 19456, timeCost: 2, parallelism: 1` — los
parámetros recomendados por OWASP. Se eligió sobre bcrypt porque resiste mejor el
crackeo con GPU, que es el escenario realista si una base se filtra.

### Protección contra fuerza bruta

Tras **5 intentos fallidos**, la cuenta se bloquea **15 minutos**. Temporal y no
permanente a propósito: un bloqueo indefinido convierte el mecanismo de defensa
en una vía de denegación de servicio contra un usuario legítimo.

### Enumeración de cuentas

Usuario inexistente y contraseña incorrecta devuelven **el mismo mensaje**. Y
cuando el usuario no existe se gasta igualmente el tiempo de un hash, para que la
diferencia de latencia tampoco lo revele.

### Tokens

| Token | Vigencia | Dónde vive |
|---|---|---|
| Access | 15 min | Cookie `httpOnly` (web) / cabecera `Authorization` (API) |
| Refresh | 7 días | Cookie `httpOnly`; en base sólo su **SHA-256** |

**Rotación con detección de reutilización.** Cada refresco revoca el token usado y
emite uno nuevo, enlazándolos (`replacedById`). Si llega un token ya revocado, se
asume robo y **se revoca toda la cadena de sesiones del usuario**.

Sólo se almacena el hash del refresh token: quien lea la tabla no puede suplantar
a nadie.

Los tokens llevan `typ: 'access' | 'refresh'`. Un refresh token no sirve para
autenticar aunque se envíe como Bearer.

### Validación en cada petición

`JwtStrategy` consulta la base en cada petición en lugar de confiar sólo en el
token. Es deliberado: un usuario suspendido, o cuyo rol cambió, debe perder el
acceso **de inmediato**, no cuando expire su access token. El coste es una
consulta por clave primaria con `select` acotado.

### El navegador nunca ve el token

La aplicación web guarda la sesión en una cookie `httpOnly` y todas sus llamadas
pasan por `/api/proxy`, un route handler de Next que adjunta el token del lado del
servidor. No hay token en `localStorage`, ni en memoria del cliente, ni token que
un XSS pueda exfiltrar.

Ese proxy también rota el refresh de forma transparente: si la API responde 401,
refresca una vez, reintenta y persiste los tokens nuevos en la misma respuesta.

---

## 2. Autorización — tres capas

Cada una responde una pregunta distinta, y las tres son necesarias.

### Capa 1 · Permiso de rol — `PermissionsGuard`

«¿Este rol puede hacer esta **clase** de cosa?»

Matriz rol → permiso declarada en `@nodus/types` y persistida en
`roles`/`permissions`/`role_permissions`. El endpoint declara qué exige:

```ts
@RequirePermissions('CASE_CLASSIFY')
```

`GET /roles` expone en paralelo los permisos persistidos y los declarados, de
modo que una divergencia entre código y base sea visible.

### Capa 2 · Acceso al recurso — `CaseAccessGuard`

«¿Puede hacerla sobre **este** caso?»

Tener `CASE_READ` no da derecho a leer el caso de otra empresa.
`CaseAccessService` resuelve tres niveles:

| Nivel | Quién |
|---|---|
| `FULL` | Advisory, admin, consultor asignado, cliente propietario |
| `REDACTED` | Consultor postulante o elegible (bolsa), revisor durante el QA |
| `NONE` | Cualquier otro |

`REDACTED` devuelve el caso con la identidad de la empresa reservada, sin datos
de contacto y con la descripción recortada — exactamente lo que el blueprint
exige para la bolsa interna.

**Un caso sin acceso devuelve 404, no 403.** Confirmar que existe ya sería una
filtración.

### Capa 3 · Rol en la arista — `WorkflowService`

«¿Su rol está autorizado en **esta transición** concreta, y tiene el ámbito que
exige?»

Cada arista declara sus roles y su ámbito (`LEAD_CONSULTANT`, `CLIENT_OWNER`,
`ANY`, `SYSTEM`). Un consultor **asignado al caso** —con acceso `FULL`— recibe
403 al intentar `CLASSIFY`, porque esa arista no admite su rol.

Esa distinción está probada explícitamente en
`test/e2e/authorization.e2e-spec.ts`, junto con la comprobación de que **el
estado del caso no cambia** tras el rechazo.

---

## 3. Validación de entrada

```ts
new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
```

`forbidNonWhitelisted` es la pieza importante: un campo que el DTO no declara es
un **error**, no algo que se ignora en silencio. Cierra la puerta al
mass-assignment — enviar `{ transition: 'START_REVIEW', status: 'CERRADO' }`
devuelve 400, no un cambio de estado inesperado.

**Doble validación, deliberada.** El frontend valida con Zod (`packages/types`) y
el backend con class-validator. No es redundancia accidental: Nest necesita clases
para generar Swagger, y validar dos veces a partir del mismo contrato es más
seguro que confiar en una sola capa. La del backend es la que cuenta.

**Sin texto libre en clasificaciones críticas.** Todo código de clasificación se
verifica contra las listas de valores antes de persistir
(`LookupsService.assertValidCodes`). Enviar `areaCode: "lo que sea"` devuelve 400.

---

## 4. Documentos

- **Lista blanca de tipos MIME**, no lista negra: enumerar lo prohibido siempre
  deja algo fuera.
- **Triple comprobación**: MIME declarado contra la lista, extensión contra el
  MIME, y primeros bytes contra la firma del formato. El `Content-Type` lo elige
  quien sube.
- **Límite de 25 MB** por archivo y de 2 MB para cuerpos JSON.
- **El bucket no es público.** La descarga se hace con URL firmada de 5 minutos,
  emitida sólo tras verificar el acceso al caso.
- **Nada se sobrescribe**: la clave de almacenamiento incluye el número de
  versión.
- `DocumentAccess` permite conceder acceso puntual a un documento por encima del
  RBAC de rol.

---

## 5. Auditoría inmutable

Tres candados independientes (detalle en
[ADR-007](../adr/ADR-007-audit-log.md)):

1. **Transaccional** — se escribe en la misma transacción que el cambio.
2. **De API** — no existe endpoint de escritura, actualización ni borrado.
3. **De base de datos** — triggers `BEFORE UPDATE`/`BEFORE DELETE` que abortan
   con `restrict_violation`.

El tercero es el que importa cuando los otros dos fallan, y hay pruebas de
integración que lo verifican escribiendo con Prisma directamente.

---

## 6. Endurecimiento HTTP

| Medida | Detalle |
|---|---|
| **Helmet** | Cabeceras de seguridad estándar; CSP activa en producción |
| **CORS** | Lista explícita de orígenes desde `CORS_ORIGINS`, con credenciales |
| **Rate limiting** | Una política por tipo de ruta: login 10/5 min por IP y cuenta; públicos 30/min e intake 5/10 min por IP; escrituras 120/min y lecturas 1200/min por usuario; sondas de salud aparte ([ADR-009](../adr/ADR-009-rate-limiting.md)) |
| **Límite de cuerpo** | 2 MB JSON |
| **`trust proxy`** | Sólo saltos de red privada (`TRUST_PROXY`); el proxy de Next reenvía `X-Forwarded-For` para que límite de tasa y auditoría vean la IP real |
| **Cabeceras del frontend** | `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` |
| **Errores normalizados** | Forma estable con código; los errores de Prisma se traducen y nunca se filtran nombres de constraints ni volcados |

---

## 7. Secretos

- Siempre por variables de entorno. `.env` está en `.gitignore`; sólo se versiona
  `.env.example`.
- **En producción, el arranque falla** si `JWT_SECRET` conserva un valor de
  ejemplo (`dev_only`, `change_me`…) o coincide con `JWT_REFRESH_SECRET`. Un
  secreto de ejemplo en producción es un fallo de despliegue, no un aviso.
- `passwordHash` nunca se selecciona fuera de `AuthService`: los `select`
  explícitos de `users` lo omiten, de modo que no puede escaparse por descuido.
- Las contraseñas temporales del intake se devuelven **una sola vez** y sólo se
  almacena su hash.

---

## 8. Interacción controlada

Regla del modelo operativo, con consecuencia técnica: **no hay canal directo
consultor ↔ Mipyme fuera de la plataforma**. Toda solicitud de aclaración,
respuesta o acuerdo pasa por `Communication`, queda asociada al caso y se
registra en la bitácora.

Durante la postulación, el consultor accede a una versión controlada del caso.
La información completa sólo es visible para advisory y para el consultor
formalmente asignado.

---

## 9. Lo que este MVP **no** cubre

Honestidad sobre el alcance:

- **Sin MFA.** El modelo de datos lo admite (campos en `User`), pero no está
  implementado.
- **Sin rotación automática de secretos** ni integración con un gestor
  (Vault, AWS Secrets Manager).
- **Sin antivirus en las cargas.** Se valida tipo, extensión y firma, pero no se
  analiza el contenido. En producción correspondería un análisis asíncrono antes
  de marcar el documento como disponible.
- **Sin cifrado en reposo a nivel de aplicación.** Se delega en el cifrado del
  volumen y del bucket.
- **Sin auditoría de lectura.** Se audita quién **cambia** algo, no quién lo
  consulta. Para un entorno con datos sensibles regulados haría falta añadirlo.
- **Rate limiting en memoria.** Con varias réplicas de la API haría falta
  respaldarlo en Redis para que el límite sea global y no por instancia.
