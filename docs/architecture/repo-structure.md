# Estructura del repositorio y desviaciones justificadas

## Estructura adoptada

```
NODUS-Ingenieria-SAS/
├── apps/
│   ├── api/                     # NestJS — backend modular monolith
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed/
│   │   ├── src/
│   │   │   ├── core/            # transversal: prisma, auth, rbac, events,
│   │   │   │                    # audit, storage, queue, cache, logger, config
│   │   │   ├── modules/         # 25 módulos de negocio
│   │   │   ├── worker.ts        # entrypoint del worker BullMQ
│   │   │   └── main.ts          # entrypoint HTTP
│   │   └── test/                # unit + integration + e2e
│   └── web/                     # Next.js 15
│       └── src/{app,components,features,lib,hooks}
├── packages/
│   ├── types/                   # contratos compartidos: enums, esquemas Zod, tipos de API
│   └── config/                  # presets eslint + tsconfig compartidos
├── infra/
│   ├── docker/                  # Dockerfiles y config de servicios
│   └── scripts/                 # bootstrap, wait-for, smoke test
├── docs/
├── docker-compose.yml
├── .env.example
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

## Desviaciones respecto de la estructura propuesta en el brief §7

### 1. `prisma/` vive en `apps/api/prisma/`, no en la raíz

**Razón.** El esquema, el cliente generado, las migraciones y el seed son artefactos del runtime de la
API, no del monorepo. Ponerlos en la raíz obliga a:

- pasar `--schema ../../prisma/schema.prisma` en **cada** invocación de Prisma CLI;
- configurar `generator client { output = ... }` apuntando fuera del paquete que lo consume, lo que
  rompe la resolución de `@prisma/client` en pnpm (que usa enlaces simbólicos estrictos);
- copiar un directorio ajeno al contexto de build en el `Dockerfile` de la API, ampliando el contexto
  de build a todo el monorepo.

Con el esquema dentro de `apps/api`, `pnpm --filter @nodus/api prisma migrate deploy` funciona sin
banderas y la imagen de la API se construye con su propio contexto.

**Qué se conserva del requisito.** Los comandos que pide el brief §43 funcionan **desde la raíz** tal
cual, porque `package.json` de la raíz los reexporta:

```bash
pnpm prisma:migrate   # → pnpm --filter @nodus/api exec prisma migrate deploy
pnpm db:seed          # → pnpm --filter @nodus/api exec tsx prisma/seed/index.ts
```

### 2. No existe `packages/ui`

**Razón.** shadcn/ui no es una librería que se instale: es un generador que **copia** componentes al
proyecto para que se editen. Extraerlos a un paquete separado exige un paso de build (tsup/tsc),
rompe el Fast Refresh de Next.js en desarrollo y obliga a duplicar la configuración de Tailwind y el
sistema de tokens. El coste es real y el beneficio sería cero: hay **una sola** aplicación frontend.

Los componentes viven en `apps/web/src/components/ui/`. Si mañana apareciera una segunda app
(portal público, app móvil web), extraerlos es un `git mv` más un `package.json`: la frontera está
respetada porque ningún componente de `ui/` importa nada de `features/`.

**Sí existe `packages/types`**, que es donde el compartir sí aporta: enums del dominio, códigos de
transición, esquemas Zod y tipos de respuesta de la API son consumidos por backend y frontend, y
tenerlos en un solo sitio evita que se desincronicen.

### 3. `infra/docker/` contiene los Dockerfiles; `docker-compose.yml` queda en la raíz

El brief pide `docker-compose.yml` en la raíz (se cumple) y un directorio `infra/docker`. Los
Dockerfiles viven allí y el compose los referencia con `dockerfile: infra/docker/api.Dockerfile`,
manteniendo el contexto de build en la raíz para poder copiar `packages/`.

### 4. `docs/` sigue exactamente la estructura pedida

`architecture/`, `domain/`, `workflow/`, `database/`, `api/`, `adr/`, `security/`, `demo/`.
