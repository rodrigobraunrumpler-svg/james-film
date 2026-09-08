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
- **[`docs/admin.md`](docs/admin.md)** = stack del admin y diseño del cliente HTTP (fase 4).
- **[`docs/james-film-admin-ui.md`](docs/james-film-admin-ui.md)** = guía visual del admin
  (paleta, tipografía, densidad, componentes). Manda en cómo se ve el admin; donde pida una
  dependencia o una API, mandan las reglas de este archivo.
- **[`docs/plans/`](docs/plans/)** = planes de implementación por fase.

---

## 1. Reglas que no se rompen

**Media**
- Entrega: **1080×1920, H.264 High, CRF 20, AAC 192k, MP4 `+faststart`**. Nunca HEVC ni 4K. §4
- **Lo que decide es el CÓDEC, no el contenedor: `.mov` SE ACEPTA** (7-sep-2026). El iPhone graba
  QuickTime **siempre**, con cualquier ajuste de cámara, así que rechazarlo condenaba a James a
  convertir cada archivo a mano. Se bloqueaba por «Firefox no reproduce contenedores QuickTime» y
  **eso es falso**: medido con un `<video>` real —no con `canPlayType`— servido como
  `video/quicktime`, un `.MOV` con H.264 decodifica en Firefox y en Chromium. `video/quicktime`
  está en las dos listas `MIMES_VIDEO`, la de `apps/api` y su espejo en el admin, y en el `accept`
  de la zona de soltar.
- **A CRF 20 el preset de entrega no siempre cabe bajo los 15 Mbps.** Un clip de 12 s a 1080×1920
  con mucho detalle salió a 16,5. Hay que añadir `-maxrate 12M -bufsize 24M`; el número del preset
  es una guía de calidad, no una garantía de tamaño.
- El máster nunca se sirve ni se sube. El disco de James es el archivo maestro, R2 es la vitrina. §4
- Validación en el navegador antes de firmar: formato reproducible, lado largo ≤2160px,
  bitrate ≤15 Mbps, faststart presente. **Los mensajes de error dicen qué hacer**, no "formato inválido". §4
- **Nunca subir archivos a través de la API.** Presigned PUT directo a R2. §4
- **`POST /admin/uploads/presign` para las nueve claves `*Key` que NO son filas `Media`**
  (portadas de categoría y paquete, avatar y captura de testimonio, logo, firma, OG, hero y su
  poster). El cliente manda un **`proposito` de lista cerrada** y el **servidor decide** prefijo,
  tipos y techo — mandar el prefijo sería dejarle elegir dónde escribe en el bucket. **No escribe
  en la base**: la clave se guarda cuando el `PATCH` de la entidad la incluye.
- **Huérfanos de ese endpoint**: un objeto bajo `covers/`, `avatars/`, `brand/` u `og/` con más
  de 24 h que no aparezca en ninguna columna `*Key` lo borra el cron de la fase 6. **`videos/` y
  `posters/` quedan FUERA de ese barrido**: ahí vive el trabajo de James y un barrido que se
  equivoque leyendo referencias lo borraría. El hero viejo se queda en el bucket.
- **El SVG entra solo en `brand/`** (logo y firma) y **no pasa por `normalizarImagen`**:
  decodificarlo a bitmap lo devolvería como un PNG del tamaño del `viewBox`. Es la única entrada
  de un documento ejecutable del proyecto, y la mitigación es **el origen** —`media.` es un
  subdominio distinto al de la landing—, no sanear el archivo.
- Fotos: solo se tocan si son HEIC o si el lado largo supera 2560px → **JPEG q95**. Nunca WebP/AVIF
  (Cloudflare re-comprime al servir; comprimir dos veces degrada). §4
- **Tres anchos de imagen en todo el sitio: 400, 800, 1600.** §4 §17
- Nombres de archivo UUID, nunca el del usuario. `storageKey` en la base, **nunca la URL**. §17
- **Solo `StorageService` conoce `CDN_BASE_URL`.** Los servicios construyen las URLs con
  `storage.getPublicUrl(key)` dentro de su mapper al DTO; ninguno lee la variable.
  **No hay `MediaUrlInterceptor`**: transformaba `storageKey`→`url` por convención de nombres
  *después* del controller, lo que impedía anotar el retorno del servicio con el DTO — y esa
  anotación es lo que hace que `select` falle cerrado. Dos mecanismos para lo mismo es peor que
  cualquiera de los dos; gana la garantía tipada.

**Diseño**
- Paleta cerrada: `void #0A0908` · `surface #141210` · `elevated #1E1B18` · `line #2E2A26` ·
  `ash #9C958C` · `bone #F2EFE9` · `brass-200 #E5D3AC` · `brass-400 #C9A96A` · `brass-600 #9A7F47` ·
  `whatsapp #25D366`. Cyan y magenta del flyer **no se usan**. §6
- **Esa paleta es la de la LANDING. El admin usa la suya**, en `docs/james-film-admin-ui.md`:
  `content #0F0D0C` · `chrome #151311` · `card #171412` · `card-hover #1C1917` · `active #221E1A` ·
  `well #080706` · `line #262220` · `line-strong #3D362F` · `line-hover #4A4038` · `muted #5F5952` ·
  `ash #8E877E` · `bone #F2EFE9` · `brass #C9A96A`. Solo `bone` y el latón coinciden, y es a
  propósito: en el admin **el chrome es más CLARO que el contenido** —así el sidebar se separa sin
  una línea— y eso no funciona con `void #0A0908`, que es más oscuro que todo lo demás. Mezclarlas
  deja el admin a medio camino de las dos.
- **El login es la «sala oscura»** (`docs/mockups-admin/login.html`, dirección B): sin tarjeta,
  la pantalla entera es la superficie, con el saludo en **Bricolage Grotesque 800** —el único sitio
  del admin con tipografía de display— y los campos reducidos a una línea base que crece con
  `scaleX` al enfocar. **El saludo por hora se calcula tras montar**: en el servidor renderizaría
  «Buenas tardes» y el navegador «Buenas noches», y React descarta el árbol entero por error de
  hidratación. Arranca en «Hola», cierto a cualquier hora, para que el titular no salte.
- **El admin tiene DOS temas y el claro no es el oscuro invertido.** Se elige con
  `[data-tema]` en el `<html>`, que pone un **script bloqueante en el `<head>`**
  (`lib/tema.ts`): leerlo en un efecto pintaría la pantalla oscura y saltaría a clara.
  Tres estados —`sistema`, `claro`, `oscuro`—; «sistema» **borra la clave** del
  `localStorage`, no guarda el valor calculado, para que siga a `prefers-color-scheme`
  si James cambia el ajuste del iPhone. El principio del oscuro se **invierte**: allí
  `chrome` es más claro que `content` y aquí más oscuro, y así el sidebar se separa
  sin una línea en los dos. `color-scheme` va declarado: es lo que pone en claro la
  barra de scroll, el autorrelleno y el selector de fecha nativo de iOS.
- **DOS latones, y la diferencia decide dónde va cada uno.** `brass` toca TEXTO e
  iconos; `brass-relleno` es el de barras, puntos y áreas, donde no hay que leer nada.
  En oscuro coinciden; en claro no pueden — el `#c9a96a` de la marca da **1.8:1**
  sobre blanco. Lo mismo con `--color-velo`, el fondo de los chips que van SOBRE una
  portada: se invierte con el tema porque lo que se pinta encima (`bone`, `brass`) ya
  se ha invertido. Con el velo fijo en negro, «24 medios» quedaba oscuro sobre oscuro.
  Y un chip sobre una foto **nunca lleva un fondo semitransparente del panel**: lo que
  se transparenta es la foto, que no controlamos.
- **Los contrastes se MIDEN sobre las superficies donde el texto vive de verdad**,
  no sobre blanco. El `muted #5f5952` que traía la guía daba **2.80:1** sobre
  `content` y lo llevaban las ayudas de todos los campos, los recuentos del menú y el
  marcador del ⌘K — a 11px y en la calle eso no se lee. Subido a `#8a837a` (5.2 / 4.9 /
  4.7). Queda casi pegado a `ash`, y es la consecuencia de que sobre ese negro **no
  cabe un gris legible por debajo**: la jerarquía la sostiene `bone` contra los dos.
  Lo verifica `e2e/responsive-total.spec.ts` en **los dos temas**, componiendo el fondo
  real capa a capa. Las **vistas previas quedan fuera**: dentro de su marco ya no es el
  admin, son la landing, Google y WhatsApp con SUS colores, y reconocerlos es el punto.
- **Una caja con `aspect-ratio` no gana a un hijo más alto.** `h-full` no resuelve
  dentro de ella, así que el alto intrínseco de un póster 9:16 estiraba la portada de
  una categoría al triple y descuadraba la rejilla entera. La imagen va `absolute
  inset-0`. No lo caza «nada se sale de su tarjeta» —no se sale, empuja— ni un test de
  DOM, que no maqueta: tiene su propio test que **mide** y solo mira si la caja CRECE
  (una más baja siempre es un `max-height` puesto a mano).
- **`items-start` en toda rejilla de tarjetas de alto variable.** Sin él la fila iguala
  alturas: un testimonio sin captura se estiraba al alto del que sí la tiene y dejaba
  300px vacíos, que sobre blanco se leen como un fallo de carga. Y hay que quitar el
  `h-full` de la tarjeta: en un ítem de grilla resuelve contra el alto de FILA aunque
  el `align-self` sea `start`, así que solo con `items-start` no cambia nada.
- **El progreso real va con curva LINEAL.** Una aceleración inventa un cambio de
  velocidad que la subida no está teniendo, y la barra es lo único que le dice a James
  si el 4G sigue vivo. La cascada de entrada lleva **techo de seis pasos**
  (`min(var(--i),6)`): con 32 medios, la rejilla se movía casi dos segundos y lo último
  en aparecer era la zona de soltar.
- **La LANDING también lleva dos temas** (decidido el 31-ago-2026; el plan de la fase 5 decía
  «oscura, punto» y se revisó al ver los diseños). Mismo argumento que ganó en el admin: se entra
  desde un móvil **a pleno sol en Ayacucho**, y un negro al 100 % de brillo se lee peor que un
  blanco. **El oscuro sigue siendo la marca** —el flyer es oscuro y dorado— y manda sin preferencia
  declarada. Y no es el oscuro invertido: en claro el titular del hero **no** va sobre el vídeo
  con un velo, el reel es una tarjeta y el titular va debajo; **los reels se quedan oscuros en los
  dos temas**, porque su fondo es el material, no la página; y el latón de leer baja a `#8A6D3B`
  —el `#C9A96A` de la marca da **1.8:1** sobre blanco—. Detalle en
  [`docs/plans/2026-08-31-fase-5-landing.md`](docs/plans/2026-08-31-fase-5-landing.md).
- **Todo fondo oscuro DECLARA su color de texto, nunca lo hereda.** Heredarlo funciona en el
  tema oscuro por accidente —la raíz ya es clara— y en el claro deja **texto negro sobre negro**.
  Se coló cuatro veces solo en los prototipos de la landing: el hero, la cifra del bento, el panel
  de cierre y las portadas de categoría. La clase de color va en el MISMO elemento que la de
  fondo. Y un bloque oscuro dentro del tema claro va como **panel** —redondeado y con margen—,
  nunca a sangre: a sangre se lee como un fallo de render.
- **Los diseños de la landing viven en `docs/mockups-web/`** (`.dc.html` + `canvas.json`, la misma
  forma que los del admin). El contenido es el REAL: precios, bullets, diferenciadores y
  `aboutText` salen del seed y de `preview.webp`, no son relleno.
- **El latón del admin solo va en bordes, iconos y estado activo.** Nunca un botón sólido dorado:
  el único que existe es el CTA de WhatsApp, y ese vive en la landing.
- **Regla del acento único**: Básico neutro → Pro latón → Premium hueso. §6
- Bricolage Grotesque **solo 400 y 800** (no tiene cursiva) + Inter 400/500. Titulares con `clamp()`. §6
- La firma "James" es SVG, no fuente. §6
- Sin librería de componentes. Son ~8 componentes. §6

**Rendimiento**
- LCP <2.5s · **INP <200ms con animaciones activas** · CLS <0.1. Medido en CrUX. §20
- Animaciones **solo `transform` y `opacity`**. Nunca `top`/`left`/`width`/`height`. §6 §17
- Todo dentro de `gsap.matchMedia("(prefers-reduced-motion: no-preference)")`. §6
- **NI GSAP NI LENIS. Ninguno de los dos entró** (fase 5, medido). Lo único que hacía falta era
  disparar la entrada AL VER el bloque —27 de 35 animaban debajo del pliegue y nadie los veía— y
  eso es un `IntersectionObserver` de diez líneas. GSAP serían ~50 KB moviendo el trabajo al hilo
  principal, que es lo que el presupuesto de INP protege; es el mismo argumento por el que
  `motion` se quitó del admin. Lenis, además, secuestra la rueda y deja un `requestAnimationFrame`
  eterno en el hilo principal a cambio de nada medible, y `scroll-behavior: smooth` ya es nativo.
  Medido con la CPU frenada 4×: LCP 304 ms · CLS 0.015 · **INP 80 ms** en la portada. §6
- **`:root.js .entra { opacity: 0 }`, nunca `.entra { opacity: 0 }` a secas.** La clase `js` la
  pone el script bloqueante del tema, así que sin JS no se esconde nada: la animación de entrada
  es un adorno, no la condición para poder leer la página. Con movimiento reducido el observador
  ni se monta y se marca todo visible de una vez.
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
- Node **24.20.0** fijado en `.nvmrc`; `engines` exige `>=24.15 <25` (una dependencia
  transitiva de NestJS pone ese suelo). pnpm **11**.
