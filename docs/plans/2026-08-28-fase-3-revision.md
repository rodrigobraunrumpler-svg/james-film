# Revisión de la fase 3 — informe completo

> Resultado de cinco revisiones en paralelo con verificación adversarial (11 agentes).
> **50 hallazgos sobrevivieron; la síntesis los redujo a 20 cambios, 4 anotaciones y 24 descartes.**
> Este documento es el razonamiento. Lo que hay que hacer está integrado en
> [`2026-08-28-fase-3-editor-galeria.md`](2026-08-28-fase-3-editor-galeria.md).

# Revisión consolidada — Fase 3

**33 hallazgos → 20 cambios al plan, 4 anotaciones, 22 descartes.** Todo verificado contra el código.

Correcciones de hecho que arrastraban varios hallazgos: el volumen de referencia es **~230 MB/evento** (CLAUDE.md §2), no 395 ni 360. Declarar `posterMimeType: 'image/png'` da **400 VALIDATION_FAILED** (`@IsIn(MIMES_POSTER)` en `presign.dto.ts` + `ValidateNested`), no 422 — y tumba el lote entero igual. `construirDocPublico` exporta **solo rutas públicas**, así que un DTO de admin no mueve `openapi-public.json`; añadir `status` al `MediaDto` público **sí** lo movería.

---

## A · AÑADIR AL PLAN

### A1 · El poster pasa a JPEG — `Task 5 Step 1 y 2-4` + API
`alta` · Absorbe: "poster WebP imposible en Safari" + la mitad (b) de "el PUT necesita Content-Type exacto".

**Conflicto resuelto:** gana JPEG sobre "assert `poster.type === 'image/webp'` y lanza". Asertar el WebP significa que en el iPhone de James —el único dispositivo— *ningún* reel tiene poster jamás. Y CLAUDE.md:283 ya cerró "fotos → JPEG q95, **nunca WebP/AVIF**, Cloudflare re-comprime al servir": el poster lo sirve el mismo CDN que las fotos. La mención del "poster WebP" en CLAUDE.md:361 es de pasada, justificando que se quita blurhash.

Verificado: `media.rules.ts` → `MIMES_POSTER = ['image/webp']`; `firmarUno` hardcodea el webp **dos veces** (`posters/${uuid}.webp` y `contentType: 'image/webp'`).

En **Task 5, Step 2-4**, `extraerPoster`:
```ts
// canvas.toBlob cae a PNG SIN error ante un tipo no soportado (spec), y Safari
// —macOS e iOS, todas las versiones— no codifica WebP. Se asevera, no se supone.
const poster = await new Promise<Blob>((ok, err) =>
  canvas.toBlob(b => (b ? ok(b) : err(new Error('El navegador no pudo generar el poster'))),
                'image/jpeg', 0.8));
if (poster.type !== 'image/jpeg') throw new Error('El navegador no pudo generar el poster');
return { poster, posterMimeType: poster.type, posterSizeBytes: poster.size, width, height, duration };
```
Al presign se declara `posterMimeType: poster.type`, **nunca** una constante escrita a mano.

En la API (tres líneas, fase 2):
```ts
// media.rules.ts
export const MIMES_POSTER = ['image/jpeg'] as const;

// media.service.ts / firmarUno
const posterKey = item.posterMimeType ? `posters/${uuid}.${extensionDe(item.posterMimeType)}` : null;
// …y en getUploadUrl del poster:
contentType: item.posterMimeType,
```

---

### A2 · Cancelar, rendirse y borrar llaman a `DELETE /admin/media/:id` — `Task 6, Step 3 bis` + `Task 7`
`alta` · Absorbe 4 hallazgos: los tres de "huérfanos/CANCELADO" + la rama FAILED del confirm.

Es el mejor value/effort del lote. Verificado: `firmarUno` crea la fila en el **presign**, `status @default(PENDING)` (schema:107), `xhr.abort()` no la toca, y `buscarPorId` la devuelve. `DELETE /admin/media/:id` existe desde la fase 2 y **el plan no lo cablea a nada** — el editor no tiene forma de borrar ningún medio, ni cancelado ni subido. §15 lo lista entre los seis tests obligatorios y §10 avisa: "el de los huérfanos es el que se olvida".

Texto exacto del **Step 3 bis**:
> **Cancelar, rendirse y borrar pasan por `DELETE /admin/media/:id`.** El `Media` nace `PENDING` en el presign, no en la subida: `xhr.abort()` a secas deja una tarjeta muerta en la grilla hasta el cron de la fase 6. Orden: `xhr.abort()` → si hay `mediaId`, `DELETE` → quitar la entrada de la cola → liberar el hueco de concurrencia → quitar el medio de la caché con `setQueryData` (no invalidar). Si el `DELETE` falla no se reintenta: el cron lo recoge. **El mismo camino es el botón de eliminar de cualquier tarjeta**, esté subiendo o READY — hoy el plan no lo tiene en ningún Task.
>
> **Un `confirm` que devuelve `status: 'FAILED'` no se reintenta: se descarta.** `confirmar` corta con `if (media.status !== 'PENDING') return {…}` y nada vuelve a poner PENDING, así que reintentar el mismo `mediaId` responde 200 y no cambia nada. Rama distinta del backoff del PUT:
> ```ts
> if (resultado.status === 'FAILED') {
>   await api.borrarMedia(item.mediaId);      // soft delete: el upsert del presign NO filtra deletedAt
>   item.clientUploadId = crypto.randomUUID(); // identidad nueva o se recupera la fila borrada
>   item.mediaId = null;
>   return transicionar(item, 'FIRMANDO');
> }
> ```
> Solo se reintenta el confirm cuando falla el **transporte** (red, 5xx). Un cuerpo con `FAILED` es una respuesta correcta.

