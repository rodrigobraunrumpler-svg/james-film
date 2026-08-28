# James Film — Documento técnico del proyecto

> Portafolio web + panel de administración para James Film, creador de contenido audiovisual.
> Última actualización: 28 de agosto de 2026

---

## 1. Contexto del negocio

**James no es fotógrafo. Es creador de contenido audiovisual.**

Esta distinción define toda la arquitectura. Su producto son **Reels y TikToks verticales (9:16)** más aftermovies cortos. Todos sus paquetes se venden por cantidad de reels, duración del aftermovie y velocidad de entrega. La fotografía no aparece como entregable en ninguno de los tres paquetes.

**Implicaciones directas:**

- El contenido de la web es **vertical**, no horizontal. Grilla tipo feed de TikTok, no carrusel de fotos apaisadas.
- Los videos deben hacer **autoplay silenciado** al entrar en viewport. Su trabajo es movimiento y ritmo; un poster estático no comunica lo que él vende.
- El CTA principal es **WhatsApp**, no un formulario de contacto.
- Identidad visual: negro profundo + dorado, con acentos de color por paquete (dorado / cyan / magenta).

**Categorías reales** (extraídas de los "Ideal para" del flyer):
Bodas · XV Años · Quinceañeras · Cumpleaños · Eventos pequeños

---

## 2. Stack

| Pieza | Tecnología | Dónde se despliega |
|---|---|---|
| Landing | Astro + Tailwind | Vercel o Cloudflare Pages (gratis) |
| Admin (frontend) | Next.js | Vercel (gratis) |
| API | NestJS | Host de contenedores (Railway / Render / Fly.io / VPS) |
| Base de datos | PostgreSQL + Prisma | **Neon** (serverless, ver §16) |
| Media | Cloudflare R2 | — |
| ~~Worker~~ | ~~BullMQ + ffmpeg~~ | **Descartado en v1** — ver §4 y §22 |
| ~~Redis~~ | ~~BullMQ~~ | **Descartado en v1** — sin worker no hace falta cola |
| Monorepo | pnpm workspaces | 3 apps, deploy independiente (§3) |

### Por qué PostgreSQL y no MongoDB

La intuición de "es contenido y textos, entonces Mongo" no aplica acá. Lo que hay es: una categoría tiene muchas galerías, una galería tiene muchos medios, un paquete tiene muchos ítems y muchas categorías. Es relacional puro, con esquema estable.

Donde MongoDB brilla es cuando cada documento tiene forma distinta. Todas las fotos y videos de James tienen exactamente los mismos campos.

Donde dolería concretamente: reordenar medios dentro de una galería con drag & drop, y borrar una categoría sin dejar galerías huérfanas. En Postgres son transacciones y `onDelete`. En Mongo lo escribes a mano, y ahí aparecen los bugs de datos inconsistentes.

*(Nota: Prisma soporta MongoDB también. La decisión nunca fue "Prisma vs Mongo".)*

### Por qué el backend no va en Vercel

NestJS se despliega en Vercel sin configuración, y Fluid Compute da hasta 300s de ejecución, así que el transcode de 2 minutos cabe en tiempo. Ese no es el problema.

El problema es que **un worker de BullMQ es un proceso que se queda vivo escuchando la cola**, y en Vercel no existe el "siempre encendido". Habría que reemplazar BullMQ por webhooks o colas gestionadas y reescribir esa capa. Sumado a empaquetar el binario de ffmpeg (~80 MB) contra el límite de bundle, no vale la pena.

Cloudflare Workers es peor: no corre binarios nativos, así que ffmpeg queda descartado de entrada.

### Por qué Cloudflare R2

Lo que hace caro al video no es guardarlo, es entregarlo. **En R2 el egress es $0/GB a cualquier volumen.** Un video que se ve 10.000 veces cuesta lo mismo que uno que nadie ve.

Free tier: 10 GB de almacenamiento, 1M operaciones Class A, 10M Class B — se renueva cada mes y no expira a los 12 meses como AWS. Después, $0.015 por GB-mes.

A 2 minutos por video **no hace falta HLS ni adaptive bitrate**. Un MP4 progresivo con `<video>` y range requests funciona perfecto. Eso es lo que permite saltarse Cloudflare Stream o Mux, que además no tienen plan gratuito.

**Costos proyectados** (reels de ~25 MB tras normalizar a 720p):

| Videos | Espacio | Costo/mes |
|---|---|---|
| ~400 | 10 GB | $0 |
| 1.000 | 25 GB | ~$0.22 |
| 5.000 | 125 GB | ~$1.72 |

**Para las imágenes**: R2 + Cloudflare Image Transformations ($0.50 por 1.000 transformaciones únicas al mes, con 5.000 gratis). Un solo proveedor, un solo bucket, una sola credencial.

R2 tampoco genera lock-in: al ser el egress $0, la API puede estar en Railway, Hetzner o AWS y mover archivos sigue costando cero.

---

---

## 3. Estructura del proyecto

**Monorepo con pnpm workspaces.**

```
james-film/
├── pnpm-workspace.yaml
├── package.json              # privado, solo scripts
├── .npmrc
├── docs/
│   └── proyecto.md           # este documento
├── apps/
│   ├── api/                  # NestJS + Prisma
│   ├── admin/                # Next.js
│   └── web/                  # Astro
└── packages/
    └── contracts/            # solo tipos compartidos
```

### Por qué monorepo

**Tres apps comparten un contrato.** El admin consume la API; la landing también. En multi-repo, cambiar un DTO obliga a publicar tipos a npm, versionar el paquete y actualizar dos consumidores. Acá es un import.

**Un solo desarrollador.** El argumento fuerte del multi-repo es aislar equipos con ciclos de release distintos. Con una persona son tres PRs para un cambio y tres historiales que no cuentan la misma historia.

**Un cambio que toca API y admin es un solo commit.** En tres repos son tres PRs y una ventana donde el contrato está roto.

**El código y este documento viven juntos.** Si vuelves en un año, abres una carpeta y está todo.

> **El monorepo no mezcla responsabilidades.** La separación sigue existiendo, por carpeta en vez de por repositorio: `apps/api` no importa nada de `apps/admin`, `apps/web` no toca Prisma. Los límites que ya definimos — repository pattern, controllers públicos vs admin, `StorageService` tras su interfaz — siguen igual de vigentes.

### Por qué pnpm y no npm

Su `node_modules` es estricto: si `apps/web` usa un paquete que no declaró, falla. Con npm funciona por accidente hasta que un día no.

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

```json
// package.json (raíz)
{
  "name": "james-film",
  "private": true,
  "scripts": {
    "dev:api":   "pnpm --filter api dev",
    "dev:admin": "pnpm --filter admin dev",
    "dev:web":   "pnpm --filter web dev"
  }
}
```

```json
// apps/admin/package.json
{
  "dependencies": {
    "@james-film/contracts": "workspace:*"
  }
}
```

### Sin Nx ni Turborepo

Con tres apps y un paquete, **pnpm workspaces basta**. Nx y Turborepo resuelven caché de builds y grafos de dependencias: problemas de veinte paquetes y CI de quince minutos. Meterlos ahora es configuración que pelear sin obtener nada.

### Los DTOs se escriben a mano

**No se reexportan los tipos de Prisma.** Es tentador (`import { Gallery } from '@prisma/client'`), pero acopla el frontend al esquema de base de datos.

```ts
// packages/contracts/src/index.ts
export type MediaType = 'REEL' | 'AFTERMOVIE' | 'PHOTO';

export interface GalleryDto {
  id: string;
  slug: string;
  title: string;
  media: MediaDto[];
}
```

El día que añadas una columna interna a `Media` (`claimedAt`, `attempts`, `error`), si el DTO se deriva del tipo de Prisma esa columna aparece en el contrato público sin que lo decidas. Escritos a mano, exponer algo es siempre un acto deliberado.

Son treinta líneas y dan la misma frontera que el repository pattern persigue en §5.

### Prisma vive solo en apps/api

**No lo muevas a `packages/`.** Solo la API habla con la base de datos. Si el cliente de Prisma es importable desde el admin, algún día alguien lo importa y se salta la API entera.

Es la única forma real de que el monorepo rompa la separación, y se evita no moviéndolo.

### Deploy: cada app por separado

Monorepo **no** significa deploy conjunto.

| App | Destino | Root directory |
|---|---|---|
| `apps/web` | Cloudflare Pages | `apps/web` |
| `apps/admin` | Vercel | `apps/admin` |
| `apps/api` | Railway / Render | `apps/api` (Dockerfile) |

**Configura los ignored build steps** o cada push a la API dispara también el build de la landing y el admin:

```bash
# Vercel · exit 0 = no construir
git diff HEAD^ HEAD --quiet ./ || exit 1
```

Molesta más de lo que parece.

### Dos gotchas de pnpm

**Prisma necesita `node-linker=hoisted`.** El store de enlaces simbólicos de pnpm rompe la generación del cliente, y el error no dice de qué va. Va en el `.npmrc` de la raíz (ver abajo).

**Render y Railway asumen npm.** Hay que indicarles pnpm explícitamente en el comando de build. Vercel y Cloudflare Pages lo detectan solos por el `pnpm-lock.yaml`.

### Versiones fijadas

El fallo clásico del monorepo: desarrollas en Node 22, Railway usa 20, Vercel 18. Algo funciona en local y revienta en producción sin explicación.

```json
// package.json (raíz)
{
  "packageManager": "pnpm@9.15.0",
  "engines": { "node": ">=22 <23", "pnpm": ">=9" }
}
```

```
// .nvmrc
22
```

```ini
# .npmrc
node-linker=hoisted
engine-strict=true
```

`packageManager` activa Corepack: quien clone el repo usa tu versión exacta de pnpm sin instalarla a mano. `engine-strict=true` hace que el install **falle** en vez de solo avisar.

Fija la misma versión en cada proveedor de deploy: Vercel y Cloudflare Pages leen `engines`, Railway y Render necesitan que se lo digas.

### ESLint: la arquitectura como regla, no como intención

Más arriba queda escrito que `apps/admin` no importa Prisma. Pero eso es una regla en un documento — un día lo importas sin pensar y funciona.

```js
// apps/admin/eslint.config.js y apps/web/eslint.config.js
rules: {
  'no-restricted-imports': ['error', {
    patterns: [{
      group: ['@prisma/client', '**/apps/api/**'],
      message: 'El frontend no habla con la base de datos. Usa @james-film/contracts.',
    }],
  }],
}
```

**Es la mejora que más protege el diseño**, porque convierte una intención en un error de lint. Sin ella, la separación depende de que te acuerdes cada vez.

Dos reglas más que valen la pena en `apps/api`:

```js
'@typescript-eslint/no-floating-promises': 'error',   // await olvidado en un servicio
'@typescript-eslint/consistent-type-imports': 'error', // import type, builds más limpios
```

El `no-floating-promises` es el que atrapa bugs reales: una promesa sin `await` en un servicio de NestJS falla en silencio.

### Prettier

Uno solo en la raíz, compartido por las tres apps. Formateo es de las cosas que no merecen una decisión por proyecto.

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

`prettier-plugin-tailwindcss` ordena las clases de Tailwind de forma canónica. En un proyecto con tanta clase utilitaria como esta landing, hace los diffs legibles.

**Prettier no discute con ESLint**: `eslint-config-prettier` desactiva las reglas de formato de ESLint y cada uno hace lo suyo.

> **Sin hooks de pre-commit.** Un hook que tarda 20 segundos acabas saltándotelo con `--no-verify`. El lint va en CI. Si acaso, `lint-staged` solo con Prettier, que es instantáneo.

### Cuándo me equivocaría


Si James contrata a alguien para el frontend, o si la landing acaba siendo un producto que vendes a otros fotógrafos. Ambas son separables después — extraer una app de un monorepo es una tarde. Lo difícil es lo contrario: unificar tres repos con historiales divergentes.

---

## 4. Arquitectura

```
┌─────────────┐         build time        ┌──────────────┐
│   Astro     │ ◄──────────────────────── │   NestJS     │
│  (landing)  │                           │    (API)     │
│  ESTÁTICA   │                           └──────┬───────┘
└─────────────┘                                  │
       ▲                                   ┌─────▼─────┐
       │ deploy hook                       │ Postgres  │
       │                                   └───────────┘
┌──────┴──────┐      REST/JSON
│  Next.js    │ ─────────────────────────────────┘
│   (admin)   │
└─────────────┘
       │
       │  1. valida en el navegador
       │  2. extrae poster + metadatos
       │  3. presigned PUT          ┌──────────────┐
       └───────────────────────────►│Cloudflare R2 │
                                    └──────────────┘
```

Tres servicios en total: API, base de datos y el bucket. Sin cola, sin worker, sin Redis.

### La landing no habla con la base de datos en producción

Astro consume la API **en build time**, genera HTML estático y listo. Cuando James publica una galería nueva desde el admin, NestJS dispara un deploy hook de Vercel/Cloudflare Pages y el sitio se reconstruye solo.

- La landing carga instantáneo
- No se puede tumbar con tráfico
- La API no queda expuesta al público
- Costo: una galería nueva tarda ~1 minuto en aparecer

Para alguien que publica un par de veces por semana, ese retraso es invisible.

### Calidad: máster vs entrega

**Son dos artefactos distintos y no hay que mezclarlos.**

- **El máster** es el archivo original en máxima calidad. Se guarda, no se sirve.
- **La entrega** es lo que descarga el visitante.

Los másters 4K viven en el disco de James. Si además quiere respaldarlos, van a `masters/` en R2 y **nunca se sirven** desde ahí.

**Que James edite en 4K está bien** — un 4K reducido a 1080p se ve mejor que un 1080p nativo, por sobremuestreo. Lo que cambia es el archivo que exporta para la web.

#### Por qué entregar 4K empeora la calidad percibida

**Nadie ve esos píxeles.** Un reel 9:16 a pantalla completa en un iPhone son ~430px CSS × 3 de densidad ≈ 1290px reales. Un 1080×1920 ya lo cubre con margen; el resto se descarta en el escalado.

**Y no se puede reproducir.** Un 4K a 45 Mbps necesita 45 Mbps sostenidos. En 4G en Ayacucho hay 15-25 con suerte. El visitante ve el video arrancar y frenar, y **eso se percibe como calidad mala, no buena**.

Lo que el visitante llama calidad es nitidez sin cortes.

#### Preset de exportación

| Ajuste | Valor |
|---|---|
| Resolución | 1080×1920 |
| Codec | H.264, perfil High |
| CRF | **20** (≈ 6 Mbps) |
| Audio | AAC 192 kbps |
| Formato | MP4 con `+faststart` |

