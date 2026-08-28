# Admin — stack y cliente HTTP

> Decisiones de la **fase 4**. `CLAUDE.md` manda; esto es el detalle.
> El diseño visual se hace en la fase 4 con componentes delante, no aquí.

## Stack

```
Datos        TanStack Query 5 + fetch nativo   (XHR solo para subir a R2)
URL state    nuqs
Formularios  react-hook-form + @hookform/resolvers + zod
Estado       zustand   (solo la cola de subidas)
UI           shadcn/ui sobre Radix + Tailwind 4
Iconos       lucide-react       Toasts  sonner
Drag & drop  @dnd-kit           Animación  motion
Fechas       Intl + <input type="date">   — sin librería
Utilidades   clsx + tailwind-merge
Tests        Vitest + Testing Library + happy-dom + Playwright
```

**Sin Server Actions** — pero eso **no** significa renunciar al servidor de Next. Son dos cosas
distintas y conviene no confundirlas:

- **Server Actions** quedan fuera por una razón concreta: traen su propia invalidación
  (`revalidatePath` / `revalidateTag`) y tendrías **dos sistemas de caché que no se hablan**
  junto a TanStack Query. Es el único argumento que se sostiene.
- **Todo lo demás del servidor de Next sí se usa**: Route Handlers, `middleware`, `cookies()`,
  `headers()`, Server Components, Metadata API, `manifest.ts`. Ver la sección siguiente.

**`zustand` solo para la cola de subidas.** Con Context, cada tick de progreso re-renderiza a
todos los consumidores, y son tres subidas concurrentes emitiendo varias veces por segundo. Los
selectores de zustand despiertan solo al que mira ese archivo. Es rendimiento, no preferencia.

**`nuqs` para el estado de lista.** El filtro, el orden y la pestaña activa viven en la URL, y
esa misma tupla **es la clave de TanStack Query**. Una fuente, no dos: recargar mantiene la vista,
el botón atrás funciona, y no hay que sincronizar `useState` con la caché. Es lo que evita la
clase de bug de "la URL dice una cosa y la tabla muestra otra".

**Fuera por ahora**: TanStack Table (5 tablas de decenas de filas, y §7 obliga a tarjetas
apiladas en móvil igual), `react-dropzone` (30 líneas nativas; entra si el `dragleave` anidado
se pone pesado), `axios`/`ky` (el interceptor de 401 se escribe igual), gráficos (§9 los
descarta), `xstate` (un `useReducer` dentro del store).

---

# Qué usamos de Next.js

Regla: **si Next ya lo trae, no se reimplementa.**

| Herramienta | Uso en el admin |
|---|---|
| **App Router**: `layout`, `loading`, `error`, `not-found`, `template` | Estructura y estados de carga por ruta. `loading.tsx` da el skeleton gratis |
| **Route Groups** `(auth)` / `(panel)` | Layout de login sin sidebar, layout del panel con sidebar. Sin condicionales en el layout |
| **`middleware.ts`** | Protección de rutas: sin sesión → `/login`. Evita el parpadeo de contenido protegido que sí tiene un guard de cliente |
| **Route Handlers** `app/api/**/route.ts` | La pasarela a NestJS. Ver "la frontera de auth" |
| **`cookies()` / `headers()`** | Leer la sesión en servidor, en middleware y en Route Handlers |
| **Server Components** | Shell, layouts y primera carga. `'use client'` solo en hojas con estado, efectos, APIs del navegador o handlers |
| **Metadata API** (`metadata`, `generateMetadata`) | Títulos por pantalla, tipado |
| **`app/manifest.ts`** | El PWA de §10, tipado con `MetadataRoute.Manifest`. Sin `manifest.json` a mano |
| **`next/font`** | Inter autoalojada, sin petición a Google Fonts ni CLS |
| **`next/image`** | Posters y portadas desde R2. `remotePatterns` apuntando al dominio del CDN |
| **`next/link` + `useRouter`** | Navegación y prefetch |
| **Rutas tipadas** | Next 16 las genera solo: `href="/galerias/xyz"` mal escrito **no compila** |
| **`instrumentation.ts`** | Sentry en la fase 6 |

## La frontera de auth — la única decisión que falta

Todo lo de arriba es independiente **salvo** `middleware`, `cookies()` y los Server Components
con datos: los tres necesitan que el servidor de Next conozca la sesión. Y hoy la sesión vive en
una cookie del dominio de la API (§16), que el servidor de Next **no puede leer**.