Test obligatorio (§15) en el proyecto `dom`, con msw y fake timers:
```ts
it('cancelar a mitad de subida no deja un Media PENDING huérfano', async () => {
  cola.añadir([reel]);
  await hasta(() => cola.estado(reel.id) === 'SUBIENDO');
  cola.cancelar(reel.id);
  expect(api.borrarMedia).toHaveBeenCalledWith(mediaId);
  expect(api.confirmar).not.toHaveBeenCalled();
});
```

---

### A3 · `middleware.ts` → `proxy.ts` — `Task 1, Files y Steps 2-5`
`media` · Verificado en la doc que trae next@16.3.3 (`node_modules/next/dist/docs/.../middleware.md`): "The `middleware.js` file convention has been **deprecated** in Next.js 16 and renamed to `proxy.js`". Existe `proxy.md` con `export function proxy(request)`. CLAUDE.md:212 es una decisión cerrada: ninguna API deprecada. Se rompe en el primer fichero del primer Task.

- `src/middleware.ts` → `src/proxy.ts`; `export function middleware(req)` → `export function proxy(req)`. El `config`/`matcher` no cambia.
- Renombrar `src/lib/api/server/proxy.ts` → `pasarela.ts` (`export async function pasarela`), para que "proxy" signifique una sola cosa.
- Corregir `docs/admin.md:488` **y su árbol de la línea 265**, que coloca el fichero dentro de `app/`: ahí Next no lo ejecuta y no avisa — las rutas quedarían sin proteger en silencio.

---

### A4 · Los medios nuevos nacen al final del orden — API, prerequisito del `Task 6`
`media` · Verificado: `order Int @default(0)` (schema:125), `firmarUno` no lo calcula, `ReorderService` numera 0..n-1 **solo los ids enviados**, `buscarPorId` ordena `[{order:'asc'},{id:'asc'}]`. James ordena 8 reels, sube dos fotos el martes y se le cuelan entre las primeras.

**Conflicto resuelto:** gana el cálculo en el servidor sobre el "PATCH de cierre de tanda" del cliente. Es determinista, no depende de que el cliente acierte a dispararlo y no compite con el debounce de 800 ms del Task 7.

**Corrección a la propuesta original:** el `aggregate` **no** puede ir dentro de `firmarUno` — `presign` hace `Promise.all(items.map(...))` y los 8 leerían el mismo máximo. Va una vez, en `presign`:
```ts
// media.service.ts
async presign(galleryId: string, items: PresignItemDto[]): Promise<PresignItemResult[]> {
  await this.asegurarGaleria(galleryId);
  for (const item of items) this.validar(item);

  // Los medios nuevos van AL FINAL. Con `order @default(0)` se colarían entre los
  // primeros: ReorderService solo numera los ids que se le envían, así que tras un
  // reorden todo lo nuevo empata en 0 con el primero.
  const { _max } = await this.prisma.media.aggregate({
    where: { galleryId, deletedAt: null }, _max: { order: true },
  });
  const base = (_max.order ?? -1) + 1;

  return Promise.all(items.map((item, i) => this.firmarUno(galleryId, item, base + i)));
}
```
`firmarUno(galleryId, item, order)` lo mete solo en `create`; el `update: {}` del upsert conserva la posición al re-firmar.

---

### A5 · `coverUrl` es null siempre: marcar portada no escribe nada — `Task 7 Step 4` (y `Task 3 Step 3` depende)
`media` · Verificado con grep sobre `apps/api/src/modules` y `prisma/seed.ts`: `coverKey` **solo** aparece en lecturas de `galleries.mapper.ts`. Ningún `create`, `update` ni seed lo escribe. `marcarPortada` solo llama a `exclusiveFlag.setOnly(media, 'isFeatured', …)`. El test de integración (`galleries.integration.spec.ts:208`) solo comprueba la exclusividad del flag.

**Conflicto resuelto:** gana **derivar en el mapper** sobre escribir `coverKey` en `marcarPortada`. Escribir `coverKey: posterKey ?? storageKey` mete un `.mp4` en el campo de portada cuando el vídeo no tiene poster (y `confirmar` anula `posterKey` justo cuando el poster falla), y duplica estado que deriva si el medio se borra.

```ts
// galleries.mapper.ts
const claveDePortada = (media: { isFeatured: boolean; posterKey: string | null;
                                 storageKey: string; type: MediaDto['type'] }[]) => {
  const p = media.find((m) => m.isFeatured);
  if (!p) return null;
  // Nunca el storageKey de un vídeo: sería un .mp4 en un <img>.
  return p.posterKey ?? (p.type === 'PHOTO' ? p.storageKey : null);
};
// en mapGaleria y mapGaleriaLista:
coverUrl: (() => { const k = g.coverKey ?? claveDePortada(g.media); return k ? storage.getPublicUrl(k) : null; })(),
```
En `listarTodas` y `listarPublicas` el select de la lista necesita la fila:
```ts
media: { where: { ...MEDIA_VISIBLE, isFeatured: true },
         select: { isFeatured: true, posterKey: true, storageKey: true, type: true }, take: 1 },
```
Y en el Task 7 Step 4: **la portada solo se marca sobre un medio READY**. El optimista sobre `isFeatured` es correcto tal como está; añadir `qc.invalidateQueries({ queryKey: keys.galleries.lists() })` en `onSettled`, porque `marcarPortada` devuelve el `GalleryDto` completo y el detalle se resuelve con `setQueryData`.

