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
- **El guard es global (`APP_GUARD`) y lo público se marca con `@Public()`.** Al revés —guard por
  controller— un módulo nuevo al que se olvide `@AdminController` queda **abierto**. Global, el
  olvido produce un 401, no una filtración. Fallar cerrado, no abierto.
- **Los controllers públicos usan `select` explícito de Prisma, no `@Exclude()`.** `@Exclude()`
  falla abierto: si olvidas marcarlo, el campo sale. `select` falla cerrado: si olvidas incluirlo,
  falta un campo y **el tipo del DTO no compila**. El dato interno nunca sale de la base.
- **Al hacer soft delete de una `Gallery`, se propaga `deletedAt` a sus `Media` en la misma
  transacción.** Si no, sus archivos nunca entran en el barrido de huérfanos y se quedan en el
  bucket para siempre — que es justo el bug que el soft delete venía a evitar.
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
cd apps/api && pnpm add @nestjs/jwt @nestjs/throttler
```

> **Sin Passport.** §16 no lo exige y `JwtAuthGuard` con `jwtService.verifyAsync()` son ~20
> líneas. Passport añadiría tres dependencias y una capa de estrategias para un único método de
> autenticación. Entra el día que haya OAuth o varias estrategias, no antes.

Y el throttler **global** además del estricto del login: un endpoint público sin límite es una
invitación, y `/track/whatsapp` de la fase 6 lo va a necesitar igual.

```ts
ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
{ provide: APP_GUARD, useClass: ThrottlerGuard },
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

Más un `storage-init` de un solo uso que crea el bucket `jamesfilm` con `mc mb` **y le
configura CORS** para el origen del admin.

> **El CORS del bucket es lo que bloquea la fase 3, no el de la API.** Con la pasarela, la API ya
> no necesita CORS; pero el `PUT` firmado sale del navegador al bucket, así que MinIO en local y
> R2 en producción sí lo necesitan. Son dos CORS distintos y es justo el que se olvida.

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

## Task 6: Swagger por decoradores propios

**La documentación no se escribe en el controller.** Cada endpoint lleva **un** decorador, y ese
decorador vive fuera, junto a su módulo. Así el controller se lee como código y la documentación
se cambia sin tocarlo.

### Dónde va cada cosa

```
src/common/swagger/
├── api-doc.decorator.ts        # el compositor genérico
├── api-paginated.decorator.ts  # el envoltorio Paginated<T>
├── api-errors.decorator.ts     # respuestas de error estándar
└── fields.ts                   # decoradores de campo para DTOs

src/modules/galleries/docs/
└── galleries.docs.ts           # un decorador por endpoint de este módulo
```

> **Nota honesta sobre "en el service, en el DTO, etc.":** OpenAPI se genera del grafo de
> **controllers y DTOs**. Un decorador en un service se puede escribir, pero no produce
> documentación: Swagger no mira ahí. Donde sí rinde la composición es en **método de controller**,
> **clase de controller** y **propiedad de DTO** — y ahí es donde está diseñado esto.

### 1 · El compositor genérico

- [ ] **Step 1: `common/swagger/api-doc.decorator.ts`**

```ts
import { applyDecorators, type Type } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiErrors, type CodigoError } from './api-errors.decorator.js';
import { ApiPaginated } from './api-paginated.decorator.js';

export interface ApiDocOptions {
  summary: string;
  description?: string;
  /** Tipo de la respuesta 200/201. Usa `paginated` si va envuelto. */
  ok?: Type<unknown>;
  paginated?: Type<unknown>;
  status?: number;
  /** Errores esperados de ESTE endpoint. 401 lo añade `auth` solo. */
  errors?: CodigoError[];
  auth?: boolean;
}

export function ApiDoc(opts: ApiDocOptions): MethodDecorator {
  const decoradores: MethodDecorator[] = [
    ApiOperation({ summary: opts.summary, description: opts.description }),
  ];

  if (opts.paginated) decoradores.push(ApiPaginated(opts.paginated));
  else if (opts.ok) {
    decoradores.push(ApiResponse({ status: opts.status ?? 200, type: opts.ok }));
  } else {
    decoradores.push(ApiResponse({ status: opts.status ?? 204, description: 'Sin contenido' }));
  }

  if (opts.auth) decoradores.push(ApiBearerAuth());
  decoradores.push(ApiErrors(...(opts.errors ?? []), ...(opts.auth ? [401 as const] : [])));

  return applyDecorators(...decoradores);
}
```