- **NestJS 12 · TypeScript 6 · Prisma 7.10.0 · Vitest 4 · oxlint · Zod 4 · PostgreSQL 17.**
- **`apps/api` es ESM** (`"type": "module"`): todo import relativo lleva extensión `.js`,
  incluso desde un `.ts`. `import { X } from './x.js'`.
  **`apps/admin` es al revés**: usa `moduleResolution: bundler` y los imports relativos van
  **sin extensión**. Poner `.js` allí rompe el build de Next con `module-not-found`.
- **En pnpm 11 los ajustes NO van en `.npmrc`** — ahí solo quedan auth y registry. Todo lo demás
  vive en `pnpm-workspace.yaml`. **El repo no tiene `.npmrc`**; si vuelve a aparecer uno con
  ajustes, se ignoran en silencio.
- **`engineStrict: true`** en `pnpm-workspace.yaml` (antes `engine-strict` en `.npmrc`).
  El install **falla**, no avisa.
- **`allowBuilds`** en `pnpm-workspace.yaml`, un mapa `paquete: booleano`. Sustituye a
  `onlyBuiltDependencies`, **eliminado en pnpm 11**. Solo `prisma` y `@prisma/client` pueden
  correr scripts de instalación; el resto falla con `ERR_PNPM_IGNORED_BUILDS`. Sin esa entrada
  el cliente de Prisma no se genera y el error no menciona pnpm.
- **Sin `nodeLinker: hoisted`.** Ese flag desactiva el `node_modules` estricto, que es la única
  razón por la que §3 eligió pnpm. Prisma 6 funciona con el linker por defecto.
- pnpm 11 retrasa **un día** la instalación de paquetes recién publicados (protección de cadena
  de suministro). Si una versión publicada hoy no resuelve, es eso, no un fallo.
- PostgreSQL **17** en Docker, en el puerto **5433** (evita el choque con un Postgres local).
- **MinIO en Docker para el almacenamiento en local y en CI** (fase 2). R2 es S3-compatible, así
  que es el mismo `@aws-sdk/client-s3` con otro endpoint: el flujo de subida se prueba entero sin
  cuenta de Cloudflare, y el código probado es exactamente el que correrá contra R2.
- **Un solo adaptador de almacenamiento**, no dos. §5 propone `r2.adapter` y `s3.adapter`, pero
  §17 admite que es el mismo SDK cambiando endpoint: serían el mismo archivo dos veces.
- Puertos de desarrollo: API 3000 · admin 3001 · web 4321.
- **`catalog:` de pnpm** en `pnpm-workspace.yaml` para lo que comparten los cuatro paquetes
  (`typescript`, `@types/node`). Se declaran como `"catalog:"`, nunca con número: subir de
  versión es una línea, no cuatro archivos.
- **`"strict": true` en los cuatro `tsconfig.json`.** El scaffold de NestJS no lo trae completo,
  y sería el único sitio del monorepo sin cobertura de tipos — justo donde vive la lógica.
- **`@types/node` se queda en 24 y TypeScript en 6, y este es el motivo** (que antes no estaba
  escrito): `@types/node` sigue la major de Node, fijada en 24 LTS. **TypeScript 7 es el port
  nativo (tsgo) y NestJS resuelve la inyección con `emitDecoratorMetadata`**; subir sin
  comprobarlo repetiría el fallo de `consistent-type-imports` — el typecheck y los tests
  unitarios pasan igual porque construyen los servicios a mano, y lo que revienta es el
  arranque. El criterio para subir es **la API arrancando sin `UnknownDependenciesException`**
  con la integración en verde, no que compile.
- **Dependabot semanal**, minor y patch agrupados en un PR. Es la automatización de la regla
  de no-deprecación; el CI es lo que la hace segura.

**Stack del admin (fase 4)** — detalle en [`docs/admin.md`](docs/admin.md)
- TanStack Query 5 + **`fetch` nativo**. Sin axios ni ky: el interceptor de 401 se escribe igual.
- **Sin Server Actions**, y solo por una razón: traen su propia invalidación (`revalidateTag`)
  y serían un segundo sistema de caché junto a TanStack Query. **El resto del servidor de Next sí
  se usa**: Route Handlers, `middleware`, `cookies()`, `headers()`, Server Components, Metadata
  API, `manifest.ts`, rutas tipadas. Si Next ya lo trae, no se reimplementa.
- **Frontera de auth: DECIDIDA — pasarela con Route Handlers**
  (`app/api/[...ruta]/route.ts`) que adjunta el `Bearer` en el servidor. El token nunca llega al
  JS del navegador, la sesión vive en una cookie del dominio del admin (así `middleware` y
  `cookies()` funcionan), y se acaba el CORS con credenciales. Las subidas siguen yendo directas
  a R2: la pasarela solo mueve JSON.
- **Enmienda a §16 por la pasarela**: `POST /auth/login` devuelve `{ accessToken, refreshToken }`
  **en el cuerpo**, y la pasarela los guarda en su propia cookie `httpOnly` del dominio del admin.
  Sin cifrar: son credenciales opacas que la API valida, la cookie no la lee el JS, y manipularla
  solo rompe la sesión propia. Todo lo demás de §16 sigue igual.
- **`export const dynamic = 'force-dynamic'` en la pasarela.** Sin eso Next puede cachear las
  respuestas GET y **servir los datos de una sesión a otra**. Es un fallo de seguridad, no una
  optimización perdida.
- **Quitar el CORS de la API no quita el de R2.** El `PUT` firmado sigue saliendo del navegador
  al bucket: R2 necesita CORS para el origen del admin aunque la API ya no.
- **Ventana de gracia en el refresh (fase 2).** En serverless no hay single-flight posible: dos
  invocaciones concurrentes refrescarían a la vez y la rotación lo leería como reuso, revocando
  la sesión. Si el token presentado coincide con `prevHash` **y** `Session.updatedAt` es de hace
  menos de ~30 s, se devuelve el vigente sin rotar ni revocar. Sin cambios de schema.
- **Estructura `src/features`**: `app/` solo enruta (sin lógica ni fetch), ninguna feature importa
  de otra, las llamadas a la API viven en `services/`, la validación en `schemas/`. Verificable
  con las skills `nextjs-boundary-enforcer` y `nextjs-architecture-review`.
- **Tipado estricto**: los DTOs vienen de `@james-film/contracts` y no se redeclaran — si la API
  cambia el contrato, el admin **no compila**. Cero `any`; `unknown` en las fronteras y de ahí a
  un tipo concreto vía zod o guard. Los tipos de formulario salen de `z.infer`, nunca al revés.
- **`signableHeaders` es obligatorio al firmar la subida.** Por defecto el SDK de S3 firma solo
  `content-length;host`: el `content-type` que le pasas **no se aplica**, así que alguien con la
  URL podría subir `text/html` bajo una clave `.mp4` y el CDN lo serviría — XSS almacenado. Hay
  que pasar `signableHeaders: new Set(['content-type', 'content-length'])`. Verificado inspeccionando
  la firma, no supuesto.
- **`GET /galleries` NO devuelve los medios**, solo portada y `mediaCount`. El detalle por slug
  sí. Si la lista los incluyera, el build de Astro se traería todos los reels de todas las
  galerías en una respuesta que crece sin techo con cada evento.
- **Los controllers públicos llevan `@SkipThrottle()`** o un límite muy alto. El build de Astro
  hace decenas de peticiones desde una sola IP en segundos: con el throttler global las tumbaría,
  y el modo de fallo es el peor — el build falla y la web se queda con la versión vieja.
- **`requestId` desde la fase 2**, no la 6. Son cinco líneas de middleware y hace que cada error
  de las fases 2 a 5 —justo donde más se depura— sea correlacionable con el log.
- **Snapshot del OpenAPI público en CI.** `/docs/public` es el contrato que consume Astro: se
  compara con `docs/openapi-public.json` commiteado y el CI falla si cambia sin querer. Mismo
  mecanismo que el drift de Prisma, aplicado a la frontera con la landing.
- **`helmet` sí, `cookie-parser` no.** La API **nunca lee una cookie**: la pasarela sostiene la
  sesión en el dominio del admin y manda `Authorization: Bearer`. Eso deja a la API **sin
  superficie de CSRF** — no hay credencial que el navegador envíe sola.
- **El CORS VOLVIÓ, y con `credentials: false`** (fase 5). Ese día llegó: el navegador de la
  landing habla directamente con la API para registrar el clic a WhatsApp, y con
  `Content-Type: application/json` eso dispara un preflight. Sin `enableCors` **el clic —la
  única métrica del negocio— no se registraba, y en silencio**: el panel diría «0 clics» y
  parecería que la web no funciona. Lo que conserva la propiedad de arriba es el
  `credentials: false`: sin credenciales no hay cookie que el navegador mande sola, así que
  sigue sin haber CSRF. Lista blanca desde `WEB_ORIGIN`, **nunca `*`** —no para el atacante
  decidido, que usa `curl`, sino para que nadie empotre el botón en otra web e infle los
  clics—, y **`app.enableCors` va lo PRIMERO** para que el `OPTIONS` no gaste cuota del
  throttler y deje sin ella al `POST` de detrás. Con test de las dos cosas.
- **`WEB_ORIGIN` se normaliza a `origin`.** `http://localhost:4321/` y el mismo con una ruta
  son el mismo origen para el navegador, pero `enableCors` compara la cadena tal cual: una
  barra de más dejaba el CORS roto sin decir por qué.
- **La CSP por defecto de `helmet` rompe la UI de Swagger** (scripts y estilos en línea). Hay que
  exceptuar la ruta de `/docs`, no desactivar la CSP entera.
- **Nada de Fastify, cache-manager ni compression.** La carga es cero —un usuario y unos builds
  a la semana— y el único cuello real es el arranque en frío de Neon, que ninguna librería arregla.
- **Toda consulta paginada termina en `{ id: 'asc' }` como desempate.** `ORDER BY "order"` con
  filas empatadas no garantiza secuencia estable en Postgres: una fila aparece en dos páginas y
  otra en ninguna. Y ocho modelos tienen `order @default(0)`, o sea que empatan por defecto.
- **El `LoginDto` NO valida longitud de contraseña.** La política pertenece al registro; en el
  login solo se verifica. Con un mínimo, una contraseña corta da **422 en vez de 401** — una
  respuesta distinta según la longitud de lo que prueba el atacante. El máximo sí se queda:
  argon2 sobre una cadena de 10 MB es una denegación de servicio gratis.
- **`RATE_LIMIT_ENABLED` apaga el throttler en la suite de tests**, que si no se autobloquea al
  hacer más de 5 logins. El comportamiento tiene su propio fichero de test con límites estáticos.
  Y ojo: se valida con `z.enum(['true','false'])`, **no con `z.coerce.boolean()`**, que convierte
  la cadena `"false"` en `true` — la misma trampa que `enableImplicitConversion`.
- **El login ejecuta siempre una verificación argon2**, contra un hash señuelo si el usuario no
  existe. Sin eso el tiempo de respuesta delata qué emails existen aunque el mensaje sea idéntico.
- **Los servicios anotan su retorno con el DTO** (`Promise<GalleryDto>`). Es lo que hace que
  `select` falle cerrado: sin la anotación, olvidar un campo compila y revienta en la landing.
- **404, no 403, para recursos no publicados.** Un 403 confirma que ese slug existe.
- `app.enableShutdownHooks()` y **límite de cuerpo de 256 kb**: el segundo convierte "nunca subas
  archivos por la API" de frase a imposibilidad.
- **`canvas.toBlob('image/webp')` NO existe en Safari** — ni iOS ni macOS, ninguna versión — y la
  spec obliga a caer a **PNG sin lanzar error**. Por eso **el poster es JPEG**: con WebP, en el
  iPhone de James ningún reel tendría miniatura nunca, y en silencio. Y el `posterMimeType` que
  se declara al presign es siempre `blob.type`, jamás una constante escrita a mano.
- **`middleware.ts` está deprecado en Next 16**: se llama `proxy.ts`, con `export function proxy`.
- **`proxy.ts` protege PÁGINAS; de las llamadas a la API se ocupa la pasarela.** Todo `/api` va
  fuera de su `matcher`: si entrara, un `fetch()` sin sesión seguiría el 307 y recibiría el HTML
  del login donde espera JSON. Verificado — la página redirige, la API devuelve 401.
- **`server-only`** en todo módulo que toque el token: si se importa desde un componente cliente,
  el build falla. Es la regla de ESLint de §3 aplicada un nivel abajo.
- **Estados de carga — un skeleton no vale para todo.** La señal va donde ocurrió la acción,
  nunca en un overlay global:
  - Primera carga de pantalla → **skeleton con la forma real** del contenido, en las 8 pantallas.
  - Refetch con datos ya en pantalla → **`placeholderData: keepPreviousData`** y atenuar. Volver
    al skeleton es un retroceso: tenías información y pasas a tener menos.
  - Mutación → **optimista con reversión** por defecto; si hay que esperar, pendiente **dentro
    del botón**. Nunca overlay. Toast al terminar, no al empezar.
  - Barra de publicación → línea de texto discreta, ni spinner ni toast.
  - **Sin autoguardado.** Se quitó del editor de galería (29-ago-2026): tenía sentido mientras
    era un borrador, pero con la galería publicada cada campo está **en vivo en la web**, y
    guardar a los dos segundos de escribir medio título es publicar medio título. Botón
    explícito, deshabilitado sin cambios —un PATCH que no cambia nada marcaría la web como
    pendiente de publicar— y aviso al salir con cambios sin guardar.
  - Subidas → **progreso real**, nunca indeterminado.
  - No ser optimista cuando el servidor decide algo impredecible (el slug con desambiguación) o
    en borrados con confirmación fuerte.
