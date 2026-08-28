# Fase 2 — API mínima · Plan de implementación

> **Para ejecutores agénticos:** SUB-SKILL REQUERIDA: usa `superpowers:subagent-driven-development`
> o `superpowers:executing-plans` para implementar tarea por tarea. Los pasos usan checkbox.

**Goal:** Dejar la API capaz de autenticar a James, servir galerías y firmar subidas a R2 — lo
mínimo que la fase 3 (el editor de galería) necesita para existir.

**Architecture:** NestJS 12 en ESM. Los servicios usan `PrismaService` directamente (sin
repository pattern, ver `CLAUDE.md`). Dos controllers por módulo: público read-only sin auth y
admin con guard. El almacenamiento se abstrae tras `StorageService` con un único adaptador
S3-compatible, así que **MinIO en local y R2 en producción son el mismo código con otro endpoint**.

**Tech Stack:** NestJS 12 · Prisma 7.10 · `@aws-sdk/client-s3` · `@nestjs/jwt` · `@nestjs/throttler` ·
Zod 4 · Vitest 4 · MinIO (local y CI)

**Spec:** `CLAUDE.md` (fuente de verdad) · `docs/proyecto.md` §5, §10, §16, §17 · `docs/admin.md`
(la pasarela es el consumidor de esta API)

## Global Constraints

Además de todo lo de `CLAUDE.md`:

- **ESM**: todo import relativo lleva `.js`. El cliente de Prisma se importa de
  `../generated/prisma/client.js`, nunca de `@prisma/client`.
- **Dos controllers por módulo.** El público filtra **siempre** `isPublished`, `isActive`,
  `deletedAt: null`, `hasConsent` en testimonios, y solo devuelve `Media` en `READY`. Nunca
  acepta un parámetro que lo desactive. **Con test.**
- **`UpdateDto` siempre `PartialType(CreateDto)`.** Nunca a mano.
- **Los DTOs `implements` las interfaces de `@james-film/contracts`**: si divergen, no compila.
- **`storageKey` en la base, nunca la URL.** Solo `MediaUrlInterceptor` conoce `CDN_BASE_URL`.
- **Nunca subir archivos a través de la API.** Presigned PUT directo.
- **El `PrismaExceptionFilter` no lee `err.meta.target`** — no existe en Prisma 7 con driver
  adapter y leerlo convierte el 409 en un 500.
- **El `exists()` del slug de `Gallery` NO filtra `deletedAt`** — el índice no es parcial.
- **Contraseñas con argon2id** (`src/common/hash.ts`, ya existe). **Refresh con SHA-256.**
- Nada deprecado, nada en preview. `npm view <pkg> dist-tags` antes de fijar una versión.

## Fuera de esta fase