- [ ] **Step 2: `api-errors.decorator.ts` — las respuestas de error, una vez**

Los mensajes salen del `PrismaExceptionFilter` y del `ValidationPipe`: **documentarlos aquí
mantiene los docs y el filtro sincronizados**, en vez de repetir cadenas por endpoint.

```ts
export type CodigoError = 400 | 401 | 403 | 404 | 409 | 422 | 429;

const CATALOGO: Record<CodigoError, string> = {
  400: 'Petición inválida o referencia inexistente',
  401: 'Falta el token o ya no es válido',
  403: 'El rol no permite esta operación',
  404: 'No encontrado',
  409: 'Ya existe un registro con ese valor único',
  422: 'La validación del DTO falló',
  429: 'Demasiadas peticiones',
};

/** Implementa ApiErrorBody de @james-film/contracts: si divergen, no compila. */
class RespuestaError implements ApiErrorBody {
  statusCode!: number;
  code!: ErrorCode;
  message!: string;
  details?: FieldError[];
  requestId?: string;
  timestamp!: string;
}

export const ApiErrors = (...codigos: CodigoError[]): MethodDecorator =>
  applyDecorators(
    ...[...new Set(codigos)].map((c) =>
      ApiResponse({ status: c, description: CATALOGO[c], type: RespuestaError }),
    ),
  );
```

- [ ] **Step 3: `api-paginated.decorator.ts` — donde el plugin no llega**

El plugin de Swagger infiere tipos de TypeScript, **pero no genéricos**: `Paginated<GalleryDto>`
sale como `object` vacío. Esta es la razón concreta por la que hace falta un decorador y no basta
con la inferencia automática.

```ts
export const ApiPaginated = <T extends Type<unknown>>(modelo: T): MethodDecorator =>
  applyDecorators(
    ApiExtraModels(PaginatedDto, modelo),
    ApiResponse({
      status: 200,
      schema: {
        allOf: [
          { $ref: getSchemaPath(PaginatedDto) },
          { properties: { items: { type: 'array', items: { $ref: getSchemaPath(modelo) } } } },
        ],
      },
    }),
  );
```

- [ ] **Step 4: `fields.ts` — validación y documentación en un decorador**

Hoy cada campo repite las reglas dos veces: una para `class-validator` y otra para Swagger. Un
decorador de campo las declara **una vez**, y de paso hace imposible que se desincronicen.

```ts
export const StringField = (o: { min?: number; max?: number; optional?: boolean; example?: string } = {}) =>
  applyDecorators(
    ...(o.optional ? [IsOptional()] : []),
    IsString(),
    Length(o.min ?? 1, o.max ?? 255),
    ApiProperty({ required: !o.optional, minLength: o.min, maxLength: o.max, example: o.example }),
  );

export const IntField = (o: { min?: number; max?: number; optional?: boolean } = {}) => ...;
export const SlugField = () => ...;   // minúsculas, guiones, sin acentos
export const CuidField = (o?: { optional?: boolean }) => ...;
export const DateOnlyField = (o?: { optional?: boolean }) => ...;  // YYYY-MM-DD, para @db.Date
```

Un DTO queda así:

```ts
export class CreateGalleryDto implements CreateGalleryInput {
  @StringField({ min: 2, max: 120, example: 'XV de Camila' })
  title!: string;

  @StringField({ optional: true, max: 2000 })
  description?: string;

  @CuidField()
  categoryId!: string;

  @DateOnlyField({ optional: true })
  eventDate?: string;
}
```

> **Seis tipos de campo, no un framework.** El día que haga falta el séptimo se añade; anticipar
> veinte es construir una librería que nadie pidió.

