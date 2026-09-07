# syntax=docker/dockerfile:1.19
# ============================================================================
#  James Film · API (NestJS 12 + Prisma 7) — imagen de produccion para Railway
#
#  Contexto de build: la RAIZ del monorepo.
#      docker buildx build -f apps/api/Dockerfile -t james-film-api .
#
#  Orden de capas por frecuencia de cambio:
#      imagen base (nunca) < lockfile (semanal) < schema.prisma (mensual)
#      < src (cada commit)
#  Lo que cambia mas a menudo va lo mas abajo posible.
# ============================================================================

# El digest es el del INDICE multi-arquitectura, no el del manifiesto de amd64.
# Con el del manifiesto, un build arm64 se traeria binarios x86 sin avisar.
# Se actualiza a mano: `docker buildx imagetools inspect node:24.20.0-bookworm-slim`.
ARG NODE_IMAGE=node:24.20.0-bookworm-slim@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e
ARG PNPM_VERSION=11.24.0

# ---------------------------------------------------------------------------
# 1. base — solo la cadena de herramientas. No cambia nunca, asi que es la capa
#    que TODAS las demas comparten y la unica que se baja de la red.
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS base
ARG PNPM_VERSION
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    npm_config_update_notifier=false
# corepack fija la version EXACTA de pnpm. `packageManager` en package.json dice
# lo mismo, pero corepack lo resolveria bajando de la red en el primer `pnpm`.
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /repo

# ---------------------------------------------------------------------------
# 2. deps — instala con el arbol COMPLETO (dev incluido) a partir de los
#    manifiestos y nada mas. Solo se reejecuta si cambia el lockfile o un
#    package.json: tocar src/ no la invalida.
#
#    El `prepare` de la raiz hace `git config core.hooksPath`, que fuera de un
#    repo git aborta el install. Se neutraliza con --ignore-scripts y se corre
#    a mano lo unico que hacia falta (`prisma generate`, en la etapa 3).
#
#    SIN `--mount=type=cache` para el store de pnpm, y no es un olvido: el
#    builder de Railway exige que el id lleve su prefijo LITERAL
#    (`id=s/<service-id>-/pnpm/store`) y no admite variables, asi que
#    `${TARGETARCH}` lo invalida y el build muere en 5 s sin ejecutar una sola
#    instruccion. Hardcodear el id del servicio ataria el repo a un proyecto de
#    Railway concreto. Y la cache de CAPAS ya cubre el caso comun -- este RUN
#    solo se reejecuta si cambia el lockfile --, o sea que lo unico que se
#    pierde es no reusar el store en esa reinstalacion, semanal como mucho.
# ---------------------------------------------------------------------------
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/contracts/package.json packages/contracts/
RUN pnpm install --frozen-lockfile --ignore-scripts --filter api...

# ---------------------------------------------------------------------------
# 3. build — genera el cliente de Prisma y compila. `nest build` es solo tsc:
#    el script `build` NO llama a prisma generate, asi que sin esta linea el
#    build limpio falla en el primer import de ../generated/prisma/client.js.
#
#    El schema va en su propio COPY, ANTES del codigo: cambiar un modelo
#    reejecuta generate + tsc; cambiar un controller reejecuta solo tsc.
# ---------------------------------------------------------------------------
FROM deps AS build
# tsconfig.json va ANTES de `prisma generate`, y no es cosmetico: el generador
# `prisma-client` LEE el tsconfig para decidir con que extension escribe sus
# imports. Sin el emite `./internal/class.ts` dentro del .js compilado y el
# contenedor muere al arrancar con ERR_MODULE_NOT_FOUND. Verificado: reordenar
# estos dos COPY cambia el codigo generado.
COPY apps/api/tsconfig.json apps/api/tsconfig.build.json apps/api/nest-cli.json apps/api/
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma7.config.ts apps/api/
RUN cd apps/api && pnpm exec prisma generate

COPY packages/contracts/src packages/contracts/src
COPY apps/api/src apps/api/src
RUN cd apps/api && pnpm exec nest build