---

### A6 · `ApiError` con `code` y `details` tipados — `Task 2 Step 1`
`media` · El Task 1 Step 6 promete `switch` por `code` y el Task 4 Step 3 promete `details[].field → setError`. El `ApiError` de `docs/admin.md:588` que el Step manda copiar solo guarda `status`, `message` y `body?: unknown`, y su `toError` parsea `body.message` como el **array del ValidationPipe** — formato que la API ya no emite (`AllExceptionsFilter` construye `ApiFailure` con `message` string). Con esa pieza, `error.code` no compila.

```ts
import type { ApiFailure, ErrorCode, FieldError } from '@james-film/contracts';

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
Y borrar de `docs/admin.md` el `toError` que une el array `message` y su test 9: prueban un formato muerto.

---

### A7 · Firmas caducadas — `Task 6 Step 5` (reescrito)
`media` · **Absorbe 6 hallazgos** (los cuatro de expiración, el de offline y el del blob re-codificado). Aquí estaba casi toda la duplicación del lote.

**Conflictos resueltos:**
- La aritmética alarmista se descarta: con ~230 MB y una URL SigV4 que caduca *cuando la petición se recibe*, no cuando termina, los 900 s solo muerden por debajo de ~2 Mbps sostenidos y en el camino de la pestaña suspendida. Es el borde, no el caso central.
- Gana **subir el TTL + re-firmar antes de cada reintento** sobre firmar por hueco de concurrencia con `firmadoEn`/`TTL/2`, sobre parsear `X-Amz-Date`, y sobre añadir `expiresAt` a `PresignItemResult`. Motivo: R2 puede devolver el 403 **sin cabeceras CORS**, y entonces el navegador lo entrega como error de red genérico, no como `status === 403` legible — cualquier remedio que dependa de leer el 403 falla en el caso real. Re-firmar siempre antes de reintentar no necesita leer nada ni mantener un reloj.
- `navigator.onLine` se descarta como mecanismo: en el iPhone sigue en `true` en los casos que el propio hallazgo cita (traspaso de celda, sótano). Lo que arregla ese fallo es el presupuesto temporal.

Texto exacto del Step 5:
> **Step 5: Reintento con presupuesto temporal, no con un contador.** Backoff 1s/2s/4s/8s mientras el tiempo total del item sea < 5 min. "Tres intentos" son 7 segundos de presupuesto, y en Ayacucho una caída de señal dura 20-60 s: el plan trataría como permanente justo la intermitencia que dice cubrir. Con 8-15 medios al mes, esperar no cuesta nada.
>
> **Antes de cada reintento se vuelve a firmar ese item.** `POST /admin/galleries/:id/media/presign` con `items: [ese uno]` y el **mismo `clientUploadId`**: el `upsert` con `update: {}` devuelve el mismo `mediaId` y la misma `storageKey`, no crea filas. Así el segundo intento siempre lleva URL fresca y da igual por qué falló el primero — necesario porque R2 puede responder 403 sin cabeceras CORS y el navegador lo entrega como error de red, no como un status legible. **Una re-firma por intento**, o un 403 que no es por expiración (content-type mal) entra en bucle.
>
> **El reintento entra en `SUBIENDO`, nunca en `VALIDANDO` ni en `EXTRAYENDO_POSTER`.** Validar, normalizar y extraer poster se ejecutan **una sola vez por item**; el `Blob` y su `size` se guardan junto al item. La firma incluye `content-length` y se calcula con el `sizeBytes` de la **fila**, así que un `canvas.toBlob` que devuelva unos bytes distintos deja el item en 403 permanente que no converge. De paso ahorra CPU y batería.
>
> **Botón Reintentar** ⇒ reentra en `FIRMANDO`, no en `SUBIENDO`.

Y una línea en el `.env`, `.env.example` y producción:
```
# La firma SigV4 admite hasta 7 días y la URL solo la tiene el navegador de James.
# Con 900 s, un aftermovie de 115 MB por debajo de 2 Mbps se topa con la firma muerta.
PRESIGN_TTL_SECONDS=3600
```

---

### A8 · `AdminMediaDto` con `status` y `error` + reconciliación al montar — contracts + API + `Task 4 Step 0` / `Task 6`
`media` · **Absorbe 5 hallazgos.** Verificado: `MediaDto` documenta que `status`/`error` "son internos y no salen", `SELECT_MEDIA` no los selecciona, y `buscarPorId` (camino admin) filtra **solo** `deletedAt: null` — devuelve PENDING y FAILED con `url` construida desde `storageKey`, apuntando a un objeto que nunca llegó. Tras la suspensión de pestaña —que el propio Step 6 llama "el modo de fallo número uno"— James ve 8 tarjetas idénticas y tres están rotas.

**Conflictos resueltos, tres candidatos:**
- ❌ Filtrar `buscarPorId` a `status: 'READY'`: un FAILED queda invisible **y sin purgar** (el cron de CLAUDE.md:381 limpia `deletedAt >30d` y `PENDING >24h`, no FAILED).
- ❌ Añadir `status`/`error` al `MediaDto` público: mueve `openapi-public.json`, que el CI congela, y contradice la regla del paquete ("exponer un campo tiene que ser un acto deliberado").
- ✅ **DTO de admin aparte.** `construirDocPublico` solo exporta rutas públicas: el snapshot no se mueve.

```ts
// packages/contracts/src/index.ts — sigue siendo solo tipos
export interface AdminMediaDto extends MediaDto {
  status: MediaStatus;
  /** Qué falló, en castellano. Lo llena el confirm. */
  error: string | null;
}
export interface AdminGalleryDto extends Omit<GalleryDto, 'media'> { media: AdminMediaDto[]; }
```
```ts
// galleries.mapper.ts
export const SELECT_MEDIA_ADMIN = { ...SELECT_MEDIA, status: true, error: true } as const;
// + mapMediaAdmin / mapGaleriaAdmin
```
`buscarPorId` se anota `Promise<AdminGalleryDto>` y usa `SELECT_MEDIA_ADMIN` — la anotación es lo que hace que el `select` falle cerrado (CLAUDE.md). `buscarPorSlug` y `listarPublicas` no se tocan: siguen con `MEDIA_VISIBLE`. En `listarTodas`, el `_count` pasa a `{ deletedAt: null, status: 'READY' }`: hoy "Medios · 8" cuenta los rotos.

**Step nuevo en Task 4**, antes del Step 1:
> **Step 0: Reconciliar al montar.** Por cada medio que llegue en `PENDING`, `POST /admin/media/:id/confirm`. Es idempotente, hace HEAD y compara `ContentLength`: lo que llegó entero pasa a READY sin volver a subir un byte, lo que no, a FAILED con el mensaje que la API ya redacta en castellano. **El servidor es la lista de pendientes: no se persiste nada en el navegador.** Tras una recarga el `File` ya no existe en memoria, así que la acción de una tarjeta rota es **Descartar** (A2) y volver a elegir el archivo, no "Reintentar la subida".

La tarjeta pinta por `status`: FAILED → borde rojo con el texto de `error` y [Descartar]; PENDING sin entrada viva en la cola → "Sin terminar" con [Descartar].

---

### A9 · `Task 0 · Andamiaje de tests` + partición del Task 5
`media` · **Absorbe 4 hallazgos.** Verificado: `apps/admin/package.json` solo tiene `dev/build/start/lint/typecheck`; no hay vitest, happy-dom, Testing Library ni `vitest.config.ts`. `pnpm test` de la raíz es `pnpm --filter api test:integration` y el CI corre **solo** `--filter api`. Como `lint` y `typecheck` sí son `-r`, es fácil creer que admin está cubierto: los 6 tests del Task 1 y los 13 del Task 5 se escribirían y **nunca correrían en un PR**.

**Task 0, Step 1** — deps en `apps/admin` (`npm view <pkg> dist-tags` antes de fijar, CLAUDE.md): `vitest`, `@vitejs/plugin-react`, `happy-dom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `msw`, `@playwright/test`.