Hay dos formas coherentes. **Es una decisión de la fase 2** (auth), pero se anota aquí porque
determina cuánto de Next se aprovecha.

### Opción A — cliente puro

El navegador guarda el access token en memoria y habla con NestJS entre dominios.

- La API necesita **CORS con credenciales** y un origen explícito.
- El `middleware` no puede proteger rutas: el guard es de cliente, con parpadeo.
- Los Server Components no pueden traer datos autenticados.
- El navegador necesita el **single-flight** del refresh (ver más abajo).

### Opción B — pasarela con Route Handlers  ← recomendada

Un `app/api/[...ruta]/route.ts` reenvía a NestJS y adjunta el `Bearer` **en el servidor**.

- **El token nunca llega al JavaScript del navegador.** Estrictamente mejor que "en memoria":
  un XSS no puede robar lo que nunca estuvo ahí.
- La sesión vive en una cookie `httpOnly` **del dominio del admin** → `cookies()`, `middleware`
  y Server Components funcionan.
- **Mismo origen**: se acaban el CORS con credenciales y los preflight.
- El cliente del navegador se simplifica mucho: sin token store, sin cabecera `Authorization`,
  sin single-flight.
- **Las subidas siguen yendo directas a R2**: la pasarela solo mueve JSON; el `PUT` firmado no
  pasa por ningún servidor. §4 y §10 intactos.

**Coste**: un salto de red más (Vercel → Railway) y un fichero de ~60 líneas.

**El problema real de la opción B, y su cura.** En serverless cada invocación es un proceso
nuevo, así que **el single-flight no se puede hacer con una promesa compartida**. Dos peticiones
concurrentes que reciban 401 refrescarían a la vez, presentando el mismo refresh token — y la
rotación de §16 lo interpreta como reuso y **revoca la sesión entera**.

La cura no necesita cambiar el schema, porque `Session` ya tiene lo que hace falta:

> **Ventana de gracia.** Si el token presentado coincide con `prevHash` **y** `updatedAt` es de
> hace menos de ~30 s, se devuelve el token vigente **sin rotar y sin revocar**. Fuera de esa
> ventana, `prevHash` sí significa reuso y se revoca. Es el patrón estándar de *refresh token
> grace period*, y `Session.updatedAt` ya guarda el instante de la última rotación.

Esto hay que implementarlo en la fase 2 **elijamos la opción que elijamos**: la opción A lo evita
en el caso normal gracias al single-flight, pero no ante dos pestañas abiertas.

---

# Estructura de carpetas

Convención `src/features`: cada feature es autocontenida y las rutas son finas.

```text
apps/admin/src/
├── app/                          # SOLO routing. Nada de lógica ni fetch aquí
│   ├── (auth)/login/page.tsx
│   ├── (panel)/
│   │   ├── layout.tsx            # sidebar + barra de publicación
│   │   ├── page.tsx              # dashboard
│   │   ├── galerias/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx     # el editor
│   │   ├── categorias/page.tsx
│   │   ├── paquetes/page.tsx
│   │   ├── testimonios/page.tsx
│   │   └── configuracion/page.tsx
│   ├── api/[...ruta]/route.ts    # la pasarela a NestJS (opción B)
│   ├── manifest.ts
│   ├── layout.tsx
│   ├── loading.tsx · error.tsx · not-found.tsx
│   └── middleware.ts
│
├── features/                     # el núcleo del producto
│   ├── auth/
│   ├── galerias/
│   │   ├── components/           # GaleriaEditor, MediaGrid, MediaCard, Dropzone
│   │   ├── hooks/                # useGaleria, useSubidas, useReordenar
│   │   ├── services/             # llamadas a la API, tipadas con @james-film/contracts
│   │   ├── schemas/              # zod de los formularios
│   │   ├── types/                # tipos locales de la feature
│   │   ├── utils/                # extraerPoster, validarVideo, normalizarImagen
│   │   ├── constants/            # umbrales: 2160p, 15 Mbps, 50 MB, concurrencia 3
│   │   └── store/                # zustand: la cola de subidas
│   ├── dashboard/
│   ├── categorias/ · paquetes/ · testimonios/ · configuracion/
│   └── publicacion/              # la barra de estado, que es global
│
├── components/
│   ├── ui/                       # primitivas de shadcn. Código propio
│   └── shared/                   # compartido entre features: EmptyState, DataList, ConfirmDialog
│
├── lib/
│   ├── api/                      # el cliente HTTP (abajo)
│   ├── query/                    # QueryClient, keys, provider
│   └── format/                   # Intl: fechas, relativos, moneda
│
└── hooks/ · utils/               # transversales, no de una feature
```

