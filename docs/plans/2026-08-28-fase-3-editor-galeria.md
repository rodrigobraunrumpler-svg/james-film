# Fase 3 — Editor de galería · Plan de implementación

> **Para ejecutores agénticos:** SUB-SKILL REQUERIDA: `superpowers:subagent-driven-development`
> o `superpowers:executing-plans`. Los pasos usan checkbox.

**Goal:** Que James pueda entrar al admin desde su iPhone, abrir la galería de una boda y subir
sus reels — validados, con poster, ordenables y publicables.

**Architecture:** Next 16 App Router con `src/features`. La sesión vive en una cookie `httpOnly`
del dominio del admin y una pasarela (`app/api/[...ruta]/route.ts`) adjunta el `Bearer` en el
servidor: **el token nunca llega al JavaScript del navegador**. Los datos van por TanStack Query
contra esa pasarela; los archivos van **directos a R2** con URL firmada, sin pasar por ningún
servidor.

**Tech Stack:** Next 16 · React 19 · TanStack Query 5 · nuqs · zustand · react-hook-form + zod ·
shadcn/ui sobre Radix · @dnd-kit · motion · vaul · sonner · Tailwind 4 · Vitest + Testing Library
+ happy-dom · Playwright

**Spec:** `CLAUDE.md` · `docs/admin.md` (stack y cliente HTTP) · `docs/proyecto.md` §7, §9, §10

## Global Constraints

Además de todo lo de `CLAUDE.md` y `docs/admin.md`:

- **`app/` solo enruta.** Sin lógica, sin fetch, sin JSX largo.
- **Ninguna feature importa de otra.** Si dos la necesitan, sube a `components/shared` o `lib`.
- **`'use client'` en la hoja, no en el contenedor**, o arrastras el árbol entero al cliente.
- **`server-only`** en todo módulo que toque el token. Si se importa desde cliente, no compila.
- **`XMLHttpRequest` solo para el `PUT` a R2** — `fetch` no emite progreso de subida.
- **Los DTOs vienen de `@james-film/contracts`** y no se redeclaran.
- **Solo `transform` y `opacity`** en animaciones. `prefers-reduced-motion` respetado.
- **Targets táctiles ≥44×44 px.** Modales → hojas a pantalla completa bajo `md`.
- Nada deprecado ni en preview. `npm view <pkg> dist-tags` antes de fijar versión.

## Fuera de esta fase

Categorías, paquetes, testimonios y configuración (fase 4). El dashboard (fase 6). La landing
(fase 5). **Multipart: se decide en el Task 8**, tras probar un aftermovie real por 4G.

---

## Task 0 · Ajustes a la API que la fase 3 necesita

Cinco cambios en `apps/api`. **Van primero**: si se empieza por el frontend, se descubre a media
fase que la API no lo soporta. Cada uno sale de la revisión (`2026-08-28-fase-3-revision.md`).

- [ ] **Step 1: El poster pasa a JPEG.**  🔴

`canvas.toBlob('image/webp')` **no existe en Safari**, ni iOS ni macOS, ninguna versión. Y la
especificación obliga a caer a **PNG sin lanzar error**. En el iPhone de James, que es el
dispositivo principal, eso significa que *ningún* reel tendría poster nunca:

- Si el cliente declara `posterMimeType: 'image/png'` → nuestro `@IsIn(MIMES_POSTER)` rechaza y,
  como `presign` valida el lote entero antes de firmar, **tumba los ocho reels**.
- Si lo declara como webp a ciegas → el `content-type` va dentro de la firma
  (`signableHeaders`), el blob es PNG, y R2 responde **403**.

Y falla mudo: `confirmar()` anula el `posterKey` cuando el HEAD falla, así que la galería sale sin
miniaturas y nadie sabe por qué.

```ts
// media.rules.ts
export const MIMES_POSTER = ['image/jpeg'] as const;

// media.service.ts · firmarUno — hoy el webp está hardcodeado DOS veces
const posterKey = item.posterMimeType
  ? `posters/${uuid}.${extensionDe(item.posterMimeType)}` : null;
// …y en el getUploadUrl del poster:
contentType: item.posterMimeType,
```

JPEG además es coherente con la regla ya cerrada: las fotos van en JPEG porque Cloudflare
re-comprime al servir y comprimir dos veces degrada. El poster lo sirve el mismo CDN.

- [ ] **Step 2: Los medios nuevos nacen al final del orden.**

