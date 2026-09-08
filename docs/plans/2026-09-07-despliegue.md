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

**El dominio antes que la LANDING, y después de todo lo demás** (corregido el 7-sep-2026; este
plan decía «el dominio al final» y para la landing es falso). Para la API y el admin sí da igual:
`r2.dev` y las URLs de los proveedores sirven perfectamente mientras el único que las usa es
James. Pero **la landing no se puede construir sin el dominio**, y aborta a propósito:

- El CSP de `apps/web/public/_headers` lleva `https://media.jamesfilm.pe` en `img-src` y
  `media-src`, y `https://api.jamesfilm.pe` en `connect-src`, **escritos a mano** — un fichero
  `_headers` es estático y Pages no interpola variables.
- `guardiaDeHosts()` en `astro.config.mjs` **lanza** cuando `CF_PAGES` está definido y
  `PUBLIC_API_URL` o `CDN_BASE_URL` no empiezan por un host del CSP. Con
  `api-production-….up.railway.app` y `pub-….r2.dev` no casa ninguna: el build falla siempre.
- Y `PUBLIC_SITE_URL` cae por defecto a `https://jamesfilm.pe`, que es el `site` de Astro: sin
  dominio, cada página se declara canónica de una dirección que no existe y el sitemap entero
  apunta ahí.

O sea que el guardia hace justo lo que promete. La alternativa —meter los hosts provisionales en
el CSP— funciona, pero deja dos entradas que hay que acordarse de quitar. Se decidió comprar el
dominio antes.

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

### Etapa 1 — La API en Railway ✅ HECHA (7-sep-2026)

**Quién:** 🔧 Javier · `https://api-production-a7757.up.railway.app`

**Cómo se comprobó:**

```
/health       200 · {"estado":"ok","arquitectura":"x64","plataforma":"linux","node":"24.20.0"}
/docs/admin   404  ← NODE_ENV=production, el Swagger de admin no está publicado
/docs/public  200  ← el contrato que consume Astro
/galleries    200 · /categories 200
POST /auth/login con un email inexistente → 401 INVALID_CREDENTIALS
```

Ese último no es de adorno: para devolver 401 el login ejecuta una verificación argon2 contra el
hash señuelo, así que prueba que **`@node-rs/argon2` cargó su binario nativo en producción** — el
fallo que si no aparece en el primer login de James y no antes. Y `/health` hace `SELECT 1`, o sea
que confirma Neon de paso.

- [ ] Secreto **`DIRECT_URL` en GitHub** → *Settings* → *Secrets and variables* → *Actions*.
      **Va PRIMERO**, antes del push: sin él el job `migraciones` falla a propósito, CI queda en
      rojo y «Wait for CI» deja el deploy en `WAITING` sin que nada mencione a GitHub
- [ ] Proyecto en Railway conectado a `rodrigobraunrumpler-svg/james-film`, con acceso de GitHub
      **limitado a ese repositorio**
- [ ] **Un solo servicio: `api`.** `web` y `admin` no van aquí
- [ ] *Root directory* **sin poner** (= la raíz del repo), nunca `apps/api`
- [ ] Región **US East (Virginia)**, la misma que Neon
- [ ] **«Wait for CI» activado** y los permisos de GitHub aceptados — sin ellos el toggle está
      encendido y no hace nada
- [ ] **Serverless apagado**
- [ ] *Custom Build Command*, *Custom Start Command* y *Watch Paths* **vacíos** — ver abajo
- [ ] Las diez variables de la tabla del §4
- [ ] *Networking* → **Generate Domain**

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

- Sin *root directory* en la raíz, Railway no encuentra `railway.json` —que es quien declara
  `builder: DOCKERFILE` y `dockerfilePath: apps/api/Dockerfile`— y cae a Railpack. Se pierden de
  golpe el healthcheck, `numReplicas: 1` y `drainingSeconds`. Y de paso el contexto de build queda
  mal: el `Dockerfile` copia `pnpm-lock.yaml` y `pnpm-workspace.yaml` de la raíz.
- Sin «Wait for CI», un push con los tests en rojo se despliega igual.
- **Con un *Custom Start Command*, el contenedor no arranca.** Pisa el `CMD ["node", "dist/main.js"]`
  del Dockerfile —«the start command overrides the image's ENTRYPOINT in exec form»— y la etapa
  `runtime` no lleva pnpm ni corepack ni CLI: `pnpm --filter api start` muere con `pnpm: not found`
  en bucle hasta agotar los reintentos. Y aunque estuviera, node dejaría de ser PID 1, así que el
  `SIGTERM` de cada redeploy no llegaría a `enableShutdownHooks()` y Neon acumularía conexiones.
