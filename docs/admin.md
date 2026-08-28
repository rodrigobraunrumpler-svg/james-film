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
Utilidades   clsx + tailwind-merge · use-debounce · server-only
Móvil        vaul (hojas con arrastre) · next-themes (opcional)
Tests        Vitest + Testing Library + happy-dom + Playwright + msw
Dev          @tanstack/react-query-devtools
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

## Complementos

Analizados contra lo que las 8 pantallas necesitan de verdad:

| Librería | Versión | Por qué entra |
|---|---|---|
| **`server-only`** | 0.0.1 | Marca los módulos que manejan el token: si alguien los importa desde un componente cliente, **el build falla**. Cero bytes en el bundle. Con la pasarela es la pieza que impide que el secreto se filtre por accidente — el mismo tipo de garantía que la regla de ESLint de §3, un nivel abajo |
| **`vaul`** | 1.1.2 | §7 exige "modales → hojas a pantalla completa en móvil". Da el arrastre para cerrar que se siente nativo en iOS, que es donde James lo usa. Es el `Drawer` de shadcn |
| **`use-debounce`** | 10.1.1 | Tres debounces distintos en §10: autoguardado 2 s, reorden 800 ms, búsqueda. Escribirlo a mano son 10 líneas, pero la limpieza al desmontar es donde se cuela la fuga |
| **`@tanstack/react-query-devtools`** | 5.102.8 | Solo desarrollo. Sin esto, depurar por qué una query no se invalida es adivinar |
| **`msw`** | 2.15.0 | §15 pide tests de componente del editor. Interceptar en la capa de red en vez de mockear módulos hace que el test pruebe el código real, incluido el cliente HTTP |
| **`next-themes`** | 0.4.6 | Opcional, pero barato y con un motivo real: **revisar material de vídeo se hace mejor en oscuro**. Integrado en shadcn |

**Opcional para el pulido de la fase 4**: `cmdk` (1.1.1) para una paleta ⌘K. Es el `Command` de
shadcn y da un aire de SaaS premium, pero es una feature, no infraestructura. Se decide cuando
las 8 pantallas existan.

**Fuera por ahora**: TanStack Table (5 tablas de decenas de filas, y §7 obliga a tarjetas
apiladas en móvil igual), `react-dropzone` (30 líneas nativas; entra si el `dragleave` anidado
se pone pesado), `axios`/`ky` (el interceptor de 401 se escribe igual), gráficos (§9 los
descarta), `xstate` (un `useReducer` dentro del store), `react-error-boundary` (`error.tsx` por
ruta cubre el caso), `@t3-oss/env-nextjs` (nuestro `config.ts` con zod son 20 líneas),
`superjson` (los DTOs ya tipan las fechas como `IsoDate`, así que no hay `Date` que serializar),
y cualquier librería de barra de progreso de navegación (`useLinkStatus` de Next lo da nativo).

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

## La frontera de auth — decidida

Todo lo de arriba es independiente **salvo** `middleware`, `cookies()` y los Server Components
con datos: los tres necesitan que el servidor de Next conozca la sesión. Y hoy la sesión vive en
una cookie del dominio de la API (§16), que el servidor de Next **no puede leer**.

**Decidido: opción B.** La A queda documentada solo para que conste por qué se descartó.

### Opción A — cliente puro (descartada)

El navegador guarda el access token en memoria y habla con NestJS entre dominios.

- La API necesita **CORS con credenciales** y un origen explícito.
- El `middleware` no puede proteger rutas: el guard es de cliente, con parpadeo.
- Los Server Components no pueden traer datos autenticados.
- El navegador necesita el **single-flight** del refresh (ver más abajo).

### Opción B — pasarela con Route Handlers  ← **DECIDIDA**

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

# Estados de carga

**Un skeleton no vale para todo, y un spinner genérico no ayuda casi nunca.** Hay cinco
situaciones distintas y cada una tiene una respuesta correcta. La regla que las une:

> **La señal va donde ocurrió la acción**, nunca en un overlay global. Y si se puede evitar
> la espera, se evita en vez de decorarla.

| Situación | Qué se muestra | Por qué |
|---|---|---|
| **Primera carga de una pantalla** | **Skeleton** con la forma final | Sin salto de layout. `loading.tsx` lo da por ruta, gratis |
| **Refetch con datos ya en pantalla** (cambiar filtro, paginar) | **Los datos anteriores**, atenuados | Sustituirlos por un skeleton es un retroceso: tenías información y ahora tienes menos |
| **Mutación** (guardar, reordenar, publicar) | **Optimista** + estado pendiente en el propio botón | Ver abajo |
| **Navegación entre pantallas** | `loading.tsx` + View Transitions, y pendiente **en el enlace pulsado** | Un overlay global tapa la pantalla que ya estaba bien |
| **Operación con progreso real** (subidas) | **Barra de progreso real**, nunca indeterminada | Ya lo da `xhr.upload.onprogress` (§10) |

## Primera carga: skeleton en todas las pantallas

Cada pantalla tiene su skeleton, con la **forma real** de su contenido — no un rectángulo gris
genérico. Un skeleton que no coincide con lo que llega produce salto de layout, que es peor que
no tener nada.

| Pantalla | Skeleton |
|---|---|
| Dashboard | Los tres bloques de §9 con sus alturas reales |
| Galerías | 6 filas / tarjetas con la proporción de la portada |
| Editor de galería | La grilla de medios con `aspect-ratio: 9/16` ya reservado |
| Categorías · Paquetes · Testimonios | Filas de tabla, tarjetas apiladas bajo `md` |
| Configuración | Los campos del formulario con sus alturas |

El `aspect-ratio` reservado no es cosmético: es lo que mantiene el CLS bajo (§17), y aquí además
evita que la grilla salte cuando entran 15 posters.

## Refetch: nunca vuelvas al skeleton

```ts
useQuery({
  queryKey: keys.galleries.list(filtros),
  queryFn: ({ signal }) => galleries.list(filtros, { signal }),
  placeholderData: keepPreviousData,   // ← conserva lo anterior mientras llega lo nuevo
});
```

Con `isFetching` se atenúa ligeramente la lista (`opacity: .6`) o se muestra una barra fina
arriba. **Sin `keepPreviousData`, cambiar de filtro hace parpadear la pantalla entera** con cada
pulsación.

## Mutaciones: aquí el skeleton no aplica, y el spinner tampoco

No hay forma que dibujar: no estás esperando datos, estás esperando una confirmación. Tres
niveles, de mejor a peor:

**1 · Optimista — el caso por defecto.** La UI muestra el resultado **al instante** y revierte si
falla. Es lo que §10 ya exige para el reorden, y aplica igual a publicar, marcar portada, activar
un testimonio o reordenar paquetes.

```ts
useMutation({
  mutationFn: (ids: string[]) => galleries.reorderMedia(id, ids),
  onMutate: async (ids) => {
    await qc.cancelQueries({ queryKey: keys.galleries.detail(id) });
    const previo = qc.getQueryData(keys.galleries.detail(id));
    qc.setQueryData(keys.galleries.detail(id), (g) => reordenar(g, ids));
    return { previo };                                    // ← para revertir
  },
  onError: (_e, _v, ctx) => {
    qc.setQueryData(keys.galleries.detail(id), ctx?.previo);
    toast.error('No se pudo reordenar. Vuelve a intentarlo.');
  },
  onSettled: () => qc.invalidateQueries({ queryKey: keys.galleries.detail(id) }),
});
```

**Cuándo NO ser optimista**: cuando el servidor decide algo que el cliente no puede predecir —
el slug generado con desambiguación, o un borrado con confirmación fuerte (§9). Ahí se espera.