**Step 2** — `apps/admin/vitest.config.ts` con `test.projects` (**no** `vitest.workspace.ts`: `test.workspace` lanza error explícito en Vitest 4; el patrón a copiar son las 12 líneas de `apps/api/vitest.config.ts`):
```ts
projects: [
  // La pasarela usa cookies() de next/headers, que fuera de un ámbito de petición
  // lanza. Aquí va con next/headers mockeado, y aquí va la lógica pura de bytes.
  { extends: true, test: { name: 'nodo', environment: 'node',
      include: ['src/lib/api/server/**/*.spec.ts', 'src/app/api/**/*.spec.ts',
                'src/features/**/*.nodo.spec.ts'] } },
  { extends: true, test: { name: 'dom', environment: 'happy-dom',
      include: ['src/**/*.dom.spec.{ts,tsx}'], setupFiles: ['./vitest.setup.dom.ts'] } },
],
```
**Step 3** — `"test": "vitest run"` y en `.github/workflows/ci.yml`, tras `pnpm --filter api test`:
```yaml
- run: pnpm --filter admin test    # milisegundos, sin servicios: en cada PR
```
**Esta línea es la mitad que de verdad vale.**

**Y corregir la frase del Task 5**, que hoy dice "lógica pura, sin React" y no lo es. Reescribir el Step 1 en dos capas:
> **Capa 1 — puro, proyecto `nodo`.** `Blob` y `File` son globales en Node 24. `tieneFaststart(file)` (parseo de cajas sobre `file.slice(0, 65536)`), `validarArchivo({name,size,type})` (A10), `elegirInstante(duration)`, `bitrate(size,duration)`, `escalarA(2560,w,h)`.
> **Capa 2 — orquestación con fábricas inyectadas, proyecto `nodo`.** `extraerPoster(file, deps = { crearVideo, crearLienzo, urls: URL })`. Con un vídeo falso que emite eventos en el orden que decide el test se afirma lo único afirmable sin decodificador: que el `seek` va **después** de `loadedmetadata`, que un `onerror` da mensaje accionable, y que **`revokeObjectURL` se llama también en la rama de error** — el snippet de §10 solo lo revoca en el camino feliz.
> **Capa 3 — decodificación real: Playwright (Task 8 Step 1) y el iPhone (Task 8 Step 2).** happy-dom no decodifica vídeo ni rasteriza canvas: `loadedmetadata` no dispara, `duration` es `NaN`, `toBlob` no produce píxeles. Un test de poster ahí pasa sin comprobar nada, que es peor que no tenerlo. **El caso HEIC no es automatizable**: ningún navegador de Linux lo decodifica, tampoco el WebKit de Playwright. Va al checklist del iPhone.

---

### A10 · Espejo de los límites de la API antes del presign — `Task 5 Step 2-4`
`media` · Absorbe "falta el test del archivo de 300 MB" + la parte viable de "criterio HEVC equivocado" + el punto 1 de "presign todo-o-nada". Dos de los seis tests obligatorios de §15 no están en el plan.

