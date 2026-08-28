# James Film — contexto del proyecto

Portafolio web + panel de administración para James, **creador de contenido audiovisual**
(no fotógrafo). Su producto son Reels/TikToks verticales 9:16 y aftermovies cortos, vendidos
en paquetes por cantidad de reels, duración y velocidad de entrega. Ayacucho, Perú.
**El objetivo de negocio es una sola cosa: clics a WhatsApp.**

## Fuente de verdad

- **`james-film-proyecto.md`** (2854 líneas) = el *porqué* de cada decisión. Se cita como `§N`.
  Es documento histórico: **no se edita**.
- **Este archivo** = el *qué se hace*. Donde los dos discrepan, **manda este archivo**.
- **`preview.webp`** = el flyer original. Confirma los datos de §14 (paquetes, precios, bullets,
  diferenciadores, redes, `aboutText` con su resaltado). Es la referencia visual de la marca.

---

## 1. Reglas que no se rompen

**Media**
- Entrega: **1080×1920, H.264 High, CRF 20, AAC 192k, MP4 `+faststart`**. Nunca HEVC ni 4K. §4
- El máster nunca se sirve ni se sube. El disco de James es el archivo maestro, R2 es la vitrina. §4
- Validación en el navegador antes de firmar: formato reproducible, lado largo ≤2160px,
  bitrate ≤15 Mbps, faststart presente. **Los mensajes de error dicen qué hacer**, no "formato inválido". §4
- **Nunca subir archivos a través de la API.** Presigned PUT directo a R2. §4
- Fotos: solo se tocan si son HEIC o si el lado largo supera 2560px → **JPEG q95**. Nunca WebP/AVIF
  (Cloudflare re-comprime al servir; comprimir dos veces degrada). §4
- **Tres anchos de imagen en todo el sitio: 400, 800, 1600.** §4 §17
- Nombres de archivo UUID, nunca el del usuario. `storageKey` en la base, **nunca la URL**. §17
- Solo `MediaUrlInterceptor` conoce `CDN_BASE_URL`. §5

**Diseño**
- Paleta cerrada: `void #0A0908` · `surface #141210` · `elevated #1E1B18` · `line #2E2A26` ·
  `ash #9C958C` · `bone #F2EFE9` · `brass-200 #E5D3AC` · `brass-400 #C9A96A` · `brass-600 #9A7F47` ·
  `whatsapp #25D366`. Cyan y magenta del flyer **no se usan**. §6
- **Regla del acento único**: Básico neutro → Pro latón → Premium hueso. §6
- Bricolage Grotesque **solo 400 y 800** (no tiene cursiva) + Inter 400/500. Titulares con `clamp()`. §6
- La firma "James" es SVG, no fuente. §6
- Sin librería de componentes. Son ~8 componentes. §6

**Rendimiento**
- LCP <2.5s · **INP <200ms con animaciones activas** · CLS <0.1. Medido en CrUX. §20
- Animaciones **solo `transform` y `opacity`**. Nunca `top`/`left`/`width`/`height`. §6 §17
- Todo dentro de `gsap.matchMedia("(prefers-reduced-motion: no-preference)")`. §6
- GSAP/Lenis con `client:visible`, nunca `client:load`. **Lenis solo ≥1024px.** §6
- `aspect-ratio` reservado en toda imagen y video. §17
- **Sin autoplay en la grilla.** Solo el hero autoplayea (loop 6s, ~1.5MB, silenciado). §4

**Responsive — no negociable, landing y admin**
- 320px sin scroll horizontal · 768px vertical · zoom 200% · móvil horizontal. §7
- `minmax(0, 1fr)` en toda grilla, `100dvw`/`100dvh`, `overflow-wrap: anywhere` en datos de usuario. §7
- Admin: tablas → tarjetas bajo `md`, sidebar → drawer bajo `lg`, targets táctiles ≥44×44px. §7

**Negocio**
- CTA principal WhatsApp. **No hay formulario de contacto.** El clic a WhatsApp *es* el lead. §1 §9
- Número en formato internacional sin `+`: `51994724944`. Sin prefijo el botón no funciona. §8
- Un solo paquete `isHighlighted`, **forzado en la API** (radio buttons en el admin, no checkbox). §8
- Grid de paquetes `repeat(auto-fit, minmax(240px, 1fr))`, nunca `grid-cols-3`. §8
- No se publica un testimonio con `hasConsent = false`. Ley 29733. §11 §19