**2 · Estado pendiente local, cuando hay que esperar.** El botón se deshabilita, cambia el texto
("Guardar" → "Guardando…") y lleva un spinner **de 16px dentro de él**. El resto de la pantalla
sigue viva y navegable. Nunca un overlay que bloquee todo.

**3 · Confirmación al terminar, no al empezar.** Un toast de sonner al éxito, o un error que
diga qué hacer. Un toast de "guardando…" es ruido: el botón ya lo dice.

## Autoguardado: ni spinner ni toast

El editor guarda el borrador con debounce de 2 s (§10). Un spinner cada dos segundos es una
pantalla que tiembla. Una línea de texto discreta, como Notion o Google Docs:

```
Guardando…        →        Guardado hace un momento
```

Mismo patrón en la **barra de publicación** de §9, que ya está diseñada así:
`● 3 cambios sin publicar` → `◐ Publicando… (~1 min)` → `✓ Publicado hace 4 minutos`.

## Errores y vacíos son estados de carga también

- **Error**: `error.tsx` por ruta, con botón de reintentar. Nunca una pantalla en blanco.
- **Vacío**: §9 lo exige explícitamente — "Aún no tienes galerías → Crear la primera". El estado
  vacío es el momento en que James decide si la herramienta le sirve.
- **Sin conexión**: el `NetworkError` del cliente HTTP se distingue del `TimeoutError`, así que
  el mensaje puede ser "no hay conexión" y no "algo falló".

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
│   ├── api/[...ruta]/route.ts    # la pasarela a NestJS
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
│   ├── api/                      # cliente del navegador
│   │   └── server/               # la pasarela — todo con `import 'server-only'`
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

# La pasarela (servidor)

Es la pieza que hace posible todo lo anterior. Vive en `src/lib/api/server/` y **todo el
directorio empieza por `import 'server-only'`**: si algo de aquí acaba importado desde un
componente cliente, el build falla en vez de filtrar el token.

## Dónde vive la sesión — enmienda a §16

§16 diseñó el refresh como cookie `httpOnly` del **dominio de la API**, porque asumía que el
navegador hablaba directamente con NestJS. Con la pasarela eso ya no ocurre: **el navegador nunca
toca la API**. Así que:

> `POST /auth/login` de NestJS devuelve `{ accessToken, refreshToken }` **en el cuerpo**.
> La pasarela los guarda en **su propia cookie `httpOnly` del dominio del admin**.
> Todo lo demás de §16 sigue igual: 15 min / 30 días, rotación, detección de reuso.

**No hace falta cifrar la cookie.** Los dos valores son credenciales opacas que la API valida por
su cuenta; es `httpOnly`, así que el JS no la lee, y manipularla desde devtools solo rompe la
sesión propia. Añadir `iron-session` sería ceremonia sin garantía nueva.

## `app/api/[...ruta]/route.ts`

```ts
import 'server-only';
import { proxy } from '@/lib/api/server/proxy';

// SIN ESTO Next puede cachear las respuestas GET y servir los datos de una sesión
// a otra. En una pasarela autenticada eso es un fallo de seguridad, no una optimización.
export const dynamic = 'force-dynamic';

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
```

## `lib/api/server/proxy.ts`