- [ ] **Step 5: Los decoradores por endpoint, junto a su módulo**

```ts
// src/modules/galleries/docs/galleries.docs.ts
export const DocListarGalerias = () =>
  ApiDoc({
    summary: 'Lista las galerías publicadas',
    description: 'Solo publicadas, sin borrar, y con sus medios en READY.',
    paginated: GalleryEntity,
  });

export const DocCrearGaleria = () =>
  ApiDoc({
    summary: 'Crea una galería',
    description: 'El slug se genera del título y NO se regenera al renombrar.',
    ok: GalleryEntity,
    status: 201,
    errors: [409, 422],
    auth: true,
  });
```

Y el controller queda legible:

```ts
@AdminController('galleries')
export class GalleriesAdminController {
  @DocCrearGaleria()
  @Post()
  create(@Body() dto: CreateGalleryDto) {
    return this.galleries.create(dto);
  }
}
```

- [ ] **Step 6: Test de que la documentación no miente**

Un doc desactualizado es peor que ninguno, y esto se comprueba solo:

```ts
it('todo endpoint tiene summary: nada sin documentar', () => {
  const doc = SwaggerModule.createDocument(app, config);
  const sinDocumentar = Object.entries(doc.paths).flatMap(([ruta, ops]) =>
    Object.entries(ops)
      .filter(([, op]) => !(op as { summary?: string }).summary)
      .map(([m]) => `${m.toUpperCase()} ${ruta}`),
  );
  expect(sinDocumentar).toEqual([]);
});

it('el doc público no contiene NINGUNA ruta de admin', () => {
  const publico = SwaggerModule.createDocument(app, cfg, { include: [GalleriesModule] });
  expect(Object.keys(publico.paths).filter((r) => r.includes('/admin'))).toEqual([]);
});

it('los endpoints con auth declaran 401', () => { ... });
```

- [ ] **Step 7: Dos documentos, no uno**

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

- [ ] **Step 8: CI**

Añadir el servicio de MinIO al workflow, con las mismas credenciales que el Docker local.

- [ ] **Step 9: Verificación final de la fase**

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

---

# El contrato de respuesta

Definido en `packages/contracts`: `ApiSuccess`, `ApiFailure`, `ApiResponse`, `ApiPaginated`,
`PaginationMeta`, `ErrorCode` y `FieldError`.

## Sobre uniforme en TODA respuesta

```jsonc
// Éxito
{ "success": true, "code": "OK", "data": { … }, "timestamp": "2026-08-28T16:40:12.031Z" }

// Lista
{ "success": true, "code": "OK", "data": [ … ], "meta": { … }, "timestamp": "…" }

// Error
{
  "success": false,
  "statusCode": 409,
  "code": "SLUG_TAKEN",                                // ← el contrato
  "message": "Ya existe una galería con ese enlace",   // ← humano, reescribible
  "requestId": "01JD4X…",
  "timestamp": "…"
}
```

`ApiResponse<T>` es una **unión discriminada por `success`**: TypeScript estrecha solo con un
`if`, sin type guards a mano.

- [ ] **`ResponseEnvelopeInterceptor` global.** Envuelve lo que devuelve el controller. Si el
  servicio devolvió `{ items, meta }`, lo desestructura a `data` + `meta`; si devolvió un recurso,
  va tal cual en `data`. **El interceptor no toca los errores**: de esos se ocupa el filtro, y
  ambos producen la misma forma.
- [ ] **`ApiDoc` envuelve el esquema.** Aquí se paga solo el diseño del Task 6: en vez de tocar
  cada `@ApiResponse` del proyecto, el sobre se aplica **en un sitio** y todos los endpoints
  quedan documentados con la forma real. Sin los decoradores propios, esto sería un cambio de
  cincuenta ficheros.

## Errores: el `code` es lo que importa

**El mensaje se reescribe, el código no.** Sin `code`, el admin acabaría comparando cadenas en
castellano y cualquier mejora de redacción rompería un `if`. Con `ErrorCode` como unión cerrada,
el `switch` es exhaustivo y TypeScript avisa cuando aparece un código nuevo.

