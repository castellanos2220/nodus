# ADR-005 — Abstracción de almacenamiento documental

- **Estado**: aceptada
- **Fecha**: 2026-09-17
- **Decide**: cómo se guardan y se sirven los documentos

## Contexto

El brief lo exige (§32): *«La aplicación NO debe acoplarse directamente a S3»*, y
fija tres reglas duras: no sobrescribir archivos históricos, versionar toda carga
y usar URLs firmadas.

Los documentos fuente mencionan AWS S3, Cloudflare R2 y Supabase Storage como
opciones de producción; el entorno local usa MinIO.

## Decisión

Una clase abstracta `StorageService` con cinco operaciones (`put`, `get`,
`getSignedUrl`, `exists`, `delete`, `healthCheck`). Los módulos de negocio
dependen de ella; el adaptador concreto se decide en `StorageModule`:

```ts
@Module({ providers: [{ provide: StorageService, useClass: S3StorageService }] })
```

La clave de almacenamiento la construye una función pura, `buildStorageKey()`:

```
companies/{companyId}/cases/{caseId}/{stage}/{documentId}/v{n}/{filename}
```

## Justificación

**Un solo adaptador cubre local y producción porque MinIO habla S3.** No hacen
falta dos implementaciones: cambia `S3_ENDPOINT` y el mismo código sirve para
MinIO, AWS S3 o Cloudflare R2. La abstracción no está para tener muchos
adaptadores, sino para que ningún módulo importe el SDK de AWS.

**La versión forma parte de la clave.** Ésta es la decisión que hace imposible
sobrescribir un histórico: aunque la capa de aplicación se equivocara, el `PUT`
iría a una clave distinta. La regla no depende de que nadie se equivoque.

**La estructura de la clave reproduce el repositorio documental del blueprint.**
Empresa → Caso → Etapa → Versión. Al mirar el bucket se ve la organización
documental exigida, no una lista de UUID.

**Nada se sirve directamente.** El bucket no es público; la descarga se hace con
URL firmada de cinco minutos, emitida sólo tras comprobar el acceso al caso. Una
URL filtrada caduca sola.

**La subida se compensa si falla.** La fila `DocumentVersion` se crea en una
transacción y después se suben los bytes. Si el `PUT` falla, se elimina la fila
—con SQL explícito, porque el trigger de inmutabilidad bloquea el `DELETE`
normal—. Ese rodeo es deliberado: hace que el único borrado posible sea éste,
explícito y auditado.

**Validación de contenido, no sólo de cabecera.** Se comprueba el MIME contra una
lista blanca, la extensión contra el MIME y los primeros bytes contra la firma
del formato. El `Content-Type` lo elige quien sube: no es una fuente de verdad.

## Consecuencias

**A favor**

- Cambiar de proveedor es cambiar variables de entorno.
- Añadir un adaptador (sistema de archivos, Azure Blob) es una clase y una línea
  en el módulo; ningún módulo de negocio se entera.
- El historial documental es íntegro por construcción.

**En contra**

- La abstracción expone el mínimo común denominador: no hay multipart upload ni
  lifecycle policies. Para archivos de oficina —que es lo que el producto
  maneja— sobra.
- Los archivos se leen en memoria para calcular el checksum y validar la firma.
  Con el límite de 25 MB es asumible; para archivos grandes habría que pasar a
  streaming y subida directa con URL firmada.