```ts
import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { serverConfig } from './config';
import { borrarSesion, guardarSesion, leerSesion, refrescar } from './session';

// Cabeceras de salto que no deben reenviarse: las gestiona cada conexión.
const NO_REENVIAR = new Set(['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'host', 'cookie']);

function cabeceras(origen: Headers, token?: string): Headers {
  const h = new Headers();
  origen.forEach((v, k) => {
    if (!NO_REENVIAR.has(k.toLowerCase())) h.set(k, v);
  });
  if (token) h.set('Authorization', `Bearer ${token}`);
  return h;
}

export async function proxy(
  req: NextRequest,
  ctx: { params: Promise<{ ruta: string[] }> },
): Promise<NextResponse> {
  const { ruta } = await ctx.params;
  const destino = new URL(`${serverConfig.apiUrl}/${ruta.join('/')}`);
  destino.search = req.nextUrl.search;

  // Se lee a texto, no se reenvía el stream: el reintento tras el 401 necesita releerlo.
  const cuerpo =
    req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.text();

  const sesion = await leerSesion();
  const enviar = (token?: string) =>
    fetch(destino, {
      method: req.method,
      headers: cabeceras(req.headers, token),
      body: cuerpo,
      signal: AbortSignal.timeout(serverConfig.timeoutMs),
      cache: 'no-store',
    });

  let res = await enviar(sesion?.accessToken);

  if (res.status === 401 && sesion?.refreshToken) {
    const nueva = await refrescar(sesion.refreshToken);
    if (!nueva) {
      await borrarSesion();
      return NextResponse.json({ message: 'Sesión expirada' }, { status: 401 });
    }
    await guardarSesion(nueva);
    res = await enviar(nueva.accessToken);
  }

  // Se devuelve el estado tal cual: 409, 404 y 400 tienen que llegar al cliente
  // para que ApiError los distinga. Una pasarela que lo aplana a 500 es inútil.
  return new NextResponse(res.body, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}
```

## `lib/api/server/session.ts`

```ts
import 'server-only';
import { cookies } from 'next/headers';
import { serverConfig } from './config';

const COOKIE = 'jf_sesion';

export interface Sesion {
  accessToken: string;
  refreshToken: string;
}

export async function leerSesion(): Promise<Sesion | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as unknown;
    return typeof s === 'object' && s !== null && 'accessToken' in s ? (s as Sesion) : null;
  } catch {
    return null;
  }
}

export async function guardarSesion(s: Sesion): Promise<void> {
  (await cookies()).set(COOKIE, JSON.stringify(s), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60, // igual que el refresh de §16
  });
}

export const borrarSesion = async (): Promise<void> => {
  (await cookies()).delete(COOKIE);
};

export async function refrescar(refreshToken: string): Promise<Sesion | null> {
  const res = await fetch(`${serverConfig.apiUrl}/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    signal: AbortSignal.timeout(serverConfig.timeoutMs),
    cache: 'no-store',
  });
  return res.ok ? ((await res.json()) as Sesion) : null;
}
```

> **`cookies().set()` solo funciona en Route Handlers y Server Actions**, nunca en un Server
> Component. Por eso el refresh vive en la pasarela y no en un layout.

## `middleware.ts`

```ts
import { NextResponse, type NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  // Solo comprueba presencia. La validez la decide la API: el middleware no debe
  // hacer red ni verificar firmas, corre en cada navegación.
  if (req.cookies.has('jf_sesion')) return NextResponse.next();

  const login = new URL('/login', req.url);
  login.searchParams.set('desde', req.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|login|api/auth).*)'],
};
```

Esto es lo que elimina el parpadeo de contenido protegido: la redirección ocurre **antes** de
pintar nada.

## Lo que la pasarela NO toca

- **La subida a R2.** El `PUT` firmado va del navegador a R2 directamente. La pasarela solo
  mueve el JSON del presign. §4 y §10 intactos.
- **Por eso R2 sigue necesitando CORS** para el origen del admin, aunque la API ya no lo necesite.
  Es fácil de olvidar al quitar el CORS de la API: no son el mismo CORS.

---

# El cliente del navegador

Con la pasarela decidida, el cliente se queda en **cuatro piezas** y ninguna maneja credenciales:

```
src/lib/api/
├── config.ts     env validada al cargar — nada hardcodeado
├── errors.ts     ApiError tipado + guards
├── http.ts       request(): URL, query, abort, parseo, mapeo de errores
├── keys.ts       factoría de claves de TanStack Query
└── endpoints/    funciones tipadas por recurso, con los DTOs del contrato
```

**Lo que desapareció respecto a un cliente sin pasarela**: el almacén de tokens, la cabecera
`Authorization`, el single-flight del refresh y el CORS con credenciales. El token nunca llega
aquí, así que no hay nada que proteger ni que sincronizar.

Reglas que sostienen el diseño:

- **`http.ts` no sabe de negocio.** No conoce rutas, ni recursos, ni DTOs concretos.
- **`endpoints/` no sabe de transporte.** No toca cabeceras ni reintentos.
- **El wrapper no reintenta.** Los reintentos son de TanStack Query; hacerlo en los dos sitios
  los multiplica sin que nadie lo note.
- **Cero `any`.** Lo que no se pueda tipar se estrecha con un guard.

## 1 · `config.ts` — nada hardcodeado

Mismo principio que §5 en la API: si falta una variable, revienta al cargar, no en producción.

```ts
import { z } from 'zod';