**Arquitectura**
- Nada fuera de `apps/api` importa `@prisma/client`. **Forzado por ESLint**, no por buena voluntad. §3
- DTOs escritos a mano en `packages/contracts`, nunca reexportados de Prisma. §3
- Dos controllers por módulo: público read-only sin auth / admin con guard. §5
- `UpdateDto` siempre `PartialType(CreateDto)`. §5 §17
- `packages/contracts` es **solo tipos, cero runtime**. En cuanto exporte un valor, las tres apps
  necesitan transpilarlo y aparece config de bundler donde no debería haberla.

**Versiones (actualizadas a 2026 — sobrescriben §3)**
- Node **`>=24 <25`** (Active LTS hasta oct-2026), pnpm **10**, `engine-strict=true`.
- **Sin `node-linker=hoisted`.** Ese flag desactiva el `node_modules` estricto, que es la única
  razón por la que §3 eligió pnpm. Prisma 6 funciona con el linker por defecto.
- **`pnpm.onlyBuiltDependencies: ["prisma", "@prisma/client"]`** en el `package.json` raíz.
  pnpm 10 bloquea los scripts de instalación por defecto; sin esa lista el cliente de Prisma
  no se genera y el error no menciona pnpm.
- PostgreSQL **17** en Docker, en el puerto **5433** (evita el choque con un Postgres local).
- Puertos de desarrollo: API 3000 · admin 3001 · web 4321.
- **`catalog:` de pnpm** en `pnpm-workspace.yaml` para lo que comparten los cuatro paquetes
  (`typescript`, `@types/node`). Se declaran como `"catalog:"`, nunca con número: subir de
  versión es una línea, no cuatro archivos.
- **`"strict": true` en los cuatro `tsconfig.json`.** El scaffold de NestJS no lo trae completo,
  y sería el único sitio del monorepo sin cobertura de tipos — justo donde vive la lógica.
- **Dependabot semanal**, minor y patch agrupados en un PR. Es la automatización de la regla
  de no-deprecación; el CI es lo que la hace segura.

**Estabilidad — nada deprecado, nada experimental**
- **Ninguna API deprecada.** Si TypeScript, el linter o el runtime avisan de una deprecación,
  se arregla; **nunca se silencia** con un `eslint-disable` ni con `@ts-ignore`.
  Forzado por **`@typescript-eslint/no-deprecated: 'error'`** en las tres apps, no por memoria.
- **Nada en `preview`, `experimental` o `canary`** en código que llega a producción. Si una
  feature solo existe tras un flag experimental, no se usa: se resuelve de otra forma.
- **Antes de añadir una dependencia**: release en los últimos 12 meses y sin aviso de
  deprecación en su README o su registro. Si no cumple, no entra — se escribe a mano o se
  busca otra. (Es la misma razón por la que §7 descarta `react-beautiful-dnd`.)
- **La API de una librería se verifica contra su documentación actual**, nunca de memoria:
  usa la herramienta `context7` antes de escribir la primera línea que la use. El conocimiento
  entrenado va por detrás de las releases y eso es exactamente cómo entra código deprecado.
- Solo versiones **LTS / estables** de Node, pnpm y PostgreSQL. Nada de `current` ni `rc`.
- Rangos `^` en `package.json` y **`pnpm-lock.yaml` commiteado**. Los builds se reproducen.
- **Al cerrar cada fase**: `pnpm outdated` y `pnpm audit`. Lo que esté deprecado o con
  vulnerabilidad se resuelve ahí, no se acumula para "más adelante".

**Seguridad**
- Contraseñas con **argon2id** vía `@node-rs/argon2` (m=19456, t=2, p=1 — OWASP). Binarios
  precompilados, sin node-gyp. El hasher vive en `apps/api/src/common/hash.ts` y lo comparten
  el seed y el login.
- **`Session.tokenHash` y `prevHash` usan SHA-256, nunca argon2.** Argon2 lleva sal: dos hashes
  del mismo token difieren y `WHERE tokenHash = ?` no encontraría la fila. Argon2 para lo que se
  *verifica*, SHA-256 para lo que se *busca*.

---

## 2. Decisiones que sobrescriben el documento

El `.md` se contradice en estos puntos. Resueltos así:

| Tema | Decisión | Contra |
|---|---|---|
| Peso de referencia | Reel **35 MB** · aftermovie **115 MB** · foto **1 MB**. Evento curado ≈230 MB → 44 eventos en 10 GB | §2 usa 25 MB/720p, §4 dice 90 MB, §10 dice 150 MB y 40 MB |
| HEIC / fotos | **JPEG q95**, y no se re-encodea lo que ya está bien | El código de §10 usa WebP 0.85; §21 cierra "HEIC → WebP" |
| Original de fotos | **No se guarda.** Solo el 2560px. Igual que los videos | §4 dice "guarda el original completo en `masters/`" |
| Autoplay | Solo el hero | §1 pide autoplay en viewport |
| Categorías en el admin | **Pantalla propia.** Diferenciadores y redes van en Configuración | §9 dice las dos cosas |
| Tabs de Configuración | Identidad · Contacto y redes · **Diferenciadores** · Hero · SEO | §9 omite Diferenciadores |
| Pantallas del admin | **Ocho** (incluye Dashboard) | §9 y §21 dicen "siete" |
| Exposición de la API | **Es accesible desde internet** (build de Astro + `/track/whatsapp`). Por eso hay throttler global y los controllers públicos filtran siempre | §4 dice "la API no queda expuesta al público" |
| Por qué no Vercel | Porque el **debounce de 60s del `DeployService` necesita un proceso vivo**. En serverless cada invocación es un proceso nuevo y el debounce no existe | §2 lo funda en BullMQ/ffmpeg, ambos fuera del v1 |
| Quién dispara el deploy | **NestJS** | El diagrama de §4 lo dibuja en el admin |
| `accentColor` | Se guarda y se edita, **la web no lo consume en v1** | §8 lo describe como funcional |
| Categorías del v1 | **Bodas · XV Años · Cumpleaños · Eventos** (4) | §1 lista "XV Años" y "Quinceañeras" por separado |
| Región | **`us-east-1` (Virginia)** para Neon y para el host de la API, la misma para ambos | §4 deja "Virginia o São Paulo" |
| Prefijos en R2 | `videos/` `photos/` `posters/` `screenshots/` `og/` `backups/`. Sin año en la ruta | §13 mezcla `media/2026/`, `fotos/`, `masters/` |
| Idempotency-Key | **No existe tabla.** `confirm` es idempotente por `WHERE status = PENDING`; el presign por `clientUploadId` | §17 lo declara convención global |
| Descartar avisos del dashboard | `localStorage` del admin, sin tabla | §9 no define persistencia |
| Repository pattern | **No se usa.** Servicios → `PrismaService` directo | §5 y §21 lo definen en detalle |
| Adaptadores de storage | **Uno solo**, S3-compatible con endpoint por env | §5 define `r2.adapter` + `s3.adapter` |
| Multipart >50MB | **No entra en la fase 3.** Se decide tras probar un aftermovie real en el iPhone de James por 4G | §10 lo da por hecho |
| Node y pnpm | **Node 24 LTS · pnpm 10.** Node 22 está en mantenimiento desde oct-2025 | §3 pinea Node 22 y pnpm 9.15.0 |
| `node-linker=hoisted` | **No se usa** (ver arriba) | §3 lo declara obligatorio |
| Hash de contraseñas | **argon2id**, no bcrypt | El doc no lo especifica |
| Config de Tailwind | **Tailwind 4**: los tokens de §6 van en `@theme` dentro del CSS, no en `tailwind.config.ts` | §6 muestra sintaxis de Tailwind 3 |
| Env del monorepo | **Un solo `.env` en la raíz.** El CLI de Prisma no lo encuentra solo: sus scripts van envueltos en `dotenv -e ../../.env --` | El doc no lo trata |

---

## 3. Deltas al schema de §13

Resultado: **14 modelos + 1 pivote · 8 enums**.

```prisma
// NUEVO — rotación de refresh con detección de reuso (§16 lo exige, §13 no lo modela)
model Session {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String    @unique          // SHA-256 del refresh vigente (no bcrypt: alta entropía)
  prevHash  String?   @unique          // SHA-256 del anterior → detecta reuso
  expiresAt DateTime
  revokedAt DateTime?
  userAgent String?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  @@index([userId])
}

// NUEVO — barra de publicación y aviso de deploy fallido (§9)
// Tabla aparte: en SiteSettings el deploy se mordería la cola.
enum DeployStatus { IDLE QUEUED BUILDING SUCCESS FAILED }

model DeployState {
  id             String       @id @default("singleton")
  pendingChanges Int          @default(0)   // "3 cambios sin publicar"
  status         DeployStatus @default(IDLE)
  deploymentId   String?                    // id que devuelve el deploy hook
  triggeredAt    DateTime?
  finishedAt     DateTime?
  error          String?
  updatedAt      DateTime     @updatedAt
}

model Gallery {
  deletedAt   DateTime?          // + soft delete
  eventDate   DateTime? @db.Date // era DateTime → desfase de día en UTC-5
  @@index([deletedAt])
}

model Media {
  deletedAt      DateTime?       // + soft delete
  error          String?         // + qué falló, sin esto el aviso del dashboard es inútil
  attempts       Int    @default(0)
  clientUploadId String?         // + idempotencia del presign sin tabla de claves
  // - blurhash: nadie la llena, el poster WebP ya cumple
  // - externalUrl, platform: sin uso, y un CTA a TikTok compite con WhatsApp
  @@unique([galleryId, clientUploadId])
  @@index([deletedAt])
}

model Package {
  priceAmount Int?  // en céntimos: S/300 → 30000. Decimal no serializa limpio a JSON ni a JSON-LD
}

model Testimonial {
  eventDate DateTime? @db.Date
  @@index([galleryId, isActive, order])   // §11 dice que es la relación que más rinde; no tenía índice
}
```