- **Un `useQuery` cuyo dato el servidor NO PUEDE saber se CORTA hasta montar — y `enabled` no
  sirve para eso.** Los recuentos de las pestañas de Galerías y los del menú se pintan solo si
  existen —un «0» mientras carga sería mentira—, así que el HTML del servidor sale sin el
  `<span>`. Si el dato ya está cuando React hidrata ESA parte del árbol, el navegador pinta un
  nodo que en el HTML no estaba y **React descarta el árbol entero**.
  **⚠ `enabled: useMontado()` NO lo arregla, y fue el primer intento**: `enabled` corta la
  PETICIÓN, no la lectura — `useQuery` sigue devolviendo lo que haya en caché. Y lo hay: el
  sidebar monta antes que la página y pide **la misma clave**, así que su respuesta puede llegar
  antes del primer render de la pantalla. Lo que cierra el fallo es **devolver `undefined` desde
  el hook** (`return montado ? data?.data : undefined`); el `enabled` se queda porque no pedir
  antes de tiempo sigue siendo correcto. Se corta en el HOOK y no en quien pinta: si lo sostiene
  la pantalla, el siguiente consumidor se olvida — misma regla que el botón «Quitar» de
  `CampoImagen`. Y el test que lo guarda **precarga la caché y mira el PRIMER valor**, no el
  último: mirando el último, las dos versiones pasan. `useMontado` vive en `lib/`.
- **`AdminGalleryDto` y `AdminGalleryListItemDto` llevan `isPublished`; los públicos no.** Sin él
  el admin no distingue un borrador de una galería en vivo, que es lo primero que hay que ver en
  la lista. Fuera del DTO público a propósito: allí siempre valdría `true` —el controller filtra—
  y añadirlo movería el `openapi-public.json` que el CI congela.
- **Ningún selector de zustand devuelve un objeto o un array nuevo.** Se selecciona el *record* y
  se deriva fuera. Un selector que allocate es un snapshot distinto en cada lectura para
  `useSyncExternalStore`: React lo detecta al confirmar, fuerza otro render y la pantalla se cae
  con «Maximum update depth exceeded». Pasó dos veces, y la segunda **solo con la barra de subidas
  visible**, o sea únicamente durante una subida de verdad.
- **Nada `fixed` sobre el contenido del panel.** Un elemento fijo no ocupa sitio en el flujo:
  la barra de subidas tapaba el botón de Cancelar de la última tarjeta — justo el que hace falta
  mientras se sube. `sticky bottom-0` se pega abajo **y** reserva su hueco.
- **Los recuentos de pestañas se calculan en el CLIENTE cuando la lista no está paginada.**
  Galerías necesita `GET /admin/galleries/counts` porque su lista viene por páginas y contar el
  trozo visible mentiría. `GET /admin/testimonials` devuelve TODO, así que ahí el contador es un
  `array.filter().length`: copiar el patrón sin mirar la diferencia habría añadido un endpoint,
  sus tests y su caché para nada.
- **El `confirm()` del navegador no se usa en ninguna parte.** En iOS sale como un diálogo del
  SISTEMA —no de la app— y se acepta con el pulgar sin leerlo. Lo que interrumpe va en `Hoja`.
  Escribir el nombre (`ConfirmarBorrado`) se reserva a lo que se lleva archivos por delante:
  pedirlo para todo entrena a confirmar sin leer, que es justo lo que se quiere evitar.
- **El h1 de cada pantalla vive DENTRO de su lista, no en el `page.tsx`.** Comparte fila con el
  botón de «Nuevo…», y separarlos los deja en dos líneas distintas.
- **Un test de Testing Library que pulsa el nodo correcto NO demuestra que se pueda pulsar.**
  RTL no hace hit-testing: `getByRole(...).click()` dispara el evento sobre el elemento aunque
  tenga otra capa encima. La capa de acciones de la tesela cubría la miniatura entera y —con
  `opacity: 0`, que **no** desactiva los clics, solo `pointer-events` lo hace— se tragaba el clic
  que abre el visor, con los tres tests unitarios en verde. Lo que lo detecta es Playwright, que
  sí hace hit-testing. Regla: **cualquier cosa que se pulse por encima de otra lleva su prueba en
  el E2E**, no solo en el dom.
- **Los botones inyectados en desarrollo se filtran en el E2E responsive**: el de Next
  (`nextjs-portal`, 32px) y el de las devtools de TanStack Query (`tsqd-open-btn`, 40px). Sin el
  filtro, el test de objetivos táctiles pasa o falla según lo que tengas abierto.
- **Medir tamaños con una animación de entrada en curso da números falsos**: un botón de 44px
  bajo `scale(0.97)` mide 43,65 y el test falla por algo que no es un fallo. Se espera con
  `el.getAnimations({ subtree: true })`, no con un `waitForTimeout` a ojo.
- **`@dnd-kit` NO se usa** y no es un olvido: su estable lleva 21 meses sin publicar y su línea
  nueva va en `beta` pre-1.0, así que no pasa la regla de dependencias. El reorden va con arrastre
  nativo HTML5 en escritorio y **botones de mover** en táctil, que es además el único camino
  testeable: en happy-dom `getBoundingClientRect()` devuelve ceros y un test de arrastre no falla,
  no hace nada y pasa.
- **`XMLHttpRequest` solo para subir a R2** — `fetch` no emite progreso de subida (§17).
- `nuqs` para filtros y pestañas: la URL **es** la clave de TanStack Query. Una fuente, no dos.
- `zustand` solo para la cola de subidas: con Context, cada tick de progreso re-renderiza a todos
  los consumidores.
- shadcn/ui sobre Radix (código propio, no dependencia — por eso no contradice §6), `react-hook-form`
  + `zod`, `lucide-react`, `sonner`, `clsx` + `tailwind-merge`. **`@dnd-kit` no está
  en la lista a propósito** — ver arriba.
- **`motion` se QUITÓ, y estuvo instalada meses sin que la importara nadie.** Las
  animaciones del admin son entradas, barras y hovers: `transform` y `opacity`,
  que el navegador corre en el COMPOSITOR. `motion` las correría en JS sobre el
  hilo principal, que es justo lo que §6 protege, y son 30 KB para escribir la
  misma cantidad de código en cada componente. Los 4 keyframes y las 6
  utilidades de `globals.css` se escriben una vez y se usan con una clase y un
  `--i`.
  **Donde sí ganaría es en lo que CSS no puede**: animar la SALIDA de algo que
  se desmonta, y el reorden con FLIP. Pero las hojas y el visor usan vaul/Radix,
  que traen sus salidas, y el ⌘K es `<dialog>` nativo: no queda ningún caso. El
  día que lo haya, se vuelve a evaluar — no antes.
  Y ojo con `motion-reduce:` en el código: **es una variante de Tailwind**, no
  la librería. Un `grep motion` da falsos positivos.
- **Base UI descartada**: sigue en `1.0.0-rc`. Radix está estable.
- **View Transitions ENTRE DOCUMENTOS: NO**, aunque la guía del admin las pida. En Next siguen
  tras un flag experimental, y eso choca con «nada en `experimental` en producción». Se revisa
  cuando salgan del flag, no antes. Tampoco el `<ClientRouter />` de Astro en la landing.
- **`document.startViewTransition()` en la MISMA página SÍ, y es lo que funde el cambio de tema
  de la landing.** Es otra API y otra madurez: estable en Chrome 111+, Safari 18 y Firefox 144,
  con detección de soporte y caída a cambio instantáneo. Entró **midiendo**, que es la única
  razón por la que entra algo aquí: el fundido escrito a mano —una clase con
  `transition: background-color, border-color, color` sobre `*` durante 240 ms— llevaba el INP
  de **80 ms a 248 en móvil y 328 en escritorio**, sobre un techo de 200. El culpable es `color`:
  transicionarlo repinta todo el texto de la página durante 200 ms. Solo con `background-color`
  bajaba a 88/208, pero entonces el texto salta mientras el fondo aún se mueve, y al pasar a
  claro son ~150 ms de letra oscura sobre fondo oscuro. Con `startViewTransition` el navegador
  fotografía, aplica y funde **en el compositor**: **40 ms en móvil y 96 en escritorio**, o sea
  MENOS que cambiar el tema a pelo sin transición —el recálculo de estilos deja de ocurrir
  dentro del evento y pasa al callback, después del primer pintado—.
- **Los recuentos de las pestañas y el uso de disco son endpoints PROPIOS**
  (`GET /admin/galleries/counts`, `GET /admin/storage`), no campos del meta paginado. Si viajaran
  en la respuesta filtrada, «Borradores 3» valdría 3 en Borradores y 0 en Publicadas — el contador
  diría lo contrario de lo que cuenta. Y `@Get('counts')` va **declarado antes que `@Get(':id')`**:
  Nest resuelve por orden, así que abajo `:id` capturaría «counts» y devolvería un 404 que parece
  culpa del cliente.
- **El uso de disco se suma sobre `Media`, no se pregunta a R2.** El bucket guarda además portadas,
  avatares y logos —kilobytes— y un `ListObjectsV2` paginado por cada carga del panel costaría más
  que el dato. Los borrados blandos no cuentan aunque el objeto siga arriba: para James ese archivo
  ya no existe. Se muestra en **eventos** («quedan unos 29»), no en gigas, con los 230 MB/evento de §2.
- **Toda galería tiene un degradado propio y estable, derivado de su id** (`lib/degradado.ts`).
  Va DEBAJO de la portada: se ve mientras la imagen carga y es lo único que hay cuando la galería
  aún no tiene ninguna. Sin él, seis eventos recién creados son seis rectángulos negros idénticos.
  **Son dieciséis y el hash es FNV-1a**: con seis se repetían a simple vista en una pantalla de
  nueve, y una suma tipo `h*31` deja a las galerías creadas el mismo día en el mismo color —los
  cuid comparten prefijo y lo que las distingue está en la cola. Con FNV-1a, doce galerías del
  mismo día salen en doce colores. Hay test de reparto, no solo de estabilidad.
- **Una portada que no carga se ESCONDE y deja ver el degradado, pero AVISA por consola**
  (`lib/imagen.ts`). Sin el `onError`, R2 caído o una clave movida a mano pintan el icono de
  imagen rota encima de la tarjeta y un fallo de red parece un fallo de datos; sin el `warn`, un
  bucket mal configurado se ve **exactamente igual que una galería vacía** —seis degradados y
  ningún error en ninguna parte—. Las dos mitades hacen falta.
- **El bucket de MinIO se deja con `mc anonymous set download`** en `storage-init`. No es relajar
  la seguridad: es reproducir producción, donde los objetos se sirven por el dominio `media.` de
  R2, que es público, y `CDN_BASE_URL` apunta ahí. En local esa variable apunta a MinIO directo y
  un bucket nace PRIVADO, así que **cada `<img>` recibe un 403** mientras la subida sigue
  funcionando —el PUT va firmado— y la API no registra ni un error. Escribir sin firma sigue
  dando 403, que es el mismo reparto que en producción.
- **El buscador (`?q=`) actualiza la URL con 300 ms de retraso.** Sin eso cada tecla es una petición
  **y una entrada en el historial**: el botón atrás habría que pulsarlo una vez por letra escrita.
  Y `?q=` vacío se convierte en `undefined` en el DTO: `contains: ''` casa con todo pero deja el
  índice fuera y convierte cada tecleo en un scan inútil.
- **«Deshacer» SÍ, y sale casi gratis**: el soft delete ya existe, así que deshacer un borrado es
  un `PATCH` con `deletedAt: null` y una acción en el toast de `sonner`. Va solo donde el error
  duele —borrar una galería o un medio—, no en cada guardado.
- **Animaciones del admin: solo `transform` y `opacity`, ≤350ms, dentro de
  `prefers-reduced-motion`.** El relleno de subida es `scaleY()` sobre el progreso real, nunca
  `height`. Sin shimmer recorriendo los skeletons (repinta en bucle; un `opacity` pulsante hace
  lo mismo por nada) y sin FLIP al reordenar la grilla: es donde el iPhone de James lo nota.
- **Sin TanStack Table en v1** (5 tablas de decenas de filas, y §7 obliga a tarjetas apiladas en
  móvil igual). La guía del admin la pide y **se contradice sola**: dos páginas antes dice
  «tarjetas, no tablas». Gana lo de las tarjetas.
- **Sin librería de fechas**: `Intl` + `<input type="date">`, que en el iPhone de James abre el
  selector nativo de iOS.
- **Los esquemas Zod de formulario viven en el admin, no en `packages/contracts`** — son runtime y
  romperían la propiedad de "solo tipos". La API sigue siendo la autoridad (`whitelist`).
- El admin **no tiene presupuesto de INP**: no se indexa. Las restricciones duras de §6 son de la
  landing. Aun así, animaciones solo con `transform` y `opacity`, y `prefers-reduced-motion`
  respetado sin excepciones.

**El tema claro — lo que salió implementándolo**
- **Un test que solo mira el DOM no ve un color.** Los tres fallos del tema claro fueron el
  mismo: un color escrito a mano que en oscuro contrastaba y en claro quedaba encima de sí
  mismo —el chip de «24 medios» en `bone` sobre un velo negro, el relleno del menú en blanco
  al 7% sobre blanco, el degradado oscuro bajo texto claro—. Ni el typecheck ni Testing
  Library los ven. Los caza `e2e/responsive-total.spec.ts`, que **compone el fondo real capa
  a capa** y exige AA en los dos temas sobre las diez pantallas.