// En Next las variables de cliente se inlinean en build: hay que nombrarlas enteras,
// `process.env[nombre]` no funciona.
const schema = z.object({
  NEXT_PUBLIC_API_BASE: z.string().startsWith('/').default('/api'),
  NEXT_PUBLIC_API_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
});

const parsed = schema.safeParse({
  NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE,
  NEXT_PUBLIC_API_TIMEOUT_MS: process.env.NEXT_PUBLIC_API_TIMEOUT_MS,
});

if (!parsed.success) {
  throw new Error(
    `Configuración inválida del admin:\n${parsed.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n')}`,
  );
}

// Mismo origen: la pasarela. La URL de NestJS solo la conoce el servidor.
export const config = {
  base: parsed.data.NEXT_PUBLIC_API_BASE,
  timeoutMs: parsed.data.NEXT_PUBLIC_API_TIMEOUT_MS,
} as const;
```

> `serverConfig` (en `lib/api/server/config.ts`, con `server-only`) valida aparte
> `API_URL` — **sin** `NEXT_PUBLIC_`, para que no se inline en el bundle del navegador.

## 2 · `errors.ts` — errores que la UI puede leer

Un `throw new Error('algo falló')` obliga a parsear cadenas en el componente. Un error tipado se
consulta con un `switch`.

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
  /** La pasarela ya intentó refrescar: si llega un 401, hay que volver al login */
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

## 3 · `http.ts` — el núcleo

```ts
import { config } from './config';
import { ApiError, NetworkError, TimeoutError } from './errors';

export interface RequestOptions {
  /** El signal que TanStack Query pasa a queryFn. Se combina con el timeout. */
  signal?: AbortSignal;
  /** Query string. Los undefined se omiten; no hay `?x=undefined`. */
  query?: Record<string, string | number | boolean | undefined | null>;
  timeoutMs?: number;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(`${config.base}${path}`, window.location.origin);
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
  // El ValidationPipe de NestJS devuelve `message` como array de frases.
  const mensaje = Array.isArray(m) ? m.join('. ') : (m ?? `Error ${res.status}`);
  return new ApiError(res.status, mensaje, body);
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  opts: RequestOptions = {},
): Promise<T> {
  const timeout = AbortSignal.timeout(opts.timeoutMs ?? config.timeoutMs);
  // AbortSignal.any es nativo: combina la cancelación de TanStack Query con el
  // timeout sin cablear listeners a mano.
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;

  const headers = new Headers(init.headers);
  // Content-Type SOLO si hay cuerpo: en un GET provoca trabajo innecesario.
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), { ...init, headers, signal });
  } catch (e) {
    if (timeout.aborted) throw new TimeoutError();
    if (opts.signal?.aborted) throw e; // cancelación legítima: que la vea TanStack Query
    throw new NetworkError(e);
  }

  if (!res.ok) throw await toError(res);
  return parse<T>(res);
}

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
| `AbortSignal.any([signal, timeout])` | Cancelación de TanStack Query **y** timeout, sin listeners a mano. Nativo |
| Distinguir `TimeoutError` de `NetworkError` | La UI dice "el servidor tarda" o "no hay conexión", no "algo falló" |
| La cancelación legítima se relanza tal cual | Si la envuelves, TanStack Query la trata como error y saca un toast al navegar |
| `Content-Type` solo con cuerpo | En un GET no aporta nada |
| Sin reintentos por red | Los hace TanStack Query. En los dos sitios se multiplican en silencio |
| Sin `Idempotency-Key` automático | No hay tabla de claves: el `confirm` es idempotente por `WHERE status = PENDING` y el presign por `clientUploadId` |
| El 401 no se maneja aquí | Ya lo intentó la pasarela. Si llega, la sesión murió: el `QueryClient` global redirige al login |