Verificado: las constantes del Task 5 son "(2160, 15 Mbps, 2560 px, 100 MP)" — **sin ningún umbral en MB**, y el primer test dice "rechaza lo que el navegador no puede reproducir", que en Safari no rechaza nada (reproduce HEVC desde iOS 11). `MAX_VIDEO_MB` = 200 y `MAX_IMAGE_MB` = 15 (`env.schema.ts:51-52`). Un aftermovie largo a 1080p con bitrate legal (10 min a 4 Mbps ≈ 300 MB) pasa las cuatro validaciones y **se decodifica entero en el iPhone** antes de rebotar en el presign, por datos móviles. Y como `presign` valida todo el lote antes de firmar nada, tumba los otros siete.

```ts
// constants/limites.ts
// Espejo de MAX_VIDEO_MB / MAX_IMAGE_MB y de MIMES_VIDEO / MIMES_FOTO de la API.
// Si cambian allí, cambian aquí: rebotar en el presign obliga a haber decodificado
// el archivo entero en el móvil, y tumba el lote completo.
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

// Tipado estructural: un File lo satisface, y el test no materializa 300 MB.
type ArchivoElegido = { name: string; size: number; type: string };
```
Un archivo que no pase **no entra en el array del presign**: se marca FALLIDO en el cliente con el mensaje de siempre.

Y corregir dos entradas de la lista de tests del Step 1:
```ts
it('rechaza un .mov/HEVC antes de firmar nada, con mensaje accionable', …);  // era "lo que el navegador no puede reproducir"
it('un archivo de 300 MB se rechaza antes de empezar a subir', …);
it('un archivo de 300 MB no llega a firmar nada', …);   // a nivel de cola: es lo que dice §15
```

---

### A11 · `clientUploadId` y quién pinta la grilla — `Task 6`, Step nuevo antes del Step 2
`media` · Absorbe "clientUploadId no aparece" + "nadie reconcilia la cola y la caché". El snippet de §10 del que bebe el plan muestra el cuerpo del presign **sin** `clientUploadId`, y el DTO lo exige (`@IsString @Length(8,64)`): el plan tal como está guía al ejecutor a un 400 en la primera llamada. Y `firmarUno` hace el `upsert` **antes** del PUT, así que la fila PENDING existe desde el presign y cualquier refetch duplica cada archivo en vuelo.

> **Step 1 bis: identidad y fuente de verdad de la grilla.**
> ```ts
> // Se genera UNA vez, al entrar en la cola. Sobrevive a los reintentos. El nombre
> // del archivo NO sirve como identidad: el picker de iOS devuelve 'image.jpeg'
> // para todas las fotos, y colisionar en el upsert sube dos fotos a la misma key.
> const clientUploadId = crypto.randomUUID();
> ```
> Es también la **key de React** de la tarjeta, nunca `file.name`.
>
> **La grilla se pinta desde `gallery.media` (TanStack Query), no desde la cola.** La fila PENDING existe desde el presign, así que la cola **no pinta tarjeta propia** para lo que ya tiene `mediaId`: solo *decora* la que coincide — barra de progreso, error, botones. La clave de casamiento es `mediaId`. Los archivos que todavía no lo tienen (SELECCIONADO → EXTRAYENDO_POSTER) sí se pintan como tarjetas locales con clave `clientUploadId`, y se funden con la fila del servidor en cuanto el presign responde.

---

### A12 · La cola y el Wake Lock viven en el layout del panel — `Task 6 Steps 6 y 7`
`media` · Absorbe los dos hallazgos de Wake Lock. `docs/admin.md` coloca `hooks/useSubidas` y `store/` dentro de `features/galerias/`, así que la lectura natural del plan ata el sentinel al ciclo de vida del editor: tocar "Galerías" en el sidebar lo libera y borra toda señal de progreso. El precedente ya existe en el doc: `features/publicacion/` es "la barra de estado, que es global" y se monta en el layout.

- El store de zustand es un **singleton de módulo** (no se crea dentro de un componente).
- El efecto del Wake Lock, el listener de `visibilitychange` y una **fila compacta de progreso** viven en `app/(panel)/layout.tsx`, junto a la barra de publicación. James ve "Subiendo 3 de 8 · 61%" desde cualquier pantalla.
- El hook, con los dos huecos que MDN documenta (el UA libera el lock "if the device is low on power, or if the user turns on a power save mode", y eso **no** dispara `visibilitychange`):
```ts
async function pedirLock() {
  if (document.visibilityState !== 'visible' || !navigator.wakeLock) return;
  try {
    lock = await navigator.wakeLock.request('screen');   // rechaza si el doc no está visible
    lock.addEventListener('release', () => { lock = null; if (hayCargasActivas) pedirLock(); });
  } catch { lock = null; }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && hayCargasActivas) pedirLock();
});
```
- **Step 7 reformulado:** `beforeunload` se deja solo por el escritorio — en Safari de iOS no produce diálogo, y en modo standalone (que es como §10 quiere que James lo use) tampoco; además no se dispara en una navegación del App Router. En el iPhone la señal es la fila de progreso visible: *"Subiendo 3 de 9 · 120 MB de 230 MB. No bloquees la pantalla ni cambies de app."*
- Corregir la frase del Step 6: el Wake Lock es una **mitigación parcial** (solo evita el auto-bloqueo por inactividad; no hace nada ante el botón de encendido, un cambio de app o una llamada). La red de seguridad real es la reconciliación de A8.

---

