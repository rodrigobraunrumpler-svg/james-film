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

**Sin Server Actions.** El admin es cliente de la API NestJS (§4). Meterlos convertiría a Next
en un BFF y chocaría con tres decisiones cerradas: el refresh vive en una cookie `httpOnly` del
dominio de la API (§16), las subidas van directas a R2 sin pasar por ningún servidor (§4, §10),
y tendrías dos sistemas de caché sin relación (`revalidateTag` y TanStack Query).

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

# El cliente HTTP

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