- **Con *Watch Paths* en `/apps/api/**`, un cambio en `packages/contracts` no despliega.** Ahí
  viven los DTOs que la API `implements`: CI pasa, Railway no construye, y la API sirve el
  contrato viejo. Sin un solo error en ninguna parte.
- Con la región equivocada, cada consulta cruza el continente dos veces. Railway **no tiene
  región en Sudamérica**: son California, Virginia, Ámsterdam y Singapur.

**Lo que salió por el camino (7-sep-2026):**

- **El builder de Railway rechaza `--mount=type=cache`** salvo que el `id` lleve su prefijo
  literal `s/<service-id>-<target>`, y **no admite variables**, así que el `${TARGETARCH}` del
  `Dockerfile` lo invalidaba. El build moría en 5 s con `dockerfile invalid … is missing the
  cacheKey prefix`, sin ejecutar una sola instrucción. Se quitaron los dos mounts en vez de
  hardcodear el id del servicio: la caché de CAPAS ya cubre el caso común. Y deja algo a la
  vista — **el CI no construye la imagen en ninguna parte**, que es cómo un `Dockerfile` inválido
  llegó a Railway con los 101 tests en verde.
- Al crear el servicio, el dashboard trae *Custom Build Command*, *Custom Start Command* y
  *Watch Paths* ya rellenos. `railway.json` **no declara los dos primeros** —el `startCommand` se
  quitó a propósito, ver `railway.md`— y config-as-code solo pisa los campos que declara, así que
  ahí mandaba el dashboard.

---

### Etapa 2 — El admin en Vercel ✅ HECHA (7-sep-2026)

**Quién:** 🔧 Javier · `https://james-film-admin.vercel.app`

- [x] Proyecto en Vercel con *root directory* `apps/admin`, preset Next.js y los tres comandos
      (*Build*, *Output*, *Install*) **en su default**
- [x] `API_URL` = la URL de Railway de la etapa 1. **Es la ÚNICA variable que hace falta**
- [x] Marcar la variable como *Sensitive* **no**: es una URL pública y querrás releerla

**Las que NO se ponen, y por qué** — comprobado contra el código, no supuesto:

- `API_TIMEOUT_MS` (15000), `NEXT_PUBLIC_API_BASE` (`/api`) y `NEXT_PUBLIC_API_TIMEOUT_MS` (15000)
  tienen ese mismo default en `lib/api/config.ts` y `lib/api/server/config.ts`.
- **`NODE_ENV` no se toca.** La gestiona Vercel, y de ella depende el flag `secure` de la cookie
  de sesión (`lib/api/server/session.ts`). Ponerla a mano rompe el login.
- `NEXT_PUBLIC_WEB_URL` se deja para la **etapa 4**: su fallback ya es `http://localhost:4321`,
  el mismo valor que tiene en `.env.production`, así que ponerla ahora no cambia nada.

⚠️ **`NEXT_PUBLIC_` se inlinea en el bundle EN TIEMPO DE BUILD.** En la etapa 4 no basta con
guardar `NEXT_PUBLIC_WEB_URL` en Vercel: hay que **redesplegar**, o el admin seguirá enlazando a
`localhost:4321` en los enlaces a la web y en las previas de SEO.

**Ojo con `.env.production`:** su `API_URL` vale `http://localhost:3000`. Ese fichero tiene los
valores reales para la API pero los de desarrollo para el admin — se escribe a mano.

**Cómo se comprueba:** entrar con las credenciales del seed y que cargue la lista de galerías.
Si el login pasa pero la lista da error, es `API_URL`. Si falla el login mismo, es la cookie.

**Qué se rompe si se salta:** James no puede subir nada, y la landing se queda sin contenido que
enseñar. Y sin `API_URL` **no compila**: `next build` revienta al recolectar `/api/[...ruta]`,
porque el módulo de la pasarela valida su entorno al cargarse.

**El origen de Vercel NO va en `WEB_ORIGIN` de la API.** El admin habla con la API desde el
servidor, por su pasarela, nunca desde el navegador — que es lo que deja a la API sin superficie
de CSRF. `WEB_ORIGIN` es solo para la landing. Donde sí hace falta este origen es en el CORS de
R2, etapa 3.

---

### Etapa 3 — CORS del bucket R2 ✅ HECHA (7-sep-2026)

**Quién:** 🔧 Javier · **necesita el origen de la etapa 2**

- [x] En R2 → `jamesfilm` → **CORS Policy**:

```json
[
  {
    "AllowedOrigins": ["https://james-film-admin.vercel.app"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3600
  }
]
```