## 4 · `keys.ts` — claves jerárquicas

Es la pieza que decide si invalidar la caché escala o se convierte en adivinanza. Con claves
literales dispersas, `invalidateQueries(['galleries'])` acierta o falla según cómo se escribió
cada `useQuery`.

```ts
export const keys = {
  galleries: {
    all: ['galleries'] as const,
    lists: () => [...keys.galleries.all, 'list'] as const,
    list: (filtros: Record<string, unknown>) => [...keys.galleries.lists(), filtros] as const,
    detail: (id: string) => [...keys.galleries.all, 'detail', id] as const,
  },
  categories: {
    all: ['categories'] as const,
    list: () => [...keys.categories.all, 'list'] as const,
    detail: (id: string) => [...keys.categories.all, 'detail', id] as const,
  },
  packages: {
    all: ['packages'] as const,
    list: () => [...keys.packages.all, 'list'] as const,
    detail: (id: string) => [...keys.packages.all, 'detail', id] as const,
  },
  testimonials: {
    all: ['testimonials'] as const,
    list: (filtros: Record<string, unknown>) => [...keys.testimonials.all, 'list', filtros] as const,
  },
  settings: { all: ['settings'] as const },
  publish: { state: ['publish', 'state'] as const },
  dashboard: {
    all: ['dashboard'] as const,
    whatsappClicks: (dias: number) => [...keys.dashboard.all, 'whatsapp', dias] as const,
    storage: () => [...keys.dashboard.all, 'storage'] as const,
    alerts: () => [...keys.dashboard.all, 'alerts'] as const,
  },
} as const;
```

Tras un `PATCH`: `invalidateQueries({ queryKey: keys.galleries.lists() })` refresca todas las
listas y deja los detalles intactos.

### nuqs y la clave son el mismo objeto

Esto es lo que hace que la URL y la caché no se desincronicen nunca:

```ts
'use client';
import { useQueryStates, parseAsInteger, parseAsString } from 'nuqs';

export function useFiltrosGalerias() {
  const [filtros, setFiltros] = useQueryStates({
    page: parseAsInteger.withDefault(1),
    categoryId: parseAsString,
    q: parseAsString,
  });
  return { filtros, setFiltros };
}

// En el componente:
const { filtros } = useFiltrosGalerias();
useQuery({
  queryKey: keys.galleries.list(filtros),        // ← el MISMO objeto que la URL
  queryFn: ({ signal }) => galleries.list(filtros, { signal }),
  placeholderData: keepPreviousData,
});
```

Cambiar un filtro reescribe la URL **y** la clave a la vez. El botón atrás vuelve a una vista que
ya está en caché, así que es instantáneo.

## 5 · `endpoints/` — tipado con el contrato

```ts
import type { GalleryDto, Paginated } from '@james-film/contracts';
import { api, type RequestOptions } from '../http';

export const galleries = {
  list: (query: { page?: number; categoryId?: string }, opts?: RequestOptions) =>
    api.get<Paginated<GalleryDto>>('/admin/galleries', { ...opts, query }),

  byId: (id: string, opts?: RequestOptions) =>
    api.get<GalleryDto>(`/admin/galleries/${id}`, opts),

  reorderMedia: (id: string, ids: string[]) =>
    api.patch<void>(`/admin/galleries/${id}/media/reorder`, { ids }),
};
```