- **Un dato que se pide y no se enseña deja de rellenarse.** `Testimonial.rating` estaba en el
  DTO y en la hoja de edición desde la fase 4, y **no se pintaba en ninguna parte**. Ahora la
  tarjeta lleva su fila de estrellas, y solo si hay valoración: cinco apagadas dicen «valorado
  con cero», que es otra cosa que «todavía no se ha valorado».
- **Los contadores de caracteres del SEO no existían**, aunque este fichero los daba por
  hechos. Van pegados a la etiqueta, avisan en latón al pasarse y **no bloquean**: Google
  recorta por ancho, no por caracteres.
- **«Arrastra» en un iPhone describe algo que no se puede hacer.** El arrastre nativo de HTML5
  no existe en iOS, así que la pista se parte por ancho: «ordena con las flechas del ⋯» bajo
  `lg`, «arrastra para reordenar» encima. Lo mismo en la tesela de soltar («Añadir del
  carrete» / «Suelta reels aquí») y en la tira del menú de categorías.
- **La segunda miga era la categoría, y a una categoría no se puede ir**: la lista filtra por
  estado y por texto, no por categoría. Ahora es el nombre de la galería.
- **El estado de una galería se dice SIEMPRE, no solo cuando es borrador.** Con el chip
  únicamente en los borradores, una galería en vivo se leía igual que una tarjeta a la que le
  falta algo. Verde para lo publicado, latón para lo que no.
- **Durante una subida el total no es lo que hay que mirar.** La cabecera de la grilla dice
  además cuántas van subiendo y cuántas fallaron: con «32 medios» a secas, James no sabe si
  quedan tres en vuelo o si una se cayó hace un minuto.
- **El prototipo no modela el caso de cero.** Dibuja los clics de cada paquete siempre porque
  tiene datos; el código los esconde mientras NINGUNO tenga tráfico, porque «0 clics» repetido
  tres veces ocupa medio pie y no informa. Del prototipo se tomó el icono, que sí faltaba.
  Regla general: **donde el prototipo y un test del proyecto discrepan, gana el test** — el
  prototipo es un estado, el test es la regla.
- **Un test no puede terminar con sus escrituras en vuelo.** El de «sin faststart» daba por
  buena la tesela que pinta la COLA LOCAL y acababa con su `confirm` en el aire; el siguiente
  cargaba la galería antes de que existiera la fila, medía 30 y ya nunca volvía a 30. El fallo
  parecía de «cancelar» y estaba dos tests más arriba.

**Sin conexión — lo que de verdad arregla el estado del prototipo**
- **El presupuesto de 5 min NO corre mientras no hay red.** Existe para rendirse ante un
  archivo que no entra —una key repetida, un bucket mal configurado—, no ante un túnel: en
  el 4G de Ayacucho, un corte de seis minutos daba por fallidos ocho reels perfectos y había
  que relanzarlos uno a uno. El motor espera con `esperarConexion()` y **adelanta `empezoEn`
  lo que duró el corte**, así que el reloj se para en vez de correr en vacío. Y al volver no
  se espera el backoff: el evento `online` ya es la señal, y sumarle ocho segundos sería
  castigar por reconectar.
- **`navigator.onLine` no promete internet** —un portal cautivo dice `true`— así que NO
  sustituye al reintento: solo añade las dos cosas que el reintento no puede saber, cuándo
  no vale la pena gastar presupuesto y cuándo volver a intentarlo ya. En la dirección que
  importa sí es fiable: si el sistema dice que no hay red, no la hay.
- **Se dice en DOS sitios y es a propósito.** La barra sale solo con algo EN VUELO
  (`hayEnCurso`), así que con la red caída y tres archivos esperando turno la banda de la
  grilla es lo único que hay. Cada una se sostiene sola; ninguna puede dar por hecha a la
  otra.
- **Nada de cuenta atrás.** El prototipo dibuja «Reintentando en 8 s…», pero se reanuda con
  el evento `online`: ese número sería mentira en los dos sentidos. Se dice qué va a pasar
  —«Se reanuda solo al volver»—, que es lo que James necesita para decidir si se mueve a
  buscar cobertura o se espera.
- **La banda va en el FLUJO, no flotando** —un elemento fijo taparía justo la tesela que
  está subiendo— y **solo si hay algo pendiente**: sin nada en cola, un corte no cambia nada
  de esa pantalla y avisar sería ruido, que es lo que entrena a no leer.
- **Durante el corte la tesela decía «Subiendo» con la barra congelada**, y eso se lee como
  «se colgó», no como «no hay cobertura» — dos cosas que piden reacciones distintas. Ahora
  dice «En cola». Los fallidos quedan fuera: ésos no esperan, piden una decisión.
- **`useEnLinea` devuelve un BOOLEAN** y su snapshot de servidor es `true`: con un objeto,
  `useSyncExternalStore` compara por identidad y entra en bucle —el mismo fallo que la regla
  de los selectores de zustand—, y arrancar diciendo «sin conexión» para corregirlo al
  hidratar sería una alarma falsa parpadeando.
- **La cola es un singleton de módulo y sobrevive ENTRE TESTS.** Es su razón de ser —James
  se va a «Galerías» y sigue viendo «Subiendo 3 de 8»—, pero obliga a vaciarla en el
  `afterEach`: sin eso, el reel de un test deja al siguiente con algo en cola y el aviso sale
  cuando el test afirma que no debería.

**Fase 4 — lo aprendido construyéndola**
- **La lista de íconos sale de lo que el seed ya usa, no de la imaginación.** El primer borrador
  la inventó y no incluía `trending-up`, `crown` ni `bar-chart-3`: con `@IsIn(ICONOS)` puesto,
  James habría abierto un paquete, guardado sin tocar el ícono y recibido un **422 sobre un campo
  que no envió**. Hay un test que compara ambas.
- **`lucide-react` ya no exporta `Instagram`** — quitaron las marcas. Por eso el admin usa un
  **mapa estático** de nombre a componente: con resolución dinámica habría caído al ícono de
  reserva en silencio; así no compiló.
- **Lo que comparten dos features sube a `lib`, no se importa de la otra.** La lista de
  categorías la necesitan tres pantallas: vive en `lib/catalogo` **con una sola clave de caché**,
  para que el CRUD y los selectores no puedan discrepar.
- **El número de WhatsApp exige 10 dígitos, no 8.** Un móvil peruano son 9 (`994724944`) y con el
  suelo anterior pasaba tal cual — justo el fallo que la validación existe para impedir. No es un
  validador E.164 general: es la comprobación de que lleva prefijo de país.
- **Un `useForm` por pestaña en Configuración.** Con uno global, guardar SEO mandaría también el
  número de WhatsApp y pisaría un cambio hecho desde el móvil.
- **`listarPublicas` usaba `mapGaleriaListaAdmin`** y devolvía `isPublished` en la respuesta de la
  landing. Siempre valía `true` —el controller filtra— así que no rompía nada y por eso llevaba ahí
  desde la fase 2; el fallo real es que al añadir un campo al DTO de admin se cuela solo en el
  público. Corregido a `mapGaleriaLista`, con test que comprueba las dos respuestas a la vez.
  **`updatedAt` va en `SELECT_GALERIA_ADMIN`, no en `SELECT_GALERIA`**: lo que no se selecciona no
  se puede filtrar mal.
- **`Gallery.coverKey` borrada** (migración `quitar_gallery_coverkey`). Era una columna muerta con
  lectura viva: el mapper la respetaba, no la escribía nadie y ningún DTO la exponía. Verificada
  vacía antes de borrarla. La portada se deriva del medio destacado, siempre.
- **`RolesGuard` no protegía nada** hasta que existió `@AdminController`: devuelve `true` cuando
  no hay metadatos de `@Roles()`, y ningún controller los declaraba.

**Panel, buscador ⌘K y el rediseño de categorías — lo aprendido**
- **Disponibilidad es la NOVENA pantalla** (`/disponibilidad`), y un solo endpoint:
  `GET /admin/availability/summary`, por el mismo motivo que el Panel — pintarla a
  trozos daría cuatro saltos de layout en el 4G de James. La API y la landing del
  calendario llevaban meses construidas y **el panel no tenía pantalla**: James no
  podía marcar ni un día, así que la web enseñaba todo libre siempre. Un endpoint
  publicado sin la pantalla que lo alimenta es una función que no existe.
  - **Una reserva es un RANGO CONTIGUO**, y por eso se elige tocando el primer día y
    el último, no sumando días sueltos. Sale de la conversación real que originó el
    módulo: «quiero para dos días, 24 y 25 de octubre». Dos fines de semana distintos
    son dos reservas y se marcan dos veces — correcto, porque en la base son dos
    `groupId`, y eso es lo que convierte «24 y 25» en una boda y no en dos días.
  - **El tercer toque REINICIA**, no amplía: es «me equivoqué».
  - **Un día pasado y libre no se toca; uno pasado y OCUPADO sí.** Es la única forma
    de deshacer un rango mal elegido, y la API ya lo permitía a propósito (rechaza
    marcar en pasado, nunca desmarcar).
  - **Sin optimista**, y es una de las excepciones de la regla: el servidor decide
    dos cosas impredecibles —el `groupId` que agrupa la reserva y un posible 422 por
    fecha pasada—, así que pintar el día ocupado antes de tiempo enseñaría un estado
    que la respuesta puede desmentir. Misma excepción que el slug con desambiguación.
  - Alrededor del calendario van las cuatro cosas que el dato puede decirle y que no
    dice ninguna otra pantalla, en este orden: **lo grabado y sin publicar** —cruce de
    `BusyDay` pasado con `Gallery.eventDate`, y es lo único que él no sabe—, **lo que
    viene**, **los sábados libres** de tres meses contados desde HOY (a mitad de mes,
    contar los que ya pasaron diría cuatro donde queda uno) y **los clics del
    calendario**, separando `calendario-libre` de `calendario-ocupado`: el segundo
    mide la demanda que se está rechazando.
  - La **nota es privada** y no sale del DTO público (Ley 29733). La pantalla lo dice
    donde se escribe, no en una ayuda aparte.
- **El Panel existe y es la octava pantalla** (`/panel`). Un solo endpoint,
  `GET /admin/dashboard`, con cinco consultas en paralelo dentro: la pantalla no
  puede pintarse a trozos —el bloque de avisos decide el alto de todo lo de abajo—
  y cinco peticiones darían cinco saltos de layout en el 4G de James.
- **Los avisos van ARRIBA, antes del número grande.** §9 lo dibuja al revés. Si el
  último deploy falló, la web sigue enseñando lo de antes, y eso cuesta más caro
  que el total del mes. Cada aviso lleva **su acción**: uno que no se puede
  resolver desde donde se lee obliga a buscar la pantalla, y entonces se ignora.
- **Los medios fallidos se agrupan POR GALERÍA.** Ocho reels rotos de la misma
  boda son un problema, no ocho: ocho avisos idénticos entrenan a descartarlos
  sin leer, que es justo lo que hay que evitar.
- **Un borrador avisa a los 3 días, no antes.** Antes es trabajo en curso.
- **Las ventanas son MÓVILES** (`ahora - 30 días`), no meses de calendario, y los
  días de la serie se agrupan con `timeZone: 'UTC'`: agrupar en la zona del
  proceso pondría la misma fila en un día distinto en `America/Lima` que en el
  contenedor. La serie se rellena con ceros y las columnas tienen **suelo de
  3px** — un día a cero tiene que verse como un día, no como un hueco.
- **`source` es una unión CERRADA en `packages/contracts`**, no `string`. Con `string` la
  landing compilaba mandando una fuente que la API no conoce, `@IsIn(FUENTES)` devolvía 422 y
  **el clic se perdía sin ruido** — pasó con `calendario`. Ahora las dos listas tienen que
  moverse juntas o no compila, y al añadir una hay que regenerar `openapi-public.json`.
- **El clic se registra con `fetch(..., { keepalive: true })`.** El clic que hay que contar es
  justo el que ABANDONA la página: al pulsar, el navegador salta a `wa.me` y un `fetch` normal
  muere en esa navegación. Sin la bandera se pierde el 100 % de lo que mide. Y el registro
  **nunca** llama a `preventDefault()`: si falla, el enlace navega igual. Perder una métrica es
  barato; perder el lead no.
- **`POST /track/whatsapp` ya existe** (público, bajo el throttler global). Un
  `packageId` que ya no existe **no tumba el clic**: se captura el P2003 y se
  guarda sin atribución. Perder de qué paquete venía es barato; perder el clic es
  perder la única métrica del negocio. `TrackingModule` va en el `include` del
  **OpenAPI público**: lo llama el navegador de la landing, y si no está ahí la
  fase 5 no sabe que existe.
- **`SEED_DEMO_CLICKS` siembra clics de ejemplo, y NUNCA va en producción.**
  Bandera propia y no `SEED_RESET`: restaurar el contenido del flyer y fabricar
  telemetría son cosas distintas. Se salta sola si ya hay clics registrados.
- **El ⌘K es lo que ata las ocho pantallas** y vive en el MENÚ, no en cada
  pantalla: desde cualquier sitio a cualquier sitio sin volver atrás. Con el
  atajo escrito al lado — si no se ve, no existe.
- **`cmdk` NO se usa**: su último release es de hace 12 meses y 2 días, fuera de
  la regla de dependencias por dos días. Está escrito con **`<dialog>` nativo**,
  que trae foco atrapado, Escape, `::backdrop` y el apilado — exactamente lo que
  hacía falta, a coste cero. Hay que llamar a **`showModal()`**, no poner el
  atributo `open`: con `open` el diálogo se pinta pero el tabulador se pasea por
  el panel de detrás. Y `onClose` es obligatorio: cubre Escape y el gesto de
  retroceso, que no pasan por nuestro código, y sin él el estado se queda en
  «abierto» y el atajo deja de funcionar. Con test E2E del foco atrapado.
