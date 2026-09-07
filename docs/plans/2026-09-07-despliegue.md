# Despliegue — De local a producción · Plan por etapas

> **Para ejecutores agénticos:** los pasos usan checkbox. Cada etapa lleva su **comprobación**:
> un comando concreto cuya salida decide si se pasa a la siguiente. Una etapa sin su
> comprobación en verde no está hecha, está empezada.

**Goal:** Que la web de James esté en internet y que el clic a WhatsApp llegue a la base de
datos. Nada más cuenta como «desplegado».

**Architecture:** Cuatro piezas y tres proveedores. `apps/api` (NestJS) en **Railway**, porque es
la única que necesita un proceso vivo —el debounce de 60 s del `DeployService` no existe en
serverless—. `apps/web` (Astro estático) en **Cloudflare Pages**. `apps/admin` (Next 16) en
**Vercel**. Base de datos en **Neon** y medios en **Cloudflare R2**.

**Spec:** `CLAUDE.md` (manda) · `railway.md` · `apps/api/Dockerfile` · `.github/workflows/ci.yml`

---

## 1. Qué decide el orden

No es preferencia. Cada pieza no arranca sin la anterior:

**R2 antes que la API.** `apps/api/src/config/env.schema.ts` declara `S3_ENDPOINT`, `S3_BUCKET`,
`S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` y `CDN_BASE_URL` **sin `.default()`**. Zod valida al
arrancar: sin esas cinco, el contenedor no levanta. No es que funcione a medias — no funciona.

**La base antes que la API**, por lo mismo con `DATABASE_URL` y `DIRECT_URL`.

**La API antes que la landing.** El build de Astro consulta la API pública en tiempo de
construcción y **aborta ante cualquier respuesta no-2xx**. Un deploy fallido es mejor que uno
vacío, así que sin API no hay landing.

**El admin antes que el CORS de R2.** La política CORS del bucket necesita el origen exacto de
Vercel, y ese no existe hasta desplegarlo.

**El dominio al final.** Es lo único que se puede hacer con todo lo demás ya vivo: hasta
entonces `r2.dev` y las URLs que reparten los proveedores sirven perfectamente, porque el único
que las usa es James.

---

## 2. Decisiones abiertas

| Decisión | Estado |
|---|---|
| Base de datos: Neon vs Railway Postgres | **Resuelta: Neon.** Gratis, es lo que CLAUDE.md ya fijaba, y el reparto `-pooler`/directo y el mapeo `P1001 → 503` estaban escritos para ella |
| Dominio | **Abierta.** Javier lo compra cuando quiera. No bloquea nada hasta la etapa 5 |
| Vitest 4 → 5 | **Aplazada a propósito.** Es el runner de las tres apps; se mira al cerrar la fase con `pnpm outdated`, no el día del despliegue |

---

## 3. Las etapas

### Etapa 0 — Cimientos ✅ HECHA (7-sep-2026)

**Quién:** 🔧 Javier

- [x] Bucket R2 `jamesfilm`, ENAM, acceso público deshabilitado
- [x] Public Development URL activada (`pub-14ba0e11….r2.dev`)
- [x] Token de cuenta `jamesfilm-api`: **Object Read & Write**, limitado a `jamesfilm`, TTL Forever
- [x] Proyecto Neon `james-film`, **PostgreSQL 17**, AWS **us-east-1**, Neon Auth apagado
- [x] Las 7 migraciones aplicadas y el seed corrido
- [x] Repositorio **privado** en GitHub y CI en verde por primera vez

**Cómo se comprobó** — no se dio por bueno ninguno sin medirlo:

```
R2:     ✔ PUT firmado · ✔ GET público HTTP 200 · ✔ DELETE deja de servirse (404)
Neon:   ✔ las dos URLs conectan · pg 17.11 · 17 tablas · solo esquema `public`
Seed:   ✔ 4 categorías · 3 paquetes (18 bullets) · 4 diferenciadores · 2 redes
        ✔ LA CONTRASEÑA DEL ARCHIVO ABRE LA SESIÓN (verificada contra el hash argon2id)
        ✔ cero clics inventados
```

**Lo que salió por el camino y conviene no olvidar:**

- `S3_FORCE_PATH_STYLE` se queda en **`true`**. R2 acepta los dos estilos, y dejarlo igual que
  MinIO significa que producción usa la misma forma de URL que prueban los tests.
- `sslmode=require` está **deprecado en la práctica**: en `pg` v9 pasará a significar «cifra pero
  no verifiques el certificado», y el cambio llegaría con un bump de dependencia rutinario, sin
  error y sin aviso. Las dos URLs usan **`verify-full`**, que hoy es idéntico y sobrevive.
- `channel_binding=require` **no hacía nada**: `pg-connection-string` no parsea ese parámetro.
  Quitado, porque una configuración que promete algo que no ocurre es peor que no tenerla.
