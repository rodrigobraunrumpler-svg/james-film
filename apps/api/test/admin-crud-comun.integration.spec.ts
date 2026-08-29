import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configurarApp } from '../src/bootstrap.js';
import { CategoriesController } from '../src/modules/categories/categories.controller.js';
import { GalleriesController } from '../src/modules/galleries/galleries.controller.js';
import { PackagesController } from '../src/modules/packages/packages.controller.js';
import { SettingsController } from '../src/modules/settings/settings.controller.js';
import { TestimonialsController } from '../src/modules/testimonials/testimonials.controller.js';

let app: INestApplication;
let token: string;

const http = () => request(app.getHttpServer());
const auth = () => ({ Authorization: `Bearer ${token}` });

/**
 * Los caminos que TODO recurso de admin comparte, en una tabla.
 *
 * Existe porque la auditoría del cierre encontró que faltaban dispersos:
 * categorías no probaba el 401, paquetes no probaba el 404 y testimonios no
 * probaba ninguno de los dos. Cada suite cubría bien lo SUYO y se olvidaba de
 * lo común, que es exactamente el hueco que deja escribir cuatro veces lo mismo.
 *
 * Se escribe como fichero aparte y no refactorizando las cuatro suites: eso
 * sería tocar tests en verde sin añadir cobertura.
 */
const RECURSOS = [
  { nombre: 'categorías', ruta: '/admin/categories', tieneId: true },
  { nombre: 'paquetes', ruta: '/admin/packages', tieneId: true },
  { nombre: 'testimonios', ruta: '/admin/testimonials', tieneId: true },
  { nombre: 'diferenciadores', ruta: '/admin/differentiators', tieneId: true },
  { nombre: 'redes', ruta: '/admin/social-links', tieneId: true },
  { nombre: 'ajustes', ruta: '/admin/settings', tieneId: false },
  { nombre: 'íconos', ruta: '/admin/icons', tieneId: false },
  { nombre: 'galerías', ruta: '/admin/galleries', tieneId: true },
];

/**
 * La clave lleva el nombre del throttler pegado detrás —`THROTTLER:SKIP` +
 * `default`—, que es el que declara `ThrottlerModule.forRootAsync` en
 * `app.module.ts`. Comprobado leyendo los metadatos reales del controller, no
 * supuesto: el `THROTTLER_SKIP` del paquete vale solo `'THROTTLER:SKIP'` y no
 * coincide con nada.
 *
 * Y no se importa de `@nestjs/throttler/dist/...`: eso es acoplarse a su
 * estructura interna. Si algún día renombran la clave, este test se pone en
 * ROJO — que es la dirección segura.
 */
const CLAVE_SKIP = 'THROTTLER:SKIPdefault';

const CONTROLLERS_PUBLICOS = [
  { nombre: 'categorías', clase: CategoriesController },
  { nombre: 'paquetes', clase: PackagesController },
  { nombre: 'testimonios', clase: TestimonialsController },
  { nombre: 'configuración', clase: SettingsController },
  { nombre: 'galerías', clase: GalleriesController },
];

const PUBLICOS = [
  '/categories',
  '/packages',
  '/testimonials',
  '/settings',
  '/differentiators',
  '/social-links',
  '/galleries',
];

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication<NestExpressApplication>();
  configurarApp(app as NestExpressApplication);
  await app.init();

  const login = await http()
    .post('/auth/login')
    .send({ email: process.env.SEED_ADMIN_EMAIL, password: process.env.SEED_ADMIN_PASSWORD });
  token = login.body.data.accessToken;
});

afterAll(async () => {
  await app.close();
});

describe('todo recurso de admin exige sesión', () => {
  it.each(RECURSOS)('$nombre → 401 sin token', async ({ ruta }) => {
    const { body } = await http().get(ruta).expect(401);
    // 401 y no un 500 ni un HTML: el admin hace `switch (error.code)`.
    expect(body.code).toBe('UNAUTHORIZED');
  });
});

describe('todo recurso de admin responde 404 a un id inexistente', () => {
  const conId = RECURSOS.filter((r) => r.tieneId);

  it.each(conId)('$nombre → 404 al actualizar', async ({ ruta }) => {
    const { body } = await http()
      .patch(`${ruta}/id-que-no-existe`)
      .set(auth())
      .send({})
      .expect(404);
    expect(body.code).toBe('NOT_FOUND');
  });

  it.each(conId.filter((r) => r.ruta !== '/admin/galleries'))(
    '$nombre → 404 al borrar',
    async ({ ruta }) => {
      await http().delete(`${ruta}/id-que-no-existe`).set(auth()).expect(404);
    },
  );
});

describe('todo controller público está abierto y sin throttler', () => {
  it.each(PUBLICOS)('%s responde sin sesión', async (ruta) => {
    await http().get(ruta).expect(200);
  });

  it.each(CONTROLLERS_PUBLICOS)('$nombre lleva @SkipThrottle', ({ clase }) => {
    /**
     * Se comprueban los METADATOS, no una ráfaga de peticiones: la suite corre
     * con `RATE_LIMIT_ENABLED=false` —si no, se autobloquearía— así que mandar
     * cuarenta peticiones no probaría absolutamente nada. Lo que hay que
     * verificar es que el decorador está puesto.
     *
     * Importa porque el build de Astro hace decenas de peticiones desde una IP
     * en segundos, y el modo de fallo es el peor: el build falla y la web se
     * queda en la versión vieja.
     */
    expect(Reflect.getMetadata(CLAVE_SKIP, clase)).toBeDefined();
  });
});

describe('ningún endpoint público expone campos de gestión', () => {
  it.each(['/categories', '/packages', '/testimonials', '/differentiators', '/social-links'])(
    '%s no filtra isActive ni order',
    async (ruta) => {
      const { body } = await http().get(ruta).expect(200);
      for (const fila of body.data as Record<string, unknown>[]) {
        expect(fila).not.toHaveProperty('isActive');
        expect(fila).not.toHaveProperty('order');
      }
    },
  );
});