## Las reglas que la sostienen

1. **`app/` solo enruta.** Sin lógica, sin fetch, sin JSX largo. Una ruta es:
   ```tsx
   import { EditorGaleria } from '@/features/galerias/components/editor-galeria';
   export default async function Page({ params }: { params: Promise<{ id: string }> }) {
     const { id } = await params;
     return <EditorGaleria id={id} />;
   }
   ```
2. **Ninguna feature importa de otra feature.** Si dos la necesitan, sube a
   `components/shared` o `lib`. Es la misma regla que §3 impone entre apps, un nivel abajo.
3. **Las llamadas a la API viven en `services/`.** Un componente nunca hace `fetch`.
4. **Validación en `schemas/`**, con zod.
5. **Server Component por defecto.** `'use client'` solo en la hoja que lo necesita — no en el
   contenedor, o arrastras el árbol entero al cliente.
6. **Nada hardcodeado en las features**: umbrales y magic numbers a `constants/`.

> Esto se puede verificar: las skills `nextjs-boundary-enforcer` y `nextjs-architecture-review`
> revisan justo estas reglas. Conviene pasarlas al cerrar la fase 4.

---

# Tipado

- **`strict: true`** ya está en el `tsconfig` del admin (verificado en la fase 1).
- **Rutas tipadas de Next 16**: un `href` inexistente no compila.
- **Los DTOs vienen de `@james-film/contracts`**, nunca se redeclaran en el admin. Si la API
  cambia el contrato, el admin **no compila** — que es exactamente el punto.
- **Cero `any`.** Lo que no se pueda tipar se estrecha con un type guard.
- **`unknown` en las fronteras** (respuestas HTTP, `localStorage`, mensajes), y de ahí a un tipo
  concreto pasando por zod o un guard.
- **Los schemas de zod de formulario derivan el tipo**, no al revés:
  `type Datos = z.infer<typeof esquema>`. Una sola fuente.
- **`satisfies` en vez de anotación** cuando quieras validar sin ensanchar el tipo.
- Los `params` de las rutas son `Promise` en Next 16: hay que esperarlos.

---

# El cliente HTTP

Vive en `src/lib/api/`. **Con la opción B es más simple**: el navegador habla con su propio
origen y no maneja tokens, así que `token-store.ts` y el single-flight de `session.ts` se mueven
al Route Handler. Lo demás (config, errores, `http.ts`, claves, endpoints) es idéntico en las dos.

Se documentan las cuatro capas completas porque la opción A las necesita todas y la B reutiliza
las mismas piezas del lado servidor.

Cuatro capas, cada una con una responsabilidad y testeable por separado:

```
src/lib/api/
├── config.ts       env validada al cargar el módulo — nada hardcodeado
├── errors.ts       ApiError tipado + guards
├── token-store.ts  access token EN MEMORIA, nunca localStorage
├── session.ts      refresh con single-flight + evento de logout
├── http.ts         request(): URL, cabeceras, abort, parseo, 401 → refresh → 1 reintento
├── keys.ts         factoría de claves de TanStack Query
└── endpoints/      funciones tipadas por recurso, con los DTOs de @james-film/contracts
```

Reglas que sostienen el diseño:

- **`http.ts` no sabe de negocio.** No conoce rutas, ni recursos, ni DTOs concretos.
- **`endpoints/` no sabe de transporte.** No toca cabeceras, tokens ni reintentos.
- **El wrapper NO reintenta** salvo el 401. Los reintentos por red son de TanStack Query;
  hacerlo en los dos sitios multiplica los intentos sin que nadie lo note.
- **Cero `any`.** Si algo no se puede tipar, se estrecha con un guard.

## 1 · `config.ts` — nada hardcodeado

Mismo principio que §5 en la API: si falta una variable, revienta al cargar, no en producción.