Por eso hay códigos de dominio y no solo genéricos: `SESSION_EXPIRED` y `SESSION_REVOKED` son
ambos 401, pero **piden reacciones distintas** — el primero manda al login sin más, el segundo
debe decir "cerramos tu sesión por seguridad", que es lo que ocurre cuando la rotación detecta
reuso.

### Errores por campo

`class-validator` devuelve `message: ["title must be longer than 2 characters"]`. Atar eso a un
campo de formulario obliga a parsear inglés. En su lugar:

```jsonc
"code": "VALIDATION_FAILED",
"message": "Revisa los campos marcados",
"details": [
  { "field": "title", "code": "minLength", "message": "Mínimo 2 caracteres" },
  { "field": "items.0.text", "code": "isNotEmpty", "message": "No puede estar vacío" }
]
```

El admin recorre `details` y llama a `setError(field, { message })`. **Sin parsear nada.** Se
consigue con `exceptionFactory` en el `ValidationPipe`, aplanando los `ValidationError` anidados
a rutas con puntos.

- [ ] **Un solo `AllExceptionsFilter` global, no dos.** Normaliza **todo** —`HttpException`,
  errores de Prisma y lo desconocido— al mismo sobre. Con dos filtros, un error no contemplado se
  escapa sin `code` y el cliente recibe una forma que no espera. El mapa de Prisma vive dentro.
- [ ] **En producción no salen ni stacks ni mensajes de Prisma.** Lo desconocido es `INTERNAL`
  con mensaje genérico; el detalle va al log con el `requestId`.

## Paginación

Se conservan los nombres de `prisma-extension-pagination` (`totalCount`, `pageCount`) y se añade
**`pageSize`**, que faltaba: sin él no se puede pintar "mostrando 1-20 de 47" ni un selector de
tamaño.

Caso borde fijado: **con cero resultados, `pageCount: 0`, `isFirstPage` e `isLastPage` en `true`,
ambos vecinos en `null`.**

```ts
export function paginar<T>(items: T[], totalCount: number, page: number, pageSize: number) {
  const pageCount = Math.ceil(totalCount / pageSize);
  return {
    items,
    meta: {
      totalCount, pageCount, currentPage: page, pageSize,
      isFirstPage: page <= 1,
      isLastPage: page >= pageCount,
      previousPage: page > 1 ? page - 1 : null,
      nextPage: page < pageCount ? page + 1 : null,
    },
  };
}
```

**Sin `prisma-extension-pagination`**: es una extensión 0.x en el camino caliente de acceso a
datos, ahorra estas diez líneas, y construye la consulta por ti — lo que pelea con nuestra regla
de `select` explícito.

> **Offset, no cursor.** Con decenas de galerías `skip/take` es correcto y deja saltar a una
> página concreta. El cursor gana a partir de miles de filas y con scroll infinito.

---

# Ocho mejoras de robustez

Encontradas revisando la fase entera. Ordenadas por lo que evitan.

### 1 · Orden determinista o la paginación repite filas 🔴

`ORDER BY "order"` con dos filas del mismo `order` **no garantiza secuencia estable en Postgres**:
la misma consulta puede devolverlas en distinto orden entre páginas, así que un elemento aparece
dos veces y otro no aparece nunca. Y ocho de nuestros modelos tienen `order` con `@default(0)`,
o sea que **empatan por defecto**.

> **Regla: toda consulta paginada termina en `{ id: 'asc' }` como desempate.**
> `orderBy: [{ order: 'asc' }, { id: 'asc' }]`. Con test que crea tres filas con el mismo `order`
> y comprueba que dos páginas de tamaño 2 no repiten ni pierden ninguna.

### 2 · Login de tiempo constante 🔴

Si el email no existe, se responde sin ejecutar argon2 (~1 ms). Si existe, se gastan ~50 ms
verificando. Eso es un **oráculo de enumeración por tiempo**: el mensaje es idéntico, pero el
reloj lo delata. El test que tenía el plan solo comparaba mensajes.

> **Ejecutar siempre una verificación**, contra un hash señuelo si el usuario no existe. El coste
> es el mismo que ya se paga en el camino feliz.