### A13 · `extraerPoster` con timeout y limpieza en `finally` — `Task 5 Step 2-4`
`baja` · El patrón heredado de §10 no tiene salida si iOS no dispara ni `loadedmetadata` ni `error`: el archivo se queda en VALIDANDO indefinidamente, un estado terminal que la máquina del Step 1 **no tiene**. Un archivo colgado sin error es peor que uno rechazado.
```ts
const esperar = <T,>(p: Promise<T>, ms = 15_000) => Promise.race([
  p, new Promise<never>((_, rej) => setTimeout(() =>
    rej(new ErrorValidacion('No se pudo leer este vídeo. Exporta MP4 / H.264 desde CapCut e inténtalo otra vez.')), ms)),
]);
// …
finally {
  URL.revokeObjectURL(url);
  video.removeAttribute('src');
  video.load();   // libera el decodificador; revokeObjectURL solo no basta
}
```
Y una frase: **la extracción de poster va con concurrencia 1** (el Step 4 limita a 3, pero eso son subidas): un solo `<video>` decodificando a la vez.

---

### A14 · El `confirm` no se dispara hasta que el PUT del poster resolvió — `Task 6 Steps 1 y 5`
`baja` · `confirmar` escribe `posterKey: media.posterKey && posterOk ? media.posterKey : null` **en la base**, y su primera rama devuelve pronto para todo lo que no sea PENDING: un poster que llegó tarde deja el reel sin miniatura **para siempre**, y sin autoplay en la grilla (regla cerrada de §4) la tarjeta pública queda en negro. La única reparación es re-subir 35 MB. El fallo realista es la **carrera**, no que falle un PUT de 50 KB después de uno de 35 MB.

Una frase en el Step 5: *"El PUT del poster resuelve **antes** de llamar al confirm, con su propio reintento — son 50 KB, reintentarlo cinco veces es gratis. Si se abandona a propósito, la tarjeta se pinta con aviso «sin miniatura», no idéntica a las demás."* No hace falta un estado `SUBIENDO_POSTER` con nombre propio.

---

### A15 · Reorden: los ids se construyen al enviar — `Task 7 Step 3`
`media` · `ReorderService.reorder` hace `ids.map((id, order) => update(...))`: asigna 0..n-1 **solo a los ids enviados** y no toca al resto. Un medio que se confirma dentro de la ventana de 800 ms y no va en el array conserva su `order` y queda descolocado, sin ningún error.
```ts
mutationFn: () => galleries.reorderMedia(
  id, qc.getQueryData(keys.galleries.detail(id))!.media.map(m => m.id)),  // TODOS, PENDING incluidos
onSettled: (respuesta) => qc.setQueryData(keys.galleries.detail(id), respuesta),
```
`reordenarMedios` devuelve el `GalleryDto` completo: `setQueryData` en vez de `invalidateQueries` ahorra el refetch y elimina la ventana en que caché y servidor discrepan. Se descarta el flag `reordenPendiente`: con esto el escenario desaparece solo.

Y una línea sobre el test obligatorio de §15:
> El test "reordenar y fallar la petición revierte el orden" va **por los botones de mover**, no por el arrastre: dnd-kit decide destino midiendo rectángulos y en happy-dom `getBoundingClientRect()` devuelve ceros — un test de arrastre no falla, no hace nada y pasa. Los botones son el mismo camino de código desde `mover(ids, desde, hacia)`, ya son obligatorios por el pulgar (§10) y por el `KeyboardSensor` (admin.md), y en móvil son lo que James usa. El arrastre se verifica en Playwright y el táctil en el iPhone.

---

### A16 · `viewport-fit=cover` — `Task 2, Step nuevo`
`baja` · El Step 4 escribe `padding-bottom: env(safe-area-inset-bottom)` sobre un valor que en el iPhone será **0**: Next no emite `viewport-fit=cover` por defecto y ningún Step define el viewport. El CSS compila, se ve bien en el emulador y la barra de publicación —"el hueco más importante" (§9)— queda debajo del indicador de inicio.
```ts
// src/app/layout.tsx
import type { Viewport } from 'next';
export const viewport: Viewport = {
  width: 'device-width', initialScale: 1,
  viewportFit: 'cover',   // sin esto env(safe-area-inset-*) es 0
  // Sin maximumScale ni userScalable: §7 exige que el zoom al 200% funcione.
};
```

---

### A17 · El logout revoca la sesión — `Task 1, Step 2-5`
`baja` · `auth.controller.ts:48` expone `POST /auth/logout` con `{ refreshToken }` y es el **único** sitio donde se revoca. El plan lista el fichero y no describe qué hace: si solo borra la cookie, el endpoint es código muerto y "cerrar sesión" no cierra nada durante 30 días. Es un bug de corrección (el botón no hace lo que dice), no un cálculo de riesgo.
```ts
export async function POST() {
  const s = await leerSesion();
  if (s?.refreshToken) {
    await fetch(`${serverConfig.apiUrl}/auth/logout`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: s.refreshToken }), cache: 'no-store',
    }).catch(() => {});          // si la API no responde, la cookie se borra igual
  }
  await borrarSesion();
  return new Response(null, { status: 204 });
}
```
Test: *"logout llama a /auth/logout con el refresh de la cookie y borra la cookie aunque la API falle"*.

---

### A18 · Cuántos MB va a subir, y un vigilante de progreso — `Task 6`
`baja` · Dos cosas pequeñas y reales.

**Total del lote (Step nuevo entre el 1 y el 4):** CLAUDE.md exige "progreso real, nunca indeterminado", pero eso es el progreso *por archivo* del Step 3; el total antes de empezar no está en ningún Step. En la confirmación de la selección, **antes de firmar nada**: `9 archivos · 230 MB`. En la cabecera de la cola: `Subiendo 3 de 9 · 120 MB de 230 MB`. El dato ya está calculado (lo necesita el `sizeBytes` del presign): son dos `Intl.NumberFormat`. **Sin aviso condicional por tipo de red**: `navigator.connection` no existe en Safari y una heurística inventada mentiría.