- **La búsqueda es del SERVIDOR** (`GET /admin/search`), no un filtro del cliente:
  la lista de galerías viene paginada, así que filtrar lo cargado encontraría
  solo lo que ya está en pantalla — justo lo que no hace falta buscar. Mínimo
  dos caracteres (422 con uno) y el recorte va **antes** de validar. Con una sola
  letra el atajo no muestra los atajos: has escrito algo y verlos es ruido.
- **`<details>` NO vale para un menú**: no se cierra al pulsar fuera, así que
  abrir uno y tocar en otro sitio lo deja abierto tapando la tarjeta de al lado.
  Va con el Popover de Radix, que ya estaba en el proyecto. Y ojo: happy-dom no
  implementa el ocultado de `<details>` cerrado, así que RTL veía su contenido —
  el mismo tipo de falso verde que el de la capa con `opacity: 0`.
- **Una categoría no es un nombre: es un montón de vídeos.** La tarjeta enseña
  portada, **las tres galerías publicadas más recientes** y **a qué paquete van
  sus clics** —derivado por `PackageCategory`, sin columna nueva en el clic: una
  denormalizada quedaría desfasada en cuanto James moviera un paquete—. Cero
  clics se DICE («Sin clics todavía»), no se deja el hueco.
- **La tira del menú de la web va encima de la rejilla.** El orden es abstracto
  hasta que se ve dónde acaba; moverlo y verlo ahí al momento lo convierte en una
  decisión. Las ocultas salen **tachadas**, no desaparecen: si desaparecieran,
  ocultar una parecería haberla borrado.
- **Los recuentos del menú reutilizan las claves de caché de las pantallas**, no
  unas propias. Con claves nuevas serían cuatro peticiones más por navegación y,
  peor, **dos verdades**: el menú diría «Paquetes 3» mientras la pantalla enseña
  cuatro. `undefined` mientras carga, nunca `0`: un cero es un dato, y ahí sería
  mentira.
- **El filo de latón del elemento activo es `box-shadow: inset 2px 0 0`, no un
  `border`.** Un borde de 2px solo en el activo empuja el icono 2px y el menú
  entero baila al navegar. Lo mismo en el subrayado de las pestañas.
- **El verde WhatsApp aparece en TRES sitios del admin y en ninguno más**: la vista
  previa del hero, el icono y el visto del bloque de WhatsApp en Contacto, y el **filo
  de 3px** a la izquierda de ese bloque. Un filo, no un borde de otro color por los
  cuatro lados —eso se lee como un error—, y nunca un botón sólido: ese vive en la
  landing. El bloque lo lleva porque es el negocio entero; si ese campo está mal, todo
  lo demás de la pantalla da igual.
- **La vista previa del hero en Configuración**, y va **pegada** (`sticky`) mientras se hace scroll: cambias
  un campo y ves el efecto sin moverte. Dentro del marco ya no es el admin, es la
  web, así que usa la paleta de la LANDING (`void #0A0908`), no la del admin.
  Se alimenta con `useWatch`, no con `watch()`: solo re-renderiza la previa.
- **`?nueva=1` abre el formulario de galería nada más entrar.** Sin eso, los
  atajos «Nueva galería» del panel y del ⌘K soltaban a James en la lista a buscar
  el botón. En la URL con `clearOnDefault`, y **el estado de nuqs sobrevive entre
  tests del mismo fichero**: hay que resetear `window.history` en el `beforeEach`
  o el test que abre el formulario deja al siguiente empezando con la hoja abierta.
- **Dos incoherencias que salieron al tocar Configuración**: sus inputs usaban
  `min-h-11 rounded-md border px-3` a mano en vez de `.campo` —sin fondo `card`,
  sin radio de control y **sin el foco en latón**— y tres botones estaban escritos
  a mano en vez de con `clasesBoton()`. Y usaba **`confirm()`**, que CLAUDE.md
  prohíbe: ahora es una `Hoja`.
- **Guardar arranca deshabilitado y solo se habilita con cambios**: un PATCH que
  no cambia nada marcaría la web como pendiente de publicar.

**Lo que salió al comparar la implementación contra el prototipo, valor por valor**
- **`border` SIN clase de color en Tailwind 4 hereda `currentColor`.** El
  preflight emite `border: 0 solid`, así que `className="rounded-md border"`
  pinta un borde **casi blanco** (`#F2EFE9`) sobre esta paleta. Estaba en nueve
  sitios de Configuración. Todo `border` lleva su `border-line`, `border-line-strong`
  o `border-danger-line`.
- **Un `z-index` NEGATIVO en un descendiente lo esconde bajo el fondo de un
  ancestro no posicionado.** `-z-10` en la luz ambiente formaba su propio
  contexto de apilamiento y se pintaba ANTES que el `bg-content` del layout —
  invisible en las tres pantallas. Basta el orden del DOM: primero en el
  documento y sin `z-index`.
- **Una transición declarada que nadie dispara es coste sin efecto.** `levanta`
  declaraba `transition: border-color, background-color` y el `:hover` solo
  cambiaba `transform`. Igual el botón `secundario`, que subía el fondo pero no
  el borde — por eso `--color-line-hover` estaba casi sin usar.
- **`font-display` NO arrastra el `letter-spacing`.** El display de la guía es
  familia + peso 800 + `-0.02em`; la utilidad de Tailwind solo cambia la
  familia. Los tres números grandes lo llevan escrito.
- **La escala de gravedad de un aviso necesita TRES niveles, y `grave` solo da
  dos.** Rojo para lo que ya salió mal en la web, latón para lo que hay que
  mirar, línea normal para el recordatorio: se deriva de `kind`, no del booleano.
- **La unidad se escribe una vez en un par**: «3.2 / 10 GB», no «3.2 GB /
  10.0 GB». Y `10.0` se escribe `10` — el decimal de un entero compite con el
  del número de al lado, que sí lo necesita. `partirTamano()` en `lib/format`.
- **Un asa de arrastre que no arrastra es una promesa rota.** Las tarjetas de
  categoría llevan arrastre nativo HTML5 en escritorio, el mismo patrón que las
  teselas del editor, con las flechas como camino táctil. Con test.
- **El buscador tiene que encontrar PANTALLAS, no solo filas de la base.**
  Escribir «ajustes» encuentra Configuración y «crear» ofrece crear: las rutas
  y las acciones viven en el cliente con un campo `busca` de sinónimos, y la
  comparación va sin acentos y en minúsculas. Sin eso, el atajo solo sirve si
  ya sabes cómo se llama la pantalla — justo lo que no sabes cuando te pierdes.
- **`overflow-hidden` en todo contenedor redondeado con hijos de fondo propio.**
  El pie del buscador y su fila activa asomaban por las esquinas.
- **La vista previa que se anuncia «en vivo» no puede mentir**: pintaba
  `whatsappNumber` crudo (`+51994724944`) donde la web pinta `whatsappDisplay`.
- **La barra pegada va en `chrome`, no en `content`**: es más clara que aquello
  sobre lo que se pega, que es cómo se separa. Con `content` solo la distingue
  la línea. Y lo que va debajo del formulario —la tarjeta de Redes— tiene que ir
  DENTRO del marco, encima de la barra: si no, «Guardar» queda a media página.
- **El `confirm()` que quedaba estaba en el peor sitio posible**: la afirmación
  de consentimiento de la Ley 29733. En iOS es un diálogo del SISTEMA que se
  acepta con el pulgar sin leerlo, que es exactamente el fallo del que esa
  confirmación tiene que proteger. Ahora hay **cero `confirm()` en el admin**,
  verificado con grep.
- **happy-dom no oculta el contenido de un `<details>` cerrado**, así que RTL lo
  ve y un test puede pulsarlo. Es el mismo falso verde que la capa con
  `opacity: 0`: lo que se apila o se colapsa se prueba en Playwright.

**Responsive: la matriz entera, medida — `e2e/responsive-total.spec.ts`**
- **Nueve anchos × diez pantallas**, más zoom al 200% y móvil horizontal, más
  las capas abiertas (⌘K, hojas, visor), más «nada se sale de su tarjeta». El
  test **nombra el elemento** que desborda con su clase y sus coordenadas: sin
  eso el fallo dice «desborda» y hay que ir componente por componente.
  Complementa a `responsive.spec.ts`, que cubre casos concretos ya conocidos.
- **Una decoración `absolute` que se sale mete scroll horizontal en TODA la
  pantalla.** La luz ambiente es un círculo de 640px colocado con `-right-32`:
  a 1024px se salía 104px y desbordaba las tres pantallas. Va dentro de un
  recortador `absolute inset-0 overflow-hidden` (`components/shared/luz-ambiente`),
  **no** con `overflow-hidden` en el contenedor de la pantalla — eso rompería
  el `position: sticky` de la barra de guardar.
- **`-mx-4` dentro de una columna de grilla la hace 32px más ancha que su
  columna**, y eso desborda la pantalla. El sangrado a los bordes solo vale
  donde el padre tiene el `px-4` que lo compensa: bajo `lg` sí, dentro de la
  grilla de dos columnas no.
- **`overflow-x: auto` obliga a `overflow-y` a no ser `visible`** (CSS Overflow
  §3), así que una fila de 44px en una caja de 44px saca **una barra vertical de
  dos píxeles** que no scrollea nada. `overflow-y: hidden` no lo arregla —la
  spec lo recalcula—: se quita la BARRA con `@utility sin-barra`
  (`scrollbar-width: none` + `::-webkit-scrollbar`), nunca el scroll. Solo donde
  el contenido cabe o se desliza con el dedo.
- **El zoom al 200% no cambia las media queries.** `sm:` sigue casando a 768px
  mientras el sitio real es la mitad, así que `sm:flex-none` en la cabecera de
  Galerías dejaba al buscador y al botón sumando 786px dentro de 768. Un grupo
  en una cabecera va `flex-1 min-w-0` con `basis-*`, nunca `flex-none`.
- **`e.key` NO siempre es una cadena.** El autorrelleno, el teclado predictivo
  de iOS y algunas extensiones despachan `keydown` sin `key`, y un
  `e.key.toLowerCase()` en un listener GLOBAL se lleva la página entera. El
  tipo de TypeScript dice `string`; el navegador no lo garantiza.
- **Un recuento se toma cuando la lista está QUIETA.** El test de cancelar una
  subida comparaba contra un `count()` tomado nada más abrir la galería, y los
  tests de arriba del mismo fichero suben reels de verdad a ESA galería: su
  `confirm` seguía en vuelo y el número cambiaba después de medirlo. Fallaba una
  de cada tres y **no era un timeout corto** —subírselo no lo arregló—: era
  medir mientras el dato se movía. `recuentoEstable()` en `e2e/apoyo.ts` lee
  hasta que dos lecturas seguidas coinciden.
- **Medir o capturar espera a que acaben las animaciones, saltándose las
  INFINITAS**: `animation.finished` de una que no acaba nunca no resuelve nunca,
  y el test agota el timeout con un fallo que parece del test. `esperarAnimaciones`
  en `e2e/apoyo.ts`. Y se espera al CONTENIDO, no al `h1`: el titular se pinta
  con el skeleton puesto y las animaciones arrancan cuando llegan los datos.
- **`locator.click()` hace scroll-into-view ANTES de pulsar**, así que cualquier medida
  de «¿se movió la página al pulsar esto?» está midiendo el desplazamiento del propio
  Playwright. Dio **−450 px constantes en cuatro anchos distintos** al abrir el menú de
  la landing —tan estable que parecía un fallo real— y con `mouse.click()` sobre las
  coordenadas del botón el desplazamiento es cero. Lo que se mide con un clic sintético
  se confirma con uno por coordenadas antes de tocar código.
- **Un alto fijo ESCONDE que el texto se parte dentro.** Las entradas del menú de
  escritorio son `h-12`, así que el ancla se queda en 48px mientras el
  `overflow-wrap: anywhere` del `body` **rompe la palabra dentro de la caja**: con seis
  entradas y el número de teléfono, a 1280 salía «Trabaj / os» y «Testimoni / os» y el
  `scrollWidth` no se movía un píxel. Ningún test de desbordes lo ve, y en una captura
  es lo primero que salta. Se mide con `Range.getClientRects().length > 1` sobre el nodo
  de TEXTO, no con la caja del elemento — y **después de `document.fonts.ready`**, porque
  con la fuente sin cargar el texto mide menos y el fallo desaparece.
- **`fullPage: true` miente con `min-h-dvh`**: Playwright agranda el viewport a
  la altura del contenido, `dvh` crece con él y la página se estira sola. Las
  capturas de móvil van sin `fullPage`, con un tiro arriba y otro abajo.

**Un fallo de RED no puede cerrar la sesión — y «Error interno» no es una respuesta**
- `refrescar()` hacía `fetch` sin `try/catch` y trataba cualquier `!res.ok` como
  «el refresh no vale». Con la API caída o devolviendo un 5xx, la pasarela
  **borraba la cookie** y James veía «Tu sesión caducó» con un refresh token
  perfectamente bueno de 30 días. Un corte de red le pedía la contraseña.
- Ahora `refrescar()` devuelve **tres** resultados, y la diferencia decide si se
  borra la cookie: `SESSION_EXPIRED`/`SESSION_REVOKED` es **la API diciendo que
  no** (4xx, y solo 4xx); `SIN_RESPUESTA` es **no haber podido preguntar** —red
  caída, 5xx, timeout— y ahí la sesión NO se toca. Con cuatro tests, y
  comprobado que fallan con el código de antes.