`order @default(0)` y `firmarUno` no lo calcula. `ReorderService` numera 0..n-1 **solo los ids
que recibe**, así que tras ordenar 8 reels, las dos fotos del martes empatan en 0 con el primero
y **se cuelan al principio**.

El `aggregate` va en `presign`, **no** en `firmarUno`: `Promise.all` haría que los ocho leyeran
el mismo máximo.

```ts
const { _max } = await this.prisma.media.aggregate({
  where: { galleryId, deletedAt: null }, _max: { order: true },
});
const base = (_max.order ?? -1) + 1;
return Promise.all(items.map((item, i) => this.firmarUno(galleryId, item, base + i)));
```

- [ ] **Step 3: `coverUrl` deja de ser siempre `null`.**

`coverKey` **solo aparece en lecturas**: ningún `create`, `update` ni seed lo escribe, y
`marcarPortada` solo toca `isFeatured`. Así que marcar portada no cambia nada visible en la lista.

Se **deriva en el mapper**, no se escribe en `marcarPortada`: escribir `coverKey` metería un
`.mp4` en el campo de portada cuando el vídeo no tiene poster, y duplicaría estado que deriva.

```ts
const claveDePortada = (media) => {
  const p = media.find((m) => m.isFeatured);
  if (!p) return null;
  return p.posterKey ?? (p.type === 'PHOTO' ? p.storageKey : null); // nunca un .mp4 en un <img>
};
```

- [ ] **Step 4: `AdminMediaDto` con `status` y `error`.**

`buscarPorId` filtra solo `deletedAt: null`, o sea que devuelve PENDING y FAILED **con una `url`
construida sobre un objeto que nunca llegó**. Tras la suspensión de la pestaña —que el propio
plan llama "el modo de fallo número uno"— James ve ocho tarjetas idénticas y tres están rotas.

No se añade al `MediaDto` público: movería `openapi-public.json`, que el CI congela, y
contradice la regla de que exponer un campo sea deliberado.

```ts
// contracts — sigue siendo solo tipos
export interface AdminMediaDto extends MediaDto { status: MediaStatus; error: string | null; }
export interface AdminGalleryDto extends Omit<GalleryDto, 'media'> { media: AdminMediaDto[]; }
```

`buscarPorId` se anota `Promise<AdminGalleryDto>` y usa `SELECT_MEDIA_ADMIN`. Y el `_count` de
`listarTodas` pasa a `{ deletedAt: null, status: 'READY' }`: hoy "Medios · 8" cuenta los rotos.

- [ ] **Step 5: `PRESIGN_TTL_SECONDS=3600`.**

Con 900 s, un aftermovie de 115 MB por debajo de 2 Mbps se topa con la firma muerta. La firma
SigV4 admite hasta 7 días y la URL solo la tiene el navegador de James.

- [ ] **Step 6: Verificar** que los 82 tests de la fase 2 siguen verdes y que
  `openapi-public.json` **no** se mueve.

---

## Task 0.5 · Andamiaje de tests del admin

`apps/admin` **no tiene runner**: sin esto, los tests de los Tasks 1 y 5 se escriben y **nunca
corren en un PR**. Y es fácil no darse cuenta, porque `lint` y `typecheck` sí son recursivos.

- [ ] **Step 1: Dependencias** — `vitest`, `@vitejs/plugin-react`, `happy-dom`,
  `@testing-library/react`, `user-event`, `jest-dom`, `msw`, `@playwright/test`.

- [ ] **Step 2: Dos proyectos de Vitest**, no uno.

```ts
projects: [
  // La pasarela usa cookies() de next/headers, que fuera de una petición lanza.
  // Aquí va con next/headers mockeado, y aquí va la lógica pura de bytes.
  { extends: true, test: { name: 'nodo', environment: 'node',
      include: ['src/lib/api/server/**/*.spec.ts', 'src/features/**/*.nodo.spec.ts'] } },
  { extends: true, test: { name: 'dom', environment: 'happy-dom',
      include: ['src/**/*.dom.spec.{ts,tsx}'], setupFiles: ['./vitest.setup.dom.ts'] } },
]
```

- [ ] **Step 3: Al CI**, tras `pnpm --filter api test`:
  `- run: pnpm --filter admin test`  ← **esta línea es la mitad del valor del Task**.