```ts
import { z } from 'zod';

// En Next, las variables de cliente se inlinean en build: hay que nombrarlas enteras,
// `process.env[nombre]` no funciona.
const schema = z.object({
  NEXT_PUBLIC_API_URL: z.url(),
  NEXT_PUBLIC_API_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
});

const parsed = schema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_API_TIMEOUT_MS: process.env.NEXT_PUBLIC_API_TIMEOUT_MS,
});

if (!parsed.success) {
  throw new Error(
    `Configuración inválida del admin:\n${parsed.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n')}`,
  );
}

export const config = {
  apiUrl: parsed.data.NEXT_PUBLIC_API_URL.replace(/\/$/, ''),
  timeoutMs: parsed.data.NEXT_PUBLIC_API_TIMEOUT_MS,
} as const;
```

## 2 · `errors.ts` — errores que la UI puede leer

Un `throw new Error('algo falló')` obliga a parsear cadenas en el componente. Un error tipado
se consulta con un `switch`.

```ts
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** 409: slug duplicado, paquete destacado ya existente… */
  get isConflict() { return this.status === 409; }
  /** 400/422: el ValidationPipe rechazó el DTO */
  get isValidation() { return this.status === 400 || this.status === 422; }
  get isNotFound() { return this.status === 404; }
  /** La sesión ya no sirve: hay que volver al login */
  get isUnauthorized() { return this.status === 401; }
  /** 5xx o red caída: reintentar tiene sentido */
  get isRetryable() { return this.status >= 500 || this.status === 0; }
}