- El CI necesitó nueve arreglos, todos diferencias entre el portátil y una máquina limpia. Uno
  destapó **un fallo de producto**: el atajo «Nueva galería» del panel, del ⌘K y de
  Disponibilidad nunca abrió el formulario, porque `nuqs` solo acepta la cadena `"true"` y los
  enlaces mandaban `"1"`. El test que lo cubría solo comprobaba la URL.

---

### Etapa 1 — La API en Railway

**Quién:** 🔧 Javier

- [ ] Proyecto en Railway conectado a `rodrigobraunrumpler-svg/james-film`, con acceso de GitHub
      **limitado a ese repositorio**
- [ ] **Un solo servicio: `api`.** `web` y `admin` no van aquí
- [ ] *Root directory* en la **raíz del repo**, no en `apps/api`
- [ ] Región **US East (Virginia)**, la misma que Neon
- [ ] **«Wait for CI» activado**
- [ ] Las nueve variables de la tabla del §4, **sin comillas**

**Cómo se comprueba:**

```bash
curl -s https://<tu-servicio>.up.railway.app/health | jq
# {"estado":"ok","arquitectura":"x64","plataforma":"linux","node":"24.20.0"}

curl -s -o /dev/null -w '%{http_code}\n' https://<tu-servicio>.up.railway.app/docs/admin
# 404  ← si devuelve 200, NODE_ENV no es 'production'
```

El primero prueba que el contenedor vive **y habla con Neon**: `/health` hace un `SELECT 1` y
devuelve 503 si la base no contesta. El segundo prueba que Swagger de admin no está publicado.

**Qué se rompe si se salta:**

- Sin *root directory* en la raíz, el build falla: el `Dockerfile` copia `pnpm-lock.yaml` y
  `pnpm-workspace.yaml` de la raíz para instalar el workspace.
- Sin «Wait for CI», un push con los tests en rojo se despliega igual.
- Sin `NODE_ENV=production`, `/docs/admin` queda navegable para quien acierte la ruta.
- Con la región equivocada, cada consulta cruza el continente dos veces. Railway **no tiene
  región en Sudamérica**: son California, Virginia, Ámsterdam y Singapur.

---

### Etapa 2 — El admin en Vercel

**Quién:** 🔧 Javier

- [ ] Proyecto en Vercel con *root directory* `apps/admin`
- [ ] `API_URL` = la URL de Railway de la etapa 1
- [ ] `NEXT_PUBLIC_WEB_URL` = la de la landing (provisional hasta la etapa 4)

**Cómo se comprueba:** entrar con las credenciales del seed y que cargue la lista de galerías.
Si el login pasa pero la lista da error, es `API_URL`.

**Qué se rompe si se salta:** James no puede subir nada, y la landing se queda sin contenido que
enseñar.

---

### Etapa 3 — CORS del bucket R2

**Quién:** 🔧 Javier · **necesita el origen de la etapa 2**

- [ ] En R2 → `jamesfilm` → **CORS Policy**: permitir `PUT` desde el origen de Vercel

**Cómo se comprueba:** subir un reel desde el admin desplegado. Tiene que llegar a `READY`.

**Qué se rompe si se salta:** **quitar el CORS de la API no quita el de R2.** El `PUT` firmado
sale del navegador de James directo al bucket, así que R2 tiene que conocer el dominio del admin
aunque la API ya no lo necesite. Sin esto, subir falla con un error de CORS que no menciona R2 en
ninguna parte.

---

### Etapa 4 — La landing en Cloudflare Pages

**Quién:** 🔧 Javier

- [ ] Proyecto de Pages con *root directory* `apps/web`, build `pnpm build`, salida `dist`
- [ ] `PUBLIC_API_URL` = la URL de Railway
- [ ] `CDN_BASE_URL` = el `pub-….r2.dev` (o el dominio `media.` si ya existe)
- [ ] **Volver a la etapa 1 y corregir `WEB_ORIGIN`** con el origen real de la landing

**Cómo se comprueba:**

```bash
# El clic a WhatsApp llega de verdad. Se pulsa el botón en la web y:
curl -s https://<api>/admin/dashboard -H "Authorization: Bearer <token>" | jq '.data.clicks'
```

**Qué se rompe si se salta el último punto:** ⚠️ **Esto es lo que más caro sale de todo el
plan.** `WEB_ORIGIN` tiene por defecto `http://localhost:4321` y es la lista blanca del CORS que
permite a la landing registrar el clic. Mal puesta, **el clic no se registra y en silencio**: el
panel dirá «0 clics» y parecerá que la web no funciona, cuando lo que no funciona es la medición.
Y el clic a WhatsApp es la única métrica del negocio.

El `guardiaDeHosts()` de `astro.config.mjs` aborta el build en Pages si detecta un `http://` o un
host fuera de la CSP, así que ese error concreto sí se caza solo.

---

### Etapa 5 — Dominio

**Quién:** 🔧 Javier · **👤 James decide el nombre**

- [ ] Dominio comprado y sus nameservers en Cloudflare
- [ ] Landing en el apex, admin en un subdominio, **`media.` conectado al bucket R2**
- [ ] `CDN_BASE_URL` pasa de `pub-….r2.dev` a `https://media.<dominio>`
- [ ] Repasar `WEB_ORIGIN` y la CSP de `apps/web/public/_headers`