- **`P1001` es 503, no 500**, y lo mismo `P1002` y `P2024`. Un 500 dice «error
  interno» y no invita a reintentar; un 503 es temporal por definición. No es
  hipotético: en local es Docker cerrado y en producción **el arranque en frío
  de Neon**, que es el único cuello real del proyecto — con «Error interno» la
  primera visita del día parecía un fallo de código.
- El síntoma de Docker cerrado es inconfundible: **`P1001 · DatabaseNotReachable
  · 127.0.0.1:5433`**. No hay nada que arreglar en el código; hay que abrir
  Docker Desktop en Windows. `docker` deja de existir en la WSL cuando se cierra.

**La pasarela DEBE capturar el fallo de red: si no, un 500 mudo**
- Si la API no contesta —no está levantada, se reinicia, o vence el timeout— el
  `fetch` de `pasarela.ts` **lanza**, y sin `try/catch` Next devuelve un **500
  con el cuerpo vacío**. El cliente del admin espera el sobre y solo puede
  decir «respuesta no válida del servidor», que no explica nada y hace pensar
  que el fallo es del dato que mandaste.
- Ahora devuelve el sobre con **504 si venció el tiempo y 502 si no había nadie
  al otro lado**, y un mensaje que dice qué hacer. Los dos son ≥500, así que
  `isRetryable` deja que TanStack Query lo reintente solo: si la API estaba
  arrancando, la pantalla se arregla sin tocar nada. Con tres tests.
- El síntoma en desarrollo es inconfundible: **`/api/...` da 500 sin cuerpo y la
  API del 3000 no responde**. No es un fallo del admin, es que falta levantarla.

**El autorrelleno del navegador TAPA la línea de ayuda**
- En Configuración proponía «James Films / James Film» justo encima del hint que
  dice dónde sale el campo. Y no tiene nada útil que sugerir: **no son los datos
  de quien rellena, es el contenido de la web**. `autoComplete="off"` más
  `data-1p-ignore` y `data-lpignore`, que son lo que respetan 1Password y
  LastPass — ellos ignoran el `autocomplete`.

**Un componente con un botón «Quitar» tiene que saber que lo han pulsado**
- `CampoImagen` hacía `previa ?? valorUrl`: al pulsar «Quitar» ponía `previa` a
  `null` y **la miniatura volvía a salir**, porque caía otra vez en el
  `valorUrl` del padre — que no cambia hasta guardar y refetchear. Cada
  pantalla lo apañaba por su cuenta con un `xKey === null ? null : url`, y
  **seis de las nueve se olvidaron**: testimonios, categorías, paquetes y el
  hero tenían el botón roto.
- Ahora el estado interno tiene **tres** valores: `undefined` (nadie tocó nada
  → manda `valorUrl`), `string` (recién subido) y `null` (quitado). El `null`
  es justo lo que un `??` no puede distinguir de «no hay nada». Con eso, los
  consumidores pasan `valorUrl` a secas y no hay dos verdades.
- Regla: **si un componente ofrece la acción, el componente sostiene su
  resultado.** Repartir esa lógica entre nueve llamadas garantiza que alguna se
  quede atrás. Con test, y comprobado que el test falla si se vuelve al `??`.

**Avisar al padre DURANTE el render es un `setState` en render — React lo grita**
- `Marco` hacía `if (isDirty) onSucio(true)` en su propio render, y `onSucio`
  era un `setState` de `PanelConfiguracion`: «Cannot update a component while
  rendering a different component». Saltaba al teclear en cualquier pestaña.
- El arreglo NO es envolverlo en un efecto y ya: **el panel no se pinta distinto
  según ese valor**, solo lo consulta al pulsar otra pestaña. Un `useState` ahí
  re-renderizaba las cinco pestañas y el formulario entero en la primera tecla,
  para nada. Va en un **`useRef`** con un `useCallback` estable, y `Marco` avisa
  en un `useEffect`. Con el ref, el fallo deja de ser posible por diseño.
- **No dejé el test que escribí para cazarlo**: con el padre en un ref no hay
  `setState` que disparar, así que pasaba igual con y sin el fallo. Un test que
  no distingue las dos versiones es peor que ninguno.
- **nuqs NO escucha `replaceState`**: guarda el estado en un emisor del módulo,
  así que resetear la URL en el `beforeEach` no devuelve la pestaña a su sitio y
  el test que acababa en SEO dejaba al siguiente empezando ahí. Los tests
  **abren la pestaña** que necesitan en vez de darla por hecha.

**El `prefetch` del login ENVENENABA la caché del router — bucle de login**
- `formulario-login.tsx` precargaba el destino mientras James escribía. Sin
  sesión, `/` responde **307 a `/login?desde=/`**, y eso es lo que quedaba
  cacheado en el Router Cache de Next. Al acertar la contraseña,
  `router.replace('/')` reusaba esa entrada y **volvía al login con la sesión ya
  creada**. No precargaba nada útil: lo que guardaba era la redirección.
- Era una **carrera**: se ganaba o se perdía según lo rápido que llegara el 307,
  y por eso pasó meses sin dar la cara. Empezó a fallar siempre al añadir los
  recuentos del menú, que retrasan la primera carga lo justo.
- **Nunca se precarga una ruta protegida desde una pantalla sin sesión.** Y
  `router.refresh()` va **ANTES** de `router.replace()`: al revés navega con la
  caché de cuando no había sesión. Con dos tests: uno de que NO se precarga y
  otro del orden de las dos llamadas.

**Configuración y Testimonios — el hueco se llena con la previa, no con aire**
- **Cada pestaña de Configuración enseña DÓNDE acaba lo que edita.** Identidad,
  Contacto y Hero → el hero en marco de móvil. Diferenciadores → la tira como
  sale bajo el hero. **SEO → el resultado de Google y la tarjeta de WhatsApp al
  pegar el enlace.** Eso es lo que resuelve el «espacio enorme» de las pestañas
  cortas: no es relleno, es el efecto de lo que estás escribiendo. Y hace la
  navegación intuitiva — nunca hay que adivinar dónde sale un campo.
- **Las previas usan la paleta de SU destino, no la del admin**: la landing
  (`void #0A0908`) en el hero y los diferenciadores, el azul de Google y el
  verde `#d9fdd3` de la burbuja de WhatsApp en SEO. Reconocerlo ES el punto; en
  gris y latón no se parecería a lo que va a ver el cliente.
- **`Campo` lleva `ayuda`, y va DEBAJO del input.** La etiqueta dice qué es; la
  ayuda dice dónde sale y para qué sirve — sin ella «Frase corta» y «Eslogan»
  son dos cajas indistinguibles, y James no tiene a quién preguntar. Encima
  empujaría el campo y se leería antes que la etiqueta.
- **Contador de caracteres en el SEO, que avisa y no bloquea**: Google recorta
  por ANCHO, no por caracteres, así que el número es una guía. Sin él, un
  título de 120 caracteres se ve a medias sin saber por qué.
- **Dos campos cortos van en una fila, no apilados**, y las imágenes también:
  dos cajas 3:1 a ancho completo se comían más alto que todos los campos juntos.
- **Testimonios: UNA acción visible, la que toca ahora.** Tenía siete controles
  con texto en el pie —dos flechas, consentimiento, publicar, destacar, editar,
  borrar— y se leía como una barra de herramientas. Ahora: primaria según el
  estado (`Dio su permiso` → `Publicar` → `Despublicar`), estrella y `⋯`. Tener
  las tres a la vez obligaba a mirar cuál estaba deshabilitada para saber en qué
  estado estabas.
- **`auto-fill`, no `auto-fit`, donde puede haber UNA tarjeta.** `auto-fit`
  colapsa las pistas vacías y estira esa única tarjeta a todo el ancho: en
  Testimonios eso convertía una captura 3:4 en 1500px de alto. `auto-fill`
  conserva las pistas. Y toda imagen dentro de una tarjeta lleva **techo de
  alto** además de proporción.

**La landing — lo aprendido cerrando la fase 5**
- **Un enlace que el build EMITE no es una página que el build GENERE.** Las cinco tarjetas de
  categoría apuntaban a `/bodas`, `/xv-anos`… y ninguna de esas páginas existía: cinco 404 en la
  portada, con el typecheck, el build y 56 tests en verde. No lo ve nada que mire el código; se
  ve comparando los `href` del HTML construido con `dist/`. Lo hace `e2e/enlaces.spec.ts`, y es
  el primer test que hay que escribir al añadir una plantilla nueva.
- **Una tarjeta solo se pinta si su destino existe.** La portada filtra las categorías sin
  trabajos, porque `[categoria].astro` tampoco las genera: pintarla sería un 404 con forma de
  tarjeta bonita. La regla general — **quien enlaza comprueba que hay adónde ir**.
- **Un `<h1>` por página, y el hero lo tenía DUPLICADO.** El bloque de móvil y el de escritorio
  eran dos, cada uno oculto en el ancho del otro: a ojo nunca se veían los dos a la vez, pero un
  rastreador y un lector de pantalla ven el documento entero. Un solo bloque con clases `lg:`.
- **El cuerpo son 17 px y el objetivo táctil son 48, no 44.** El alto casi nunca falla; **el
  ancho sí**: los días del calendario medían 42 px a 390 px porque una rejilla de siete columnas
  reparte lo que queda tras el `padding` y el `gap`. Se mide el ancho, no solo el alto.
- **Sacar un color con una expresión regular está MAL.** Tailwind 4 sirve `bg-void/90` como
  `oklab(0.985 -0.00005 0.004 / 0.9)`: leído como RGB 0-255 da casi negro, y el test de
  contraste acusaba de 1.04:1 a una barra blanca. Se pinta sobre blanco y sobre negro en un
  canvas y se despeja el color y su alfa — exacto para oklab, `color()`, lab, y lo que venga.
  ⚠ **`apps/admin/e2e/responsive-total.spec.ts` tiene el mismo fallo y sigue sin arreglar.**
- **`background-color` NO ve un degradado.** Un `linear-gradient` es una `background-image`, así
  que el fondo real del panel de cierre era invisible para el test, que creía ver el `body`
  blanco detrás. Se extraen las paradas del degradado y manda **la peor**.
- **Lo que un ancestro RECORTA no desborda la página.** El aura del hero mide 720 px dentro de su
  `overflow-hidden`. Sin esa comprobación el test acusa a lo que está bien mientras el scroll
  horizontal real está en cero — y ese cero es la señal de que el equivocado es el test.
- **`[hidden]` no gana solo**: la regla es del navegador y cualquier `display: flex` de Tailwind
  la pisa, así que `el.hidden = true` deja el elemento a la vista **sin que nada falle**. Hay un
  `[hidden] { display: none !important }` en `global.css`.
- **Un comentario `{/* … */}` DENTRO de la lista de atributos de un componente Astro
  compila y luego revienta `astro check`.** `pnpm build` lo acepta —el compilador de Astro
  lo tolera— y `astro check` lo lee como JSX y lanza `Unterminated string literal` en la
  línea del `</Layout>`, o sea **a decenas de líneas del error real**. Pasó tres veces en
  una sesión: en `<Layout>`, en `<Calendario>` y en un `<a>` del pie. El comentario va
  SIEMPRE encima de la etiqueta, nunca entre sus atributos. Y ojo con el síntoma: si el
  build pasa y el typecheck falla señalando una etiqueta de cierre, busca el comentario.
- **La landing tiene su propio Playwright** (`apps/web/e2e`), no cuelga del admin: aquel apunta
  al 3001 y arranca con sesión. Se prueba `dist/` con `astro preview`, **nunca `astro dev`**.
  Y ojo: **`astro preview` de Astro 7 daemoniza y vuelve**, así que Playwright lo lee como «el
  servidor murió al empezar» y el error no nombra ni a Astro ni al puerto; el comando acaba en
  un proceso de espera. Si se cuelga, `astro preview stop` — matar el pid deja vivo el registro
  del demonio y el siguiente arranque se niega a levantar.
- **Un `astro preview` propio en OTRO puerto también rompe la suite**, y el fallo no se
  parece a su causa: el demonio de Astro es uno solo, así que levantar un preview en el
  4322 para mirar algo mientras Playwright levanta el suyo en el 4321 deja a los dos
  peleándose por el mismo registro. El síntoma fue **20 tests rojos repartidos por seis
  ficheros** que pasaban de uno en uno, y otra vez `Timed out waiting for
  config.webServer`. Antes de lanzar la suite: `ss -ltnp | grep -E '432[12]'` tiene que
  no devolver nada. Y `astro preview stop` para UNO por llamada — con dos vivos hay que
  llamarlo dos veces o matar el pid que quede.
- **Un `astro dev` en el 4321 hace que la suite pase probando OTRA COSA, y sin decirlo.** Con
  `reuseExistingServer` en local, Playwright ve el puerto ocupado, **no construye** y lanza los
  49 tests contra el servidor de desarrollo: otro pipeline, y con los datos EN VIVO de la API en
  vez de los del build. El síntoma es absurdo y por eso despista —una galería que la lista
  enlaza y que da 404, porque el dev la resuelve al vuelo mientras `dist/` ni la tiene—, y el
  resto de la suite sale verde sin haber tocado el código que acabas de escribir. Antes de medir
  o de dar una suite por buena: `ss -ltnp | grep 4321`. Y `astro dev stop` no siempre lo mata
  —si el registro del demonio se perdió dice «No dev server is running» con el proceso vivo—,
  así que ahí sí toca `kill` del pid que nombre `ss`.