- [ ] **Step 4: Preguntar a James su versión de iOS** y anotarla como suelo soportado.
  `AbortSignal.any` pide Safari 17.4+ y lo usa el cliente HTTP en **todas** las peticiones; Wake
  Lock y `canvas.toBlob` piden 16.4+. Por debajo, el admin no falla en las subidas: falla en la
  **primera petición**, con un `TypeError` que no menciona la versión del sistema. La sesión de
  15 min con James ya está pendiente, así que no añade tarea.

---

## Task 1 · La pasarela y la sesión

**Files:** `src/lib/api/server/{config,session,pasarela}.ts`, `src/app/api/[...ruta]/route.ts`,
`src/app/api/auth/{login,logout}/route.ts`, **`src/proxy.ts`**,
`src/features/auth/**`, `src/app/(auth)/login/page.tsx`

> **`middleware.ts` está DEPRECADO en Next 16** y se llama `proxy.ts`, con
> `export function proxy(request)`. Verificado en la documentación que trae `next@16.3.3`.
> Nuestra regla de "nada deprecado" lo prohíbe, y se rompería en el primer fichero de la fase.
> El fichero de la pasarela pasa a `pasarela.ts` para que "proxy" signifique una sola cosa.

- [ ] **Step 1: Tests de la pasarela** — es donde vive el riesgo.

```ts
it('adjunta el Bearer y NO reenvía la cookie de sesión a la API', async () => { … });
it('un 401 dispara UN refresh y reintenta UNA vez', async () => { … });
it('si el refresh falla, borra la cookie y devuelve 401', async () => { … });
it('los códigos pasan sin aplanarse: un 409 llega como 409', async () => { … });
it('la cookie es httpOnly, sameSite lax y secure en producción', async () => { … });
// `force-dynamic` es una directiva que interpreta el runtime, no una conducta que se
// pueda ejercitar importando el módulo. Se comprueba que la línea sigue ahí, y se dice
// honestamente que la fuga real NO se está probando aquí.
it('la pasarela declara force-dynamic', async () => {
  expect((await import('@/app/api/[...ruta]/route')).dynamic).toBe('force-dynamic');
});
it('logout revoca en la API y borra la cookie aunque la API falle', async () => { … });
```

- [ ] **Step 2 a 5**: `config.ts` con `server-only` y zod (sin `NEXT_PUBLIC_`), `session.ts` con
  `cookies()`, `pasarela.ts`, y `src/proxy.ts` que solo comprueba presencia de la cookie (no hace
  red ni verifica firmas: corre en cada navegación).

- [ ] **Step 5 bis: El logout revoca de verdad.** `POST /auth/logout` de la API es el **único**
  sitio donde se revoca la sesión. Si el Route Handler solo borra la cookie, el refresh sigue
  vivo 30 días y el botón no hace lo que dice.