**Por qué esa y no otra**, verificado en el código y no supuesto: `xhr.open('PUT', …)` en
`lib/media/cola/subir.ts` es la **única** petición del navegador contra R2, y por ahí pasan las
tres rutas — el reel, su póster y las imágenes sueltas del admin (portadas, avatares, logo). Manda
`Content-Type` y no lee ninguna cabecera de la respuesta, así que no hace falta `ExposeHeaders`.
El `HEAD` que verifica el `ContentLength` en el `confirm` lo hace la API desde el servidor.
`MaxAgeSeconds` evita un preflight por archivo: con 32 reels serían 32.

**No se añade `localhost`:** en local las subidas van a MinIO, no a R2. Y tampoco comodines para
las *preview* de Vercel — tienen URL aleatoria, y una subida desde una preview debe fallar.

**Cómo se comprueba:** subir un reel desde el admin desplegado. Tiene que llegar a `READY`.

**Qué se rompe si se salta:** **quitar el CORS de la API no quita el de R2.** El `PUT` firmado
sale del navegador de James directo al bucket, así que R2 tiene que conocer el dominio del admin
aunque la API ya no lo necesite. Sin esto, subir falla con un error de CORS que no menciona R2 en
ninguna parte.

---

### Etapa 4 — La landing en Cloudflare Pages

> ⚠️ **DEPENDE DEL DOMINIO.** `guardiaDeHosts()` aborta el build en Pages si `PUBLIC_API_URL` o
> `CDN_BASE_URL` no están en el CSP de `public/_headers`. Hay dos caminos y **se tomó el segundo**
> (7-sep-2026): hacer la etapa 5 primero, o **añadir los hosts provisionales al CSP** para vivir
> en `*.pages.dev` mientras tanto. El bloque marcado `PROVISIONAL · BORRAR EN LA ETAPA 5` en
> `public/_headers` es eso, y lleva además un `X-Robots-Tag: noindex` para que Google no indexe la
> versión de pruebas y luego compita con el dominio real. El porqué de la dependencia, en el §1.

**Ajustes del proyecto de Pages** — el build image **v3 trae Node 22.16.0 y pnpm 10.11.1**, y este
repo exige `node >=24.15 <25` y `pnpm >=11` con **`engineStrict: true`**, o sea que el install
**falla**, no avisa. Y `.nvmrc` está en la raíz, no en `apps/web`. Se declara y se acabó:

| Ajuste | Valor | Por qué |
|---|---|---|
| *Root directory* | **la raíz del repo** | ahí están el lockfile, `pnpm-workspace.yaml` y `.nvmrc`, y es lo que hace resolver `packages/contracts` |
| *Build command* | `pnpm --filter web build` | |
| *Output directory* | `apps/web/dist` | relativo a la raíz |
| `NODE_VERSION` | `24.20.0` | igual que `.nvmrc` |
| `PNPM_VERSION` | `11.24.0` | igual que `packageManager`; v3 **no** lo detecta del lockfile |

**El nombre del proyecto decide la URL**, y tiene que cuadrar con `PUBLIC_SITE_URL`: llamarlo
`james-film` da `https://james-film.pages.dev`. Es el `site` de Astro, o sea las canónicas y el
sitemap.

**Quién:** 🔧 Javier

- [ ] Proyecto de Pages con *root directory* `apps/web`, build `pnpm build`, salida `dist`
- [ ] `PUBLIC_API_URL` = la URL de Railway
- [ ] `CDN_BASE_URL` = **`https://media.jamesfilm.pe`**. El `pub-….r2.dev` NO vale aquí: el CSP
      no lo declara y el guardia aborta el build
- [ ] `PUBLIC_SITE_URL` = `https://jamesfilm.pe` — su default ya es ése, así que solo hace falta
      si el dominio acaba siendo otro
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

### Etapa 5 — Dominio · **se hace ANTES de la 4**

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

### Etapa 7 — Migrar a Infrastructure as Code · **antes del 1-dic-2026**

**Quién:** 🔧 Javier · **no bloquea nada hasta esa fecha**

`railway.json` está **deprecado**, y lo dice la propia pantalla de ajustes del servicio:

> Config as Code is deprecated. Prefer Infrastructure as Code. Existing config files keep working
> until **2026-12-01**. Starting 2026-08-28, services that have never used Config as Code cannot
> opt in.

- [ ] `railway config init` y `railway config pull` — importa el proyecto ya en verde, no lo
      escribas a mano
- [ ] Que `.railway/railway.ts` reproduzca las ocho claves de `railway.json`, más
      `sleepApplication: false`
- [ ] `railway config plan` y comparar contra los ajustes vivos **antes** de `apply`
- [ ] Borrar `railway.json` y reescribir `railway.md` contra el fichero nuevo
- [ ] Las diez variables y el dominio pasan al fichero: dejan de vivir solo en el dashboard

**Cómo se comprueba:** `railway config plan` sin diferencias contra lo desplegado, y un deploy
después que siga pasando las dos comprobaciones de la etapa 1 — `/health` en 200 y `/docs/admin`
en 404.