- **`qs` y `mysql2` van forzados** en `overrides`. El primero SÍ está en el camino de una
  petición —parsea la query string de Express— y el segundo no se carga nunca aquí, pero acaba
  en el árbol de `pnpm deploy --prod`. Con ellos, `pnpm audit` da cero.

**Estabilidad — nada deprecado, nada experimental**
- **Ninguna API deprecada.** Si TypeScript, el linter o el runtime avisan de una deprecación,
  se arregla; **nunca se silencia** con un `eslint-disable` ni con `@ts-ignore`.
  Forzado por **`@typescript-eslint/no-deprecated: 'error'`** en las tres apps, no por memoria.
- **Nada en `preview`, `experimental` o `canary`** en código que llega a producción. Si una
  feature solo existe tras un flag experimental, no se usa: se resuelve de otra forma.
- **`latest` en npm no significa estable.** Prisma publica release candidates bajo ese dist-tag:
  `pnpm add prisma` traía `8.0.0-rc.12` y con él un árbol entero (`@prisma/composer` → `alchemy`
  → `workerd`). **Comprueba `npm view <pkg> dist-tags` y fija la versión estable a mano.**
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

**Linting: oxlint, no ESLint**
- NestJS 12 trae **oxlint**. Las reglas type-aware (`no-deprecated`, `no-floating-promises`)
  necesitan el paquete **`oxlint-tsgolint`** y el flag **`--type-aware`** en el script de lint.
  Sin cualquiera de los dos **no fallan, simplemente no existen**.
- **`typescript/consistent-type-imports` está DESACTIVADA en `apps/api`**, y no debe reactivarse.
  NestJS resuelve la inyección por `emitDecoratorMetadata`, que necesita la referencia en runtime:
  con `import type` el arranque falla con `UnknownDependenciesException`. **Ni el typecheck ni los
  tests unitarios lo detectan** —estos construyen los servicios a mano— así que el linter te pide
  un cambio que rompe producción y nada te avisa. Verificado, no supuesto. Sigue activa en
  `apps/admin` y `apps/web`, que no tienen DI.
- **El fichero de config es `.oxlintrc.json`.** oxlint **no autodescubre `oxlint.json`** — que es
  justo el nombre que genera el scaffold de NestJS, así que sus reglas nunca se aplican. Si ves
  un `oxlint.json` en el repo, está muerto: bórralo.
- Reglas activas en `apps/api`: `no-deprecated`, `no-floating-promises`, `consistent-type-imports`.
  En `apps/admin` y `apps/web` se añade `no-restricted-imports` (la frontera arquitectónica).
- `src/generated/**` va en `ignorePatterns`.

**Commits: conventional, en inglés, asunto ≤100**
- `commitlint.config.mjs` con `@commitlint/config-conventional`. Asunto, líneas de cuerpo y
  de pie, todo a **100**. `scope-enum` cerrado a `api · admin · web · contracts · deps · ci ·
  docs`: un ámbito con typo no agrupa nada al leer el historial.
- **Sin husky.** `prepare` apunta `core.hooksPath` a `.githooks/` y pnpm lo ejecuta al
  instalar. Una dependencia menos para lo que hace una línea de config.
- El cuerpo se mide **por línea**, no entero: un commit largo está bien mientras ninguna
  línea pase de 100. Es lo que permite explicar el *porqué*, que es para lo que sirven.

**Testing: Vitest, no Jest**
- NestJS 12 trae **Vitest 4**. Sustituye a Jest en §15, y de paso unifica: §15 ya quería Vitest
  para el admin, así que ahora todo el repo usa el mismo runner.
- **Playwright para E2E**, en `apps/admin/e2e`, solo en `main` (levanta API y admin). Los fixtures
  `reel.mp4`, `reel-hevc.mp4`, `reel.mov`, `reel-hevc.mov` y `reel-hevc-sin-faststart.mov` se
  generaron con ffmpeg y están commiteados: entre 41 y 212 KB. Los `.mov` llevan marca `ftyp qt`
  como los del iPhone; el último pesa 212 KB **a propósito**, porque por debajo de los 64 KB de la
  ventana el archivo se lee entero de una vez y la rama que lo justifica no se ejecutaría.
  `faststart.fixtures.nodo.spec.ts` valida el parser contra ELLOS y no contra cajas fabricadas por
  el propio test — una cabecera inventada solo demuestra que el parser lee lo que el test escribe.
- **El aviso del Chromium empaquetado vale para CÓDECS, no para contenedores.** Trae su propio
  bundle de ffmpeg, así que decodifica cosas que el Chrome del visitante quizá no — por eso una
  medida de HEVC hecha ahí no sirve de nada. Demultiplexar un `.mov` sí es código del navegador y
  no depende del hardware: esa medida sí es representativa, y es la que abrió la puerta a aceptar
  QuickTime.
- **El Chromium empaquetado SÍ decodifica H.264** (`canPlayType` → `probably` en Playwright 1.62;
  trae su propio bundle de ffmpeg). El spec de subida se salta comprobando la **capacidad**, no el
  canal. `channel: 'chrome'` sigue siendo el defecto —es lo más parecido a lo que usa James— con
  `PW_CANAL=chromium` para máquinas donde no se pueda instalar Chrome, que pide root.
- **Si ya tienes la API corriendo, el E2E la REUSA** (`reuseExistingServer`) y su
  `RATE_LIMIT_ENABLED=false` no se aplica: a la tercera ejecución seguida, el login empieza a
  devolver «demasiados intentos» y parece un fallo de credenciales. Mata el proceso del 3000 y
  deja que Playwright lo levante.
  **Y no se sondea el endpoint para ver si la ventana ya se abrió**: cada sondeo consume uno de
  los cinco intentos, así que el sondeo es lo que impide que se abra. Se espera 70 s sin tocarlo.
  El síntoma es inconfundible en el `error-context.md` que deja Playwright: el login pinta
  «Demasiados intentos» con la cuenta atrás.
- **Y si tienes un `next dev` en el 3001**, Next inyecta su botón de dev tools (32 px) y el test
  de objetivos táctiles falla. Está filtrado por `closest('nextjs-portal')`, pero conviene
  saberlo: un test que pasa o falla según qué tengas abierto es peor que no tenerlo.
- **El E2E entra UNA vez** y reutiliza la sesión con `storageState`. El login limita a 5 intentos
  por minuto, y hace bien: sin esto la suite se autobloquea y el fallo parece de credenciales.
- **Un test verde a la primera y rojo a la tercera cuenta filas que nadie borra.** El de «las
  más pedidas» sembraba 3 clics y afirmaba `count: 3`: a la tercera corrida seguida decía **9**,
  porque el `beforeEach` limpiaba `busyDay` y no `whatsappClick`. Se borra **por `source`**, como
  el resto de specs, no la tabla entera — los ficheros van en serie, pero un `deleteMany()` a
  pelo se lleva por delante lo que siembre otro. Regla: **quien siembra, limpia lo suyo**, y una
  afirmación sobre un contador absoluto solo vale si la tabla arranca vacía.
- **Un test NUNCA redeclara la forma de un DTO.** `dashboard.integration.spec.ts` llevaba un
  `interface Panel` copiado a mano de la fase 4, así que al añadir `bySource` y `saturdays` el
  test los leía en runtime —y pasaba— mientras el typecheck decía que no existían. Con
  `DashboardDto` importado de `packages/contracts`, un campo que la API mueva mueve el test o no
  compila. Es la misma regla que ya rige en el admin, aplicada a los tests de la API.
- **Un número escrito a mano en un test es una afirmación sobre los DATOS, no sobre el código.**
  «enseña las CINCO entradas» del menú móvil pasaba a rojo cada vez que James despublicaba la
  última galería: la portada esconde «Trabajos» sin galerías y «Testimonios» sin ninguno con
  permiso, así que el menú tiene cuatro entradas o seis según el día. Lo que hay que afirmar es
  el **invariante** —todas las que se pintan se ven de una vez, sin scroll y sin desvanecer—,
  que es lo que el test existía para proteger.

**Prisma 7 — cuatro cosas que cambiaron respecto a lo que describe §13 y §16**
- Generador **`prisma-client`** (no `prisma-client-js`), con salida a **`apps/api/src/generated/prisma`**.
  Está en `.gitignore`: **el CI tiene que correr `prisma generate` antes de typecheck y tests.**
- Se importa de **`../generated/prisma/client.js`**, nunca de `@prisma/client`.
- **El cliente exige un driver adapter**: `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`.
  Ya no lee `DATABASE_URL` por su cuenta.
- **`directUrl` ya no existe.** La conexión de migraciones vive en `prisma7.config.ts`, cuyo
  `datasource` solo acepta `url` y `shadowDatabaseUrl`. El reparto queda invertido respecto a §16:
  **`prisma7.config.ts` → `DIRECT_URL`** (migraciones, conexión directa, en Neon sin `-pooler`) y
  **`PrismaService` → `DATABASE_URL`** (runtime, en Neon con `-pooler`).
- `prisma7.config.ts` carga el `.env` de la raíz él mismo con `override: false`, así que los
  comandos de Prisma **no** necesitan `dotenv-cli`. Solo se usa para apuntar los tests a
  `jamesfilm_test`, donde la variable ya presente en el entorno gana.

**Seguridad
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
| Pantallas del admin | **Nueve**: las siete del doc, el Panel (`/panel`) y Disponibilidad (`/disponibilidad`) | §9 y §21 dicen "siete" |
| Exposición de la API | **Es accesible desde internet** (build de Astro + `/track/whatsapp`). Por eso hay throttler global y los controllers públicos filtran siempre | §4 dice "la API no queda expuesta al público" |
| Por qué no Vercel | Porque el **debounce de 60s del `DeployService` necesita un proceso vivo**. En serverless cada invocación es un proceso nuevo y el debounce no existe | §2 lo funda en BullMQ/ffmpeg, ambos fuera del v1 |
| Quién dispara el deploy | **NestJS** | El diagrama de §4 lo dibuja en el admin |
| `accentColor` | Se guarda y se edita, **la web no lo consume en v1** | §8 lo describe como funcional |
| Categorías del v1 | **Bodas · XV Años · Cumpleaños · Eventos** (4) | §1 lista "XV Años" y "Quinceañeras" por separado |
| Región | **`us-east-1` (Virginia)** para Neon y para el host de la API, la misma para ambos | §4 deja "Virginia o São Paulo" |
| Prefijos en R2 | `videos/` `photos/` `posters/` `screenshots/` `og/` **`covers/` `avatars/` `brand/`** `backups/`. Sin año en la ruta | §13 mezcla `media/2026/`, `fotos/`, `masters/` |
| Idempotency-Key | **No existe tabla.** `confirm` es idempotente por `WHERE status = PENDING`; el presign por `clientUploadId` | §17 lo declara convención global |
| Descartar avisos del dashboard | `localStorage` del admin, sin tabla | §9 no define persistencia |
| Repository pattern | **No se usa.** Servicios → `PrismaService` directo | §5 y §21 lo definen en detalle |
| Adaptadores de storage | **Uno solo**, S3-compatible con endpoint por env | §5 define `r2.adapter` + `s3.adapter` |
| Multipart >50MB | **No entra en la fase 3.** Se decide tras probar un aftermovie real en el iPhone de James por 4G | §10 lo da por hecho |
| Node y pnpm | **Node 24 LTS · pnpm 11.** Node 22 está en mantenimiento desde oct-2025 | §3 pinea Node 22 y pnpm 9.15.0 |
| `.npmrc` | **No existe.** pnpm 11 solo lee auth y registry de ahí; los ajustes van en `pnpm-workspace.yaml` | §3 pone la configuración en `.npmrc` |
| `node-linker=hoisted` | **No se usa** (ver arriba) | §3 lo declara obligatorio |
| Hash de contraseñas | **argon2id**, no bcrypt | El doc no lo especifica |
| Config de Tailwind | **Tailwind 4**: los tokens de §6 van en `@theme` dentro del CSS, no en `tailwind.config.ts` | §6 muestra sintaxis de Tailwind 3 |
| Linter | **oxlint** (+ `oxlint-tsgolint`), config en `.oxlintrc.json` | §3 configura ESLint con `eslint.config.js` |
| Test runner | **Vitest 4** en todo el repo | §15 usa Jest en el backend |
| Prisma | **7.10.0** con generador `prisma-client`, salida a `src/generated/`, driver adapter obligatorio | §13 asume `prisma-client-js` y `@prisma/client` |
| `directUrl` | **No existe en Prisma 7.** `prisma7.config.ts` usa `DIRECT_URL`; el runtime usa `DATABASE_URL` | §16 los pone al revés, en el `datasource` del schema |
| Módulos de `apps/api` | **ESM**: imports relativos con `.js` | El doc asume CommonJS |
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
  Un único cron diario limpia R2: `Media` con `deletedAt` >30 días, `PENDING` huérfanos >24h,
  y por último **las filas `Gallery` con `deletedAt` >30 días** — si no, su slug queda ocupado
  para siempre.
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
- **`@AdminController('ruta', { tag })`** = decorador compuesto: `@Controller` + `@ApiTags` +
  `@ApiBearerAuth` + **`@Roles('ADMIN')` por defecto**. Un solo sitio donde entrará el
  `TriggerDeployInterceptor` de la fase 6: con siete controllers de admin, es la diferencia
  entre un fichero y siete — y al que se le olvide **no fallará**, esa pantalla dejará de marcar
  cambios sin publicar y James verá «0 cambios» tras editar. §5