`DeployService` y su interceptor (fase 5: no hay landing que reconstruir), multipart (se decide
en la 3.5 tras probar en el iPhone real), categorías, paquetes, testimonios y settings (fase 4),
health, pino y Sentry (fase 6), el cron de huérfanos (fase 6).

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/config/env.schema.ts` | **Modificar**: añadir JWT, R2 y límites |
| `src/common/dto/` | `PaginationDto`, `ReorderDto`, `IdParamDto` |
| `src/common/filters/prisma-exception.filter.ts` | Códigos de Prisma → HTTP |
| `src/common/services/{slug,reorder,exclusive-flag}.service.ts` | Comportamientos compartidos |
| `src/common/decorators/` | `@Public()`, `@CurrentUser()`, `@AdminController()` |
| `src/common/guards/{jwt-auth,roles}.guard.ts` | Autenticación y rol |
| `src/common/interceptors/media-url.interceptor.ts` | `storageKey` → URL absoluta |
| `src/modules/auth/` | Login, refresh con rotación y gracia, logout, me |
| `src/storage/` | `StorageService` + adaptador S3 |
| `src/modules/galleries/` | Público read-only + admin CRUD |
| `src/modules/media/` | Presign en lote + confirm con verificación HEAD |
| `docker-compose.yml` | **Modificar**: añadir MinIO |

---

## Task 1: Fundación transversal

**Files:**
- Modify: `src/config/env.schema.ts`, `src/main.ts`
- Create: `src/common/filters/prisma-exception.filter.ts`,
  `src/common/services/{slug,reorder,exclusive-flag}.service.ts`,
  `src/common/dto/{pagination,reorder,id-param}.dto.ts`, `src/common/common.module.ts`
- Test: `src/common/services/*.spec.ts`, `test/prisma-filter.integration.spec.ts`

**Interfaces:**
- Produces: `SlugService.unique(base, exists)`, `ReorderService.reorder(delegate, ids)`,
  `ExclusiveFlagService.setOnly(delegate, field, id, scope)`, y `CommonModule` que los exporta.

- [ ] **Step 1: Ampliar el entorno**

Solo lo que esta fase usa. Una variable declarada y no usada solo consigue que la app no arranque.

```ts
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.url(),
  DIRECT_URL: z.url(),

  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
  /** Ventana en la que un prevHash reciente se acepta en vez de revocar. Ver Task 2. */
  REFRESH_GRACE_SECONDS: z.coerce.number().int().nonnegative().default(30),

  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: z.string(),
  S3_ACCESS_KEY_ID: z.string(),
  S3_SECRET_ACCESS_KEY: z.string(),
  /** Solo lo lee MediaUrlInterceptor. Ningún servicio conoce el dominio del CDN. */
  CDN_BASE_URL: z.url(),

  MAX_VIDEO_MB: z.coerce.number().default(200),
  MAX_IMAGE_MB: z.coerce.number().default(15),
  PRESIGN_TTL_SECONDS: z.coerce.number().default(900),
});
```

Añade los mismos a `.env.example` y `.env.test` (con los valores de MinIO del Task 3).

- [ ] **Step 2: Tests de los tres servicios compartidos**

Son la prioridad 1, 2 y 3 de testing de §15. Lógica pura, sin base de datos salvo el reorder.

`src/common/services/slug.service.spec.ts`
```ts
import { SlugService } from './slug.service.js';