## Server Components y TanStack Query

El doc dice "Server Component por defecto" y también usa TanStack Query. Conviven así, y conviene
no mezclarlos por capricho:

| Caso | Quién trae los datos |
|---|---|
| Shell, layouts, navegación, textos | **Server Component**, sin datos |
| Pantallas interactivas (todas las 8) | **Cliente + TanStack Query** |
| Primera pintura de una lista larga | Opcional: prefetch en el servidor + `HydrationBoundary` |

**Recomendación para el v1: no usar prefetch con hidratación.** Añade un `dehydrate` por pantalla
para ahorrar un salto que, con un solo usuario y un `loading.tsx` con skeleton, no se nota. Es
optimización sin problema medido — justo lo que §4 dice de no perseguir.

Los Server Components sí traen algo importante gratis: **`loading.tsx` funciona por ruta sin que
escribas estado**, que es la mitad de la sección de estados de carga.

## Lo que este cliente NO hace

- **No sube archivos.** El `PUT` a R2 va con `XMLHttpRequest` porque `fetch` no emite progreso de
  subida (§17), y no pasa por la pasarela: la URL firmada ya autoriza.
- **No cachea, ni reintenta.** Eso es TanStack Query.
- **No conoce rutas.** Eso es `endpoints/`.
- **No maneja credenciales.** Eso es la pasarela.

## Qué se testea

**De la pasarela** (donde vive el riesgo):

1. Un 401 dispara **un** refresh y reintenta **una** vez; si el segundo también falla, borra la
   cookie y devuelve 401.
2. Los códigos de estado pasan sin aplanarse: un 409 de la API llega como 409 al navegador.
3. La cookie de sesión **no** se reenvía a NestJS (va en `NO_REENVIAR`).
4. La cookie es `httpOnly`, `sameSite=lax` y `secure` en producción.
5. `dynamic = 'force-dynamic'`: dos sesiones distintas no comparten respuesta cacheada.

**Del cliente:**

6. El timeout produce `TimeoutError`; una cancelación se relanza sin envolver.
7. `query` omite los `undefined`: no aparece `?categoryId=undefined`.
8. Un 204 no intenta parsear JSON.
9. El array `message` del `ValidationPipe` se une en una frase legible.

---

# Accesibilidad

§7 solo cubre los targets de 44px. Un admin con cola de subidas necesita algo más, y es barato:

- **`aria-live="polite"`** en la región de estado de las subidas y en la barra de publicación:
  un fallo que solo se ve como un icono rojo no existe para quien usa lector de pantalla.
- **Foco gestionado en modales y hojas**: lo da Radix, pero hay que **devolver el foco** al
  elemento que abrió el diálogo al cerrarlo.
- **El drag & drop necesita alternativa por teclado.** `@dnd-kit` trae `KeyboardSensor`, y §10 ya
  pide botones de mover por otra razón (el pulgar en el móvil): la misma solución cubre las dos.
- **Contraste AA** sobre la base neutra. El latón `#C9A96A` sobre blanco **no** llega a 4.5:1,
  así que sirve para bordes, iconos y acentos, **no para texto pequeño**.
- **`prefers-reduced-motion`** respetado sin excepciones.

# PWA

§10 lo pide y son quince minutos:

- **`app/manifest.ts`** tipado con `MetadataRoute.Manifest`, no un `manifest.json` a mano.
- Iconos 192 y 512, `display: 'standalone'`, `theme_color` de la base neutra.
- **`env(safe-area-inset-bottom)`** en la barra de publicación fija, o el notch se la come (§7).
- **Sin service worker ni modo offline en el v1.** Subir requiere red por definición, y un SW mal
  invalidado sirve una versión vieja del admin durante días. Se añade si algún día hay algo que
  de verdad funcione sin conexión.


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