**Vigilante (Step 3):** XHR no tiene timeout por defecto, y `xhr.timeout` global no sirve (115 MB por 4G tardan legítimamente minutos). En móvil la degradación típica no es un error sino un estancamiento: el hueco de concurrencia queda ocupado y los otros 5 archivos no arrancan.
```ts
let ultimo = Date.now();
xhr.upload.onprogress = (e) => { ultimo = Date.now(); setProgreso(e.loaded / e.total); };
const vigilante = setInterval(() => {
  // CERO eventos de progreso en 30 s, nunca "progreso lento": abortar por lentitud
  // tira los 20 MB ya subidos de una conexión sana.
  if (Date.now() - ultimo > 30_000) { clearInterval(vigilante); xhr.abort(); fallarIntento('estancado'); }
}, 5_000);
xhr.onloadend = () => clearInterval(vigilante);
```
Y en el handler de `visibilitychange → visible` del Step 6: lo que siga en `CONFIRMANDO` se vuelve a confirmar (es idempotente por `WHERE status = PENDING`).

---

### A19 · Playwright ejecutable — `Task 8 Step 1` y `Task 1 Step 1`
`baja` · El Step 1 entero es una línea y no existe `playwright.config.ts`. Tres cosas:

**(a) Canal `chrome`.** El Chromium empaquetado de Playwright no incluye códecs propietarios; el flujo "subir un reel" pasa por `extraerPoster`, que exige decodificar H.264. Con el canal por defecto falla siempre y el error parece del validador. No hay salida por WebM: `MIMES_VIDEO = ['video/mp4']`.
```ts
projects: [{ name: 'chrome',
  // El Chromium empaquetado NO trae H.264: extraerPoster fallaría siempre y el
  // error parecería del validador. Canal chrome, verificado en la doc.
  use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
webServer: [
  { command: 'pnpm --filter api start',   url: 'http://localhost:3000/galleries',
    reuseExistingServer: !process.env.CI, timeout: 120_000 },
  { command: 'pnpm --filter admin start', url: 'http://localhost:3001/login',
    reuseExistingServer: !process.env.CI, timeout: 120_000 },
],
```
**(b) Precondición como script, no como frase:** `"pretest:e2e": "pnpm -w db:up && pnpm --filter api db:deploy && pnpm --filter api db:seed"`, y el login usa `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` — sin fixture de usuario. En CI, `playwright install --with-deps chrome`.

**(c) El test 6 del Task 1 Step 1 no es escribible.** `export const dynamic = 'force-dynamic'` es una directiva que interpreta el runtime al construir, no una conducta que se ejercite importando el módulo. Sustituirlo por la guardia honesta (y corregir el test 5 de `docs/admin.md`, que tiene el mismo defecto):
```ts
it('la pasarela declara force-dynamic', async () => {
  // Guardia de regresión: si alguien borra la línea, Next puede cachear un GET y
  // servir los datos de una sesión a otra. La fuga real NO se comprueba aquí.
  expect((await import('@/app/api/[...ruta]/route')).dynamic).toBe('force-dynamic');
});
```

---

### A20 · Preguntar a James la versión de iOS — `Task 1, Step 0`
`baja` · Tres piezas de la fase tienen suelos distintos: `AbortSignal.any` (Safari 17.4+) lo usa el cliente HTTP de `docs/admin.md:676` en **todas** las peticiones; Wake Lock y `canvas.toBlob` piden 16.4+. Si el iPhone está por debajo, el admin no falla en las subidas: falla en la **primera petición**, con un `TypeError` que no menciona la versión del sistema. La sesión de 15 minutos con James ya está pendiente en CLAUDE.md §7, así que no añade tarea.

> **Step 0:** preguntar la versión de iOS y anotarla en el plan como suelo soportado. Si es <17.4, la única línea afectada es el `AbortSignal.any` del Task 2 Step 1 → `AbortController` con dos listeners (seis líneas). Si es <16.4, cambian el Task 5 y el Task 6.

---

### Task 6 no lista un solo test
`Task 6` está marcado 🔴 el riesgo y es **el único Task sin tests**, mientras el Task 1 y el Task 5 los ponen primero. Añadir tres al Step 5, en el proyecto `dom` con msw y `vi.useFakeTimers()` + `await vi.advanceTimersByTimeAsync()` (msw intercepta XHR, así que se prueba el código real — la decisión de `admin.md`; no hace falta inyectar un puerto `Transporte`):
```ts
it('un archivo en HEVC no detiene a los otros siete', …);   // la conducta que §10 exige
it('nunca hay más de 3 subidas en vuelo con 8 archivos', …);
it('un reintento vuelve a firmar y no re-ejecuta extraerPoster', …);
```

---

## B · ANOTAR PARA MÁS ADELANTE