**CRF 20, no 26.** Un CRF 26 es compresión agresiva y está mal para una marca que vende calidad audiovisual. En 20 la diferencia con el original es imperceptible.

**Pesos reales por tipo de archivo:**

| Archivo | Duración | Peso a 1080p CRF 20 |
|---|---|---|
| Reel | ~45 s | **~35 MB** |
| Aftermovie | ~2.5 min | ~115 MB |
| Foto (2560px, q90) | — | ~1 MB |

Los reels no duran 2 minutos: el flyer vende "7 Reels/TikToks", que son de 30-60 s. Solo el aftermovie llega a los minutos.

En CapCut esto se configura **una vez** y queda como preferencia. No es un ritual por video.

### Decisión: sin worker de ffmpeg (por ahora)

**James exporta con el preset y el admin valida.** El worker solo compraría una cosa: que no tenga que configurar bien su export. Todo lo demás ya está resuelto con la validación en el navegador.

Lo que costaría: ffmpeg en la imagen (+150 MB), más RAM durante el transcode, y con eso el host gratuito deja de alcanzar (~$5/mes). Más uno o dos días de desarrollo.

Está documentado en §22 para el día en que haga falta.

### Flujo de subida de media

```
1. El navegador valida el archivo   → formato, resolución, bitrate, faststart
2. Extrae poster + metadatos        → canvas del frame del medio
3. Admin pide URL firmada           → NestJS valida mime + tamaño ANTES de firmar
4. Cliente sube DIRECTO a R2        → nunca pasa por la API
5. Sube el poster                   → posters/{uuid}.webp
6. Admin confirma                   → POST /media/:id/confirm → status = READY
```

**Nunca subas archivos a través de la API de NestJS.** Un video de 200 MB bloquea el event loop y te obliga a escalar por un problema que no es tuyo.

### La validación

El test perfecto viene gratis: **si el navegador del admin no puede reproducirlo, el del visitante tampoco.**

```ts
const video = document.createElement("video");
video.preload = "metadata";
video.muted = true;
video.playsInline = true;
video.src = URL.createObjectURL(file);

await new Promise((ok, err) => {
  video.onloadedmetadata = ok;
  video.onerror = () => err(new Error("Formato no compatible. Exporta en MP4 / H.264."));
});

const ladoLargo = Math.max(video.videoWidth, video.videoHeight);
const mbps = (file.size * 8) / video.duration / 1_000_000;

if (ladoLargo > 2160) {
  throw new Error(
    `Este video es ${ladoLargo}p. Expórtalo a 1080p desde CapCut — ` +
    `el visitante no ve la diferencia y así carga al instante.`
  );
}
if (mbps > 15) {
  throw new Error(`Bitrate muy alto (${mbps.toFixed(1)} Mbps). Se va a trabar en datos móviles.`);
}
```

**Acepta hasta 2160p, rechaza por encima.** Un 4K de 2 min pesa ~700 MB pero *funciona*, solo carga lento. Bloquearlo del todo sería más rígido de lo necesario; el aviso de bitrate cubre el resto.

**La redacción del error importa tanto como la validación.** Un "Formato no válido" deja a James atascado; un mensaje que dice qué hacer lo resuelve solo. Cuesta lo mismo escribirlo bien.

#### Detectar faststart en el navegador

```ts
async function tieneFaststart(file: File) {
  const head = new Uint8Array(await file.slice(0, 65536).arrayBuffer());
  const txt = new TextDecoder('latin1').decode(head);
  const moov = txt.indexOf('moov');
  const mdat = txt.indexOf('mdat');
  return moov !== -1 && (mdat === -1 || moov < mdat);
}
```

Si `moov` no va antes que `mdat`, el navegador descarga el archivo entero antes del primer frame. Mejor avisar en el momento que descubrirlo en producción.

### Sin autoplay en la grilla

Con archivos de ~90 MB, doce reels autoplayeando serían más de un giga. **La grilla muestra posters estáticos**; el video carga solo al tocar.

**Un único video autoplayea: el del hero.** Un loop de 6 segundos a ~2 Mbps (≈1.5 MB), silenciado. Ese sí puede moverse solo.

Es un cambio respecto al planteamiento inicial y viene de priorizar calidad: sin ABR no se pueden tener las dos cosas.

### Fotos: sin compromiso

Acá no hay tensión.

- **Guarda el original completo** en `masters/`, intacto.
- **Entrega con Cloudflare Image Transformations**: AVIF al tamaño exacto de visualización.

```html
<img
  src="/cdn-cgi/image/width=800,format=auto,quality=88/fotos/xv-camila-01.jpg"
  srcset="/cdn-cgi/image/width=800,format=auto,quality=88/... 1x,
          /cdn-cgi/image/width=1600,format=auto,quality=88/... 2x"
  sizes="(max-width: 768px) 50vw, 25vw"
  width="1080" height="1620" loading="lazy">
```

AVIF a calidad 88 es indistinguible del original y pesa un quinto. El visitante ve la foto **más nítida** que si le sirvieras el JPEG original: en retina recibe el doble de densidad y además carga antes.

#### Nadie convierte a AVIF

Ni James ni tú. **Cloudflare lo genera al vuelo**, en el momento en que alguien pide la imagen:

```
James sube:   xv-camila-01.jpg  (JPEG, 2560px)
                    ↓
              se guarda en R2 sin tocar
                    ↓
Visitante con Chrome  → AVIF de 800px, ~45 KB
Visitante con Safari  → WebP
Navegador antiguo     → JPEG
```

`format=auto` decide leyendo el header `Accept`. No escribes ni un `if`.

Consecuencias:

- **No hay paso de conversión en el admin** para fotos: seleccionar, subir, listo.
- **No hay variantes almacenadas.** Guardas una imagen, no seis tamaños.
- **No hay nada que rehacer si cambia el diseño.** Si la grilla pasa de 4 a 3 columnas, cambias el `width=` en la URL y todas las fotos se re-sirven. Sin migración.

**La única conversión que sí hace el admin es HEIC → JPEG**, y no es por peso: **Cloudflare no procesa HEIC**. Si subes un HEIC las transformaciones fallan.

```ts
const esHeic = /image\/heic|heif/.test(file.type) || /\.heic$/i.test(file.name);
const aSubir = esHeic ? await convertirAJpeg(file) : file;
```

Convierte a **JPEG calidad 95**, no a WebP ni AVIF. Ese archivo es tu máster: va lo más limpio posible, y la compresión real la hace Cloudflare después. Comprimir dos veces degrada.

**Límite duro:** Cloudflare rechaza imágenes de más de 100 megapíxeles. Una cámara normal (24-50 MP) pasa sin problema, pero un panorama cosido puede superarlo. Validar y avisar en el admin.

### Acuerdo con James

**Cerrado.** Los másters 4K se quedan en su disco; a la web solo sube la entrega en 1080p.

- Exportar en **MP4 / H.264 a 1080p**, nunca HEVC ni 4K.
- **CRF 20** o el equivalente de "alta calidad" en su editor.
- **Fast Start** marcado en el export (Premiere). CapCut ya lo hace por defecto.
- En CapCut se configura **una vez** y queda como preferencia. No es un ritual por video.
- Su disco es el archivo maestro. R2 es la vitrina, no el respaldo de su trabajo.

Esto es lo que hace innecesario el worker de ffmpeg (§22) y lo que mantiene el proyecto dentro del free tier. El admin lo verifica en cada subida y rechaza con un mensaje que explica qué hacer, así que el acuerdo no depende de que él lo recuerde.

> **James necesita su propio respaldo.** R2 guarda las entregas en 1080p, no sus másters. Si se le muere el disco, ese material no está en ninguna parte. Conviene decírselo explícitamente — es su activo, no el nuestro.

### Costos reales

| | Free | Cuándo se paga |
|---|---|---|
| Cloudflare R2 | 10 GB/mes, egress $0 siempre | Pasado 10 GB: $0.015/GB |
| Cloudflare Images | 5.000 transformaciones/mes | Muy lejos del volumen real |
| Cloudflare Pages | Ilimitado para estático | — |
| Neon Postgres | 0,5 GB | Suficiente de sobra |
| Vercel (admin) | Hobby | — |
| Sentry, CF Analytics | Free tier | — |
| **Host de la API** | Render (se duerme a los 15 min) | **Railway / Fly ~$5/mes** |

**Un evento curado en la web** (3 reels + 1 aftermovie + 8 fotos) pesa **~230 MB**. Los 10 GB gratis son **~44 eventos**, unos nueve meses a cinco eventos al mes.

Pasado eso: 50 GB cuestan **$0.60/mes** — cuarenta eventos más de portafolio por menos que un café.

### Cómo no romper el free tier

**1. Los másters 4K no van a R2.** Es la única regla que de verdad importa: un máster son ~700 MB, veinte veces un reel entregado. Se quedan en el disco de James.

**2. Fotos redimensionadas a 2560px antes de subir.** El mismo canvas que convierte el HEIC, aplicado a todo. De 6 MB a ~1 MB, y 2560px sigue siendo más de lo que cualquier pantalla muestra.

**3. Tres anchos fijos en todo el sitio**: `400`, `800`, `1600`. Nada de un `width` distinto por componente, o las 5.000 transformaciones mensuales de Cloudflare se acercan sin necesidad.

**4. Curar, no volcar.** James no sube los 7 reels de cada evento a la web: sube 3. Un portafolio es curado, no un archivo. Tres reels buenos venden más que siete mediocres — el visitante ve dos y decide. Los otros cuatro son del cliente, por WhatsApp.

**Contador en el dashboard del admin:** "3.2 GB de 10 GB", sumando `sizeBytes` de la tabla `Media`. Es una query, no hace falta hablar con la API de R2. Verde hasta 7 GB, ámbar hasta 9, rojo después.

> **No optimices mucho por esto.** Las cuatro reglas valen la pena porque son gratis y además **mejoran el sitio**: un portafolio curado convierte más y las fotos ligeras cargan antes. Pero si algún día hay que elegir entre borrar trabajo de James o pagar sesenta centavos, se pagan los sesenta centavos. Nada de rotación automática ni borrado programado: es complejidad y riesgo de perder material para ahorrar cantidades que no mueven nada.

> **Despublicar, no borrar.** `isPublished = false` saca la galería de la web y conserva el archivo.

### Configuración de R2

- **Dominio propio, no `r2.dev`.** La URL pública de Cloudflare está rate-limited y no es para producción. Conecta `media.jamesfilm.com` al bucket: así la CDN queda delante y los range requests del reproductor pegan en caché.
- **Límite de `Content-Length` al firmar.** Sin eso, cualquiera sube 5 GB con tu propia firma.
- **`Cache-Control: public, max-age=31536000, immutable`** en los archivos finales. El nombre es un UUID, nunca cambia.
- **CORS** configurado para el dominio del admin (necesario para el `PUT` directo desde el navegador).

> Al no haber worker no hay archivos crudos, así que la lifecycle rule de `uploads/raw/` que estaba planeada ya no aplica.

### Región

Estás en Perú: fija el backend en `us-east` (Virginia) o São Paulo, con Postgres **en la misma región**. Un round-trip extra a la base de datos por request es el error de latencia más común y el más fácil de evitar. R2 no importa — se sirve desde el edge esté donde esté el backend.

---

## 5. Estructura del backend (NestJS)

```
src/
├── main.ts
├── app.module.ts
│
├── config/                    # validación de env con Zod
├── prisma/                    # PrismaModule + PrismaService
│
├── common/
│   ├── decorators/            # @Public(), @CurrentUser(), @AdminController()
│   ├── dto/                   # PaginationDto, ReorderDto, IdParamDto
│   ├── filters/               # PrismaExceptionFilter
│   ├── guards/                # JwtAuthGuard, RolesGuard
│   ├── interceptors/          # MediaUrlInterceptor, TriggerDeployInterceptor
│   ├── services/              # ReorderService, SlugService, ExclusiveFlagService
│   └── pipes/
│
├── storage/                   # módulo propio, no dentro de media
│   ├── storage.module.ts
│   ├── storage.service.ts     # getUploadUrl / delete / getPublicUrl
│   └── adapters/
│       ├── r2.adapter.ts
│       └── s3.adapter.ts
│
├── deploy/                    # dispara el rebuild de Astro
│   └── deploy.service.ts
│
└── modules/
    ├── auth/
    ├── categories/
    ├── galleries/
    ├── media/
    ├── packages/
    ├── testimonials/
    ├── social-links/
    ├── differentiators/
    ├── leads/
    └── settings/
```

### Anatomía de cada módulo

```
modules/galleries/
├── galleries.module.ts
├── galleries.service.ts
├── galleries.controller.ts        # público, read-only, sin auth
├── galleries.admin.controller.ts  # CRUD, con guard
├── dto/
│   ├── create-gallery.dto.ts
│   ├── update-gallery.dto.ts      # PartialType(CreateGalleryDto)
│   └── query-gallery.dto.ts       # extends PaginationDto
└── entities/
    └── gallery.entity.ts          # serializer con @Expose / @Exclude
```

**Dos controllers por módulo, siempre.** Astro consume la ruta pública en build time; el admin la protegida. Si los mezclas, acabas con guards condicionales y campos que se filtran a la landing sin querer (borradores, `hasConsent`, leads).

**`UpdateDto` siempre como `PartialType(CreateDto)`.** Nunca a mano: se desincroniza el día que agregues un campo.

### Lo que NO hay que abstraer

**No construyas un `BaseCrudService<T>` genérico.** Es lo primero que uno intenta con diez módulos casi idénticos, y con Prisma termina lleno de `any` porque cada delegate tiene su propio tipo. Pierdes el tipado, Swagger deja de inferir los DTOs y la validación se te escapa.

Lo que sí se abstrae bien son los **comportamientos** que se repiten entre modelos.

### Comportamientos compartidos

Ocho modelos tienen `order`: Category, Gallery, Media, Package, PackageItem, Testimonial, SocialLink, Differentiator. Escribir el reorder ocho veces es justo lo que hay que evitar.

```ts
// common/services/reorder.service.ts
type OrderableDelegate = {
  update(args: { where: { id: string }; data: { order: number } }): Promise<unknown>;
};

@Injectable()
export class ReorderService {
  constructor(private readonly prisma: PrismaService) {}

  reorder(delegate: OrderableDelegate, ids: string[]) {
    return this.prisma.$transaction(
      ids.map((id, order) => delegate.update({ where: { id }, data: { order } })),
    );
  }
}
```

Se usa con los tipos intactos: `this.reorder.reorder(this.prisma.media, dto.ids)`.

Mismo patrón para el flag exclusivo, que necesitan `Package.isHighlighted`, `Gallery.isFeatured` y `Media.isFeatured`:

```ts
// common/services/exclusive-flag.service.ts
@Injectable()
export class ExclusiveFlagService {
  constructor(private readonly prisma: PrismaService) {}

  setOnly<T extends { updateMany: Function; update: Function }>(
    delegate: T,
    field: string,
    id: string,
    scope: Record<string, unknown> = {},
  ) {
    return this.prisma.$transaction([
      delegate.updateMany({ where: scope, data: { [field]: false } }),
      delegate.update({ where: { id }, data: { [field]: true } }),
    ]);
  }
}
```

El `scope` es lo que permite reusarlo en `Media.isFeatured`, donde el flag es único **por galería**, no global.

Y el slug, que generan Category, Gallery y Package:

```ts
// common/services/slug.service.ts
@Injectable()
export class SlugService {
  async unique(base: string, exists: (slug: string) => Promise<boolean>) {
    const root = slugify(base, { lower: true, strict: true });
    let candidate = root;
    let n = 2;
    while (await exists(candidate)) candidate = `${root}-${n++}`;
    return candidate;
  }
}
```

### El decorador compuesto

Cada admin controller repite el mismo bloque de guards, interceptors y Swagger. Agrúpalos una vez:

```ts
// common/decorators/admin-controller.decorator.ts
export function AdminController(path: string) {
  return applyDecorators(
    Controller(`admin/${path}`),
    UseGuards(JwtAuthGuard, RolesGuard),
    UseInterceptors(TriggerDeployInterceptor, ClassSerializerInterceptor),
    ApiBearerAuth(),
    ApiTags(`admin/${path}`),
  );
}
```

Cada controller queda en una línea: `@AdminController('galleries')`. El día que agregues rate limiting o auditoría, lo pones acá y los diez módulos lo heredan.

### El interceptor de deploy

Evita esparcir `deployService.trigger()` por veinte métodos:

```ts
@Injectable()
export class TriggerDeployInterceptor implements NestInterceptor {
  constructor(private readonly deploy: DeployService) {}

  intercept(ctx: ExecutionContext, next: CallHandler) {
    const method = ctx.switchToHttp().getRequest().method;
    const mutates = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method);
    return next.handle().pipe(tap(() => mutates && this.deploy.schedule()));
  }
}
```

`schedule()` lleva debounce de 60s. Si James edita diez campos seguidos, sin debounce disparas diez builds de Astro.

### Nada hardcodeado

Config validada al arrancar. Si falta una variable, la app no levanta — mejor que descubrirlo en producción:

```ts
// config/env.schema.ts
export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  R2_ACCOUNT_ID: z.string(),
  R2_ACCESS_KEY_ID: z.string(),
  R2_SECRET_ACCESS_KEY: z.string(),
  R2_BUCKET: z.string(),
  CDN_BASE_URL: z.string().url(),
  DEPLOY_HOOK_URL: z.string().url(),
  MAX_VIDEO_MB: z.coerce.number().default(200),
});
```

`CDN_BASE_URL` lo lee **solo** el `MediaUrlInterceptor`. Ningún servicio ni componente conoce el dominio del CDN.

### Repository pattern

Cada módulo expone un **contrato abstracto** y una implementación Prisma. El servicio consume el contrato y nunca ve Prisma.

```
modules/categories/
├── repositories/
│   ├── category.repository.ts          # abstract = contrato
│   └── category.prisma.repository.ts   # implementación
```

```ts
// repositories/category.repository.ts
export abstract class CategoryRepository {
  abstract findMany(query: FindCategoriesQuery): Promise<Paginated<Category>>;
  abstract findById(id: string): Promise<Category | null>;
  abstract findBySlug(slug: string): Promise<Category | null>;
  abstract create(data: CreateCategoryData): Promise<Category>;
  abstract update(id: string, data: UpdateCategoryData): Promise<Category>;
  abstract delete(id: string): Promise<void>;
  abstract slugExists(slug: string): Promise<boolean>;
  abstract reorder(ids: string[]): Promise<void>;
}
```

**La clase abstracta funciona como token de inyección.** No hace falta `Symbol` ni `@Inject('CATEGORY_REPO')`:

```ts
@Module({
  controllers: [CategoriesController, CategoriesAdminController],
  providers: [
    CategoriesService,
    { provide: CategoryRepository, useClass: PrismaCategoryRepository },
  ],
  exports: [CategoryRepository],
})
export class CategoriesModule {}
```

```ts
@Injectable()
export class CategoriesService {
  constructor(
    private readonly repo: CategoryRepository,
    private readonly slug: SlugService,
  ) {}

  async create(dto: CreateCategoryDto) {
    const slug = await this.slug.unique(dto.name, s => this.repo.slugExists(s));
    return this.repo.create({ ...dto, slug });
  }
}
```

### Transacciones entre repositorios

Acá es donde el patrón se rompe en la mayoría de implementaciones. Si crear una galería debe insertar también sus `Media` de forma atómica y cada uno tiene su repositorio, `$transaction` no sirve: necesita el **mismo cliente** en ambos.

La salida limpia es `AsyncLocalStorage`. Los repositorios ni se enteran:

```ts
// common/prisma/transaction.context.ts
@Injectable()
export class TransactionContext {
  private readonly als = new AsyncLocalStorage<Prisma.TransactionClient>();

  get client() {
    return this.als.getStore();
  }

  run<T>(tx: Prisma.TransactionClient, fn: () => Promise<T>) {
    return this.als.run(tx, fn);
  }
}

// common/prisma/unit-of-work.ts
@Injectable()
export class UnitOfWork {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TransactionContext,
  ) {}

  execute<T>(fn: () => Promise<T>): Promise<T> {
    return this.prisma.$transaction(tx => this.ctx.run(tx, fn));
  }
}
```

```ts
// base para todas las implementaciones Prisma
export abstract class PrismaRepositoryBase {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly ctx: TransactionContext,
  ) {}

  /** El cliente de la transacción activa, o el normal si no hay ninguna. */
  protected get db(): Prisma.TransactionClient {
    return this.ctx.client ?? this.prisma;
  }
}
```

Los repositorios usan `this.db.category.findMany(...)`, nunca `this.prisma.category`. Con eso, esto es atómico y ningún repositorio sabe que está dentro de una transacción:

```ts
await this.uow.execute(async () => {
  const gallery = await this.galleryRepo.create(data);
  await this.mediaRepo.createMany(gallery.id, items);
});
```

Sin esto, el patrón te obliga a pasar `tx` por cada firma del contrato, que es exactamente la fuga de abstracción que estabas evitando.

### El costo del patrón

Con el contrato de por medio pierdes el `include` dinámico de Prisma. Si el servicio quiere categorías **con** sus galerías, o agregas un parámetro que replica la API de Prisma (y entonces la abstracción no sirve de nada) o defines un método explícito:

```ts
abstract findBySlugWithGalleries(slug: string): Promise<CategoryWithGalleries | null>;
```

**Métodos con nombre de intención**, uno por cada forma de consulta que realmente uses. Son cinco o seis por módulo, no cincuenta.

### Validación y transformación

```ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,              // elimina props que no están en el DTO
  forbidNonWhitelisted: true,   // y lanza 400 si llegan
  transform: true,
}));
```

**`whitelist: true` es de seguridad, no de limpieza.** Sin él, alguien puede mandar `{ "isPublished": true }` a un endpoint que no debería permitirlo y Prisma lo escribe encantado.

**No actives `enableImplicitConversion`.** Convierte de formas sorprendentes (`"false"` → `true`). Mejor `@Type()` explícito donde haga falta.

### Swagger

```json
// nest-cli.json
{ "compilerOptions": { "plugins": ["@nestjs/swagger/plugin"] } }
```

Con el plugin, Swagger **infiere** tipo, opcionalidad y descripción desde TypeScript y desde los decoradores de class-validator. Ya no escribes `@ApiProperty()` en cada campo:

```ts
export class CreateCategoryDto {
  @IsString()
  @Length(2, 60)
  name: string;

  @IsOptional()
  @IsString()
  tagline?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order?: number;
}
```

Ese DTO ya genera documentación completa. `@ApiProperty()` a mano solo cuando quieras un `example` concreto.

**Dos documentos, no uno.** Ya tienes controllers públicos y de admin separados:

```ts
const publicDoc = SwaggerModule.createDocument(app, publicConfig, {
  include: [CategoriesModule, GalleriesModule, PackagesModule],
});
SwaggerModule.setup('docs/public', app, publicDoc);
```

El doc público es el contrato que consume Astro. El de admin lleva `.addBearerAuth()` y no tiene por qué ser accesible en producción.

### Serialización

`ClassSerializerInterceptor` ya viene en el `@AdminController()`. Las entidades controlan qué sale:

```ts
export class UserEntity {
  id: string;
  email: string;

  @Exclude()
  passwordHash: string;
}
```

Un `@Exclude()` y nunca más te preocupas de filtrarlo a mano en cada endpoint.

### Manejo de errores de Prisma

Sin esto, un slug duplicado devuelve un 500 con el stack de Prisma:

```ts
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly map: Record<string, [number, string]> = {
    P2002: [409, 'Ya existe un registro con ese valor único'],
    P2025: [404, 'No encontrado'],
    P2003: [400, 'Referencia inválida'],
  };

  catch(err: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const [status, message] = this.map[err.code] ?? [500, 'Error interno'];
    host.switchToHttp().getResponse().status(status).json({ statusCode: status, message });
  }
}
```

Quince líneas que arreglan la mitad de los errores feos de la API.

---

## 6. Frontend: landing en Astro

### Sistema de diseño

Derivado del flyer, pero **con la paleta reducida**. El flyer usa negro + dorado + cyan + magenta: cuatro familias compitiendo. Eso es lo que lo hace leerse como flyer de evento y no como marca. En web se queda en tres.

**Paleta**

| Token | Hex | Uso |
|---|---|---|
| `void` | `#0A0908` | Fondo de página. Negro cálido, no azulado |
| `surface` | `#141210` | Tarjetas, contenedores de video |
| `elevated` | `#1E1B18` | Hover, modales |
| `line` | `#2E2A26` | Bordes |
| `ash` | `#9C958C` | Texto secundario |
| `bone` | `#F2EFE9` | Texto principal |
| `brass-200` | `#E5D3AC` | Latón claro |
| `brass-400` | `#C9A96A` | **El acento** |
| `brass-600` | `#9A7F47` | Latón apagado, etiquetas |
| `whatsapp` | `#25D366` | Solo el botón de conversión |

Tres decisiones detrás de esos números:

**El negro es cálido, no azulado.** `#0A0908` frente a un `#08080C`. El azulado se lee tecnológico; el cálido se lee cinematográfico.

**El blanco no es blanco.** `#F2EFE9`, hueso. El blanco puro sobre negro vibra y cansa la vista.

**El dorado bajó de saturación.** `#C9A96A` en vez de `#E3B23C`. El primero es latón, metal real; el segundo es dorado de fiesta, que es la paleta de todos los flyers de eventos del mercado.

### La regla del acento único

**Si todo tiene color, nada destaca.** Con una sola familia de acento, el latón se convierte en señalizador y se pone donde quieres que miren.

Aplicado a los paquetes, la jerarquía es neutro → latón → blanco:

| Paquete | Tratamiento |
|---|---|
| Básico | Borde `line`, texto `ash` — presente pero callado |
| Pro | Borde y precio en `brass-400` — el único con color |
| Premium | Borde y texto en `bone`, máximo contraste |

El color se lo lleva el que James quiere vender. Los tres acentos del flyer (dorado / cyan / magenta) **no se usan en web**; `Package.accentColor` sigue en el schema por si algún día hace falta, pero el v1 no lo consume.

### Tipografía

**Bricolage Grotesque** (display) + **Inter** (cuerpo). Ambas gratis en Google Fonts.

