# ADR-003 — Docker Compose para el entorno de desarrollo y evaluación

- **Estado**: aceptada
- **Fecha**: 2026-09-17
- **Decide**: cómo se levanta el entorno completo

## Contexto

El brief es explícito sobre el propósito (§5): *«El objetivo de Docker no es
"acelerar mágicamente" el backend»*, sino reproducibilidad y que el evaluador no
tenga que instalar PostgreSQL, Redis, MinIO ni un servidor SMTP a mano.

## Decisión

Un `docker-compose.yml` en la raíz con: `postgres`, `redis`, `minio`
(+ `minio-init`), `mailpit`, `migrate`, `api`, `worker` y `web`.

Dos modos de uso, ambos soportados:

```bash
# Modo completo: todo en contenedores
docker compose up -d

# Modo híbrido: infraestructura en Docker, aplicación en el host
docker compose up -d postgres redis minio mailpit
pnpm dev
```

## Justificación

**Docker resuelve un problema de instalación, no de rendimiento.** Se dice aquí
explícitamente porque la confusión es común: los contenedores no hacen el backend
más rápido. Lo que hacen es que `pg_trgm`, el bucket de MinIO y el servidor SMTP
existan y estén configurados sin que nadie lea un manual.

**Las dependencias se declaran con `condition: service_healthy`.** La API no
arranca hasta que PostgreSQL acepta conexiones, Redis responde `PING` y MinIO
está listo. Sin eso, el primer arranque falla de forma intermitente y parece un
error del producto.

**`minio-init` es un contenedor de un solo uso.** Crea el bucket y termina.
Delegarlo al arranque de la API mezclaría aprovisionamiento de infraestructura
con lógica de aplicación.

**`migrate` también es de un solo uso, y por una razón que se descubrió
probando.** La primera versión ejecutaba `prisma migrate deploy` en el `command`
de la API. Con `restart: unless-stopped`, cada reinicio del contenedor lanzaba
otro proceso de migración, y dos compitiendo por el advisory lock de PostgreSQL
hacían que ambos fallaran por timeout (`P1002`). Con un servicio propio y
`condition: service_completed_successfully`, las migraciones corren exactamente
una vez y la API sólo arranca cuando han terminado bien.

**El worker comparte imagen con la API y cambia el entrypoint.** Es la
consecuencia práctica de que compartan código: una imagen, dos procesos.

**Las extensiones de PostgreSQL se instalan por dos vías.** El script de
`docker-entrypoint-initdb.d` las crea en la base principal, y la migración 002 las
declara con `CREATE EXTENSION IF NOT EXISTS`. Lo segundo hace que las migraciones
sean autosuficientes en cualquier PostgreSQL —incluido uno gestionado, o la
*shadow database* que Prisma crea para validar—, donde el script de init no corre.

**El modo híbrido existe porque es como se desarrolla de verdad.** Recompilar una
imagen para probar un cambio de una línea es fricción innecesaria; el hot reload
del host es más rápido. El modo completo está para la evaluación.

## Consecuencias

**A favor**

- `docker compose up -d` deja el entorno completo funcionando, con bucket creado
  y extensiones instaladas.
- El mismo `docker-compose.yml` sirve para desarrollar y para evaluar.
- Los datos persisten en volúmenes nombrados; `docker compose down -v` reinicia
  de cero de forma limpia.

**En contra**

- La primera ejecución descarga imágenes (unos minutos según la red).
- En Windows y macOS, los volúmenes montados para hot reload son más lentos que
  el sistema de archivos nativo. Por eso existe el modo híbrido.

## Nota sobre las imágenes de MinIO

Las imágenes `minio/minio` y `minio/mc` de Docker Hub dejaron de ser accesibles
de forma anónima. El compose apunta a `quay.io/minio/minio` y `quay.io/minio/mc`,
que son los registros oficiales vigentes del proyecto.