# ---------------------------------------------------------------------------
# 4. prod-deps — arbol de PRODUCCION, en paralelo a la etapa 3 (no dependen
#    entre si, BuildKit las corre a la vez).
#
#    `pnpm deploy --prod` deja 449 MB: `@prisma/client` declara `prisma` y
#    `typescript` como peers OPCIONALES, y como `apps/api` los tiene en
#    devDependencies el lockfile los mete en la clave de resolucion, asi que
#    --prod se trae el CLI entero (Studio, pglite, effect, react...). Medido:
#    mover el CLI a la raiz NO lo arregla, pnpm lo encuentra igual.
#    `podar-prod.mjs` corta esos dos enlaces y borra lo que deja de ser
#    alcanzable: 449 MB -> 186 MB. La etapa 5 comprueba que no rompio nada.
# ---------------------------------------------------------------------------
FROM base AS prod-deps
# Sin cache mount, por lo mismo que la etapa 2.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/contracts/package.json packages/contracts/
RUN pnpm --filter api deploy --prod --legacy --ignore-scripts /prod
COPY docker/podar-prod.mjs /tmp/podar-prod.mjs
RUN node /tmp/podar-prod.mjs /prod && rm /tmp/podar-prod.mjs

# ---------------------------------------------------------------------------
# 4b. migrate — objetivo APARTE, no se publica. Lleva el CLI de Prisma, el
#     schema y las migraciones, y nada mas. Existe para que aplicar una
#     migracion sea el MISMO artefacto reproducible que el build, en vez de un
#     `prisma migrate deploy` desde el portatil de quien despliegue:
#
#       docker build --target migrate -f apps/api/Dockerfile -t jf-migrate .
#       docker run --rm -e DIRECT_URL="$DIRECT_URL" jf-migrate
#
#     Las migraciones NO corren al arrancar el contenedor de la API. Con dos
#     replicas arrancarian dos a la vez, y una que falle deja el servicio en
#     bucle de reinicio: el fallo de la migracion se leeria como "la API esta
#     caida" en vez de "esta migracion no aplica".
# ---------------------------------------------------------------------------
FROM deps AS migrate
COPY apps/api/prisma7.config.ts apps/api/
COPY apps/api/prisma apps/api/prisma
WORKDIR /repo/apps/api
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

# ---------------------------------------------------------------------------
# 5. runtime — lo unico que se publica. Sin pnpm, sin corepack, sin CLI.
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    TZ=UTC \
    NODE_OPTIONS=--enable-source-maps
WORKDIR /app

COPY --from=prod-deps --chown=node:node /prod/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /prod/package.json ./package.json
COPY --from=build     --chown=node:node /repo/apps/api/dist ./dist

# Prueba de humo. Convierte en fallo de BUILD los dos fallos que si no se ven
# hasta produccion:
#   1) argon2 compilado para otra arquitectura -> "Failed to load native binding"
#      en el PRIMER login, no al arrancar.
#   2) la poda de la etapa 4 se llevo algo por delante -> ERR_MODULE_NOT_FOUND.
# Las variables son de mentira y no se guardan en ninguna capa: importar
# app.module.js ejecuta `ConfigModule.forRoot`, que VALIDA el entorno al
# importar. No se conecta a nada: Prisma abre la conexion en onModuleInit.
RUN DATABASE_URL=postgresql://u:p@127.0.0.1:5432/x \
    DIRECT_URL=postgresql://u:p@127.0.0.1:5432/x \
    JWT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
    S3_ENDPOINT=http://127.0.0.1:9000 S3_BUCKET=x \
    S3_ACCESS_KEY_ID=x S3_SECRET_ACCESS_KEY=x \
    CDN_BASE_URL=http://127.0.0.1:9000/x \
    node --input-type=module -e "\
      const { hash } = await import('@node-rs/argon2'); \
      if (!(await hash('probe')).startsWith('\$argon2id')) throw new Error('argon2 no es argon2id'); \
      await import('/app/dist/app.module.js'); \
      console.log('smoke ok · ' + process.arch + '/' + process.platform); \
    "

USER node
EXPOSE 3000
# Forma exec: node es PID 1 y recibe el SIGTERM de Railway directamente.
# `enableShutdownHooks()` lo captura y cierra Prisma; con forma shell, sh seria
# PID 1, se tragaria la senal y cada redeploy dejaria conexiones colgando.
CMD ["node", "dist/main.js"]