Se eligió sobre Instrument Serif porque encaja mejor con lo que James realmente vende: el flyer dice "TikToks en tendencia", "Ganchos (Hooks)", "Viral". No vende recuerdos elegantes, vende contenido que rinde en redes. Y quien contrata para una boda hoy tiene 25-35 años.

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,800&family=Inter:wght@400;500&display=swap">
```

Bricolage es variable con eje de tamaño óptico. **Solo dos pesos: 400 y 800.** Nada de cargar el rango completo.

**Bricolage no tiene cursiva.** El contraste del titular se hace con peso, no con estilo: primera línea en 800 sobre `bone`, segunda en 400 sobre `brass-400`.

**Titulares con `clamp()`, siempre.** A 44px fijos el hero se desborda en móvil:

```css
font-size: clamp(28px, 7vw, 64px);
```

### tailwind.config.ts

```ts
export default {
  theme: {
    extend: {
      colors: {
        void:     '#0A0908',
        surface:  '#141210',
        elevated: '#1E1B18',
        line:     '#2E2A26',
        ash:      '#9C958C',
        bone:     '#F2EFE9',
        brass: {
          200: '#E5D3AC',
          400: '#C9A96A',
          600: '#9A7F47',
        },
        whatsapp: '#25D366',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'sans-serif'],
        sans:    ['Inter', 'sans-serif'],
      },
      letterSpacing: {
        brand: '0.3em',    // "CREADOR DE CONTENIDO"
        wide2: '0.18em',   // "E V E N T O S"
      },
    },
  },
}
```

> **Pendiente:** estos hex están derivados a ojo desde el JPG del flyer. Pedirle a James el archivo original (`.ai`, `.psd` o el proyecto de Canva) para confirmar los valores exactos y el nombre real de la fuente del logo.

> **La firma manuscrita "James" no se convierte en fuente.** Va como SVG. Es un logotipo, no texto.

### Sin librería de componentes

shadcn, Preline, daisyUI y Flowbite traen su propia identidad visual, y la de James ya está definida por el flyer. Se pasa más tiempo desmontando su estética que construyendo la propia. Son unos 8 componentes en total: Tailwind y listo.

```bash
npx astro add tailwind sitemap
npm i astro-seo astro-icon gsap lenis
```

| Paquete | Para qué |
|---|---|
| `astro-seo` | Meta tags, Open Graph, Twitter cards |
| `@astrojs/sitemap` | Sitemap automático |
| `astro-icon` | Íconos de paquetes y diferenciadores, con tree-shaking |
| `astro:assets` | Optimización de imágenes — viene de fábrica |
| `gsap` | Animaciones |
| `lenis` | Smooth scroll |

### SEO estructurado

Los meta tags son lo básico. Lo que mueve la aguja para un negocio local es **JSON-LD**:

```astro
---
const schema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: settings.brandName,
  telephone: `+${settings.whatsappNumber}`,
  areaServed: "Ayacucho, Perú",
  makesOffer: packages.map(p => ({
    "@type": "Offer",
    name: p.name,
    price: p.priceAmount,
    priceCurrency: p.currency,
  })),
};
---
<script type="application/ld+json" set:html={JSON.stringify(schema)} />
```

Con eso los precios pueden aparecer directo en Google. Un `VideoObject` por cada reel destacado es lo que te mete en la pestaña de videos.

**La imagen de OG importa más de lo normal acá** porque James comparte el link por WhatsApp todo el tiempo. Esa preview es la primera impresión.

### Animaciones

**GSAP es 100% gratis desde abril de 2025**, incluidos todos los plugins que antes eran de pago: SplitText, MorphSVG, DrawSVG, ScrollTrigger y ScrollSmoother. SplitText además fue reescrito con la mitad de peso.

En orden de impacto:

| Efecto | Dónde | Plugin |
|---|---|---|
| Texto entrando letra por letra | Hero | `SplitText` |
| Reveal escalonado con `clipPath` | Grilla de reels | `ScrollTrigger` |
| Entrada secuencial, la destacada al final | Tarjetas de paquete | `ScrollTrigger` |
| Texto que se descifra al entrar | "CREA. CAPTURA. IMPACTA." | `ScrambleTextPlugin` |
| Marquee infinito de categorías | Separador entre secciones | core |
| Cursor que muta a "▶ VER" sobre los reels | Grilla | core |

Tres cosas que no se pueden olvidar:

```js
gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
  // todas las animaciones acá dentro
});
```

Sin eso, quien tenga movimiento reducido activado se marea.

**Carga GSAP con `client:visible`, no `client:load`.** Astro manda cero JS por defecto; GSAP + Lenis son ~70kb y no tiene sentido pagarlos antes de que se vean.

**El contenido de James ya es movimiento.** Si el fondo se mueve, el texto vuela y las tarjetas hacen parallax al mismo tiempo, los reels dejan de destacar. Tres momentos con animación fuerte, el resto quieto.

### Animaciones vs INP: el riesgo no se reparte igual

El umbral de INP es 200 ms (ver §20), y las tres librerías no aportan el mismo riesgo:

| Librería | Qué hace | Riesgo de INP |
|---|---|---|
| **GSAP core** | Anima `transform` y `opacity` en rAF | Bajo |
| **ScrollTrigger** | Dispara animaciones al scrollear | Bajo-medio |
| **Lenis** | **Intercepta el scroll nativo** y lo recalcula en JS | **Alto** |

GSAP anima propiedades compositadas: el navegador las resuelve en GPU sin tocar el layout. Mientras solo animes `transform` y `opacity`, el hilo principal apenas se entera.

**Lenis es distinto por naturaleza.** Cancela el scroll del navegador y lo recalcula en JavaScript en cada frame, así que **cada interacción pasa por tu código antes de llegar al navegador** — que es literalmente lo que INP mide.

#### Las tres reglas de oro

**1. Solo `transform` y `opacity`.** Nunca `top`, `left`, `width` ni `height`. Animar esas fuerza reflow en cada frame: es la diferencia entre 60fps y un INP de 400 ms.

**2. `client:visible`, nunca `client:load`.** No pagues 70 kb antes de que el usuario llegue a la sección.

**3. `will-change` puesto y quitado.** Dejarlo permanente en muchos elementos reserva capas de GPU que no se liberan y **empeora** el rendimiento. GSAP lo gestiona solo si usas sus métodos.

#### Lenis: solo en escritorio

Es el componente con peor relación beneficio/riesgo del stack. Aporta suavidad, pero es la única pieza que se interpone entre el dedo del usuario y el navegador.

Y **el smooth scroll casi no se nota en móvil**, porque iOS ya tiene su propia inercia. La mayoría del tráfico de James será móvil, así que estarías pagando el riesgo de INP donde el efecto ni se percibe — y donde Google mide, porque indexa con el índice móvil.

```js
if (window.matchMedia('(min-width: 1024px)').matches) {
  const lenis = new Lenis();
  // …
}
```

#### El orden de medición (fase 5 de §18)

Sin línea base, un INP de 350 ms al final del proyecto es adivinar entre cinco culpables.

1. Construye la landing **sin animaciones**
2. Mide LCP, INP y CLS → **esa es tu línea base**
3. Añade GSAP y ScrollTrigger → mide otra vez
4. Añade Lenis solo en escritorio → mide otra vez
5. Si el INP pasa de 200 ms, quita en orden inverso

Cada paso te dice exactamente cuánto costó.

---

## 7. Responsive: requisito no negociable

**Landing y admin funcionan en móvil, tablet y escritorio. En todas las pantallas, sin desbordes.**

No es un "nice to have": James va a querer publicar los reels de una boda desde su celular al día siguiente, no esperar a llegar a su escritorio.

### Breakpoints

| | Ancho | Landing | Admin |
|---|---|---|---|
| `base` | < 640 | 1 col · reels 2 col | Tablas → tarjetas apiladas |
| `sm` | ≥ 640 | reels 2 col | Formularios aún 1 columna |
| `md` | ≥ 768 | paquetes 2 col · reels 3 col | Aparece la tabla real |
| `lg` | ≥ 1024 | paquetes 3 col · reels 4 col | Sidebar fijo |
| `xl` | ≥ 1280 | reels 5 col | Sidebar + panel de detalle |

### Las trampas de desborde

Estas son las que causan el 95% del scroll horizontal:

**`grid-template-columns: 1fr` tiene `min-width: auto`.** Un hijo con contenido ancho empuja la columna más allá del contenedor. Usa siempre `minmax(0, 1fr)`.

**Strings largos sin espacios** — URLs, handles, correos. `overflow-wrap: anywhere` (o `break-words` en Tailwind) en cualquier celda que muestre datos del usuario.

**`100vw` incluye el ancho de la barra de scroll** y produce scroll horizontal en desktop. Usa `100%` o `100dvw`.

**`100vh` en iOS incluye la barra del navegador**, así que el hero queda cortado. Usa `100dvh`.

**Modales de ancho fijo.** `width: min(500px, calc(100vw - 2rem))`.

**Tablas con muchas columnas.** No las hagas scrollear: por debajo de `md`, conviértelas en tarjetas apiladas. Un scroll horizontal dentro de una página que ya scrollea vertical es horrible en touch.

### Específico de la landing

**Los reels son 9:16.** `aspect-ratio: 9/16` + `object-fit: cover` en el contenedor. Nunca dimensiones fijas.

**La tarjeta de paquete destacada usa un desplazamiento vertical** (`margin-top` negativo o `translateY`) para sobresalir en la fila. **Ese offset hay que desactivarlo cuando las tarjetas se apilan**, o queda un hueco raro a mitad de la columna. `md:-translate-y-6` y nada por debajo.

**El marquee necesita `overflow: hidden`** en el contenedor padre, o es una fuente garantizada de scroll horizontal.

### Específico del admin

- **Sidebar → drawer** por debajo de `lg`.
- **Formularios en una sola columna** por debajo de `md`. Dos columnas en un móvil no ahorran espacio, solo aprietan.
- **Modales → hojas a pantalla completa** en móvil.
- **Targets táctiles de 44×44 px mínimo.** Los íconos de editar/borrar de 24px son imposibles con el pulgar.
- **Drag & drop con soporte touch.** Usa `@dnd-kit`, que trae sensores táctiles. `react-beautiful-dnd` no los cubre bien y está sin mantenimiento.
- **`env(safe-area-inset-bottom)`** en la barra de publicación fija, o el notch del iPhone se la come.

### Cómo encontrar el desborde

Cuando aparezca scroll horizontal y no sepas de dónde viene:

```js
document.querySelectorAll('*').forEach(el => {
  if (el.scrollWidth > document.documentElement.clientWidth) console.log(el);
});
```

Te imprime el elemento culpable directamente. Mucho más rápido que ir poniendo bordes rojos.

### Checklist antes de dar algo por terminado

- [ ] 320px de ancho (iPhone SE) sin scroll horizontal
- [ ] 768px vertical (iPad) — ni móvil ni escritorio, es donde más se rompe
- [ ] Zoom del navegador al 200%
- [ ] Móvil en horizontal
- [ ] Nombre de galería de 60 caracteres sin romper la tarjeta
- [ ] Tabla del admin con un correo largo en una celda

---

## 8. Qué se administra desde el panel

### La regla

> **Es configurable lo que cambia sin que cambie el diseño.**

Textos, números, links, precios, orden, qué se publica: sí.
Cantidad de secciones, layout, tipografías, paleta: no.

En el momento en que James puede mover secciones, la página se rompe visualmente y el problema vuelve a ser tuyo.

### Prioridades

**Crítico** — WhatsApp, redes sociales, precios de los tres paquetes. El número de WhatsApp *es su negocio*: si lo cambia y está hardcodeado, no puede vender hasta que tú despliegues.

**Alto valor** — Video del hero, texto "Soy James…", bullets de cada paquete, categorías y su orden, qué galerías están publicadas, testimonios.

**Vale la pena** — Los 4 diferenciadores, meta title/description, imagen de OG para cuando comparta el link por WhatsApp.

**No editable (archivo `src/content/copy.ts` en Astro)** — Títulos de sección como "PAQUETES CREACIÓN DE CONTENIDO", "EVENTOS", "SÍGUEME EN MIS REDES". No cambian nunca en la práctica y te ahorras una tabla más una pantalla de admin.

### Detalles de conversión

**El WhatsApp necesita prefijo de país.** `994724944` es local; `wa.me/` requiere `51994724944`. Sin eso el botón no funciona para nadie fuera de Perú.

**Mensaje pre-llenado por paquete.** Si el CTA del Premium abre WhatsApp con *"Hola James, me interesa el paquete Premium para mi boda"*, James sabe qué le piden antes de responder. Cuesta un campo de texto y ahorra tres mensajes de ida y vuelta por consulta.

### Paquetes: puede crear los que quiera

No están limitados a tres. Tres campos hacen tres cosas distintas, a propósito:

| Campo | Qué controla |
|---|---|
| `badgeText` | El texto del chip. Libre: "NUESTRO MÁS VENDIDO", "NUEVO", "OFERTA MARZO" |
| `isHighlighted` | El tratamiento visual: borde acentuado, escala, desplazamiento vertical |
| `accentColor` | El color del ícono y del borde de esa tarjeta |

Están separados para que pueda poner un chip "NUEVO" en el Básico sin convertirlo en el paquete dominante de la grilla.

**El schema no impide que marque los tres como destacados**, y si los tres tienen chip el chip deja de significar nada. Fuérzalo en la API, no en la interfaz:

```ts
async setHighlighted(packageId: string) {
  return this.prisma.$transaction([
    this.prisma.package.updateMany({
      data: { isHighlighted: false },
    }),
    this.prisma.package.update({
      where: { id: packageId },
      data: { isHighlighted: true },
    }),
  ]);
}
```

En el admin, un grupo de radio buttons en vez de un checkbox por paquete: así la restricción se ve antes de guardar, no después.

**En el CSS, grilla flexible desde el principio:**

```css
grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
```

Con `grid-cols-3` hardcodeado, el día que agregue un cuarto paquete se rompe el layout. Con `auto-fit`, 2, 3, 4 o 5 paquetes se acomodan solos y no vuelves a tocar el CSS. En móvil van apilados en cualquier caso.

Y si llega a tener muchos, la pivote `PackageCategory` ya permite filtrarlos por tipo de evento sin cambiar el modelo.

---

## 9. Pantallas del admin

**Siete en el v1:**

| # | Pantalla | Peso |
|---|---|---|
| 1 | Login | Trivial |
| 2 | Galerías (lista) | Bajo |
| 3 | **Editor de galería** | **Alto** |
| 4 | Categorías | Bajo |
| 5 | Paquetes | Medio |
| 6 | Testimonios | Bajo |
| 7 | Configuración (con tabs) | Medio |
| 8 | Dashboard | Medio |

**El editor de galería es el 60% del trabajo.** Tiene sección propia: **ver §10**. Las otras seis son CRUDs de tabla más modal.

**Nada de pantalla propia para lo que tiene menos de 10 filas.** Categorías, diferenciadores y redes sociales van como secciones dentro de Configuración, con edición en modal. Una pantalla dedicada para cuatro diferenciadores es más navegación que contenido.

Configuración con tabs: **Identidad · Contacto y redes · Hero · SEO**.

**Fuera del v1:** Leads. El CTA es WhatsApp y un formulario añade fricción. El modelo `Lead` se queda en el schema aunque nadie escriba en él — cuesta cero y evita una migración si algún día quiere capturar consultas fuera de horario.

### Dashboard

Entró al v1 cuando aparecieron dos datos con valor real: el contador de R2 y el tracking de clics a WhatsApp. Sin ellos habría sido un dashboard de vanidad.

**La regla: cada bloque es un problema que resolver o el único número que importa.** Nada de "12 galerías totales".

#### Bloque 1 · Clics a WhatsApp

```
47 clics · últimos 30 días        ↑ 12 vs periodo anterior
Premium 6  ·  Pro 24  ·  Básico 11  ·  Sin paquete 6
```

Es la respuesta a "¿la web me está funcionando?", y **la única métrica que le importa a James**.

**La comparación con el periodo anterior no es opcional.** "47 clics" aislado no significa nada: él no tiene forma de saber si está bien o mal. Con la línea de comparación, el número pasa de muerto a interpretable por una query más.

El desglose por paquete es información de negocio: si el Premium tiene 6 clics contra 24 del Pro, o no se ve o el precio asusta.

> **El clic a WhatsApp es el lead.** Sin formulario, sin fricción, y con mejor conversión que cualquier form. Esto sustituye funcionalmente a la tabla `Lead`.

#### Bloque 2 · Almacenamiento

```
3.2 GB de 10 GB   ████░░░░░░░░
Quedan unos 29 eventos antes del tramo de pago (~$0.60/mes)
```

Suma de `Media.sizeBytes`: una query, sin hablar con la API de R2. Verde hasta 7 GB, ámbar hasta 9, rojo después. Que vea el límite venir en vez de que le llegue de golpe.

#### Bloque 3 · Requiere tu atención

| Aviso | Por qué está |
|---|---|
| Subidas fallidas | Sin esto, un `Media` en `FAILED` es **invisible**. James cree que subió el reel y lo descubre semanas después, o nunca |
| Galerías en borrador | El olvido típico: sube los reels el domingo, no termina, se le pasa |
| Cambios sin publicar | La web no los muestra todavía |
| **Deploy fallido** | El más caro de todos — ver abajo |

**El aviso de deploy fallido es el que más daño hace pasar desapercibido.** Si el build de Cloudflare Pages revienta, James publica, la barra dice "Publicado", y la web sigue mostrando lo viejo. Silencioso, y puede durar semanas.

```
⚠ El último intento de publicar falló hace 2 horas    [Reintentar]
```

Guarda el estado del último deploy y muéstralo.

#### Evitar que el bloque se vuelva ruido

Si cualquier borrador aparece ahí para siempre, el bloque queda permanentemente en rojo y **James deja de mirarlo**. Es el mismo mecanismo que hace que la gente ignore las notificaciones.

- Un borrador solo aparece **después de 3 días** sin tocarse. Antes es trabajo en curso, no un problema.
- Cada aviso se puede **descartar**.
- **Máximo 5 avisos**; el resto como "y 7 más" con enlace a la lista.

#### Estado vacío

Los primeros dos meses el dashboard estará casi vacío. Un dashboard vacío enseña a no volver a mirarlo, y después no lo mira ni cuando importa.

- **Sin datos** → onboarding: "Crea tu primera galería → Sube tus reels → Publica", con checkmarks. Algo que hacer en vez de un cero.
- **Menos de 30 días de datos** → no digas "últimos 30 días" cuando llevas 6. Pon "desde que publicaste (6 días)". Un 47 en 30 días y un 47 en 6 son cosas muy distintas.

#### En móvil, el orden cambia

Es lo primero que ve al abrir en el iPhone. Los tres bloques van apilados y **el orden importa: atención primero, clics segundo, almacenamiento tercero.**

En escritorio el número grande arriba funciona porque se ve todo de un vistazo. En el celular, lo accionable va primero; lo demás queda bajo el pliegue y no pasa nada.

#### Descartado a propósito

**Visitas y páginas vistas.** Es trabajo de Cloudflare Analytics; duplicarlo son dos fuentes que se contradicen. Un enlace a su panel y listo.

**Gráficos.** Con cinco eventos al mes, cualquier gráfico son cuatro puntos y una línea que no dice nada.

**Ranking de reels más vistos.** R2 sirve desde el edge y no da analítica por objeto. Habría que instrumentar el play en el cliente y guardar filas, y con este volumen no sería significativo. Complejidad por una curiosidad.

**Resumen semanal por correo.** Es lo mejor del dashboard sin que él entre, pero requiere Resend, plantillas, cron y desuscripción. **Anotado para el v2**: el día que James lleve seis meses y entre menos seguido, un correo con "12 clics esta semana, 1 subida falló" vale más que el dashboard entero.

### La barra de estado de publicación

Este es el hueco más importante y no es una pantalla, es un componente del layout.

La landing es estática. James edita un precio, entra a la web, y no ve el cambio porque el rebuild tarda un minuto. Va a asumir que se rompió y te va a llamar. Todas las veces.

```
● 3 cambios sin publicar        [Publicar ahora]
◐ Publicando… (~1 min)
✓ Publicado hace 4 minutos
```

Alimentada por el debounce del `DeployService`. Es lo que evita el 80% de las llamadas de soporte.

### Tres detalles que casi nunca se ponen

**Botón "Ver en la web"** en cada galería y paquete, que abra la URL pública en otra pestaña.

**Confirmación fuerte al borrar.** Borrar una galería con 30 reels borra 30 archivos de R2 y no hay vuelta atrás. Que tenga que escribir el nombre de la galería, tipo GitHub. Mejor aún: `deletedAt` para soft delete y un job que limpia R2 a los 30 días.

**Estados vacíos con acción.** La primera vez que entre no habrá nada. En vez de una tabla vacía, "Aún no tienes galerías → Crear la primera". Es el momento en que decide si la herramienta le sirve.

---

## 10. Editor de galería

**La pantalla más compleja del proyecto: el 60% del esfuerzo del admin y casi todo el riesgo técnico.**

Una galería es un evento ("XV de Camila"). Dentro viven sus 7 reels, el aftermovie y algunas fotos. El editor debe permitir subirlos, ordenarlos, elegir portada y publicar — **desde el iPhone de James, al día siguiente de la boda.** Esa última condición es la que define casi todas las decisiones de abajo.

### Layout

```
┌─────────────────────────────────────────────┐
│ ● 3 cambios sin publicar   [Publicar ahora] │  ← barra global del layout
├─────────────────────────────────────────────┤
│ XV de Camila                    [Publicada] │
│ /galeria/xv-de-camila                       │
│                                             │
│ [Categoría] [Fecha] [Lugar]                 │
│                                             │
│ Medios · 8          ⇅ arrastra para ordenar │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌╌╌╌╌┐          │
│ │Port│ │    │ │64% │ │ ⚠  │ │ +  │          │
│ └────┘ └────┘ └────┘ └────┘ └╌╌╌╌┘          │
│  listo  listo subiendo error  dropzone      │
│                                             │
│ [Ver en la web]        [Eliminar galería]   │
└─────────────────────────────────────────────┘
```

### Máquina de estados por archivo

```
SELECCIONADO → VALIDANDO → EXTRAYENDO_POSTER → FIRMANDO
                    ↓                              ↓
                 FALLIDO                      SUBIENDO → CONFIRMANDO → LISTO
                                                  ↓
                                            FALLIDO (reintentar)