**Reglas que dependen de esto**

- **Borrar = `deletedAt`, nunca `DELETE`.** `Media.galleryId` tiene `onDelete: Cascade`, así que
  Postgres borra las filas sin que la app las vea y **los objetos de R2 quedan huérfanos para siempre**.
  Un único cron diario limpia R2: `Media` con `deletedAt` >30 días **y** `PENDING` huérfanos >24h.
- Todo repositorio y controller público filtra `deletedAt: null`.

---

## 4. Stack y dónde vive cada cosa

| Pieza | Tecnología | Dónde | Root |
|---|---|---|---|
| Landing | Astro + Tailwind, **estática** | Cloudflare Pages | `apps/web` |
| Admin | Next.js (PWA) | Vercel Hobby | `apps/admin` |
| API | NestJS + Prisma | Contenedor en `us-east-1` | `apps/api` |
| Base de datos | PostgreSQL | Neon, `us-east-1`, con `directUrl` para migraciones | — |
| Media | Cloudflare R2, dominio propio (no `r2.dev`) | — | — |
| Tipos compartidos | — | — | `packages/contracts` |

Monorepo pnpm workspaces. **Sin Nx ni Turborepo.** Deploy independiente por app con
ignored build steps configurados. §3

**Sin worker, sin Redis, sin cola.** Tres servicios: API, base de datos y bucket. §4
El worker de ffmpeg está documentado en §22 y **no se construye**.

**Flujo de publicación**: mutación en admin → `TriggerDeployInterceptor` → `pendingChanges++` →
`DeployService.schedule()` con debounce 60s → deploy hook → rebuild de Astro (~1 min).
El estado del build se consulta **bajo demanda** contra la API de Cloudflare cuando el admin
abre el dashboard. Sin cron, sin webhook entrante.

**Flujo de subida**: navegador valida → extrae poster en canvas (`muted` + `playsInline`,
seek *después* de `loadedmetadata`) → presign en lote → PUT directo a R2 vía **XHR**
(concurrencia 3, backoff 1/2/4s) → PUT del poster → `confirm` → **HEAD a R2 para verificar
que `ContentLength` coincide** → `READY`. Si no coincide: `FAILED` + `error`.

---

## 5. Convenciones de código

- Servicios usan `PrismaService` directamente. Transacciones con `prisma.$transaction(async tx => …)`.
- **Sí se abstraen los comportamientos repetidos**, no las entidades:
  `ReorderService` (8 modelos con `order`), `ExclusiveFlagService` (con `scope`, para
  `Media.isFeatured` único por galería), `SlugService`. §5
- `@AdminController('path')` = decorador compuesto con guards, interceptors y Swagger. §5
- `ValidationPipe` con `whitelist: true` + `forbidNonWhitelisted: true`. **Sin `enableImplicitConversion`**
  (`"false"` → `true`). `whitelist` es seguridad, no limpieza. §5
- Los DTOs de NestJS hacen `implements` de las interfaces de `packages/contracts`.
  **Si divergen, no compila.** Swagger se genera, no se mantiene.
- Env validada con Zod al arrancar. Si falta una variable, la app no levanta. §5
- `PrismaExceptionFilter`: P2002→409, P2025→404, P2003→400. §5
- **Los controllers públicos filtran siempre** `isPublished: true`, `isActive: true`,
  `deletedAt: null`, y solo devuelven `Media` con `status: READY`. Nunca aceptan un parámetro
  que lo desactive. Con test.
- **El slug se genera al crear y NO se regenera al renombrar.** James comparte links por WhatsApp
  veinte veces al día; regenerarlo los rompe todos en silencio. Editable a mano, con aviso.
- **El build de Astro aborta con error ante cualquier respuesta no-2xx.** Un deploy fallido es
  mejor que uno vacío.
- Íconos (`Package.icon`, `Differentiator.icon`, `SocialLink.icon`): **lista cerrada de ~15 nombres
  lucide** en `copy.ts` con `<select>` en el admin. `astro-icon` no hace tree-shaking de nombres
  dinámicos, y un typo deja un hueco en la web. Fallback `?? 'link'`.