### 3 · `enableShutdownHooks()` 🟠

Railway y Render mandan `SIGTERM` en cada redeploy. Sin los hooks, `onModuleDestroy` no corre,
Prisma no cierra y **cada despliegue deja conexiones colgando** — que en el plan free de Neon,
con su límite bajo, se nota rápido.

```ts
app.enableShutdownHooks();
```

### 4 · Límite de cuerpo explícito y pequeño 🟠

`"Nunca subas archivos a través de la API"` (§4) es hoy una frase. Un límite explícito lo
convierte en una imposibilidad:

```ts
app.use(express.json({ limit: '256kb' }));
```

El presign de ocho archivos ocupa ~2 kb. Cualquier cosa que se acerque a 256 kb es alguien
intentando lo que el diseño prohíbe.

### 5 · Los servicios anotan su tipo de retorno con el DTO 🟠

La regla de "usar `select`, no `@Exclude()`" solo falla cerrado **si el tipo lo comprueba**:

```ts
async findBySlug(slug: string): Promise<GalleryDto | null> { … }
```

Sin la anotación, olvidar un campo en el `select` compila igual y el fallo aparece en la landing.
Con ella, no compila.

### 6 · 404, no 403, para lo no publicado 🟡

`GET /galleries/:slug` de una galería en borrador debe devolver **404**. Un 403 confirma que ese
slug existe, que es exactamente lo que un borrador no debería revelar.

### 7 · Coherencia entre `type` y `mimeType` al firmar 🟡

Hoy se validan por separado: un `type: 'PHOTO'` con `mimeType: 'video/mp4'` pasaría las dos
validaciones y crearía un `Media` incoherente que la landing renderizaría como imagen.

> `REEL` y `AFTERMOVIE` exigen `video/*`; `PHOTO` exige `image/*`. Y el poster, `image/webp`.

### 8 · `helmet` y CORS explícito 🟡

La API es alcanzable desde internet (la pasarela y, en la fase 6, `/track/whatsapp`). `helmet` son
dos líneas y cubre las cabeceras de seguridad básicas. Y **CORS con lista blanca explícita, nunca
`origin: true`** — aunque con la pasarela casi nada lo necesite.

### Anotado, no construido

- **Carrera TOCTOU en el slug**: `exists()` dice libre y otro proceso crea el mismo entre medias.
  Con un solo usuario no ocurre; el arreglo es capturar `P2002` y reintentar una vez, **fuera** de
  la transacción.
- **Concurrencia optimista** con `updatedAt`: dos pestañas editando la misma galería. Un usuario,
  un dispositivo: no ahora.

---

# Rendimiento: qué aplica aquí y qué sería de manual

**El perfil de carga de esta API es prácticamente cero**: un usuario en el admin y unas cuantas
consultas de Astro en build time, un par de veces por semana. No hay camino caliente. Eso invalida
la mayoría de las recomendaciones de rendimiento que se dan por defecto, y hace que **el único
cuello real sea el arranque en frío** — Neon con scale-to-zero a los 5 min y, si se elige Render
gratis, el contenedor durmiéndose a los 15.

Ninguna librería arregla un cold start. Así que:

| Recomendación típica | Veredicto aquí |
|---|---|
| **Cambiar Express por Fastify** | **No.** Fastify es ~2× más rápido en peticiones/segundo, una métrica que a este volumen no significa nada. Y cambia el ecosistema de `helmet`, límites de cuerpo y middlewares. Churn puro |
| **`@nestjs/cache-manager`** | **No.** No hay nada que cachear: los datos cambian cuando James los cambia, y quien los lee de verdad es un build de Astro que quiere lo último |
| **`compression`** | **No de entrada.** Railway y Render comprimen en su proxy. Anotado: si el JSON público de la landing crece mucho, es una línea |
| **Réplicas de lectura, colas, workers** | **No.** §22 ya documenta el worker y por qué no se construye |

Lo que sí importa al rendimiento **percibido** son cuatro cosas de diseño, no de librería:

### 1 · `GET /galleries` NO devuelve los medios 🔴