- **`RolesGuard` no protegía nada hasta que existió ese decorador**: está registrado como guard
  global desde la fase 2, pero devuelve `true` cuando no hay metadatos de `@Roles()` y **ningún
  controller los declaraba**. Cualquier usuario autenticado entraba en todo el admin. El rol se
  aplica ahora una vez por controller y no se puede olvidar.
- **El rol `EDITOR` está en el enum y NO está definido en el doc.** Nadie lo tiene y el seed no
  lo crea; queda cerrado por defecto hasta que signifique algo.
- `ValidationPipe` con `whitelist: true` + `forbidNonWhitelisted: true`. **Sin `enableImplicitConversion`**
  (`"false"` → `true`). `whitelist` es seguridad, no limpieza. §5
- Los DTOs de NestJS hacen `implements` de las interfaces de `packages/contracts`.
  **Si divergen, no compila.** Swagger se genera, no se mantiene.
- Env validada con Zod al arrancar. Si falta una variable, la app no levanta. §5
- **Contrato de respuesta** (tipos en `packages/contracts`):
  - **Los errores van siempre envueltos con `code`**, un `ErrorCode` de unión cerrada. El código
    es el contrato; el mensaje es para humanos y puede reescribirse sin romper a nadie. El admin
    hace `switch (error.code)`, nunca compara cadenas.
  - **Códigos de dominio, no solo genéricos.** `SESSION_EXPIRED` y `SESSION_REVOKED` son ambos
    401 pero piden reacciones distintas: el segundo es el reuso de refresh y debe decir "cerramos
    tu sesión por seguridad".
  - **`VALIDATION_FAILED` lleva `details: FieldError[]`** con `{ field, code, message }` y rutas
    con puntos (`items.0.text`). El admin llama a `setError(field)` sin parsear nada. Se consigue
    con `exceptionFactory` en el `ValidationPipe`.
  - **Sobre uniforme en TODA respuesta**: `{ success, code, data, meta?, timestamp }`.
    `ApiResponse<T>` es una unión discriminada por `success`, así que TypeScript estrecha solo.
    Lo aplica un `ResponseEnvelopeInterceptor` global, y `ApiDoc` lo refleja en el esquema **en un
    solo sitio** — sin los decoradores propios del Task 6 sería un cambio de cincuenta ficheros.
  - `PaginationMeta` conserva los nombres de `prisma-extension-pagination` (`totalCount`,
    `pageCount`) y añade **`pageSize`**. Con cero resultados: `pageCount: 0`, ambos `isFirst/isLast`
    en `true`, ambos vecinos en `null`.
  - **Paginación por offset**, no cursor: con decenas de galerías `skip/take` es correcto y deja
    saltar a una página concreta. Cursor queda como escape, no como pendiente.
  - **Un solo `AllExceptionsFilter` global**, no uno por tipo: con dos, un error no contemplado se
    escapa sin `code`. El mapa de Prisma vive dentro. En producción no salen stacks ni SQL.
- `AllExceptionsFilter`: P2002→409, P2025→404, P2003→400, con **mapa estático por código**
  como el de §5 del doc. **Nunca leer `err.meta.target`:** en Prisma 7 con driver adapter ya no
  existe (`meta = { driverAdapterError, table, modelName }`), y leerlo lanza un TypeError que
  convierte el 409 en un 500. El nombre del índice está en
  `meta.driverAdapterError.cause.constraint.index`, pero con mensaje genérico no hace falta.
- **Los controllers públicos filtran siempre** `isPublished: true`, `isActive: true`,
  `deletedAt: null`, **`hasConsent: true` en testimonios**, y solo devuelven `Media` con
  `status: READY`. Nunca aceptan un parámetro que lo desactive. Con test.
- **`Testimonial.isActive` nace en `false`.** Es el único `isActive` del schema que no arranca
  en `true`: con el default contrario, un testimonio recién creado sería publicable y **sin
  consentimiento**, que es justo lo que la Ley 29733 prohíbe (§19). Nace borrador, como
  `Gallery.isPublished`.
- **El slug se genera al crear y NO se regenera al renombrar.** James comparte links por WhatsApp
  veinte veces al día; regenerarlo los rompe todos en silencio. Editable a mano, con aviso.
- **El `exists()` que `SlugService.unique()` recibe para `Gallery` NO filtra `deletedAt`.**
  `Gallery_slug_key` no es un índice parcial: el slug de una galería con soft delete sigue
  ocupado. Si el sondeo filtrara `deletedAt: null` diría "libre" y el `create` reventaría con
  P2002. Es un sondeo contra un índice físico, no un repositorio: la regla general no aplica ahí.
  `Category` y `Package` no tienen soft delete, su `exists()` es el normal.
- **El build de Astro aborta con error ante cualquier respuesta no-2xx.** Un deploy fallido es
  mejor que uno vacío.
- Íconos (`Package.icon`, `Differentiator.icon`, `SocialLink.icon`): **lista cerrada de ~15 nombres
  lucide** en `copy.ts` con `<select>` en el admin. `astro-icon` no hace tree-shaking de nombres
  dinámicos, y un typo deja un hueco en la web. Fallback `?? 'link'`.
- Seed **idempotente**: `upsert` por clave natural. Se ejecuta en local, en cada branch de CI y
  en producción.
- **El seed CREA el estado inicial, no lo mantiene sincronizado: `update: {}` en todo el
  contenido.** Con el objeto entero en `update` —y corriendo también en producción— el siguiente
  despliegue le devolvía a James los precios, las redes, el `aboutText` y **el número de
  WhatsApp** a los valores del flyer. Sin error y sin log. Es el mismo principio que ya protegía
  la contraseña del usuario, extendido al contenido. `SEED_RESET=true` restaura los valores del
  flyer; es explícito, para local, y nunca va en el comando de producción. Con cinco tests.

**Fechas y zona horaria — sin librería**

- **Perú es UTC-5 fijo, sin horario de verano** (verificado: Lima da `GMT-05:00` en enero y en
  julio). Eso elimina de raíz la clase de problemas que justifica una librería de zonas horarias.
- **No se instala date-fns, dayjs, luxon ni moment.** Node 24 trae ICU completo y `Intl` cubre
  todo lo que este proyecto necesita. `Temporal` **todavía no está** en Node 24.20, así que no
  se usa. Cuando llegue, sustituye a los cálculos a mano, no a `Intl`.
  - Formato de fecha y hora → `Intl.DateTimeFormat`
  - "hace 3 días" del dashboard y la barra de publicación → `Intl.RelativeTimeFormat`
  - `S/ 300.00` desde céntimos → `Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })`
  - Aritmética de fechas ("hace 30 días") → una resta sobre `Date.now()`
- **`timeZone` SIEMPRE explícito.** Nunca dependas de la zona horaria del proceso: la máquina de
  desarrollo está en `America/Lima` y el contenedor de producción estará en UTC, así que el mismo
  código daría días distintos.
  - `eventDate` y todo lo que sea `@db.Date` → **`timeZone: 'UTC'`**. Es una fecha de calendario,
    no un instante. Formatearla en Lima resta 5 horas y muestra **el día anterior** (verificado:
    `2026-03-15` sale como "14 de marzo").
  - `createdAt`, `updatedAt` y demás instantes que ve James → **`timeZone: 'America/Lima'`**.
- Locale **`es-PE`** en todo lo que se muestra.
- **Los rangos del dashboard son ventanas móviles**, no días de calendario: "últimos 30 días" es
  `now - 30*86400e3`, no "desde el 1 de agosto en Lima". Así el cálculo no depende de la zona.
- `TZ=UTC` en el contenedor de la API (fase 6). Con la regla del `timeZone` explícito es
  redundante, pero hace determinista cualquier descuido.
- El helper de tiempos relativos vive en el **admin** (fase 4), no en la API: la API devuelve ISO.
  Son doce líneas y no necesitan más:
  ```ts
  const rtf = new Intl.RelativeTimeFormat('es-PE', { numeric: 'auto' });
  const UNIDADES = [['year', 31536000], ['month', 2592000], ['day', 86400],
                    ['hour', 3600], ['minute', 60], ['second', 1]] as const;

  export function relativo(fecha: string | Date, ahora = Date.now()): string {
    const s = Math.round((new Date(fecha).getTime() - ahora) / 1000);
    for (const [unidad, seg] of UNIDADES) {
      if (Math.abs(s) >= seg || unidad === 'second') return rtf.format(Math.round(s / seg), unidad);
    }
    return '';
  }
  ```
- En `apps/api` todo import relativo lleva `.js` (ESM). El cliente de Prisma se importa de
  `src/generated/prisma/client.js`.
- `Media.durationSec` es `Int`: `Math.round(video.duration)` en el cliente. `Media.orientation`
  se deriva de `width`/`height` en el `confirm`, no lo elige nadie a mano.
- `SiteSettings.aboutText` es Markdown y **solo usa negrita** (el resaltado dorado del flyer).
  Se renderiza en Astro **en build time**; no llega markdown sin procesar al navegador.
- Textos de sección no editables → `apps/web/src/content/copy.ts`. §8

---

## 6. Orden de construcción

**Principio: lo más incierto primero.** No empieces por la landing. §18

Planes: [fase 1 — base](docs/plans/2026-08-28-fase-1-base.md) ✅ ·
[fase 2 — API mínima](docs/plans/2026-08-28-fase-2-api-minima.md) ✅ ·
[fase 3 — editor de galería](docs/plans/2026-08-28-fase-3-editor-galeria.md) ✅ código
([revisión](docs/plans/2026-08-28-fase-3-revision.md)) ·
[fase 4 — resto del admin](docs/plans/2026-08-28-fase-4-resto-del-admin.md)

**`faststart` AVISA, no bloquea** (resuelto lo que la fase 3.5 dejaba abierto). HEVC sí bloquea,
**pero el motivo escrito aquí estaba caducado y el nuevo es otro** (corregido el 7-sep-2026): decía
«Chrome y Firefox no lo reproducen» y en 2026 los dos lo hacen —Chrome desde la 107 donde el
sistema aporta el decodificador, Firefox desde la 134/136/137—. Lo que sostiene el bloqueo hoy es
que **decodificar HEVC depende del hardware del visitante**: en Windows sin decodificador por
hardware falla, y Edge exige una extensión de pago de la Store. El que no puede reproducirlo no ve
un vídeo peor, **no ve nada**, y no pulsa el botón de WhatsApp — y eso no se mide desde aquí.
Frente a eso, el arreglo cuesta un tap: *Ajustes › Cámara › Formatos › «Más compatible»*, que **no
baja la calidad** (misma imagen, archivo más grande) y solo renuncia a 4K60, que este proyecto
reescala igual. Esa es también la línea que separa el HEVC del `.mov`: el contenedor lo
demultiplexa el navegador **siempre**, el códec no. Un MP4 sin faststart **se reproduce perfectamente**; lo único es que el primer play tarda
porque el navegador no puede empezar hasta tenerlo entero. Bloquearlo dejaba a James **sin salida**
cuando su editor no ofrece esa opción —y varios no la ofrecen—: cambiar un inconveniente por una
imposibilidad es peor negocio. El aviso se pinta en `ash`, nunca en rojo.

**Y un HEVC SIN faststart se colaba entero, que es el fallo que esto destapó.** El parser leía
solo los primeros 64 KB, y en un archivo sin faststart el `moov` está **al final**: el FourCC del
códec no cae en esa ventana, sale `desconocido`, y como solo se bloquea lo que se reconoce, el
vídeo se subía y acababa publicado. `inspeccionarMp4` lee ahora una **segunda ventana en la cola**,
y solo cuando la primera no encontró el códec — con faststart no llega a ejecutarse, y hay test que
lo comprueba contando las lecturas. Salió de un `IMG_*.MOV` real del iPhone: `ftyp → wide → mdat`
de 106 MB con el `moov` detrás. **Ninguna caja fabricada a mano lo habría enseñado**, porque todas
las de los tests traen el `moov` delante — es la misma razón por la que los fixtures son de ffmpeg.

**Un mensaje no afirma lo que no ha comprobado.** El primer intento decía «el vídeo de dentro está
bien: basta con cambiar el contenedor» sin haber identificado el códec, y en el archivo real de
James eso era mentira: había HEVC en 4K. Con el códec sin identificar se dice qué exportar y no se
promete nada.

**Los mensajes de error no nombran ninguna aplicación.** Decían «vuelve a exportarlo desde CapCut»
y James puede haber montado en Premiere, en DaVinci o en el propio iPhone: nombrar un producto que
no usa convierte «di qué hacer» en «busca una pantalla que no existe». Se nombra el AJUSTE —MP4,
H.264, 1080p, «inicio rápido»— y, cuando el ajuste puede no existir, se añade «si tu editor lo
ofrece». Hay test de que el mensaje dice qué hacer, no de que cite una marca.

**Pendiente la fase 3.5**: el [checklist del iPhone](docs/checklist-iphone.md), que decide
multipart y el suelo de iOS. Lo de faststart ya está resuelto arriba. No bloquea la fase 4.

| # | Fase | Duración |
|---|---|---|
| 1 | Base: monorepo, ESLint, Prettier, schema, migración, seed | ~1 día |
| 2 | API mínima: auth con tokens en el cuerpo, galerías, media con presign | ~3 días |
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
- **La versión de iOS de su iPhone.** Tres piezas de la fase 3 tienen suelos distintos:
  `AbortSignal.any` pide **Safari 17.4+** y lo usa el cliente HTTP en *todas* las peticiones;
  Wake Lock y `canvas.toBlob` piden 16.4+. Por debajo, el admin no falla al subir: falla en la
  **primera petición**, con un `TypeError` que no menciona la versión del sistema. Va en la
  sesión de 15 min que ya está pendiente.
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