**Qué se rompe si se salta:** el 1-dic-2026 el fichero deja de aplicarse **y no lo dice nadie**.
El builder cae a Railpack, que no sabe que el Dockerfile vive en `apps/api/`, y —peor— se pierde
`healthcheckPath`. Ese es el ajuste que hace que un deploy con una variable mal escrita se quede
detenido con la versión anterior en pie en vez de tumbar la API: sin él Railway promociona en
cuanto el puerto acepta conexiones. Y `numReplicas: 1` deja de estar sujeto, que es lo que protege
al debounce de 60 s del `DeployService` y al throttler en memoria.

**Por qué merece la pena aunque no caducara:** IaC es de PROYECTO, no de servicio, así que cubre
lo que Config-as-Code no podía — variables de entorno, dominios, servicios, volúmenes. Es lo que
convierte «pegar diez variables a mano en el dashboard» en una línea del repo. Solo la variante
TypeScript (`.railway/railway.ts`) está GA; Python y Go van en beta y quedan fuera por la regla de
nada experimental.

**Mientras tanto**, una línea que hoy falta en `railway.json` y cierra un agujero:
`"sleepApplication": false` dentro de `deploy`. Es el toggle Serverless — hoy apagado en la UI y
sin nada en el repo que lo sujete. Encenderlo escala a cero y rompe en silencio el debounce del
`DeployService`, que es literalmente el motivo por el que se descartó Vercel.

---

## 4. Variables de entorno

### Railway (`apps/api`) — las diez

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
| `NODE_ENV` | `production` | redundante con la imagen; se pone igual, ver abajo |
| `PRESIGN_TTL_SECONDS` | `3600` | el default del esquema es `900` |

**`PRESIGN_TTL_SECONDS` era la décima y se descubrió tarde**, con la API ya online. Vale `3600` en
los tres ficheros del proyecto (`.env`, `.env.example`, `.env.production`) y el esquema cae a `900`
si no está, así que la diferencia no se ve por ningún lado: la API arranca igual. Es cuánto vive
una URL de subida firmada, y con 15 minutos un aftermovie de 115 MB por el 4G de Ayacucho se queda
sin URL a media subida — peor con el presign en lote, donde el último reel se firma en el segundo
cero y empieza a subir mucho después. R2 contesta 403 sin mencionar la caducidad y el medio queda
`FAILED`. **Regla:** una variable va a Railway si su valor **difiere del default del esquema**;
que esté escrita en `.env.production` no significa nada.

**`NODE_ENV` es el caso contrario, y este plan lo contaba al revés.** La imagen ya lo trae
(`ENV NODE_ENV=production` en la etapa `runtime` del `Dockerfile`), así que NO ponerla deja
`/docs/admin` correctamente oculto. El riesgo va en la otra dirección: una variable de Railway
pisa el `ENV` de la imagen, o sea que **ponerla mal es lo único que puede publicar el Swagger de
admin**.

**No hay comillas que quitar** — esto también estaba mal. `.env.production` no entrecomilla ni una
línea, verificado. El `sed` que este plan sugería no hace falta.

### Las que NO se ponen

**Porque su valor es idéntico al default del esquema** —comprobado una a una, no supuesto—:
`JWT_ACCESS_TTL_SECONDS` (900) · `REFRESH_TTL_DAYS` (30) · `REFRESH_GRACE_SECONDS` (30) ·
`MAX_VIDEO_MB` (200) · `MAX_IMAGE_MB` (15) · `S3_REGION` (`auto`) · `S3_FORCE_PATH_STYLE` (`true`).
Están en `.env.production` porque ahí se escribe el entorno completo; ponerlas en Railway no
cambia ni un byte.

**Porque no tocan:** `PORT` (lo inyecta Railway) · `RATE_LIMIT_ENABLED` y `STORAGE_QUOTA_GB` (ni
siquiera están en `.env.production`; sus defaults ya son de producción) · `SEED_ADMIN_*` y
`SEED_DEMO_CLICKS` (el seed ya corrió) · `API_URL` y `NEXT_PUBLIC_WEB_URL` (son del admin en
Vercel) · `TOKEN_VALUE` (el token de R2 en crudo; la API usa el par de claves).

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
R2 ─► Neon ─► API (Railway) ─► admin (Vercel) ─► CORS de R2 ─► dominio ─► landing (Pages)
        ✅            ✅                 ✅               ✅

Las cuatro primeras cerradas el 7-sep-2026. **Dominio y landing van en ese orden**, no al revés:
ver el §1. Y ojo con el primer paso — **Cloudflare Registrar no vende ccTLDs**, así que
`jamesfilm.pe` se compra en un registrador de `.pe` y a Cloudflare solo se le traen los
nameservers, que es gratis y es lo único que hace falta.
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