```ts
export async function POST() {
  const s = await leerSesion();
  if (s?.refreshToken) {
    await fetch(`${serverConfig.apiUrl}/auth/logout`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: s.refreshToken }), cache: 'no-store',
    }).catch(() => {});   // si la API no responde, la cookie se borra igual
  }
  await borrarSesion();
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 6: Pantalla de login.** `react-hook-form` + zod. Los errores del servidor se atan
  por `code`: `INVALID_CREDENTIALS` → mensaje en el formulario, `RATE_LIMITED` → "demasiados
  intentos, espera un minuto".

---

## Task 2 · Armazón del admin

**Files:** `src/lib/api/{config,errors,http,keys}.ts`, `src/lib/query/*`,
`src/components/ui/*` (shadcn), `src/app/(panel)/layout.tsx`, `src/lib/format/*`

- [ ] **Step 1: El cliente del navegador**: mismo origen, sin credenciales, `AbortSignal.any`.
  **Desenvuelve el sobre**: `{ success, data, meta }` → `{ data, meta }`.

  **El `ApiError` de `docs/admin.md` no sirve tal cual**: solo guarda `status`, `message` y
  `body: unknown`, y su `toError` parsea `body.message` como el array del `ValidationPipe`, un
  formato que la API **ya no emite**. Con esa pieza, el `switch (error.code)` del Task 1 y el
  `details[].field → setError` del Task 4 no compilan.

```ts
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly details?: FieldError[];
  constructor(readonly status: number, cuerpo: ApiFailure | undefined, mensaje?: string) {
    super(cuerpo?.message ?? mensaje ?? `Error ${status}`);
    this.name = 'ApiError';
    this.code = cuerpo?.code ?? 'INTERNAL';
    this.details = cuerpo?.details;
  }
  get esSesionMuerta() {
    return this.code === 'SESSION_EXPIRED' || this.code === 'SESSION_REVOKED' || this.status === 401;
  }
}
```

- [ ] **Step 2: `QueryClient` con defaults deliberados.**

```ts
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // No reintentar lo que no se arregla reintentando: un 404 o un 422 no
      // cambian por insistir, y cada reintento retrasa el mensaje de error.
      retry: (intentos, error) => isApiError(error) && error.isRetryable && intentos < 2,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
});
```

- [ ] **Step 3: Cierre de sesión global.** Un `QueryCache.onError` que ante `isUnauthorized`
  limpia la caché y navega a `/login`. Sin esto, cada pantalla tendría que manejarlo.

- [ ] **Step 4: Layout del panel** con route groups `(auth)` y `(panel)`, sidebar → drawer bajo
  `lg` con `vaul`, y `env(safe-area-inset-bottom)` en la barra fija.

- [ ] **Step 4 bis: `viewport-fit=cover`.** Sin esto `env(safe-area-inset-bottom)` vale **0** en
  el iPhone: el CSS compila, se ve bien en el emulador, y la barra de publicación —"el hueco más
  importante" de §9— queda debajo del indicador de inicio.

```ts
export const viewport: Viewport = {
  width: 'device-width', initialScale: 1,
  viewportFit: 'cover',   // sin esto env(safe-area-inset-*) es 0
  // Sin maximumScale ni userScalable: §7 exige que el zoom al 200% funcione.
};
```

- [ ] **Step 5: Formato con `Intl`** — `fecha()` con `timeZone: 'UTC'`, `fechaHora()` con
  `America/Lima`, `relativo()` y `moneda()` desde céntimos. Con tests de los casos borde.

---

## Task 3 · Lista de galerías

- [ ] **Step 1: Filtros en la URL con nuqs**, y ese mismo objeto **es** la clave de caché.
- [ ] **Step 2: `placeholderData: keepPreviousData`.** Sin esto, cambiar de filtro hace parpadear
  la pantalla entera en cada pulsación.
- [ ] **Step 3: Skeleton con la forma real** en `loading.tsx`, y estado vacío con acción
  ("Aún no tienes galerías → Crear la primera"): es el momento en que James decide si la
  herramienta le sirve (§9).
- [ ] **Step 4: Tabla bajo `md` → tarjetas apiladas.** No scroll horizontal dentro de una página
  que ya scrollea vertical (§7).

---

## Task 4 · El editor: datos y autoguardado

- [ ] **Step 0: Reconciliar al montar.**  🔴 Por cada medio que llegue en `PENDING`,
  `POST /admin/media/:id/confirm`. Es idempotente y hace HEAD: lo que llegó entero pasa a READY
  **sin volver a subir un byte**, y lo que no, a FAILED con el mensaje que la API ya redacta.

  **El servidor es la lista de pendientes: no se persiste nada en el navegador.** Tras una
  recarga el `File` ya no existe en memoria, así que la acción de una tarjeta rota es
  **Descartar** y volver a elegir el archivo, no "Reintentar la subida".

  Es la red de seguridad real ante la suspensión de pestaña de iOS — el Wake Lock solo es una
  mitigación parcial.

- [ ] **Step 1: Formulario** con `react-hook-form` + zod: título, descripción, categoría, fecha
  (`<input type="date">` nativo, que en el iPhone abre el selector de iOS) y lugar.
- [ ] **Step 2: Autoguardado con debounce de 2 s.** Ni spinner ni toast: una línea discreta
  `Guardando…` → `Guardado hace un momento`.
- [ ] **Step 3: Los errores del servidor se atan por campo** con `details[].field` →
  `setError(field, { message })`. Sin parsear nada.

---

## Task 5 · Validación en el navegador  🔴 el corazón

**Es lo que hace innecesario el worker de ffmpeg** (§4), así que es el módulo con más tests de
la fase. Pero **no es todo lógica pura**, y esa distinción decide cómo se testea:

| Capa | Qué | Dónde se prueba |
|---|---|---|
| **1 · Puro** | `tieneFaststart` (parseo de cajas), `validarArchivo({name,size,type})`, `bitrate`, `escalarA` | proyecto `nodo` — `Blob` y `File` son globales en Node 24 |
| **2 · Orquestación** | `extraerPoster(file, deps)` con fábricas inyectadas | proyecto `nodo`, con un vídeo falso que emite eventos en el orden que decide el test |
| **3 · Decodificación real** | que el poster tenga píxeles, que el HEIC se convierta | **Playwright y el iPhone**, Task 8 |

> **happy-dom no decodifica vídeo ni rasteriza canvas**: `loadedmetadata` no dispara, `duration`
> es `NaN`, `toBlob` no produce píxeles. Un test de poster ahí **pasa sin comprobar nada**, que
> es peor que no tenerlo. Y **el caso HEIC no es automatizable**: ningún navegador de Linux lo
> decodifica, tampoco el WebKit de Playwright. Va al checklist del iPhone.

De la capa 2 sí se puede afirmar lo único afirmable sin decodificador: que el `seek` va
**después** de `loadedmetadata`, que un `onerror` da mensaje accionable, y que
**`revokeObjectURL` se llama también en la rama de error** — el snippet de §10 solo lo revoca en
el camino feliz.

- [ ] **Step 1: Los tests primero.**

```ts
describe('validarVideo', () => {
  // "lo que el navegador no puede reproducir" es el criterio equivocado en el único
  // navegador que importa: iOS Safari REPRODUCE HEVC desde iOS 11. §15 lo pide explícito.
  it('rechaza un .mov/HEVC antes de firmar nada, con mensaje accionable', …);
  it('un archivo de 300 MB se rechaza antes de empezar a subir', …);
  it('rechaza por encima de 2160p diciendo qué hacer en CapCut', …);
  it('rechaza bitrate > 15 Mbps: se trabaría en datos móviles', …);
  it('acepta un 1080p a CRF 20', …);
});

describe('tieneFaststart', () => {
  it('detecta moov antes de mdat', …);
  it('lo rechaza si moov va después: el navegador descargaría el archivo entero', …);
  it('no lee más de 64 KB del archivo', …);
});

describe('extraerPoster', () => {
  it('saca el frame del medio, no el primero (suele ser negro)', …);
  it('el seek va DESPUÉS de loadedmetadata, nunca antes', …);
  it('devuelve width, height y duration junto al poster', …);
});

describe('normalizarImagen', () => {
  it('convierte HEIC a JPEG q95: Cloudflare no procesa HEIC', …);
  it('respeta la orientación EXIF: una foto vertical no sale girada', …);
  it('redimensiona a 2560px de lado largo', …);
  it('NO re-encodea un JPEG que ya cumple', …);
});
```

- [ ] **Step 2: Espejo de los límites de la API, antes del presign.**

Las constantes del plan no tenían **ningún umbral en MB**. Un aftermovie largo a 1080p con
bitrate legal (10 min a 4 Mbps ≈ 300 MB) pasa las cuatro validaciones, **se decodifica entero en
el iPhone**, se sube por datos móviles y rebota en el presign — que además tumba los otros siete
porque valida el lote completo.

```ts
// constants/limites.ts — espejo de MAX_VIDEO_MB / MAX_IMAGE_MB de la API.
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

// Tipado estructural: un File lo satisface, y el test no materializa 300 MB.
type ArchivoElegido = { name: string; size: number; type: string };
```

Un archivo que no pase **no entra en el array del presign**.

- [ ] **Step 3: `extraerPoster` con timeout y limpieza en `finally`.**

El patrón de §10 no tiene salida si iOS no dispara ni `loadedmetadata` ni `error`: el archivo se
queda en VALIDANDO indefinidamente, un estado terminal que la máquina no contempla. Un archivo
colgado sin error es peor que uno rechazado.

```ts
const esperar = <T,>(p: Promise<T>, ms = 15_000) => Promise.race([p,
  new Promise<never>((_, rej) => setTimeout(() => rej(
    new ErrorValidacion('No se pudo leer este vídeo. Exporta MP4 / H.264 desde CapCut.')), ms))]);

finally {
  URL.revokeObjectURL(url);
  video.removeAttribute('src');
  video.load();   // libera el decodificador; revokeObjectURL solo no basta
}
```

**La extracción de poster va con concurrencia 1**: un solo `<video>` decodificando a la vez. La
concurrencia 3 del Task 6 son las subidas.

- [ ] **Step 4: El poster se genera en JPEG y se declara `blob.type`, nunca una constante.**

```ts
const poster = await new Promise<Blob>((ok, err) =>
  canvas.toBlob(b => (b ? ok(b) : err(new Error('El navegador no pudo generar el poster'))),
                'image/jpeg', 0.8));
// toBlob cae a PNG SIN error ante un tipo no soportado. Se asevera, no se supone.
if (poster.type !== 'image/jpeg') throw new Error('El navegador no pudo generar el poster');
```

- [ ] **Step 5**: `normalizarImagen`, y el resto de constantes (2160, 15 Mbps, 2560 px, 100 MP).

> **La redacción del error importa tanto como la validación** (§4). "Formato no válido" deja a
> James atascado; "Expórtalo a 1080p desde CapCut" lo resuelve solo.

---

## Task 6 · La cola de subidas  🔴 el riesgo

- [ ] **Step 1: Máquina de estados POR ARCHIVO**, no global: si James suelta ocho reels y el
  tercero está en HEVC, los otros siete siguen subiendo.

```
SELECCIONADO → VALIDANDO → EXTRAYENDO_POSTER → FIRMANDO → SUBIENDO → CONFIRMANDO → LISTO
                    ↓                              ↑          ↓            ↓
                 FALLIDO                           └──────────┴─── reintento (vuelve a FIRMAR)
```

**El reintento vuelve a `FIRMANDO`, nunca a `VALIDANDO` ni a `EXTRAYENDO_POSTER`.** Validar,
normalizar y extraer poster se ejecutan **una sola vez por item**, y el `Blob` resultante se
guarda junto a él: la firma incluye `content-length`, así que un `canvas.toBlob` que devuelva
unos bytes distintos deja el item en un 403 permanente que no converge.

- [ ] **Step 1 bis: Identidad y quién pinta la grilla.**

```ts
// Se genera UNA vez, al entrar en la cola, y sobrevive a los reintentos. El nombre del
// archivo NO sirve como identidad: el picker de iOS devuelve 'image.jpeg' para todas las
// fotos, y colisionar en el upsert subiría dos fotos a la misma key.
const clientUploadId = crypto.randomUUID();
```

Es también la **key de React** de la tarjeta, nunca `file.name`.

**La grilla se pinta desde `gallery.media` (TanStack Query), no desde la cola.** La fila PENDING
existe desde el presign, así que la cola **no pinta tarjeta propia** para lo que ya tiene
`mediaId`: solo *decora* la que coincide — progreso, error, botones. Los archivos que aún no lo
tienen se pintan como tarjetas locales con clave `clientUploadId` y se funden con la del servidor
en cuanto el presign responde. **Sin esto, cada archivo en vuelo aparece dos veces.**

- [ ] **Step 2: `zustand` como singleton de módulo**, no creado dentro de un componente. Con
  Context, cada tick de progreso re-renderiza a todos los consumidores.

- [ ] **Step 3: `XMLHttpRequest` con progreso** y `xhr.abort()` para cancelar. Se manda **solo**
  el `Content-Type` firmado y ninguna cabecera más, o el bucket responde 403.

  **Vigilante de estancamiento.** XHR no tiene timeout por defecto, y uno global no sirve: 115 MB
  por 4G tardan minutos legítimamente. En móvil la degradación típica no es un error, es un
  estancamiento, y el hueco de concurrencia queda ocupado para siempre.

```ts
let ultimo = Date.now();
xhr.upload.onprogress = (e) => { ultimo = Date.now(); setProgreso(e.loaded / e.total); };
const vigilante = setInterval(() => {
  // CERO eventos en 30 s, nunca "progreso lento": abortar por lentitud tiraría
  // los 20 MB ya subidos de una conexión sana.
  if (Date.now() - ultimo > 30_000) { clearInterval(vigilante); xhr.abort(); fallar('estancado'); }
}, 5_000);
xhr.onloadend = () => clearInterval(vigilante);
```

- [ ] **Step 3 bis: Cancelar, rendirse y borrar pasan por `DELETE /admin/media/:id`.**  🔴

El `Media` nace `PENDING` **en el presign**, no en la subida: `xhr.abort()` a secas deja una
tarjeta muerta en la grilla hasta el cron de la fase 6. Orden: `xhr.abort()` → si hay `mediaId`,
`DELETE` → quitar de la cola → liberar el hueco → quitar el medio de la caché con `setQueryData`.
Si el `DELETE` falla no se reintenta: el cron lo recoge. **El mismo camino es el botón de
eliminar de cualquier tarjeta**, esté subiendo o READY.

**Un `confirm` que devuelve `FAILED` no se reintenta: se descarta.** `confirmar` corta con
`if (media.status !== 'PENDING')`, así que reintentar el mismo `mediaId` responde 200 y no cambia
nada. Es una rama distinta del backoff del PUT:

```ts
if (resultado.status === 'FAILED') {
  await api.borrarMedia(item.mediaId);        // soft delete
  item.clientUploadId = crypto.randomUUID();  // identidad nueva, o se recupera la fila borrada
  item.mediaId = null;
  return transicionar(item, 'FIRMANDO');
}
```
Solo se reintenta el confirm cuando falla el **transporte**. Un cuerpo con `FAILED` es una
respuesta correcta.

- [ ] **Step 4: Concurrencia 3.** Ocho simultáneas por datos móviles saturan y todas van lentas.
  Y **el total del lote antes de empezar**: `9 archivos · 230 MB` en la confirmación, y
  `Subiendo 3 de 9 · 120 MB de 230 MB` en la cabecera. El dato ya está calculado. Sin aviso
  condicional por tipo de red: `navigator.connection` no existe en Safari y una heurística
  inventada mentiría.

- [ ] **Step 5: Reintento con presupuesto temporal, no con un contador.**

Backoff 1s/2s/4s/8s mientras el tiempo total del item sea **< 5 min**. "Tres intentos" son 7
segundos de presupuesto, y en Ayacucho una caída de señal dura 20-60 s: el plan trataría como
permanente justo la intermitencia que dice cubrir.

**Antes de cada reintento se vuelve a firmar ese item.** `presign` con `items: [ese uno]` y el
**mismo `clientUploadId`**: el `upsert` con `update: {}` devuelve el mismo `mediaId` y la misma
`storageKey`, no crea filas. Así el segundo intento siempre lleva URL fresca **y da igual por qué
falló el primero** — necesario porque R2 puede responder 403 **sin cabeceras CORS**, y entonces
el navegador lo entrega como error de red genérico, no como un status legible. Cualquier remedio
que dependa de leer el 403 fallaría en el caso real.

**Una re-firma por intento**, o un 403 que no sea por expiración entra en bucle.

**El PUT del poster resuelve ANTES de llamar al confirm**, con su propio reintento — son 50 KB,
reintentarlo cinco veces es gratis. `confirmar` escribe `posterKey: null` si el HEAD falla, y su
primera rama corta para todo lo que no sea PENDING: un poster que llega tarde deja el reel sin
miniatura **para siempre**, y sin autoplay en la grilla la tarjeta pública queda en negro.

- [ ] **Step 5 bis: Tests de la cola.** Era el único Task sin ninguno. En el proyecto `dom`, con
  msw (que intercepta XHR, así que se prueba el código real) y `vi.useFakeTimers()`:

```ts
it('un archivo en HEVC no detiene a los otros siete', …);
it('nunca hay más de 3 subidas en vuelo con 8 archivos', …);
it('un reintento vuelve a firmar y NO re-ejecuta extraerPoster', …);
it('cancelar a mitad de subida no deja un Media PENDING huérfano', async () => {
  cola.añadir([reel]);
  await hasta(() => cola.estado(reel.id) === 'SUBIENDO');
  cola.cancelar(reel.id);
  expect(api.borrarMedia).toHaveBeenCalledWith(mediaId);
  expect(api.confirmar).not.toHaveBeenCalled();
});
```

- [ ] **Step 6: La cola y el Wake Lock viven en el LAYOUT del panel**, no en el editor. Atados al
  editor, tocar "Galerías" en el sidebar libera el lock y borra toda señal de progreso. James ve
  `Subiendo 3 de 8 · 61%` desde cualquier pantalla.

```ts
async function pedirLock() {
  if (document.visibilityState !== 'visible' || !navigator.wakeLock) return;
  try {
    lock = await navigator.wakeLock.request('screen');
    // El UA lo libera también por batería baja o modo ahorro, y eso NO dispara
    // visibilitychange: hay que escuchar el propio evento release.
    lock.addEventListener('release', () => { lock = null; if (hayCargasActivas) pedirLock(); });
  } catch { lock = null; }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && hayCargasActivas) {
    pedirLock();
    reconfirmarLosQueSiguenEnConfirmando();   // idempotente por WHERE status = PENDING
  }
});
```

> El Wake Lock es una **mitigación parcial**: solo evita el auto-bloqueo por inactividad. No hace
> nada ante el botón de encendido, un cambio de app o una llamada. La red de seguridad real es la
> reconciliación del Task 4 Step 0.

- [ ] **Step 7: `beforeunload` solo para escritorio.** En Safari de iOS no produce diálogo, en
  modo standalone tampoco, y no se dispara en una navegación del App Router. En el iPhone la
  señal es la fila de progreso visible: *"Subiendo 3 de 9 · 120 MB de 230 MB. No bloquees la
  pantalla ni cambies de app."*

---

## Task 7 · Ordenar y portada

- [ ] **Step 1: `@dnd-kit` con `TouchSensor` y `activationConstraint: { delay: 200, tolerance: 5 }`.**
  Sin ese delay, cualquier toque inicia un arrastre y **la página deja de poder scrollear**.
- [ ] **Step 2: Botones de mover además del arrastre.** Redundante a propósito: en el móvil es lo
  que de verdad se usa con más de 8 elementos.
- [ ] **Step 3: Reorden optimista** con `PATCH` debounced a 800 ms. Si falla, revierte y avisa.

  **Los ids se construyen al enviar, no al arrastrar.** `ReorderService` numera 0..n-1 **solo los
  ids que recibe** y no toca al resto: un medio que se confirma dentro de la ventana de 800 ms y
  no va en el array conserva su `order` y queda descolocado, sin ningún error.

```ts
mutationFn: () => galleries.reorderMedia(
  id, qc.getQueryData(keys.galleries.detail(id))!.media.map(m => m.id)),  // TODOS, PENDING incluidos
onSettled: (respuesta) => qc.setQueryData(keys.galleries.detail(id), respuesta),
```

`reordenarMedios` devuelve el `GalleryDto` completo: `setQueryData` en vez de `invalidateQueries`
ahorra el refetch y elimina la ventana en que caché y servidor discrepan.

  > **El test obligatorio de §15 va por los botones de mover, no por el arrastre.** dnd-kit decide
  > destino midiendo rectángulos, y en happy-dom `getBoundingClientRect()` devuelve ceros: un test
  > de arrastre **no falla, no hace nada y pasa**. Los botones son el mismo camino de código, ya
  > son obligatorios por el pulgar (§10), y en móvil son lo que James usa. El arrastre se verifica
  > en Playwright y el táctil en el iPhone.

- [ ] **Step 4: Portada.** Solo sobre un medio **READY**. Optimista sobre `isFeatured`, y
  `invalidateQueries(keys.galleries.lists())` en `onSettled` porque `coverUrl` se deriva de ahí
  (Task 0 Step 3).

---

## Task 8 · Cierre

- [ ] **Step 1: Playwright**, tres flujos y nada más (§15): login, subir un reel, publicar.

  **Canal `chrome`, no el Chromium empaquetado**: no incluye códecs propietarios, y "subir un
  reel" pasa por `extraerPoster`, que exige decodificar H.264. Con el canal por defecto falla
  siempre y **el error parece del validador**. No hay salida por WebM: `MIMES_VIDEO` es solo mp4.

```ts
projects: [{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
webServer: [
  { command: 'pnpm --filter api start',   url: 'http://localhost:3000/galleries', reuseExistingServer: !process.env.CI },
  { command: 'pnpm --filter admin start', url: 'http://localhost:3001/login',     reuseExistingServer: !process.env.CI },
],
```

  Y la precondición como script, no como frase:
  `"pretest:e2e": "pnpm -w db:up && pnpm --filter api db:deploy && pnpm --filter api db:seed"`.
  El login usa `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`, sin fixture de usuario. En CI,
  `playwright install --with-deps chrome`.
- [ ] **Step 2: Probar en el iPhone REAL de James.** Wake Lock, HEIC, decodificación de vídeo y
  el file picker se comportan distinto en Safari de verdad; el modo dispositivo de DevTools no
  reproduce ninguno de los cuatro.
- [ ] **Step 3: DECIDIR multipart** con el dato en la mano: subir un aftermovie real por 4G. Si
  funciona, nos hemos ahorrado la pieza más frágil del editor.
- [ ] **Step 4: Checklist responsive** — 320 px sin scroll horizontal, 768 px vertical, zoom 200%,
  móvil en horizontal, nombre de 60 caracteres sin romper la tarjeta.