export class NetworkError extends ApiError {
  constructor(cause: unknown) {
    super(0, 'No hay conexión con el servidor', cause);
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends ApiError {
  constructor() {
    super(0, 'El servidor tardó demasiado en responder');
    this.name = 'TimeoutError';
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;
```

## 3 · `token-store.ts` — el access token nunca toca el disco

§16: access token de 15 min **en memoria**, refresh de 30 días en cookie `httpOnly`. Un XSS no
puede leer ninguno de los dos. Guardarlo en `localStorage` tira ese diseño por la ventana.

```ts
let accessToken: string | null = null;
const listeners = new Set<() => void>();

export const tokenStore = {
  get: () => accessToken,
  set(token: string | null) {
    accessToken = token;
    listeners.forEach((l) => l());
  },
  /** Para useSyncExternalStore: el layout reacciona al logout sin prop drilling. */
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
```

## 4 · `session.ts` — refresh con single-flight

**El bug clásico**: cinco peticiones dan 401 a la vez, cinco refresh salen en paralelo. Con la
rotación de §16 el primero invalida al anterior, así que los otros cuatro presentan un token ya
usado — que es exactamente la señal de robo — y el servidor **revoca la sesión entera**. James
se desloguea a mitad de una subida.

La cura es una sola promesa compartida.

```ts
import { config } from './config.js';
import { ApiError } from './errors.js';
import { tokenStore } from './token-store.js';

let inFlight: Promise<string> | null = null;
const onLogout = new Set<() => void>();

export const onSessionLost = (cb: () => void) => {
  onLogout.add(cb);
  return () => onLogout.delete(cb);
};

async function doRefresh(): Promise<string> {
  // credentials: 'include' es lo que envía la cookie httpOnly del dominio de la API.
  // Requiere CORS con Access-Control-Allow-Credentials y un origen explícito, nunca '*'.
  const res = await fetch(`${config.apiUrl}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  if (!res.ok) {
    tokenStore.set(null);
    onLogout.forEach((cb) => cb());
    throw new ApiError(res.status, 'Sesión expirada');
  }

  const { accessToken } = (await res.json()) as { accessToken: string };
  tokenStore.set(accessToken);
  return accessToken;
}

/** Todas las llamadas concurrentes esperan al mismo refresh. */
export function refreshSession(): Promise<string> {
  inFlight ??= doRefresh().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
```

## 5 · `http.ts` — el núcleo

```ts
import { config } from './config.js';
import { ApiError, NetworkError, TimeoutError } from './errors.js';
import { refreshSession } from './session.js';
import { tokenStore } from './token-store.js';

export interface RequestOptions {
  /** El signal que TanStack Query pasa a queryFn. Se combina con el timeout. */
  signal?: AbortSignal;
  /** Query string. Los undefined se omiten; no hay `?x=undefined`. */
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Para /auth/login y /auth/refresh, que no llevan Authorization. */
  skipAuth?: boolean;
  timeoutMs?: number;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(`${config.apiUrl}${path}`);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  return url.toString();
}

async function parse<T>(res: Response): Promise<T> {
  // 204 y 205 no traen cuerpo: pedir .json() lanza.
  if (res.status === 204 || res.status === 205) return undefined as T;
  const texto = await res.text();
  if (!texto) return undefined as T;
  try {
    return JSON.parse(texto) as T;
  } catch {
    throw new ApiError(res.status, 'Respuesta no válida del servidor', texto);
  }
}

async function toError(res: Response): Promise<ApiError> {
  const body = await parse<{ message?: string | string[] }>(res).catch(() => undefined);
  const m = body?.message;
  const mensaje = Array.isArray(m) ? m.join('. ') : (m ?? `Error ${res.status}`);
  return new ApiError(res.status, mensaje, body);
}

async function send(
  path: string,
  init: RequestInit,
  opts: RequestOptions,
): Promise<Response> {
  const timeout = AbortSignal.timeout(opts.timeoutMs ?? config.timeoutMs);
  // AbortSignal.any es nativo: combina la cancelación de TanStack Query con el timeout
  // sin cablear listeners a mano.
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;

  const headers = new Headers(init.headers);
  // Content-Type SOLO si hay cuerpo: en un GET provoca un preflight CORS innecesario.
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (!opts.skipAuth) {
    const token = tokenStore.get();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    return await fetch(buildUrl(path, opts.query), { ...init, headers, signal });
  } catch (e) {
    if (timeout.aborted) throw new TimeoutError();
    if (opts.signal?.aborted) throw e; // cancelación legítima: que la vea TanStack Query
    throw new NetworkError(e);
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  opts: RequestOptions = {},
): Promise<T> {
  const res = await send(path, init, opts);
  if (res.ok) return parse<T>(res);

  // Un único reintento tras refrescar. Nunca más: si el segundo también da 401,
  // el problema no es el token.
  if (res.status === 401 && !opts.skipAuth) {
    await refreshSession(); // lanza y dispara el logout si el refresh no vale
    const reintento = await send(path, init, opts);
    if (reintento.ok) return parse<T>(reintento);
    throw await toError(reintento);
  }

  throw await toError(res);
}

// El cuerpo se serializa a string, no a stream: así el reintento del 401 puede reusarlo.
const json = (body: unknown): RequestInit =>
  body === undefined ? {} : { body: JSON.stringify(body) };

export const api = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>(path, { method: 'GET' }, opts),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { method: 'POST', ...json(body) }, opts),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { method: 'PATCH', ...json(body) }, opts),
  put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { method: 'PUT', ...json(body) }, opts),
  delete: <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, { method: 'DELETE' }, opts),
};
```

### Por qué cada decisión

| Decisión | Motivo |
|---|---|
| Cuerpo serializado a `string`, no a stream | Un `ReadableStream` se consume una vez: el reintento del 401 fallaría |
| `AbortSignal.any([signal, timeout])` | Cancelación de TanStack Query **y** timeout, sin listeners a mano. Nativo |
| Distinguir `TimeoutError` de `NetworkError` | La UI dice "el servidor tarda" o "no hay conexión", no "algo falló" |
| Cancelación legítima se relanza tal cual | Si la envuelves, TanStack Query la trata como error y muestra un toast al navegar |
| `Content-Type` solo con cuerpo | En un GET dispara un preflight CORS que no hace falta |
| Un solo reintento | Si el segundo 401 llega, el token no es el problema |
| Sin `Idempotency-Key` automático | No hay tabla de claves (ver `CLAUDE.md`): el `confirm` es idempotente por `WHERE status = PENDING` y el presign por `clientUploadId` |
| Sin reintentos por red | Los hace TanStack Query. En los dos sitios se multiplican en silencio |

## 6 · `keys.ts` — claves jerárquicas

Es la pieza que decide si invalidar la caché escala o se convierte en adivinanza. Con claves
literales dispersas, `invalidateQueries(['galleries'])` acierta o falla según cómo se escribió
cada `useQuery`. Con una factoría, invalidar por prefijo es exacto.

```ts
export const keys = {
  galleries: {
    all: ['galleries'] as const,
    lists: () => [...keys.galleries.all, 'list'] as const,
    list: (filtros: Record<string, unknown>) => [...keys.galleries.lists(), filtros] as const,
    detail: (id: string) => [...keys.galleries.all, 'detail', id] as const,
  },
  packages: {
    all: ['packages'] as const,
    list: () => [...keys.packages.all, 'list'] as const,
    detail: (id: string) => [...keys.packages.all, 'detail', id] as const,
  },
  dashboard: {
    all: ['dashboard'] as const,
    whatsappClicks: (dias: number) => [...keys.dashboard.all, 'whatsapp', dias] as const,
    storage: () => [...keys.dashboard.all, 'storage'] as const,
  },
} as const;
```

Tras un `PATCH`: `invalidateQueries({ queryKey: keys.galleries.lists() })` refresca todas las
listas y deja los detalles intactos.

**El objeto de filtros que entra en `keys.galleries.list()` es exactamente el que gestiona
nuqs.** Una fuente para la URL y para la caché.

## 7 · `endpoints/` — tipado con el contrato

```ts
import type { GalleryDto, Paginated } from '@james-film/contracts';
import { api } from '../http.js';
import type { RequestOptions } from '../http.js';

export const galleries = {
  list: (query: { page?: number; categoryId?: string }, opts?: RequestOptions) =>
    api.get<Paginated<GalleryDto>>('/admin/galleries', { ...opts, query }),

  byId: (id: string, opts?: RequestOptions) =>
    api.get<GalleryDto>(`/admin/galleries/${id}`, opts),

  reorderMedia: (id: string, ids: string[]) =>
    api.patch<void>(`/admin/galleries/${id}/media/reorder`, { ids }),
};
```

Y en el componente, con el `signal` que da TanStack Query:

```ts
useQuery({
  queryKey: keys.galleries.list(filtros),
  queryFn: ({ signal }) => galleries.list(filtros, { signal }),
});
```

## Lo que este cliente NO hace

- **No sube archivos.** El `PUT` a R2 va con `XMLHttpRequest` porque `fetch` no emite progreso
  de subida (§17), y además no lleva `Authorization`: la URL firmada ya autoriza.
- **No cachea.** Eso es TanStack Query.
- **No reintenta por red.** Eso es TanStack Query.
- **No sabe rutas.** Eso es `endpoints/`.

## Qué se testea

1. Cinco peticiones con 401 simultáneo disparan **un solo** `/auth/refresh`.
2. Un refresh fallido limpia el token y emite el evento de logout.
3. Un 401 tras el reintento no vuelve a refrescar.
4. El timeout produce `TimeoutError`; una cancelación se relanza sin envolver.
5. `query` omite los `undefined`: no aparece `?categoryId=undefined`.
6. Un 204 no intenta parsear JSON.
7. El array `message` del `ValidationPipe` se une en una frase legible.

---

# Animaciones

El admin **no tiene presupuesto de INP** que cuidar: no se indexa. Las restricciones duras de §6
son de la landing.

| Momento | Cómo |
|---|---|
| Modales, hojas, toasts | `AnimatePresence` |
| Grilla de medios al reordenar o borrar | Prop `layout` sobre `@dnd-kit`. Lo que más se nota |
| Bloques del dashboard y filas al cargar | Stagger de 30-40 ms |
| El número de clics a WhatsApp | Count-up al entrar |
| Skeleton → contenido | Crossfade con el `isPending` de TanStack Query |
| Cambio de pantalla | View Transitions nativa |
| Progreso de subida | `transform: scaleX()` |

**Las reglas que lo mantienen elegante:**

- **150-250 ms.** Nada por encima de 400: lo lento se percibe como lento, no como cuidado.
- `ease-out` al entrar, `ease-in` al salir.
- **Una cosa se mueve a la vez.** Si al abrir un modal también se desliza la lista de detrás,
  no se lee ninguna de las dos.
- **Solo `transform` y `opacity`.** Aquí no es por INP: un panel con 15 tarjetas de vídeo que
  reflowea se nota igual.
- **`prefers-reduced-motion` respetado, sin excepciones.**

**Dirección visual**: base neutra clara —James trabaja de día, después de un evento— con el
latón `#C9A96A` como acento único, reutilizando la regla de §6. Densidad baja. En el editor, la
grilla de medios ocupa el 80% de la pantalla y el resto es cromo. El diseño concreto se hace en
la fase 4 con componentes delante.