```

**Por archivo, no global.** Si James suelta ocho reels y el tercero está en HEVC, los otros siete siguen subiendo. Un estado global haría que un archivo malo abortara todo.

### Extracción del poster y validación

Un solo bloque hace triple trabajo: valida el formato, saca el poster y llena `width`, `height` y `durationSec`. Es la razón por la que no hace falta el worker de ffmpeg.

```ts
async function extraerPoster(file: File) {
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.muted = true;
  video.playsInline = true;          // iOS no decodifica frames sin esto
  video.src = URL.createObjectURL(file);

  await new Promise((ok, err) => {
    video.onloadedmetadata = ok;
    video.onerror = () => err(new Error('Formato no compatible. Exporta en MP4 / H.264.'));
  });

  video.currentTime = Math.min(1, video.duration / 2);
  await new Promise(ok => (video.onseeked = ok));

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d')!.drawImage(video, 0, 0);

  const poster = await new Promise<Blob>(ok =>
    canvas.toBlob(b => ok(b!), 'image/webp', 0.8),
  );

  URL.revokeObjectURL(video.src);
  return { poster, width: video.videoWidth, height: video.videoHeight, duration: video.duration };
}
```

`muted` y `playsInline` no son opcionales: sin ellos Safari en iOS no decodifica frames y el poster sale en negro. El `seek` va **después** de `loadedmetadata`, nunca antes.

### Fotos del iPhone: HEIC

El iPhone guarda fotos en **HEIC**, que Chrome y Firefox de escritorio no muestran. Mismo problema que el HEVC pero para imágenes.

La solución funciona **precisamente porque es un iPhone**: Safari sí decodifica HEIC, así que la conversión en el navegador funciona en el dispositivo donde importa.

```ts
async function normalizarImagen(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
  bitmap.close();
  return new Promise(ok => canvas.toBlob(b => ok(b!), 'image/webp', 0.85));
}
```

`imageOrientation: 'from-image'` es obligatorio: sin eso las fotos verticales salen giradas 90°, porque la rotación va en el EXIF y el canvas la ignora por defecto.

**Toda foto se redimensiona a 2560px de lado largo antes de subir**, sea HEIC o no. De ~6 MB a ~1 MB, y 2560px sigue superando lo que cualquier pantalla muestra. Es la regla que más espacio ahorra en R2.

**Formato de salida: JPEG calidad 95, no WebP ni AVIF.** Ese archivo es el máster en R2; la compresión real la hace Cloudflare al servir. Comprimir dos veces degrada.

### Firmado en lote

Una llamada para N archivos, no N llamadas:

```
POST /admin/galleries/:id/media/presign
[{ filename, mimeType, sizeBytes, type }]
→ [{ mediaId, uploadUrl, posterUploadUrl, storageKey, posterKey }]
```

Ocho reels son un roundtrip, no ocho.

### La subida necesita XHR, no fetch

**`fetch` no tiene evento de progreso de subida.** Sigue la descarga, no la subida. Para la barra de progreso hace falta `XMLHttpRequest`:

```ts
const xhr = new XMLHttpRequest();
xhr.upload.onprogress = e => setProgress(Math.round((e.loaded / e.total) * 100));
xhr.open('PUT', uploadUrl);
xhr.send(file);
```

`xhr.abort()` da el botón de cancelar gratis.

**Cola con concurrencia de 3.** Ocho subidas simultáneas desde datos móviles saturan la conexión y todas van lentas. De tres en tres terminan antes.

**Reintento con backoff exponencial**: 1s, 2s, 4s, tres intentos. Las redes móviles fallan de forma intermitente, no permanente.

### El modo de fallo móvil: pantalla bloqueada

**Este es el problema número uno subiendo desde el iPhone.** James sube un reel de 150MB por datos, se apaga la pantalla o cambia de app, iOS suspende la pestaña y la subida muere.

**Wake Lock** — mantiene la pantalla encendida mientras haya subidas activas (Safari 16.4+):

```ts
let lock: WakeLockSentinel | null = null;

async function mantenerPantalla(activo: boolean) {
  if (activo && !lock) {
    lock = await navigator.wakeLock?.request('screen').catch(() => null);
  } else if (!activo && lock) {
    await lock.release();
    lock = null;
  }
}

// iOS libera el lock al cambiar de pestaña: hay que recuperarlo
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && hayCargasActivas) mantenerPantalla(true);
});
```

**Multipart para archivos grandes.** R2 es compatible con multipart de S3, así que se firma una URL por parte y se reanudan solo las que fallaron:

```
POST /admin/media/:id/multipart/init     → uploadId + URLs por parte (8MB c/u)
PUT  <urlParte>                          → ETag por parte
POST /admin/media/:id/multipart/complete → { parts: [{ PartNumber, ETag }] }
```

Guardar las partes completadas en `localStorage`. Si la pestaña muere, al volver reanuda desde la parte 12 en vez de la 1.

**Umbral: 50MB.** Por debajo, `PUT` simple con reintento — un reel de 25MB por 4G tarda medio minuto y no vale la complejidad. Por encima, multipart.

### Drag & drop

`@dnd-kit`, y hay un detalle que decide si funciona en móvil o no:

```ts
useSensor(TouchSensor, {
  activationConstraint: { delay: 200, tolerance: 5 },
});
```

Sin ese `delay`, cualquier toque en una tarjeta inicia un arrastre y **la página deja de poder scrollear**. Con 200ms, un toque rápido scrollea y una pulsación mantenida arrastra.

**Botones de mover además del arrastre.** Dos flechas pequeñas en cada tarjeta. En escritorio se arrastra; en el celular se toca. Es redundante a propósito, y en móvil es lo que de verdad se usa con más de 8 elementos.

El reorden es optimista en estado local, con `PATCH` debounced a 800ms:

```
PATCH /admin/galleries/:id/media/reorder
{ ids: ["med_3", "med_1", "med_7", ...] }
```

Si falla, revierte al orden anterior y avisa. Sin debounce, arrastrar tres tarjetas serían tres peticiones y tres deploys encolados.

### Portada: flag exclusivo con scope

Marcar una portada desmarca la anterior, pero **solo dentro de esa galería**. Es el `ExclusiveFlagService` de §5 con el `scope` puesto:

```ts
this.exclusiveFlag.setOnly(this.prisma.media, 'isFeatured', mediaId, { galleryId });
```

Sin el scope, marcar la portada de la boda de Ana desmarcaría la de los XV de Camila.

### Autoguardado

Si la pestaña muere con el título y la descripción escritos, no debe perderlos. Guardar como borrador con debounce de 2s. Es barato y evita el peor momento posible: rehacer trabajo justo después de que ya falló algo.

### Robustez del backend

**Idempotencia en el confirm.** Si la red reintenta o James toca dos veces, no debe crear dos `Media`:

```ts
@Post(':id/confirm')
confirm(@Headers('Idempotency-Key') key: string, ...) { }
```

**Limpieza de huérfanos.** Cron diario que borra los `Media` en `PENDING` con más de 24h y su objeto en R2. Sin esto, cada subida cancelada deja basura para siempre.

### PWA

"Añadir a pantalla de inicio" en iOS da modo standalone: sin barra del navegador, icono propio, se siente una app. Es un `manifest.json` y quince minutos.

**El Web Share Target no funciona en iOS.** Sería ideal que James compartiera desde CapCut directo al admin, pero Safari no lo soporta. En Android sí; en iPhone no existe. No lo persigas.

### Escalabilidad del orden

Con `order: Int`, reordenar N elementos escribe N filas. Con 8-15 medios por galería es irrelevante y **no se cambia ahora**.

Si algún día una galería tiene 200 fotos, la alternativa es **fractional indexing**: un `sortKey: String` donde mover un elemento entre otros dos calcula una clave intermedia y escribe **una sola fila**. La librería `fractional-indexing` lo hace en tres líneas.

Anotado como escape, no como decisión pendiente.

### Tests obligatorios

De todo el proyecto, los de mayor valor:

- Un `.mov` con HEVC se rechaza antes de firmar nada
- Un archivo de 300MB se rechaza antes de empezar a subir
- Una foto HEIC vertical se convierte a WebP sin rotarse
- El poster sale del frame correcto y no en negro
- Reordenar y fallar la petición revierte el orden en pantalla
- Cancelar a mitad de subida no deja un `Media` en `PENDING` huérfano
- Multipart reanuda desde la última parte completada

El de los huérfanos es el que se olvida y el que ensucia la base con el tiempo.

### Dos cosas que no se pueden saltar

**Probar en el iPhone real de James, no en el emulador de Chrome.** Wake Lock, HEIC, la decodificación de video y el file picker se comportan distinto en Safari de verdad. El modo dispositivo de DevTools no reproduce ninguno de los cuatro.

**Que exporte desde CapCut a 1080p, no a 4K.** Dos minutos a 1080p son ~40MB; a 4K son 700MB. Ningún truco técnico compensa esa diferencia, y es una instrucción de flujo que resuelve más que cualquier código de esta sección.

---

## 11. Testimonios

**Decidido para v1: los carga James desde el admin. No hay formulario público.**

Sus clientes ya están en WhatsApp con él. Cuando entrega los reels, la reacción llega ahí mismo. Pedirle a esa persona que abra el navegador, entre a la web y escriba lo mismo otra vez pierde el 95% de los testimonios que ya tenía en la mano.

Y un endpoint público de texto libre se llena de spam en semanas, así que necesitarías moderación de todos modos: el mismo trabajo para James, más una cola que mantener, más un vector de abuso.

### El formato importa más que el mecanismo

Una cita en una caja gris — *"Excelente servicio – María G. ⭐⭐⭐⭐⭐"* — no la cree nadie. Su audiencia es nativa de TikTok e Instagram, donde la prueba social real es **la captura del chat de WhatsApp** o **el comentario de Instagram con el handle visible**. Eso no se falsifica fácil.

Por eso `Testimonial` soporta ambos formatos (`TEXT` y `SCREENSHOT`).

### Atarlos a la galería

La relación `Testimonial → Gallery` es la que más rinde: en la página de "XV de Camila" salen los reels **y** lo que dijo Camila. Prueba social pegada al trabajo que la generó, no flotando en una sección aparte.

### Consentimiento

Publicar una captura de WhatsApp muestra nombre y a veces foto de perfil. Que James pida permiso por el mismo chat y marque `hasConsent`. En Perú los datos personales están regulados por la Ley 29733, y una captura con nombre y foto entra ahí. **El admin no debe permitir publicar con `hasConsent = false`.**

### Para más adelante

Si quiere que los clientes escriban solos, la forma correcta no es un formulario público: es un **link con token por evento** (`/testimonio/a8f3k2`) que James manda al entregar. Solo esa persona lo tiene, va atado a su galería, y no hay endpoint abierto que spamear. No lo construyas en el v1.

---

## 12. Redes sociales

Las redes van en **su propia tabla**, no como columnas de `SiteSettings`. El día que James abra YouTube o Threads, con columnas fijas tendrías que migrar la base, tocar el footer y desplegar — para que él agregue un link.

Tres decisiones:

**`platform` es String, no enum.** Un enum obliga a migrar cada vez que aparece una red nueva, que es justo el problema que se está resolviendo.

**`url` se guarda completa, no se arma.** Es tentador guardar el handle y construir `instagram.com/${handle}`, pero cada red tiene formato distinto (TikTok necesita arroba, Instagram no). La URL completa evita una clase entera de bugs.

**El WhatsApp NO va en esta tabla.** Se queda en `SiteSettings` con campos propios. No es una red que sigues, es su canal de venta, con mensaje pre-llenado y tratamiento visual distinto.

### Fallback de íconos

```ts
const ICONS: Record<string, string> = {
  tiktok: "music-2",
  instagram: "instagram",
  facebook: "facebook",
  youtube: "youtube",
  threads: "at-sign",
};