| Anotación | Disparador |
|---|---|
| **CORS del bucket de R2.** `docs/r2-cors.json` commiteado (`AllowedOrigins`: dominio del admin + `http://localhost:3001`; `AllowedMethods: ["PUT"]`; `AllowedHeaders: ["content-type"]`; `ExposeHeaders: ["ETag"]`) y aplicado en la consola de Cloudflare. El PUT lleva `Content-Type: video/mp4`, que dispara preflight. **No bloquea la fase 3**: MinIO responde `*` por defecto y los Tasks 1-7 corren contra MinIO. | Primer deploy con R2 real. Además, arreglar ya el comentario mentiroso de `docker-compose.yml:43-56`, que promete CORS cuando el entrypoint solo hace `mc alias set` + `mc mb`. |
| **Cron de huérfanos.** CLAUDE.md:381 lo promete y no existe: cero `@Cron` en `apps/api/src`. Sin él, los PENDING cancelados y los FAILED se quedan indefinidamente. A2 y A8 lo mitigan desde el cliente, no lo sustituyen. | Fase 6, tal como está planificado. Si tras el Task 8 se ve basura acumulada, se adelanta. |
| **Multipart.** Ya está en el Task 8 Step 3. Añadir un dato al criterio: si la re-firma de A7 se dispara de verdad con el aftermovie real por 4G, es argumento a favor, porque el PUT simple reinicia desde el byte 0. | Task 8 Step 3. |
| **Fractional indexing** para el orden (§10 lo anota como escape). | Una galería con >100 medios. No va a pasar con 8-15. |

---

## C · DESCARTAR

**Maquinaria que A7 y A8 vuelven innecesaria**
1. `firmadoEn` + refirmar a `TTL/2`, y firmar por hueco de concurrencia — el TTL a 3600 + re-firmar en cada reintento cubre lo mismo sin reloj que mantener.
2. Parsear `X-Amz-Date` con una regex de seis grupos, y añadir `expiresAt` a `PresignItemResult` — toca el contrato cerrado para calcular algo que ya no hace falta.
3. Ramas condicionadas a `xhr.status === 403` — R2 puede devolver el 403 sin cabeceras CORS y el navegador lo entrega como error de red: la rama nunca se ejecutaría.
4. Persistir la cola en `localStorage` con volcado en `pagehide` — el servidor **es** la lista de pendientes; y tras una recarga el `File` ya no existe, así que no se puede reintentar la subida de todos modos.
5. Estado `ESPERANDO_RED` + listeners `online`/`offline` — `navigator.onLine` sigue en `true` en el iPhone en los casos citados (traspaso de celda, sótano): cubre el caso raro y no el descrito.
6. Estado `CANCELADO` en el diagrama con seis transiciones — una entrada cancelada se elimina de la cola, no se conserva.
7. Estado `SUBIENDO_POSTER` con nombre propio — el ordenamiento (A14) es lo que vale.
8. Flag `reordenPendiente` en el store — acopla la cola con la mutación; A15 hace que el escenario desaparezca solo.
9. Invalidación "una por tanda" y `Map<galleryId, Map<clientUploadId, Item>>` — el detalle son unos KB de JSON contra 230 MB de vídeo, y dos pestañas con dos galerías distintas no pasa con un usuario.
10. `fetch(DELETE, { keepalive: true })` en `beforeunload` — **puede matar una subida buena**: si el PUT terminó y el confirm está en vuelo cuando James recarga, borra bytes que ya están en R2.
11. Reintentar el presign en lotes más pequeños para aislar al culpable — bisección para un caso que A10 ya evita.

**Complejidad en el módulo que ya es el más testeado**
12. Parser de `moov > trak > mdia > minf > stbl > stsd` para leer el fourcc HEVC — cubre solo el residuo mp4+`hvc1` exportado a mano, y ese camino ya tiene dos controles no-código (el preset de CapCut de §7 y el acuerdo de §4). A10 cierra lo barato.
13. Retocar el test de los 64 KB de `tieneFaststart` — con faststart, el `stsd` del primer trak cae muy por debajo.
14. Test aparte de "el `posterMimeType` declarado es `blob.type`" — la aserción de A1 ya es la garantía; un test que comprueba que se pasa una variable no prueba nada.

**Testing de manual o que contradice decisiones cerradas**
15. Proyecto `navegador` con Browser Mode de Vitest + `@vitest/browser-playwright` — binarios y config extra; lo que decide (HEVC, HEIC, Safari) no lo da ningún Chromium de Linux, y el Task 8 ya tiene el E2E y el iPhone.
16. Puerto `Transporte` inyectado en la cola — `docs/admin.md` ya eligió msw ("interceptar en la capa de red en vez de mockear módulos, para que el test pruebe el código real"), y msw intercepta XHR.
17. Test del backoff exacto 1s/2s/4s — con un usuario y 8-15 archivos, que sea 1/2/4 u 8/16/32 no lo nota nadie. Y A7 lo cambia por un presupuesto temporal.
18. Cuarto flujo de Playwright para vigilar `force-dynamic` — §15 dice "tres flujos y nada más" y el plan lo repite.
19. Inyectar el debounce de 800 ms como parámetro — `vi.useFakeTimers()` ya lo cubre.
20. Inyectar el almacén de cookies en `session.ts` en vez de `vi.mock('next/headers')` — preferencia de diseño, no un test inescribible.

**Fuera de alcance o contraproducente**
21. `MINIO_API_CORS_ALLOW_ORIGIN` en `docker-compose` — solo estrecha el entorno de desarrollo y no prueba nada del CORS que importa, que es el de R2 y se configura en Cloudflare.
22. `manifest.ts` / PWA, y confirmar cada enlace del sidebar con `onNavigate` — lo primero es fase de PWA, no de editor; lo segundo interrumpe a James para avisarle de algo que con A12 ya no se rompe.
23. Que `confirmar` reintente el HEAD cuando `status === 'FAILED'` — cambia la garantía de idempotencia que CLAUDE.md fijó ("idempotente por `WHERE status = PENDING`"). A2 lo resuelve desde el cliente.
24. Filtrar `buscarPorId` a `status: 'READY'` — esconde los FAILED **y** los deja sin purgar: el cron solo limpia `deletedAt >30d` y `PENDING >24h`.