**Cómo se comprueba:** una imagen de la web servida desde `media.` con HTTP 200.

**Qué se rompe si se salta:** nada urgente. `r2.dev` está **limitado por tasa y no es para
producción** según Cloudflare, pero mientras el único tráfico sea James subiendo, aguanta. Lo que
sí importa: en la base se guardan **claves, nunca URLs** (`storageKey`), así que cambiar de
dominio no rompe ni un solo medio ya subido.

---

### Etapa 6 — Antes de que haya datos reales

**Quién:** 🔧 Javier, salvo lo marcado

- [ ] Cron de `pg_dump` a R2 **y restaurado una vez** a una branch de Neon
- [ ] Páginas legales: privacidad, términos, consentimiento de imagen
- [ ] 👤 **James:** Google Business Profile
- [ ] 👤 **James:** logo y firma en SVG, y la versión de iOS de su iPhone

**Qué se rompe si se salta:** un backup no probado no es un backup, y las «6 hours» de retención
del plan gratis de Neon **no son un backup**: son una ventana de restauración a un punto en el
tiempo. Y lo legal es lo único de esta lista que puede traerle a James un problema de verdad —
hay menores en los XV años.

---

## 4. Variables de entorno

### Railway (`apps/api`) — las nueve

| Variable | De dónde sale | Ojo |
|---|---|---|
| `DATABASE_URL` | Neon, **con** `-pooler` | runtime |
| `DIRECT_URL` | Neon, **sin** `-pooler` | migraciones; el pooler no soporta sus sentencias |
| `JWT_SECRET` | `.env.production` | |
| `S3_ENDPOINT` | Cloudflare | **sin** `/jamesfilm` al final: el bucket es otra variable |
| `S3_BUCKET` | `jamesfilm` | |
| `S3_ACCESS_KEY_ID` | token de R2 | |
| `S3_SECRET_ACCESS_KEY` | token de R2 | se enseña **una sola vez** |
| `CDN_BASE_URL` | `pub-….r2.dev` | **sin barra final** |
| `NODE_ENV` | `production` | su default es `development`, y es lo que oculta `/docs/admin` |

**Las comillas se quitan al pegar.** En `.env.production` están como `S3_ENDPOINT="https://…"`
porque dotenv las interpreta; Railway y GitHub guardan la cadena **tal cual**, y `z.url()`
rechazaría unas comillas literales.

### Las que NO se ponen

`PORT` (lo inyecta Railway) · `S3_REGION` y `S3_FORCE_PATH_STYLE` (sus defaults son los correctos
para R2, verificados) · `RATE_LIMIT_ENABLED` y `STORAGE_QUOTA_GB` (defaults ya de producción) ·
`SEED_ADMIN_*` y `SEED_DEMO_CLICKS` (el seed ya corrió) · `API_URL` y `NEXT_PUBLIC_WEB_URL` (son
del admin).

### Las dos que están mal por defecto

| Variable | Default | Por qué importa |
|---|---|---|
| **`WEB_ORIGIN`** | `http://localhost:4321` | sin el origen real, **el clic a WhatsApp no se registra y en silencio** |
| **`SEED_DEMO_CLICKS`** | — | si alguien la pone en `true` en producción, fabrica telemetría y deja la única métrica sin valor |

### GitHub Actions

| Secreto | Para qué |
|---|---|
| `DIRECT_URL` | el job `migraciones` aplica el esquema antes de que Railway despliegue el código nuevo |

---

## 5. Orden de publicación

```
R2 ─► Neon ─► API (Railway) ─► admin (Vercel) ─► CORS de R2 ─► landing (Pages) ─► dominio
```

Y dentro de cada push a `main`, el orden lo garantiza el CI:

```
tests ─► migraciones ─► (verde) ─► Railway construye y despliega
```

Eso es lo que hace el job `migraciones` con «Wait for CI»: el esquema se aplica **siempre** antes
que el código que lo necesita. Sin ese orden el fallo es silencioso — el contenedor arranca, el
healthcheck (`SELECT 1`) pasa, Railway da el deploy por bueno, y la API revienta en la primera
consulta que toque la columna que falta.

---

## 6. Fuera de alcance

- **Worker de ffmpeg, Redis, colas.** Tres servicios: API, base y bucket. Lo demás está anotado
  en §22 del documento del proyecto y no se construye.
- **Multi-región, réplicas, autoescalado.** `numReplicas: 1`. La carga es un usuario y unos
  builds a la semana.
- **Construir la imagen en GitHub Actions y empujarla a un registro.** El `Dockerfile` fija la
  base por digest multi-arch y el lockfile está commiteado: Railway reconstruyendo el mismo
  commit produce el mismo artefacto. Un registro sería credenciales y minutos a cambio de nada.
- **Caché de `.next` en CI.** El build compila en 6,5 s; la caché ahorraría segundos a cambio de
  configuración que mantener.