La lista devuelve portada, título, fecha y **el número** de medios. El detalle
(`GET /galleries/:slug`) devuelve el array completo.

Si la lista incluyera los medios, el build de Astro se traería *todos los reels de todas las
galerías* en una sola respuesta, y crecería sin techo con cada evento. Es la decisión de API que
más peso tiene en esta fase, y no estaba escrita.

> Se comprueba en el test: `GET /galleries` no trae la propiedad `media`, y sí trae `mediaCount`.

### 2 · El throttler global puede tumbar el build de Astro 🔴

`ThrottlerModule` a 120 peticiones/minuto, y un build que pide la lista más una llamada por
galería, todo desde **una sola IP** en pocos segundos. Con 50 galerías más assets, se pasa.

Y el modo de fallo es el peor posible: **el build falla, la web se queda con la versión vieja**,
y `DeployState` marca fallo sin que nadie sepa por qué.

> Los controllers públicos llevan **`@SkipThrottle()`** o un límite propio muy alto. El estricto
> se queda donde importa: el login. Con test que hace 200 peticiones públicas seguidas.

### 3 · Log de consultas de Prisma en desarrollo 🟠

```ts
new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['query'] : [] })
```

Es lo que hace visible un N+1 el día que se escribe, no seis meses después. Cuesta una línea y
cero en producción.

### 4 · `requestId` desde la fase 2, no desde la 6 🟠

`ApiFailure` ya tiene el campo. Rellenarlo son cinco líneas de middleware con
`crypto.randomUUID()`, y a partir de ahí **cada error que reporte James viene con un
identificador** que se busca en los logs. Dejarlo `undefined` hasta la fase 6 significa que todos
los errores de las fases 2 a 5 son incorrelacionables — que son justo las fases donde más se
depura.

---

# La recomendación que más rinde: congelar el contrato público

El doc de `/docs/public` es **el contrato que Astro consume en build time**. Si cambia sin querer,
la landing se rompe en el siguiente deploy y el error aparece lejos de la causa.

> **Snapshot del OpenAPI público en CI.** Se genera el documento, se compara con
> `docs/openapi-public.json` commiteado, y **si difiere, el CI falla** pidiendo que se actualice a
> propósito.

Es exactamente el mismo mecanismo que el drift de Prisma de la fase 1 —que ya nos sirvió— pero
para la frontera hacia la landing. Y sale gratis: el documento ya se genera en el Task 6.

```ts
it('el contrato público no ha cambiado sin querer', () => {
  const actual = SwaggerModule.createDocument(app, cfg, { include: [GalleriesModule] });
  const congelado = JSON.parse(readFileSync('docs/openapi-public.json', 'utf8'));
  expect(actual.paths).toEqual(congelado.paths);
});
```

---

## Librerías: qué entra y qué no

Todas verificadas con `npm view <pkg> dist-tags`, ninguna en RC.

| Librería | Versión | Por qué |
|---|---|---|
| `@nestjs/jwt` | 12.0.1 | Firmar y verificar el access token |
| `@nestjs/throttler` | 6.5.0 | Global + estricto en login (§16) |
| `@nestjs/swagger` | 12.0.1 | Con su plugin de inferencia |
| `class-validator` + `class-transformer` | 0.15.1 / 0.5.1 | Lo que decidió §5 |
| `@aws-sdk/client-s3` + `s3-request-presigner` | 3.1120.0 | El mismo SDK para MinIO y R2 |
| `slugify` | 1.6.9 | Con `locale: 'es'` para la ñ y los acentos |
| `helmet` | 8.3.0 | Cabeceras de seguridad. La API es alcanzable desde internet |

**Para los decoradores de Swagger no hace falta ninguna librería.** `applyDecorators` viene en
`@nestjs/common` y es exactamente para esto. Cualquier paquete de terceros aquí sería una capa
sobre una función de doce caracteres.

### La alternativa de fondo: `nestjs-zod` (5.5.0)