describe('SlugService', () => {
  const service = new SlugService();

  it('slugifica quitando acentos y mayúsculas', async () => {
    expect(await service.unique('XV de Camila', async () => false)).toBe('xv-de-camila');
    expect(await service.unique('Cumpleaños Ñoño', async () => false)).toBe('cumpleanos-nono');
  });

  it('desambigua con sufijo numérico cuando ya existe', async () => {
    const ocupados = new Set(['boda-ana', 'boda-ana-2']);
    expect(await service.unique('Boda Ana', async (s) => ocupados.has(s))).toBe('boda-ana-3');
  });

  it('nunca devuelve cadena vacía', async () => {
    // Un título de solo emoji o solo símbolos slugifica a "".
    const slug = await service.unique('🎬🎬🎬', async () => false);
    expect(slug.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Ejecutar y ver que fallan**

```bash
cd apps/api && pnpm test
```
Expected: FAIL, `slug.service.js` no existe.

- [ ] **Step 4: Implementar los tres servicios**

```ts
// src/common/services/slug.service.ts
import { Injectable } from '@nestjs/common';
import slugify from 'slugify';

@Injectable()
export class SlugService {
  async unique(base: string, exists: (slug: string) => Promise<boolean>): Promise<string> {
    // Si el título no deja nada slugificable, no puede devolverse "".
    const raiz = slugify(base, { lower: true, strict: true, locale: 'es' }) || 'sin-titulo';
    let candidato = raiz;
    let n = 2;
    while (await exists(candidato)) candidato = `${raiz}-${n++}`;
    return candidato;
  }
}
```

```ts
// src/common/services/reorder.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

type OrderableDelegate = {
  update(args: { where: { id: string }; data: { order: number } }): Promise<unknown>;
};

@Injectable()
export class ReorderService {
  constructor(private readonly prisma: PrismaService) {}

  /** Se usa con los tipos intactos: `reorder(this.prisma.media, dto.ids)`. */
  reorder(delegate: OrderableDelegate, ids: string[]) {
    return this.prisma.$transaction(
      ids.map((id, order) => delegate.update({ where: { id }, data: { order } })),
    );
  }
}
```

```ts
// src/common/services/exclusive-flag.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

type FlaggableDelegate = {
  updateMany(args: { where: Record<string, unknown>; data: Record<string, boolean> }): Promise<unknown>;
  update(args: { where: { id: string }; data: Record<string, boolean> }): Promise<unknown>;
};

@Injectable()
export class ExclusiveFlagService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `scope` es lo que permite reusarlo en Media.isFeatured, donde la portada es
   * única POR GALERÍA. Sin él, marcar la portada de una boda desmarcaría la de otra.
   */
  setOnly<T extends FlaggableDelegate>(
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

```bash
cd apps/api && pnpm add slugify class-validator class-transformer
```

- [ ] **Step 5: El filtro de errores de Prisma**

```ts
// src/common/filters/prisma-exception.filter.ts
import { type ArgumentsHost, Catch, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../../generated/prisma/client.js';

/**
 * Mapa estático por código. NUNCA leer `err.meta.target`: en Prisma 7 con driver
 * adapter no existe (`meta = { driverAdapterError, table, modelName }`) y leerlo
 * lanza un TypeError que convierte el 409 en un 500.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly map: Record<string, [number, string]> = {
    P2002: [409, 'Ya existe un registro con ese valor único'],
    P2025: [404, 'No encontrado'],
    P2003: [400, 'Referencia inválida'],
  };

  catch(err: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    const [statusCode, message] = this.map[err.code] ?? [500, 'Error interno'];
    host.switchToHttp().getResponse<Response>().status(statusCode).json({ statusCode, message });
  }
}
```

- [ ] **Step 6: Pipes globales en `main.ts`**

```ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,            // SEGURIDAD: sin esto alguien manda {isPublished:true}
    forbidNonWhitelisted: true, //           a un endpoint que no debería permitirlo
    transform: true,
    // NO activar enableImplicitConversion: convierte "false" en true.
  }),
);
app.useGlobalFilters(new PrismaExceptionFilter());
```

- [ ] **Step 7: Test de integración del filtro**

Que un slug duplicado devuelva 409 y no 500 es la mitad de los errores feos de la API.

```ts
// test/prisma-filter.integration.spec.ts — comprueba el CÓDIGO, no `meta`
it('un slug duplicado se convierte en 409, no en 500', async () => {
  await prisma.category.create({ data: { slug: 'dup', name: 'A' } });
  const err = await prisma.category
    .create({ data: { slug: 'dup', name: 'B' } })
    .catch((e: unknown) => e);
  expect((err as { code: string }).code).toBe('P2002');
  expect(new PrismaExceptionFilter()['map']['P2002']).toEqual([409, expect.any(String)]);
});
```

- [ ] **Step 8: Verificar y commitear**

```bash
pnpm test && pnpm test:integration && pnpm lint && pnpm typecheck
git commit -m "feat(api): fundación transversal — slug, reorder, flag exclusivo y filtro de prisma"
```

---

## Task 2: Auth

**Files:**
- Create: `src/modules/auth/**`, `src/common/guards/{jwt-auth,roles}.guard.ts`,
  `src/common/decorators/{public,current-user,admin-controller}.decorator.ts`
- Test: `src/modules/auth/auth.service.spec.ts`, `test/auth.integration.spec.ts`

**Interfaces:**
- Consumes: `hashPassword`/`verifyPassword` de `src/common/hash.ts`, el modelo `Session`.
- Produces: `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`.
  `@AdminController(path)`, `@Public()`, `@CurrentUser()`.

- [ ] **Step 1: El contrato de tokens**

**Enmienda a §16, ya registrada en `CLAUDE.md`**: como el navegador nunca habla con esta API
(lo hace la pasarela de Next), el login devuelve los tokens **en el cuerpo**, no en una cookie.

```
POST /auth/login    { email, password }        → { accessToken, refreshToken }
POST /auth/refresh  { refreshToken }           → { accessToken, refreshToken }
POST /auth/logout   { refreshToken }           → 204
GET  /auth/me                                  → { id, email, name, role }
```

- **Access token**: JWT firmado con `JWT_SECRET`, 15 min.
- **Refresh token**: 32 bytes aleatorios en hex. En la base se guarda su **SHA-256**, nunca el
  valor. Es alta entropía: un hash rápido es lo correcto, y además es lo único que permite
  buscarlo con `WHERE tokenHash = ?`.

- [ ] **Step 2: Los tests de rotación — el corazón de la fase**

```ts
// test/auth.integration.spec.ts
describe('rotación de refresh', () => {
  it('rota: el token nuevo sirve y el anterior pasa a prevHash', async () => {
    const { refreshToken: t0 } = await login();
    const { refreshToken: t1 } = await refresh(t0);
    expect(t1).not.toBe(t0);

    const s = await prisma.session.findFirstOrThrow({ where: { revokedAt: null } });
    expect(s.tokenHash).toBe(sha256(t1));
    expect(s.prevHash).toBe(sha256(t0));
  });

  it('VENTANA DE GRACIA: el token anterior recién rotado se acepta y NO revoca', async () => {
    // Sin esto, dos invocaciones concurrentes de la pasarela en serverless
    // revocarían la sesión: no hay single-flight posible entre procesos.
    const { refreshToken: t0 } = await login();
    await refresh(t0);
    const segundo = await refresh(t0);          // el mismo t0, dentro de la ventana

    expect(segundo.refreshToken).toBeDefined();
    const s = await prisma.session.findFirstOrThrow();
    expect(s.revokedAt).toBeNull();
  });

  it('fuera de la ventana, el token anterior SÍ es reuso y revoca la sesión', async () => {
    const { refreshToken: t0 } = await login();
    await refresh(t0);
    // Envejecer la rotación más allá de REFRESH_GRACE_SECONDS
    await prisma.session.updateMany({ data: { updatedAt: new Date(Date.now() - 60_000) } });

    await expect(refresh(t0)).rejects.toMatchObject({ status: 401 });
    const s = await prisma.session.findFirstOrThrow();
    expect(s.revokedAt).not.toBeNull();
  });

  it('un token desconocido da 401 sin tocar ninguna sesión', async () => {
    await login();
    await expect(refresh('token-inventado')).rejects.toMatchObject({ status: 401 });
    expect(await prisma.session.count({ where: { revokedAt: null } })).toBe(1);
  });

  it('logout revoca la sesión y su token deja de servir', async () => {
    const { refreshToken } = await login();
    await logout(refreshToken);
    await expect(refresh(refreshToken)).rejects.toMatchObject({ status: 401 });
  });

  it('una contraseña incorrecta no revela si el email existe', async () => {
    const a = await loginRaw('javier.fullstack.qr@gmail.com', 'mal').catch((e) => e);
    const b = await loginRaw('no-existe@x.com', 'mal').catch((e) => e);
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.message).toBe(b.message);
  });
});
```

- [ ] **Step 3: Ejecutar y ver que fallan**

- [ ] **Step 4: `AuthService`**

```ts
// src/modules/auth/auth.service.ts (fragmento clave: el refresh)
import { createHash, randomBytes } from 'node:crypto';

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

async refresh(refreshToken: string): Promise<Tokens> {
  const hash = sha256(refreshToken);

  const sesion = await this.prisma.session.findFirst({
    where: { OR: [{ tokenHash: hash }, { prevHash: hash }], revokedAt: null },
    include: { user: true },
  });

  if (!sesion || sesion.expiresAt < new Date()) throw new UnauthorizedException();

  // Vino por prevHash: o es una carrera legítima, o es un token robado.
  if (sesion.prevHash === hash) {
    const graciaMs = this.env.REFRESH_GRACE_SECONDS * 1000;
    const dentroDeLaVentana = Date.now() - sesion.updatedAt.getTime() < graciaMs;

    if (!dentroDeLaVentana) {
      // Señal de robo: se revoca la sesión entera, no solo este token.
      await this.prisma.session.update({
        where: { id: sesion.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException();
    }
    // Dentro de la ventana: se rota igual. Ambos concurrentes acaban con un par válido.
  }

  return this.rotar(sesion);
}
```

> **Por qué se rota también en la gracia**: solo guardamos hashes, así que no podemos devolver el
> token vigente al que llegó tarde. Rotar de nuevo le da un par válido y mantiene la cadena.

- [ ] **Step 5: Guards y decoradores**

```ts
// src/common/decorators/admin-controller.decorator.ts
export function AdminController(path: string) {
  return applyDecorators(
    Controller(`admin/${path}`),
    UseGuards(JwtAuthGuard, RolesGuard),
    UseInterceptors(ClassSerializerInterceptor),
    ApiBearerAuth(),
    ApiTags(`admin/${path}`),
  );
}
```

Cada admin controller queda en una línea: `@AdminController('galleries')`. El día que haya que
añadir auditoría o rate limiting, se pone aquí y lo heredan todos los módulos.

- [ ] **Step 6: Rate limit del login**

Un admin con un solo usuario y sin límite de intentos es fuerza bruta esperando a ocurrir (§16).

```ts
@Throttle({ default: { limit: 5, ttl: 60_000 } })
@Public()
@Post('login')
```
```bash
cd apps/api && pnpm add @nestjs/jwt @nestjs/throttler @nestjs/passport passport passport-jwt
pnpm add -D @types/passport-jwt
```

- [ ] **Step 7: Verificar y commitear**

```bash
pnpm test:integration -t auth
git commit -m "feat(api): auth con rotación de refresh y ventana de gracia"
```

---

## Task 3: Almacenamiento — MinIO en local, R2 en producción

**Files:**
- Modify: `docker-compose.yml`, `.env.example`, `.env.test`
- Create: `src/storage/{storage.module,storage.service}.ts`,
  `src/common/interceptors/media-url.interceptor.ts`
- Test: `test/storage.integration.spec.ts`

**Interfaces:**
- Produces: `StorageService.getUploadUrl()`, `.headObject()`, `.delete()`, `.getPublicUrl()`.

- [ ] **Step 1: MinIO en Docker**

Esto es lo que permite probar el flujo de subida **completo** en local y en CI sin cuenta de
Cloudflare. R2 es S3-compatible, así que es el mismo `@aws-sdk/client-s3` con otro endpoint: el
código que se prueba aquí es exactamente el que correrá contra R2.

```yaml
  storage:
    image: minio/minio:latest
    container_name: jamesfilm-storage
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: jamesfilm
      MINIO_ROOT_PASSWORD: jamesfilm-secreto
    ports: ['9000:9000', '9001:9001']
    volumes: ['jamesfilm-minio:/data']
    healthcheck:
      test: ['CMD', 'mc', 'ready', 'local']
      interval: 5s
      timeout: 3s
      retries: 10
```

Más un `storage-init` de un solo uso que crea el bucket `jamesfilm` con `mc mb`.

- [ ] **Step 2: Test del flujo firmado completo**

```ts
it('la URL firmada permite subir, y el HEAD devuelve el tamaño real', async () => {
  const { url, key } = await storage.getUploadUrl({
    key: 'videos/prueba.mp4',
    contentType: 'video/mp4',
    contentLength: 12,
  });

  const put = await fetch(url, {
    method: 'PUT',
    headers: { 'content-type': 'video/mp4', 'content-length': '12' },
    body: 'hola mundo!!',
  });
  expect(put.ok).toBe(true);

  const head = await storage.headObject(key);
  expect(head?.contentLength).toBe(12);
});

it('la firma caduca y una URL vencida no sirve', async () => { /* PRESIGN_TTL_SECONDS=1 */ });

it('sin Content-Length en la firma, cualquiera subiría 5 GB con tu credencial', async () => {
  // Verifica que getUploadUrl SIEMPRE incluye la restricción de tamaño (§4).
});
```

- [ ] **Step 3: `StorageService`**

**Un solo adaptador**, no dos. §5 propone `r2.adapter` y `s3.adapter`, pero §17 admite que es el
mismo SDK cambiando el endpoint: serían el mismo archivo dos veces. La interfaz sí se queda —
es la que da la frontera y permite testear.

```ts
@Injectable()
export class StorageService {
  private readonly s3 = new S3Client({
    endpoint: this.env.S3_ENDPOINT,
    region: this.env.S3_REGION,
    forcePathStyle: true,           // MinIO lo necesita; R2 lo tolera
    credentials: { accessKeyId: ..., secretAccessKey: ... },
  });

  /** El límite de tamaño va EN LA FIRMA: sin él, cualquiera sube 5 GB con tu credencial (§4). */
  async getUploadUrl(args: { key: string; contentType: string; contentLength: number }) { ... }

  /** Lo usa el confirm: una subida truncada devuelve un tamaño distinto al declarado. */
  async headObject(key: string): Promise<{ contentLength: number } | null> { ... }
}
```
```bash
cd apps/api && pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

- [ ] **Step 4: `MediaUrlInterceptor`**

Es el **único** sitio del proyecto que conoce `CDN_BASE_URL`. Transforma `storageKey` →
`${CDN_BASE}/${key}` en la respuesta, para que ningún servicio ni componente sepa el dominio y
cambiar de proveedor no toque la base de datos (§17).

- [ ] **Step 5: Verificar y commitear**

---

## Task 4: Galerías

**Files:**
- Create: `src/modules/galleries/**`
- Modify: `packages/contracts/src/index.ts` si falta algún campo
- Test: `test/galleries.integration.spec.ts`

- [ ] **Step 1: Los tests del filtro público — lo no negociable**

```ts
describe('controller público', () => {
  it('no devuelve galerías sin publicar', async () => {
    await crearGaleria({ slug: 'borrador', isPublished: false });
    const { body } = await get('/galleries');
    expect(body.items.map((g) => g.slug)).not.toContain('borrador');
  });

  it('no devuelve galerías con soft delete', async () => { ... });

  it('solo devuelve Media en READY: un PENDING no sale', async () => {
    // Si sale, la landing muestra un vídeo que todavía no está subido.
  });

  it('ignora cualquier parámetro que intente desactivar el filtro', async () => {
    const { body } = await get('/galleries?isPublished=false');
    expect(body.items.every((g) => g.isPublished !== false)).toBe(true);
  });

  it('no expone campos internos en el DTO', async () => {
    const { body } = await get('/galleries/xv-de-camila');
    expect(body.media[0]).not.toHaveProperty('storageKey');
    expect(body.media[0]).not.toHaveProperty('sizeBytes');
    expect(body.media[0]).not.toHaveProperty('status');
  });
});

describe('slug', () => {
  it('NO se regenera al renombrar: los links compartidos siguen vivos', async () => {
    const g = await crearGaleria({ title: 'XV de Camila' });
    await patch(`/admin/galleries/${g.id}`, { title: 'XV Años de Camila' });
    expect((await porId(g.id)).slug).toBe('xv-de-camila');
  });

  it('una galería borrada mantiene su slug ocupado: la nueva es -2', async () => {
    // El índice Gallery_slug_key no es parcial y el cron solo purga a los 30 días.
    const g = await crearGaleria({ title: 'Boda Ana' });
    await del(`/admin/galleries/${g.id}`);           // soft delete
    const nueva = await crearGaleria({ title: 'Boda Ana' });
    expect(nueva.slug).toBe('boda-ana-2');
  });
});

describe('borrado', () => {
  it('es soft: la fila queda con deletedAt y los archivos siguen en el bucket', async () => {
    // Sin esto, el Cascade de Postgres borra los Media sin que la app los vea
    // y los objetos quedan huérfanos en R2 para siempre.
  });
});
```

- [ ] **Step 2 a 5**: implementar `GalleriesService`, los dos controllers, los DTOs con
  `implements GalleryDto`, y el reorden de media con `ReorderService` + la portada con
  `ExclusiveFlagService` y `scope: { galleryId }`.

Endpoints:
```
GET    /galleries                     público, paginado, solo publicadas
GET    /galleries/:slug                público
GET    /admin/galleries                admin, incluye borradores
POST   /admin/galleries                admin, genera slug
PATCH  /admin/galleries/:id            admin, NO regenera slug
DELETE /admin/galleries/:id            admin, soft delete
PATCH  /admin/galleries/:id/media/reorder
PATCH  /admin/galleries/:id/media/:mediaId/cover
```

---

## Task 5: Media — presign y confirm

**Files:**
- Create: `src/modules/media/**`
- Test: `test/media.integration.spec.ts`

- [ ] **Step 1: Los tests del flujo**

```ts
it('valida mime y tamaño ANTES de firmar', async () => {
  // §4: la API valida antes de firmar. Firmar primero y validar después
  // deja una URL válida en manos de quien mandó basura.
  await expect(presign([{ mimeType: 'application/zip', sizeBytes: 100 }]))
    .rejects.toMatchObject({ status: 400 });
  await expect(presign([{ mimeType: 'video/mp4', sizeBytes: 900 * 1024 * 1024 }]))
    .rejects.toMatchObject({ status: 400 });
});

it('firma N archivos en UN roundtrip', async () => {
  const res = await presign(ochoReels);
  expect(res).toHaveLength(8);
  expect(new Set(res.map((r) => r.storageKey)).size).toBe(8);   // sin colisiones
});

it('el mismo clientUploadId devuelve el MISMO media, no uno nuevo', async () => {
  const a = await presign([{ ...reel, clientUploadId: 'abc' }]);
  const b = await presign([{ ...reel, clientUploadId: 'abc' }]);
  expect(b[0].mediaId).toBe(a[0].mediaId);
  expect(await prisma.media.count()).toBe(1);
});

it('confirm verifica con HEAD: si el tamaño no cuadra, FAILED con motivo', async () => {
  // Una subida truncada por pérdida de red devuelve 200 y quedaría READY
  // con un vídeo roto que nadie descubre hasta que un visitante lo abre.
  const [m] = await presign([reelDe1000Bytes]);
  await subirParcial(m.uploadUrl, 400);
  const res = await confirm(m.mediaId);
  expect(res.status).toBe('FAILED');
  expect(res.error).toContain('tamaño');
});

it('confirm es idempotente: dos veces no crea nada ni rompe', async () => {
  // `UPDATE ... WHERE status = PENDING` lo hace idempotente por construcción,
  // sin tabla de claves de idempotencia.
});

it('la orientación se deriva de width/height, no la elige el cliente', async () => {
  expect((await confirmarCon({ width: 1080, height: 1920 })).orientation).toBe('VERTICAL');
  expect((await confirmarCon({ width: 1920, height: 1080 })).orientation).toBe('HORIZONTAL');
});
```

- [ ] **Step 2 a 4**: implementar. Contrato:

```
POST /admin/galleries/:id/media/presign
  [{ filename, mimeType, sizeBytes, type, clientUploadId, width?, height?, durationSec? }]
→ [{ mediaId, uploadUrl, posterUploadUrl, storageKey, posterKey }]

POST /admin/media/:id/confirm   → HEAD, verifica tamaño → READY | FAILED + error
DELETE /admin/media/:id         → soft delete
```

Claves con **UUID, nunca el nombre original** (colisiones y path traversal, §17). Prefijos
`videos/`, `photos/`, `posters/`.

---

## Task 6: Swagger y cierre

- [ ] **Step 1: Dos documentos, no uno**

```ts
const publico = SwaggerModule.createDocument(app, configPublica, {
  include: [GalleriesModule],
});
SwaggerModule.setup('docs/public', app, publico);
```

El doc público es el contrato que consumirá Astro en la fase 5. El de admin lleva
`.addBearerAuth()` y **no se expone en producción**.

Con el plugin `@nestjs/swagger/plugin` en `nest-cli.json`, los tipos y la opcionalidad se
infieren de TypeScript y de class-validator: no hay que escribir `@ApiProperty()` por campo.

- [ ] **Step 2: CI**

Añadir el servicio de MinIO al workflow, con las mismas credenciales que el Docker local.

- [ ] **Step 3: Verificación final de la fase**

```bash
pnpm db:reset && pnpm install --frozen-lockfile
pnpm --filter api db:deploy && pnpm --filter api db:test:deploy && pnpm --filter api db:seed
pnpm lint && pnpm typecheck && pnpm test
```

- [ ] Login con la contraseña del seed devuelve un par de tokens
- [ ] El refresh rota, y el token anterior dentro de la ventana **no** revoca
- [ ] Fuera de la ventana, sí revoca
- [ ] Un endpoint de admin sin token da 401
- [ ] El controller público no devuelve borradores, borradas, ni Media que no esté READY
- [ ] Un slug duplicado da 409, no 500
- [ ] Renombrar una galería no cambia su slug
- [ ] El presign valida mime y tamaño antes de firmar
- [ ] El confirm de una subida truncada deja `FAILED` con motivo
- [ ] Ningún DTO público expone `storageKey`, `sizeBytes` ni `status`
- [ ] `/docs/public` no incluye ninguna ruta de admin

## Lo que la fase 3 necesita de ésta

El editor de galería solo puede empezar cuando: se puede iniciar sesión, crear una galería,
pedir URLs firmadas en lote, subir a ellas desde el navegador y confirmar. Si algo de eso no
está cerrado, la fase 3 se construye sobre arena.