- Seed **idempotente**: `upsert` por slug. Se ejecuta en local, en cada branch de CI y en producción.
- `Media.durationSec` es `Int`: `Math.round(video.duration)` en el cliente. `Media.orientation`
  se deriva de `width`/`height` en el `confirm`, no lo elige nadie a mano.
- `SiteSettings.aboutText` es Markdown y **solo usa negrita** (el resaltado dorado del flyer).
  Se renderiza en Astro **en build time**; no llega markdown sin procesar al navegador.
- Textos de sección no editables → `apps/web/src/content/copy.ts`. §8

---

## 6. Orden de construcción

**Principio: lo más incierto primero.** No empieces por la landing. §18

Plan detallado de la fase 1: [`docs/plans/2026-08-28-fase-1-base.md`](docs/plans/2026-08-28-fase-1-base.md)

| # | Fase | Duración |
|---|---|---|
| 1 | Base: monorepo, ESLint, Prettier, schema, migración, seed | ~1 día |
| 2 | API mínima: auth con refresh en cookie, galerías, media con presign | ~3 días |
| 3 | **Editor de galería** — 60% del esfuerzo y todo el riesgo técnico | ~1 semana |
| 3.5 | **Probar en el iPhone real de James con un aftermovie real por 4G.** Solo entonces se decide si hace falta multipart | — |
| 4 | Resto del admin: categorías, paquetes, testimonios, configuración | ~3 días |
| 5 | Landing. **Animaciones al final, midiendo INP en cada paso** | ~1 semana |
| 6 | Cierre: dashboard, observabilidad, SEO, E2E, checklist | ~3 días |

**CI desde la fase 1** (GitHub Actions): `lint` + `typecheck` + **drift de schema** + tests de
integración contra un Postgres 17 de servicio, con las mismas credenciales que el Docker local.
Sin CI, la regla de ESLint que protege la frontera es tan opcional como la frase que sustituye.

El **drift** (`prisma migrate diff --exit-code`) falla si alguien edita `schema.prisma` sin
generar la migración. Sin esa comprobación, la divergencia se descubre en el deploy.

**Medición de INP (fase 5)**: landing sin animaciones → línea base → +GSAP/ScrollTrigger → medir →
+Lenis solo escritorio → medir. Si pasa de 200ms, quitar en orden inverso. §6

**Testing** (§15, prioridad en este orden): `SlugService` · `ExclusiveFlagService` ·
`ReorderService` · auth · flujo de subida · `PrismaExceptionFilter`.
Unit para lógica pura. **Integración contra branches efímeras de Neon** (una por corrida de CI).
Playwright solo para login, subir un reel y publicar. Cobertura alta en servicios, baja en controllers.
CI en <5 min: lint + typecheck + unit por PR; integración solo en `main`.

---

## 7. Pendientes abiertos

**Decide Javier, no bloquean**
- Host de la API: Render free (duerme a los 15 min → **pierde clics a WhatsApp** y puede tumbar
  el build de Astro) vs Railway/Fly ~$5/mes.
- Dominio y subdominio `media.` conectado a R2. Mientras tanto `r2.dev` y `CDN_BASE_URL` por env.

**Pedir a James**
- Logo y firma manuscrita en **SVG**. (El logo no es un monograma "JM" como dice el comentario
  de §13: es una tira de película estilizada. Confirmado en `preview.webp`.)
- ~~Handle de TikTok~~ — **resuelto con el flyer**: TikTok `@james_film`, Instagram `James_film30`.
- Sesión de 15 min: preset de CapCut y uso del admin.
- Google Business Profile — tarea suya, mayor retorno de todo el SEO. §20

**Antes de datos reales**
- Cron de `pg_dump` a R2 corriendo **y restaurado una vez a una branch de Neon**. Un backup
  no probado no es un backup. §16 §20
- Cabeceras de seguridad en `_headers` de Cloudflare Pages (CSP, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`).
- Páginas legales: privacidad, términos, consentimiento de imagen. Ley 29733, y hay menores
  en XV años. **Es el único punto que puede traerle un problema real a James.** §19
- Verificar que la OG por galería (1200×630 desde una portada 9:16) no corta caras:
  `fit=cover&gravity=0.5x0.3`, probado con una foto real. §20

**Anotado, no se construye**
Worker de ffmpeg (§22) · formulario de `Lead` · testimonios por link con token · resumen semanal
por correo · gráficos y visitas en el dashboard · fractional indexing · Web Share Target ·
campos estructurados en `Package` · tabla `SiteCopy` · ABR.