Merece mención porque **ya usamos Zod en los dos lados**: la API valida el entorno con Zod 4 y el
admin valida formularios con Zod 4. `nestjs-zod` haría del schema la única fuente de tipo,
validación y OpenAPI, y eliminaría los decoradores de campo del Step 4.

**Recomendación: seguir con class-validator.** Tres razones concretas:

1. **`PartialType`, `PickType` y `OmitType` son idiomas de `@nestjs/swagger`** y `CLAUDE.md` los
   exige (`UpdateDto` siempre `PartialType(CreateDto)`). Con Zod son `.partial()` y `.pick()`,
   equivalentes pero obligan a reescribir esa regla.
2. **La generación de OpenAPI del plugin oficial está más rodada** que la de cualquier puente
   Zod→OpenAPI, y este proyecto publica el doc público como contrato para Astro.
3. `whitelist` y `forbidNonWhitelisted` del `ValidationPipe` —que §5 llama seguridad, no
   limpieza— tienen equivalente en Zod (`.strict()`), pero cambiarlos ahora toca la única línea
   de defensa contra un `{ "isPublished": true }` inyectado.

**Cuándo reconsiderarlo**: si algún día el contrato tiene que compartir validación *runtime* entre
la API y el admin. Hoy no puede, porque `packages/contracts` es solo tipos a propósito.

### La otra alternativa de fondo: generar el cliente con `openapi-typescript` (7.13.0)

Con el doc público congelado (arriba), se podría **generar** los tipos y el cliente del admin en
vez de escribirlos a mano en `packages/contracts` y `endpoints/`. Eso garantizaría la sincronía
por construcción, no por disciplina.

**Recomendación: no ahora.** `contracts` ya existe, son ~250 líneas, y su valor no es solo tipar:
es que **exponer un campo sea un acto deliberado** (§3). Un cliente generado publica lo que haya
en el doc, que es un paso más cerca de derivar el contrato del esquema — justo lo que §3 rechaza.

**Cuándo entra**: si aparece un tercer consumidor de la API, o si el contrato empieza a divergir
en la práctica pese al snapshot.

---

## Mejoras aplicadas tras revisar el plan

Seis cambios sobre la primera versión, todos por robustez:

| Cambio | Qué evita |
|---|---|
| **Guard global con `@Public()`** en vez de guard por controller | Un módulo nuevo al que se olvide `@AdminController` quedaría **abierto**. Global, el olvido da 401. Fallar cerrado |
| **`select` explícito en vez de `@Exclude()`** | `@Exclude()` falla abierto: se te olvida y el campo sale. `select` falla cerrado: se te olvida y **no compila** |
| **El soft delete de `Gallery` propaga `deletedAt` a sus `Media`** | Sin eso, sus archivos nunca entran en el barrido de huérfanos y se quedan en el bucket para siempre — el bug que el soft delete venía a evitar |
| **Sin Passport** | Tres dependencias y una capa de estrategias para un único método de auth. `verifyAsync` son 20 líneas |
| **Throttler global**, no solo en login | Un endpoint público sin límite es una invitación, y `/track/whatsapp` lo necesitará igual |
| **Test de que el doc público no tiene rutas de admin** | Es el contrato que consumirá Astro: una ruta de admin ahí filtra la superficie privada |

### Dos decisiones que conviene dejar escritas

**El contador de almacenamiento cuenta también lo borrado en blando.** Un `Media` con `deletedAt`
sigue ocupando espacio en R2 hasta que el cron lo purga a los 30 días. Contar solo
`deletedAt: null` haría que el indicador del dashboard mintiera a la baja justo cuando James
acaba de borrar cosas para hacer sitio.

**El poster también se valida al firmar.** El contrato devuelve `posterUploadUrl`, y ese objeto
es un WebP que sale del canvas del navegador: su mime y su tamaño se validan igual que el vídeo.
Si no, es una URL firmada sin restricción real.

---

## Lo que la fase 3 necesita de ésta

El editor de galería solo puede empezar cuando: se puede iniciar sesión, crear una galería,
pedir URLs firmadas en lote, subir a ellas desde el navegador y confirmar. Si algo de eso no
está cerrado, la fase 3 se construye sobre arena.