const icon = link.icon ?? ICONS[link.platform.toLowerCase()] ?? "link";
```

El campo `icon` existe en la tabla para que James pueda elegirlo desde el admin si agrega una red rara. El `?? "link"` garantiza que nunca quede un hueco en el footer.

---

## 13. Schema Prisma

```prisma
// ============================================================
//  JAMES FILM — Schema Prisma (PostgreSQL)
// ============================================================

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ------------------------------------------------------------
//  CATEGORÍAS
// ------------------------------------------------------------

model Category {
  id          String  @id @default(cuid())
  slug        String  @unique          // "bodas", "xv-anos"
  name        String                   // "Bodas"
  tagline     String?
  description String? @db.Text

  coverKey String?                     // key de R2, no relación (evita ciclo)

  order    Int     @default(0)
  isActive Boolean @default(true)

  metaTitle       String?
  metaDescription String?

  galleries Gallery[]
  packages  PackageCategory[]
  leads     Lead[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([isActive, order])
}

// ------------------------------------------------------------
//  GALERÍAS — un evento cubierto ("XV de Camila")
// ------------------------------------------------------------

model Gallery {
  id          String  @id @default(cuid())
  slug        String  @unique
  title       String
  description String? @db.Text

  eventDate DateTime?
  location  String?
  coverKey  String?

  isPublished Boolean @default(false)
  isFeatured  Boolean @default(false)  // aparece en el home
  order       Int     @default(0)

  categoryId String
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Restrict)

  media        Media[]
  testimonials Testimonial[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([categoryId, isPublished, order])
  @@index([isFeatured, isPublished])
}

// ------------------------------------------------------------
//  MEDIA — reels, aftermovies y fotos
// ------------------------------------------------------------

enum MediaType {
  REEL         // vertical 9:16 — el producto principal
  AFTERMOVIE   // resumen horizontal, 1-3 min
  PHOTO        // stills / behind the scenes
}

enum Orientation {
  VERTICAL
  HORIZONTAL
  SQUARE
}

enum MediaStatus {
  PENDING      // subido, aún procesando
  READY        // listo para la landing
  FAILED       // falló — el admin lo ve y reintenta
}

model Media {
  id          String      @id @default(cuid())
  type        MediaType
  orientation Orientation @default(VERTICAL)
  status      MediaStatus @default(PENDING)

  // SIEMPRE la key, nunca la URL → `${CDN_BASE}/${storageKey}`
  storageKey String  @unique           // "media/2026/uuid.mp4"
  posterKey  String?                   // frame extraído en el navegador

  externalUrl String?                  // link al post original
  platform    String?                  // "tiktok", "instagram" — String, no enum

  mimeType    String
  sizeBytes   Int
  width       Int?
  height      Int?
  durationSec Int?
  blurhash    String?                  // placeholder mientras carga

  alt        String?
  caption    String?
  order      Int     @default(0)       // drag & drop en el admin
  isFeatured Boolean @default(false)

  galleryId String
  gallery   Gallery @relation(fields: [galleryId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([galleryId, order])
  @@index([status])
  @@index([type, isFeatured])
}

// ------------------------------------------------------------
//  PAQUETES — Básico S/300 · Pro S/600 · Premium S/900
// ------------------------------------------------------------

model Package {
  id       String  @id @default(cuid())
  slug     String  @unique             // "basico", "pro", "premium"
  name     String                      // "BÁSICO"
  subtitle String?                     // "Viral Highlights"

  priceAmount Decimal? @db.Decimal(10, 2)
  currency    String   @default("PEN")
  priceNote   String?

  idealFor String?                     // "Bodas, XV años" — texto de display

  icon        String?                  // "clapperboard" | "trending-up" | "crown"
  imageKey    String?                  // foto de fondo de la tarjeta
  accentColor String?                  // "#D4AF37" — jerarquía visual del flyer
  badgeText   String?                  // "NUESTRO MÁS VENDIDO"

  whatsappMessage String?              // pre-llenado del CTA

  isHighlighted Boolean @default(false)
  isActive      Boolean @default(true)
  order         Int     @default(0)

  items          PackageItem[]
  categories     PackageCategory[]
  leads          Lead[]
  whatsappClicks WhatsappClick[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([isActive, order])
}

// Un paquete sirve a VARIAS categorías (el Premium es "Bodas, XV años")
// y una categoría tiene varios paquetes. Muchos a muchos.
model PackageCategory {
  packageId  String
  categoryId String

  package  Package  @relation(fields: [packageId], references: [id], onDelete: Cascade)
  category Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@id([packageId, categoryId])
}

// Los bullets tal cual aparecen en el flyer.
// Texto libre a propósito: James los edita sin que tú toques nada.
model PackageItem {
  id       String  @id @default(cuid())
  text     String                      // "7 Reels / TikToks en tendencia"
  included Boolean @default(true)      // false = se muestra tachado
  order    Int     @default(0)

  packageId String
  package   Package @relation(fields: [packageId], references: [id], onDelete: Cascade)

  @@index([packageId, order])
}

// ------------------------------------------------------------
//  DIFERENCIADORES — la fila de 4 íconos del flyer
// ------------------------------------------------------------

model Differentiator {
  id       String  @id @default(cuid())
  title    String                      // "ENTREGA RÁPIDA"
  subtitle String?
  icon     String                      // nombre en lucide
  order    Int     @default(0)
  isActive Boolean @default(true)

  @@index([isActive, order])
}

// ------------------------------------------------------------
//  REDES SOCIALES — tabla propia, no columnas fijas
// ------------------------------------------------------------

model SocialLink {
  id       String  @id @default(cuid())
  platform String                      // "tiktok", "youtube" — String, no enum
  handle   String                      // "james_film30" — lo que se muestra
  url      String                      // link completo, no se arma
  icon     String?                     // si es null se deriva de platform
  order    Int     @default(0)
  isActive Boolean @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([isActive, order])
}

// ------------------------------------------------------------
//  TRACKING DE CONVERSIÓN
//  El clic a WhatsApp ES el lead: sin formulario, sin fricción.
// ------------------------------------------------------------

model WhatsappClick {
  id        String   @id @default(cuid())

  packageId String?
  package   Package? @relation(fields: [packageId], references: [id], onDelete: SetNull)

  source    String?  // "hero" | "paquetes" | "footer" — dónde reforzar el CTA

  createdAt DateTime @default(now())

  @@index([createdAt])
}

// ------------------------------------------------------------
//  TESTIMONIOS
// ------------------------------------------------------------

enum TestimonialFormat {
  TEXT         // cita escrita
  SCREENSHOT   // captura del chat o comentario — convierte más
}

enum TestimonialSource {
  WHATSAPP
  INSTAGRAM
  TIKTOK
  DIRECTO
}

model Testimonial {
  id     String            @id @default(cuid())
  format TestimonialFormat @default(SCREENSHOT)
  source TestimonialSource @default(WHATSAPP)

  authorName   String                  // "Camila R."
  authorHandle String?                 // "@camila_r" si vino de IG/TikTok
  avatarKey    String?
  eventType    String?                 // "XV Años"
  eventDate    DateTime?

  quote         String? @db.Text       // si format = TEXT
  screenshotKey String?                // si format = SCREENSHOT
  externalUrl   String?                // link al comentario original

  rating Int?                          // 1-5

  // El testimonio aparece junto a los reels de esa misma fiesta
  galleryId String?
  gallery   Gallery? @relation(fields: [galleryId], references: [id], onDelete: SetNull)

  hasConsent Boolean @default(false)   // NO publicar si es false
  isActive   Boolean @default(true)
  isFeatured Boolean @default(false)
  order      Int     @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([isActive, order])
}

// ------------------------------------------------------------
//  LEADS — formulario secundario (el CTA principal es WhatsApp)
// ------------------------------------------------------------

enum LeadStatus {
  NEW
  CONTACTED
  QUOTED
  WON
  LOST
}

model Lead {
  id      String  @id @default(cuid())
  name    String
  phone   String
  email   String?
  message String? @db.Text

  eventDate DateTime?

  categoryId String?
  category   Category? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  packageId  String?
  package    Package?  @relation(fields: [packageId], references: [id], onDelete: SetNull)

  status LeadStatus @default(NEW)
  notes  String?    @db.Text

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status, createdAt])
}

// ------------------------------------------------------------
//  CONFIGURACIÓN DEL SITIO (fila única, id = "singleton")
// ------------------------------------------------------------

model SiteSettings {
  id String @id @default("singleton")

  // --- Identidad ---
  brandName String  @default("James Film")
  role      String?                     // "CREADOR DE CONTENIDO"
  tagline   String?                     // "Transformo momentos en historias"
  slogan    String?                     // "CREA. CAPTURA. IMPACTA."
  aboutText String? @db.Text            // Markdown, para el resaltado en dorado

  logoKey      String?                  // monograma JM
  signatureKey String?                  // firma manuscrita

  // --- WhatsApp (canal de venta principal) ---
  // Formato internacional SIN el +, listo para wa.me/
  // 994724944 (local) → 51994724944
  whatsappNumber  String?               // "51994724944"
  whatsappDisplay String?               // "994 724 944"
  whatsappMessage String?               // default si el paquete no trae uno
  ctaText         String?               // "¡HABLEMOS DE TU EVENTO!"

  email String?

  // --- Hero ---
  heroMediaKey  String?                 // un reel vertical > imagen fija
  heroPosterKey String?

  footerTagline String?                 // "HISTORIAS REALES. EMOCIONES REALES..."

  // --- SEO / compartir por WhatsApp ---
  metaTitle       String?
  metaDescription String?
  ogImageKey      String?

  updatedAt DateTime @updatedAt
}

// ------------------------------------------------------------
//  USUARIOS DEL ADMIN
// ------------------------------------------------------------

enum Role {
  ADMIN
  EDITOR
}

model User {
  id           String  @id @default(cuid())
  email        String  @unique
  passwordHash String
  name         String
  role         Role    @default(EDITOR)
  isActive     Boolean @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### Mapa de relaciones

```
Category ──< Gallery ──< Media
    │            │
    │            └──< Testimonial
    │
    └──< PackageCategory >── Package ──< PackageItem
                                  │
Lead >────────────────────────────┤
WhatsappClick >───────────────────┘

SocialLink · Differentiator · SiteSettings · User   → sueltos
```

**11 modelos · 1 tabla pivote · 8 enums**

---

## 14. Datos del flyer para el seed

### Paquetes

| | Básico | Pro | Premium |
|---|---|---|---|
| **Subtítulo** | Viral Highlights | Memorias & Tendencias | La Alfombra Roja / Experiencia Viral |
| **Precio** | S/ 300 | S/ 600 | S/ 900 |
| **Badge** | — | NUESTRO MÁS VENDIDO ⭐ | — |
| **Acento** | Dorado | Cyan | Magenta |
| **Ícono** | claqueta | gráfico ascendente | corona |
| **Ideal** | Pequeños eventos, cumpleaños | Quinceañeras, Cumpleaños grandes | Bodas, XV años |

**Bullets Básico**
- Cobertura: 3 - 4 horas
- 7 Reels / TikToks en tendencia
- Cortes dinámicos y ganchos (Hooks)
- Entrega rápida: 24h - 48h
- Material bruto incluido

**Bullets Pro**
- Cobertura: 6 - 7 horas
- 7 Reels / TikToks Virales
- 1 Video Resumen "Aftermovie" (1-2 min)
- 1 Mini-Reel expres (Same Day Edit / 12h)
- Edición ágil, textos dinámicos, música trending
- Material bruto en alta calidad

**Bullets Premium**
- Cobertura completa: hasta 10 horas
- 7 Reels / TikToks Virales
- 1 Video Resumen "Aftermovie" (2-3 min)
- Entrega Express (Reels en 24h)
- Entrevistas y tomas estéticas

### Diferenciadores

| Título | Ícono sugerido (lucide) |
|---|---|
| CALIDAD PROFESIONAL | `camera` |
| ENTREGA RÁPIDA | `zap` |
| CONTENIDO QUE CONECTA | `users` |
| RESULTADOS REALES | `bar-chart-3` |

### Redes

| platform | handle | url |
|---|---|---|
| `tiktok` | `@james_film` | `https://www.tiktok.com/@james_film` |
| `instagram` | `James_film30` | `https://www.instagram.com/james_film30` |

> El handle de Instagram aparece con mayúscula en el flyer, pero Instagram no distingue en la URL. Guarda el `handle` tal como él lo escribe (es su marca) y la `url` en minúsculas.

### SiteSettings

```
brandName       James Film
role            CREADOR DE CONTENIDO
tagline         Transformo momentos en historias
slogan          CREA. CAPTURA. IMPACTA.
aboutText       ¡Hola! Soy **James**, creador de contenido audiovisual.
                Me especializo en capturar y contar historias que
                conectan, inspiran y venden. Llevo tu evento al
                siguiente nivel con videos profesionales y
                **contenido que genera impacto**.
whatsappNumber  51994724944
whatsappDisplay 994 724 944
ctaText         ¡HABLEMOS DE TU EVENTO!
footerTagline   HISTORIAS REALES. EMOCIONES REALES. RECUERDOS PARA SIEMPRE.
```

> `aboutText` va en **Markdown**: en el flyer hay palabras resaltadas en dorado dentro del párrafo ("James", "contenido que genera impacto"). Si lo guardas como texto plano pierdes ese detalle, que es justo lo que le da personalidad al bloque.

---

## 15. Testing

**Requisito del proyecto, no opcional.** Y es exactamente donde el repository pattern se paga solo: si no vas a testear, el patrón te cuesta más de lo que te da.

### La pirámide

| Nivel | Qué prueba | Herramienta | Velocidad |
|---|---|---|---|
| Unit | Servicios, con repositorio en memoria | Jest | ms |
| Integración | Repositorios contra Postgres real | Jest + Neon branch | segundos |
| E2E | Endpoints completos | Supertest | segundos |
| Frontend | Componentes del admin | Vitest + Testing Library | ms |
| Flujos críticos | Login, subida, publicar | Playwright | minutos |

### Unit: el pago del repository pattern

Una implementación en memoria y pruebas de servicio sin base de datos:

```ts
export class InMemoryCategoryRepository extends CategoryRepository {
  private items = new Map<string, Category>();

  async findById(id: string) { return this.items.get(id) ?? null; }
  async slugExists(slug: string) {
    return [...this.items.values()].some(c => c.slug === slug);
  }
  async create(data: CreateCategoryData) {
    const c = { id: randomUUID(), ...data } as Category;
    this.items.set(c.id, c);
    return c;
  }
  // …
}
```

```ts
// en el test
const module = await Test.createTestingModule({
  providers: [
    CategoriesService,
    SlugService,
    { provide: CategoryRepository, useClass: InMemoryCategoryRepository },
  ],
}).compile();
```

Toda la lógica de negocio queda cubierta sin levantar Postgres. Corren en milisegundos, así que puedes ejecutarlos en watch mientras programas.

### Integración: branches de Neon en CI

Acá Neon encaja bien de verdad. En vez de Testcontainers, **una branch efímera por corrida de CI**:

```yaml
- run: neon branches create --name ci-${{ github.run_id }}
- run: npx prisma migrate deploy
- run: npm run test:integration
- run: neon branches delete ci-${{ github.run_id }}
```

Postgres real, aislamiento total entre corridas, y se borra al terminar. Las branches hijas no suman costo de historial.

### Qué testear de verdad

Con tiempo limitado, el orden de prioridad:

1. **`SlugService`** — la generación con colisiones es lógica pura y llena de casos borde
2. **`ExclusiveFlagService`** — que marcar uno desmarque los demás, en transacción
3. **`ReorderService`** — que el orden quede consistente tras reordenar
4. **Auth** — que un usuario sin token no llegue a ningún endpoint de admin
5. **El flujo de subida** — validación de mime, límite de tamaño, que la URL firmada expire
6. **`PrismaExceptionFilter`** — que un slug duplicado devuelva 409 y no 500

### Qué NO testear

No persigas el 100% de cobertura. Los CRUDs que solo delegan al repositorio no aportan nada: estás probando Prisma, no tu código. **Cobertura alta en `services/`, baja en controllers.**

### Frontend

- **Vitest + Testing Library** para los componentes del admin, sobre todo el editor de galería.
- **Playwright** para tres flujos y nada más: login, subir un reel, publicar. Son los que si se rompen, el proyecto no sirve.
- **La validación de video en el navegador necesita test.** Es la única barrera que impide que suba un archivo que nadie puede reproducir.

---

## 16. Producción y observabilidad

### Neon: dos gotchas que rompen deploys

**Necesitas dos connection strings.** Prisma usa el pooler para queries pero las migraciones requieren conexión directa:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")        // …-pooler.neon.tech
  directUrl = env("DIRECT_URL")          // …neon.tech, sin -pooler
}
```

Si te falta `directUrl`, `prisma migrate deploy` falla en el pipeline y el error no dice por qué.

**Scale-to-zero con 5 minutos de inactividad** en el plan free. La primera petición tras el idle tarda cerca de un segundo. No es grave para un admin de una persona, pero conviene saberlo antes de perseguir un fantasma de rendimiento.

**Bonus:** las branches de Neon también sirven para entornos de preview. Una branch por PR, con datos reales y aislados.

### Backups

Neon da hasta **6 horas de historial en el plan free, con tope de 1 GB de cambios**, y **los backups programados no están disponibles en el plan Free**. El restore es una operación de metadatos: rebobina la branch en segundos sin cambiar el connection string.

Eso cubre el "borré algo hace un rato". No cubre el "borré algo el martes pasado".

**Así que el `pg_dump` a R2 va igual:**

```
cron diario → pg_dump → gzip → PUT a r2://backups/YYYY-MM-DD.sql.gz
              lifecycle rule: borrar a los 90 días
```

R2 guarda los archivos, pero si se pierde la base se pierde toda la estructura: qué reel es de qué galería, el orden, los textos, los precios. Es lo único que te salva de verdad, y cuesta cero.

Si algún día pasas al plan Launch, el historial sube a 7 días y se habilitan los backups programados.

### Health check

`@nestjs/terminus` con `/health`. Railway y Render lo necesitan para saber si el contenedor está vivo. Sin él, un deploy roto puede quedarse corriendo sin que nadie lo note. Chequea Postgres y R2.

### Rate limiting

`@nestjs/throttler`, global y **con un límite mucho más estricto en el login**. Un admin con un solo usuario y sin límite de intentos es fuerza bruta esperando a ocurrir.

```ts
@Throttle({ default: { limit: 5, ttl: 60_000 } })
@Post('login')
```

### Refresh tokens en cookie httpOnly

Con JWT solo, o le pones expiración larga (riesgo) o James se desloguea a media subida (peor).

```ts
res.cookie('refresh_token', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/auth/refresh',
  maxAge: 30 * 24 * 60 * 60 * 1000,
});
```

- **Access token**: 15 min, en memoria del cliente. Nunca en `localStorage`.
- **Refresh token**: 30 días, cookie `httpOnly`. El JS del navegador no puede leerla, así que un XSS no se la lleva.
- **Rotación**: cada refresh emite uno nuevo e invalida el anterior. Si aparece uno ya usado, revoca toda la sesión — es señal de robo.
- `path: '/auth/refresh'` hace que la cookie no viaje en cada petición.

### Logging estructurado

`nestjs-pino`, con JSON y request ID. La diferencia entre depurar en producción en cinco minutos o en dos horas.

```ts
LoggerModule.forRoot({
  pinoHttp: {
    redact: ['req.headers.authorization', 'req.headers.cookie'],
    autoLogging: { ignore: req => req.url === '/health' },
  },
});
```

El `redact` no es opcional: sin él acabas con tokens en texto plano en los logs.

### Sentry

Free tier, en API y admin. Cuando un upload falle en el celular de James un domingo, quieres el error, no una llamada.

Enlaza el request ID de pino con el de Sentry para saltar del error al log completo.

### Cloudflare Web Analytics

En la landing. Gratis, sin cookies, sin banner de consentimiento, y ya estás en Cloudflare.

**Lo importante es trackear el clic al botón de WhatsApp**, y con qué paquete:

```js
document.querySelectorAll('[data-whatsapp]').forEach(btn => {
  btn.addEventListener('click', () => {
    navigator.sendBeacon('/api/track', JSON.stringify({
      event: 'whatsapp_click',
      package: btn.dataset.package,
    }));
  });
});
```

Es **la única métrica que le importa a James**: cuánta gente le escribe, y desde qué paquete. Sin eso la web es una caja negra y no vas a saber qué mejorar.

El `sendBeacon` apunta a un endpoint público propio, no a Cloudflare:

```
POST /track/whatsapp          ← público, con rate limiting
{ packageId?, source }        → una fila en WhatsappClick
```

Se guarda en tu base porque el dashboard del admin (§9) necesita agregarlo y desglosarlo por paquete. Cloudflare Analytics cubre visitas y páginas; esto cubre conversión.

A 50 clics al mes son 600 filas al año. No hace falta agregación ni limpieza.

---

## 17. Convenciones

**Guarda `storageKey`, nunca la URL completa.** Un campo `storageKey` en la entidad, y la URL se construye en el serializer. El día que cambies de proveedor no migras la base de datos.

**Todo detrás de un `StorageService`.** Interfaz con `getUploadUrl()`, `delete()`, `getPublicUrl()`, y adaptadores por proveedor. Como R2 es S3-compatible, es el mismo `@aws-sdk/client-s3` cambiando el endpoint. Migrar a S3 o de vuelta es tocar un archivo.

**Nombres de archivo con UUID, nunca el nombre original del usuario.** Evita colisiones y previene path traversal.

**Las portadas (`coverKey`) son keys sueltas, no relaciones a `Media`.** Evita el ciclo `Category → Media → Gallery → Category` y simplifica el borrado.

**`status: PENDING | READY | FAILED` en `Media`** es lo que permite mostrar "procesando…" en el admin en vez de una galería rota.

**Un `UpdateDto` nunca se escribe a mano** — siempre `PartialType(CreateDto)`.

**`minmax(0, 1fr)` en vez de `1fr`** en toda grilla CSS. Es la causa número uno de scroll horizontal.

**Ningún componente conoce el dominio del CDN.** Solo el `MediaUrlInterceptor` lee `CDN_BASE_URL`.

**`XMLHttpRequest` para subir, no `fetch`** — `fetch` no emite progreso de subida.

**Todo endpoint que crea algo acepta `Idempotency-Key`.** Las redes móviles reintentan solas.

**Tres anchos de imagen en todo el sitio: 400, 800, 1600.** Un `width` distinto por componente multiplica las transformaciones de Cloudflare sin necesidad.

**El máster nunca se sirve.** `masters/` es backup; la entrega sale de `media/` y `fotos/`.

**Nada fuera de `apps/api` importa `@prisma/client`.** Si hace falta un tipo, va a `packages/contracts` escrito a mano. Está forzado por ESLint, no por buena voluntad.

**Toda imagen y video lleva `aspect-ratio` reservado.** Es lo que mantiene el CLS por debajo de 0.1.

**Animaciones solo con `transform` y `opacity`.** Animar `top`, `left` o `width` fuerza reflow y hunde el INP.

**Lenis solo por encima de 1024px.** En móvil no se nota y es donde Google mide.

---

## 18. Orden de construcción

**Principio: lo más incierto primero.** La landing es trabajo conocido; la subida desde el iPhone de James no. Si algo va a obligar a replantear, mejor descubrirlo en la semana 2 que en la 6.

| # | Fase | Qué entra | Duración |
|---|---|---|---|
| 1 | **Base** | Monorepo pnpm, ESLint, Prettier, schema, primera migración, seed con los datos del flyer | ~1 día |
| 2 | **API mínima** | Auth con refresh en cookie, módulo galerías, módulo media con presign a R2 | ~3 días |
| 3 | **Editor de galería** | Validación en navegador, poster, drag & drop, multipart, estados | ~1 semana |
| 4 | **Resto del admin** | Categorías, paquetes, testimonios, configuración | ~3 días |
| 5 | **Landing** | Tokens, hero, grilla, paquetes, testimonios, WhatsApp. **Animaciones al final, midiendo INP en cada paso** (§6) | ~1 semana |
| 6 | **Cierre** | Dashboard, observabilidad, SEO, E2E, checklist de lanzamiento | ~3 días |

**La fase 3 es la que decide el proyecto.** Concentra el 60% del esfuerzo del admin y todo el riesgo técnico. Ponerla tercera —antes de la landing, que es lo divertido— es lo que evita descubrir en la semana 6 que algo obliga a rehacer.

**No empieces por la landing.** Es la tentación natural porque es visible y ya tienes los tokens. Pero es también la parte con menos incógnitas: si la dejas para el final, llegas con la arquitectura ya probada.

---

## 19. Legal

**No es opcional.** La web va a publicar fotos y videos de invitados a bodas y de menores en quinceañeras.

### Lo que hace falta

**Política de privacidad.** Perú regula los datos personales con la **Ley 29733**. Aplica a los testimonios (capturas con nombre y foto de perfil) y también al contenido: un reel donde se identifica a personas es tratamiento de datos.

**Consentimiento de imagen.** Los novios contratan a James, pero **los invitados que salen en un reel no firmaron nada**. Y en XV años hay menores de edad, donde el consentimiento debe darlo quien ejerce la patria potestad.

Lo práctico:

- Una cláusula en el contrato de James autorizando uso promocional del material.
- Un correo de contacto visible para solicitar retirada de contenido.
- **El mecanismo técnico ya existe**: `Gallery.isPublished = false` saca la galería sin borrar el archivo. Solo faltaba la vía para que alguien lo pida.

**Términos de uso.** Breves. Quién es el titular del sitio, propiedad intelectual del material, y que los precios publicados son referenciales.

> Esto no es un tema técnico, pero **es el único punto del documento que puede traerle un problema real a James.** Media hora de un abogado o una plantilla adaptada, y queda resuelto.

---

## 20. SEO y lanzamiento

### Open Graph: la primera impresión

**James manda el link por WhatsApp veinte veces al día.** Si sale sin imagen, parece un enlace sospechoso. Es el elemento de SEO con más impacto directo en su negocio.

```html
<meta property="og:title"       content="James Film · Creador de contenido audiovisual">
<meta property="og:description" content="Reels y aftermovies para bodas, XV años y eventos en Ayacucho.">
<meta property="og:image"       content="https://media.jamesfilm.com/og/default.jpg">
<meta property="og:image:width"  content="1200">
<meta property="og:image:height" content="630">
<meta property="og:type"        content="website">
<meta name="twitter:card"       content="summary_large_image">
```

- **1200×630 px exactos.** Otras proporciones se recortan y suelen cortar el logo.
- **Imagen absoluta y accesible sin auth.** Es el error más común.
- **JPEG, no WebP.** Algunos clientes de mensajería aún no lo previsualizan.
- **Una OG por galería**, usando su `coverKey`. Así compartir "XV de Camila" muestra esa fiesta, no la portada genérica.

### Core Web Vitals, y el riesgo de las animaciones

Los umbrales vigentes:

| Métrica | Bueno | Malo |
|---|---|---|
| LCP | < 2.5 s | > 4.0 s |
| **INP** | **< 200 ms** | > 500 ms |
| CLS | < 0.1 | > 0.25 |

**INP reemplazó a FID** y mide la respuesta del sitio a cada interacción. Un INP pobre indica que el hilo principal está bloqueado por JavaScript pesado.

> **Esto choca de frente con las animaciones.** GSAP + ScrollTrigger + Lenis corriendo a la vez es exactamente lo que bloquea el hilo principal. El sitio se ve espectacular y falla INP.
>
> Mitigación: cargar con `client:visible`, usar solo `transform` y `opacity` (nunca `top`/`left`/`width`), y `will-change` con moderación. **Medir con datos de campo (CrUX), no solo con PageSpeed en local** — Google usa datos reales para el ranking.

También: desde diciembre de 2025 Google puede excluir de la cola de renderizado las páginas que devuelven códigos distintos de 200.

### Datos estructurados

**La estructura es el lenguaje de los LLMs.** Ya no es solo para rich snippets: es lo que determina si ChatGPT, Claude o las AI Overviews citan el sitio.

| Schema | Dónde | Para qué |
|---|---|---|
| `LocalBusiness` | Home | Negocio local + `makesOffer` con los precios |
| `VideoObject` | Cada reel destacado | Entrar en la pestaña de videos |
| `FAQPage` | Sección de preguntas | **La IA cita mucho contenido de FAQ** |
| `BreadcrumbList` | Categorías y galerías | Navegación en resultados |

**Cuidado con el schema drift**: si el JSON-LD dice un precio y la página muestra otro, Google pierde confianza en los datos. Como los precios salen de la misma base, el riesgo es bajo — pero no los hardcodees en el schema.

**Añade una sección de FAQ a la landing.** Cinco preguntas reales: "¿cuánto cuesta un video de boda en Ayacucho?", "¿en cuánto tiempo entregas?", "¿cubres fuera de la ciudad?". Responde directo en la primera frase y amplía después. Es el formato que la IA extrae y cita.

### robots.txt con crawlers de IA

Ya no basta con `User-agent: *`. Hay que diferenciar buscadores tradicionales de crawlers de IA:

```
User-agent: *
Allow: /

User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: Google-Extended
Allow: /

Sitemap: https://jamesfilm.com/sitemap.xml
```

**Para James conviene permitirlos todos.** Quiere ser citado cuando alguien le pregunte a una IA por videógrafos en Ayacucho. Bloquearlos solo tiene sentido para quien vende contenido.

**Sobre `llms.txt`: está en disputa.** Google ha declarado que no se requiere ningún archivo específico de IA para aparecer en funciones generativas, y hay quien lo considera directamente ruido. Otros lo adoptan igual. Cuesta cinco minutos y no hace daño — pero no le dediques tiempo ni lo consideres decisivo.

### Google Business Profile

**Probablemente el mayor retorno de todo el SEO, y es gratis.** Para un videógrafo local, aparecer en el mapa cuando alguien busca "video para bodas Ayacucho" pesa más que cualquier optimización del sitio.

- Ficha con categoría, teléfono (el mismo WhatsApp), zona de servicio y horario.
- Fotos y videos de su trabajo, subidos directo ahí.
- Pedir reseñas a los clientes que ya dieron testimonio. Es el mismo mensaje de WhatsApp.

Es tarea de James, no tuya, pero debe estar en la entrega.

### Checklist de lanzamiento

**Técnico**
- [ ] Favicon en todos los tamaños (`favicon.ico`, `apple-touch-icon`, 192, 512)
- [ ] `manifest.json` con nombre, colores e íconos
- [ ] `robots.txt` con las reglas de arriba
- [ ] `sitemap.xml` generado y enviado a Search Console
- [ ] Certificado HTTPS y redirección de `www`
- [ ] Página 404 con enlace al home

**Compartir**
- [ ] OG probado en el debugger de Facebook
- [ ] **Link abierto en un WhatsApp real**, no en un simulador
- [ ] OG por galería mostrando su propia portada

**SEO**
- [ ] `LocalBusiness` validado en el Rich Results Test
- [ ] `VideoObject` en los reels destacados
- [ ] Sección FAQ con `FAQPage`
- [ ] Títulos y descripciones únicos por página
- [ ] Google Business Profile creado y verificado

**Rendimiento**
- [ ] LCP < 2.5 s en móvil con 4G simulado
- [ ] INP < 200 ms **con las animaciones activas**
- [ ] CLS < 0.1 — reservar espacio con `aspect-ratio` en toda imagen y video
- [ ] Medido en CrUX, no solo en local

**Final**
- [ ] Probado en el iPhone real de James
- [ ] Botón de WhatsApp abre con el mensaje pre-llenado correcto
- [ ] Tracking de clics registrando en la base
- [ ] `pg_dump` corriendo y verificado restaurando una copia
- [ ] Páginas legales publicadas y enlazadas en el footer

---

## 21. Pendientes

### Abierto

**Bloquea el arranque**

- [ ] Elegir host de la API: Render gratis (se duerme a los 15 min) vs Railway/Fly ~$5/mes
- [ ] Registrar dominio y conectar subdominio `media.` al bucket de R2 *(pospuesto: para desarrollar sirve la URL de `r2.dev`, pero se cae en producción por rate limit)*

**Durante el desarrollo**

- [ ] Contador de uso de R2 en el dashboard del admin (suma de `Media.sizeBytes`)
- [ ] Configurar el cron de `pg_dump` a R2 antes de meter datos reales
- [ ] Probar el editor en el iPhone real de James — al terminar el admin, junto con la sesión de entrega


**Antes de entregar**

- [ ] Sesión de 15 min con James: preset de exportación en CapCut y cómo usar el admin
- [ ] Páginas legales: privacidad, términos y consentimiento de imagen (§19)
- [ ] Google Business Profile creado y verificado — tarea de James
- [ ] Checklist de lanzamiento completo (§20)

### Cerrado

- [x] **Postgres, no MongoDB** — el modelo es relacional puro
- [x] **Sin worker de ffmpeg** — James sube ya editado; validación en el navegador
- [x] **Sin Redis en v1** — cae junto con el worker
- [x] **Testimonios cargados por James** — el link con token queda para después
- [x] **Paquetes ilimitados** con un único destacado, forzado en la API
- [x] **Sin librería de componentes** — el flyer ya es el sistema de diseño
- [x] **Paleta reducida a 3 familias** — void / bone / brass, con acento único
- [x] **Bricolage Grotesque + Inter** como tipografías
- [x] **Framer descartado** — no permite exportar código, incompatible con la arquitectura
- [x] **Subida optimizada para iPhone** — Wake Lock, multipart >50MB, HEIC → WebP
- [x] **Admin como PWA** instalable (sin Web Share Target: iOS no lo soporta)
- [x] **`order: Int` se queda** — fractional indexing anotado solo como escape futuro
- [x] **Máster ≠ entrega** — 4K en el disco de James, 1080p CRF 20 en la web
- [x] **Sin autoplay en la grilla** — posters estáticos, solo el hero se mueve
- [x] **Worker documentado pero no construido** (§22) — sin Redis cuando toque
- [x] **Despublicar en vez de borrar** cuando se llene el free tier de R2
- [x] **AVIF lo genera Cloudflare al vuelo** — no hay conversión en el admin ni variantes guardadas
- [x] **Fotos a 2560px / JPEG q95 antes de subir** — la regla que más espacio ahorra
- [x] **Curar 3 reels por evento**, no volcar los 7 — mejor portafolio y menos peso
- [x] **Acuerdo con James cerrado**: másters 4K en su disco, a la web solo 1080p CRF 20
- [x] **La paleta queda como está** — son variables de Tailwind; cambiarla es una línea
- [x] **James llena categorías, galerías y reels** desde el admin; no hay migración de datos
- [x] **No se pide el archivo original del flyer** — los hex derivados son suficientes
- [x] **Monorepo con pnpm workspaces** — sin Nx ni Turborepo
- [x] **DTOs escritos a mano en `packages/contracts`**, nunca reexportados de Prisma
- [x] **Prisma solo en `apps/api`** — la única forma de que el monorepo rompa la separación
- [x] **Node y pnpm fijados** con `packageManager`, `engines` y `engine-strict`
- [x] **ESLint prohíbe importar Prisma desde el frontend** — la arquitectura como regla, no como intención
- [x] **Prettier único en la raíz**, sin hooks de pre-commit
- [x] **Orden de construcción fijado** (§18) — el editor de galería va tercero, antes de la landing
- [x] **Crawlers de IA permitidos** en robots.txt — James quiere ser citado, no protegerse
- [x] **`llms.txt` opcional** — Google dice que no se requiere; cinco minutos, sin expectativas
- [x] **GSAP + ScrollTrigger se quedan**; Lenis solo en escritorio y medido al final
- [x] **Dashboard entra al v1** como pantalla 8 — clics a WhatsApp, uso de R2 y avisos accionables
- [x] **`Lead` fuera del v1** — el clic a WhatsApp es el lead; el modelo se queda por si acaso
- [x] **Sin gráficos ni visitas en el dashboard** — CF Analytics cubre eso, duplicarlo se contradice
- [x] **GSAP + Lenis** para animación, cargados con `client:visible`
- [x] **Siete pantallas de admin** + barra de estado de publicación
- [x] **Responsive obligatorio** en landing y admin, móvil / tablet / escritorio
- [x] **Repository pattern** con contrato abstracto + UnitOfWork por AsyncLocalStorage
- [x] **class-validator + class-transformer + Swagger** con el plugin de inferencia
- [x] **Testing obligatorio** — unit con repos en memoria, integración con branches de Neon
- [x] **Neon como Postgres** + `pg_dump` diario a R2 (el free tier solo da 6h de historial)
- [x] **Observabilidad**: health, throttler, refresh en cookie httpOnly, pino, Sentry, CF Analytics

### Deuda técnica aceptada a propósito

**Sin campos estructurados en `Package`** (tipo `coverageHours`, `reelsCount`). Los bullets ya dicen "Cobertura: 6-7 horas"; guardarlo también estructurado obliga a James a escribir lo mismo dos veces y tarde o temprano se desincronizan. Si más adelante quieres una tabla comparativa de los tres paquetes, ahí se agregan y los bullets se generan solos.

**Sin tabla `SiteCopy`** para títulos de sección. Van en `src/content/copy.ts`. Si algún día James los quiere editar, se migra.

**El modelo `Lead` se queda sin escritor.** No se construye el formulario en el v1, así que la tabla existirá vacía. Cuesta cero y evita una migración si más adelante quiere capturar consultas fuera de horario.

**Resumen semanal por correo, para el v2.** Cuando James lleve seis meses y entre menos al admin, un correo con "12 clics esta semana, 1 subida falló" vale más que el dashboard entero. Requiere Resend, plantillas, cron y desuscripción — fuera del v1.

**Validación de video solo en el cliente.** Un atacante con la URL firmada podría subir cualquier cosa saltándose el navegador. El impacto real es bajo (solo James tiene acceso al admin, y lo peor que pasa es que un video no se vea), pero si algún día abres las subidas a terceros, esa validación tiene que moverse al servidor.

---

## 22. Anexo: worker de transcodificación sin Redis

**No se construye ahora.** Queda documentado para el día en que James quiera subir el 4K crudo y olvidarse del preset de exportación.

### Un worker no implica Redis

Redis lo pide BullMQ, no el concepto. **`Media.status` ya es una cola.** Postgres da persistencia, reintentos y coordinación entre procesos — las tres cosas por las que existiría Redis.

```
1. James sube el archivo → status = PENDING
2. Un timer en la misma app pregunta cada 30s: "¿hay algún PENDING?"
3. Si hay: lo marca PROCESSING, corre ffmpeg, lo pasa a READY
4. Si falla: FAILED con el mensaje de error
```

El timer vive en el mismo contenedor de NestJS. Sin servicio nuevo, sin dependencia nueva.

```ts
@Injectable()
export class MediaProcessor {
  @Cron('*/30 * * * * *')
  async procesarPendientes() {
    const media = await this.reclamarSiguiente();
    if (!media) return;

    try {
      await this.transcodificar(media);
      await this.repo.update(media.id, { status: 'READY' });
    } catch (e) {
      await this.repo.update(media.id, { status: 'FAILED', error: e.message });
    }
  }
}
```

### Reclamar el trabajo de forma segura

Lo único no trivial. Si corres dos instancias de la API, ambas podrían tomar el mismo video:

```sql
UPDATE "Media"
SET status = 'PROCESSING', "claimedAt" = now()
WHERE id = (
  SELECT id FROM "Media"
  WHERE status = 'PENDING'
  ORDER BY "createdAt"
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
RETURNING *;
```

`FOR UPDATE SKIP LOCKED` hace que dos procesos concurrentes se lleven filas distintas en vez de pelearse. Es el mismo mecanismo que usan por dentro las colas serias sobre Postgres.

### Recuperar trabajos colgados

Si el contenedor se reinicia a media transcodificación:

```sql
UPDATE "Media" SET status = 'PENDING'
WHERE status = 'PROCESSING' AND "claimedAt" < now() - interval '15 minutes';
```

Un cron cada 5 minutos y los huérfanos vuelven solos a la cola.

### Cambios al schema

```prisma
model Media {
  status    MediaStatus @default(PENDING)
  claimedAt DateTime?
  attempts  Int         @default(0)
  error     String?
}

enum MediaStatus {
  PENDING
  PROCESSING   // ← nuevo
  READY
  FAILED
}
```

### El comando

```bash
ffmpeg -i input.mp4 \
  -c:v libx264 -crf 20 -preset slow -profile:v high \
  -vf "scale=-2:1920" \
  -c:a aac -b:a 192k \
  -movflags +faststart \
  output.mp4
```

### Lo que cuesta

```dockerfile
RUN apt-get update && apt-get install -y ffmpeg
```

Suma ~150 MB a la imagen y sube el consumo de RAM durante el transcode. Un contenedor de 512 MB se queda corto con 4K; con 1 GB va bien. **Ahí es donde el host gratuito deja de alcanzar** y pasas a ~$5/mes.

### Lo que pierdes frente a BullMQ

Sin dashboard, sin backoff sofisticado, sin prioridades, sin trabajos programados. Y el polling de 30s significa que un video puede esperar medio minuto antes de empezar.

Para ocho videos por semana, nada de eso importa.

### Cuándo construirlo

- James sube archivos mal formateados de forma repetida pese a los mensajes de validación
- Se abren las subidas a terceros (un segundo camarógrafo, clientes)
- Hace falta generar varias resoluciones para ABR

Mientras el preset de exportación funcione, esto sería infraestructura para un problema que una instrucción resuelve.
