import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configurarApp } from '../src/bootstrap.js';
import { PrismaClient } from '../src/generated/prisma/client.js';

let app: INestApplication;
let prisma: PrismaClient;
let token: string;

const http = () => request(app.getHttpServer());
const auth = () => ({ Authorization: `Bearer ${token}` });

const crear = async (body: Record<string, unknown>) => {
  const { body: res } = await http().post('/admin/categories').set(auth()).send(body).expect(201);
  return res.data as { id: string; slug: string };
};

beforeAll(async () => {
  prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  await prisma.$connect();

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
  // Un test devuelve la base como la encontró: si no, el recuento del seed y
  // el contrato congelado fallan en OTROS ficheros, lejos de la causa.
  await prisma.gallery.deleteMany({ where: { slug: { startsWith: 'test-' } } });
  await prisma.category.deleteMany({ where: { slug: { startsWith: 'test-' } } });
  await app.close();
  await prisma.$disconnect();
});

/** Las del seed no se tocan: otros tests cuentan con ellas. */
beforeEach(async () => {
  await prisma.category.deleteMany({ where: { slug: { startsWith: 'test-' } } });
});

describe('controller público', () => {
  it('solo devuelve las activas', async () => {
    const oculta = await crear({ name: 'test- Oculta', isActive: false });

    const { body } = await http().get('/categories').expect(200);

    expect(body.data.some((c: { id: string }) => c.id === oculta.id)).toBe(false);
    expect(body.data.length).toBeGreaterThanOrEqual(4);
  });

  it('no expone los campos de admin', async () => {
    const { body } = await http().get('/categories').expect(200);

    // isActive, order y los meta son de gestión, no del visitante.
    expect(body.data[0]).not.toHaveProperty('isActive');
    expect(body.data[0]).not.toHaveProperty('galleryCount');
  });

  it('no exige sesión', async () => {
    await http().get('/categories').expect(200);
  });
});

describe('orden de rutas: /reorder no lo captura /:id', () => {
  it('PATCH /admin/categories/reorder llega a reordenar, no a actualizar', async () => {
    // Nest resuelve por orden de DECLARACIÓN. Si `:id` fuera primero, esto
    // daría un 404 con aspecto de «ese id no existe», y reordenar el fichero
    // basta para romperlo. Por eso la ruta literal tiene su propio test.
    const a = await crear({ name: 'test- Primera' });
    const b = await crear({ name: 'test- Segunda' });

    const { body } = await http()
      .patch('/admin/categories/reorder')
      .set(auth())
      .send({ ids: [b.id, a.id] })
      .expect(200);

    const posiciones = Object.fromEntries(
      body.data.map((c: { id: string; order: number }) => [c.id, c.order]),
    );
    expect(posiciones[b.id]).toBeLessThan(posiciones[a.id]);
  });
});

describe('borrado', () => {
  it('una categoría en uso da 409 CON el número, no un error de clave foránea', async () => {
    const categoria = await prisma.category.findFirstOrThrow({ where: { slug: 'bodas' } });
    await prisma.gallery.create({
      data: { slug: 'test-usa-bodas', title: 'Usa bodas', categoryId: categoria.id },
    });

    const { body } = await http()
      .delete(`/admin/categories/${categoria.id}`)
      .set(auth())
      .expect(409);

    expect(body.code).toBe('CATEGORY_IN_USE');
    // El número es lo accionable: «restricción de clave foránea» no lo es.
    expect(body.message).toMatch(/\d+ galería/);

    await prisma.gallery.deleteMany({ where: { slug: 'test-usa-bodas' } });
  });

  it('cuenta también los paquetes, que Postgres NO impediría', async () => {
    // PackageCategory es Cascade: borrar la categoría los desvincularía en
    // silencio, sin error de ningún tipo.
    const categoria = await crear({ name: 'test- Con paquete' });
    const paquete = await prisma.package.findFirstOrThrow();
    await prisma.packageCategory.create({
      data: { packageId: paquete.id, categoryId: categoria.id },
    });

    const { body } = await http()
      .delete(`/admin/categories/${categoria.id}`)
      .set(auth())
      .expect(409);

    expect(body.message).toMatch(/paquete/);
  });

  it('una categoría vacía se borra', async () => {
    const c = await crear({ name: 'test- Vacía' });
    await http().delete(`/admin/categories/${c.id}`).set(auth()).expect(204);
    await http().delete(`/admin/categories/${c.id}`).set(auth()).expect(404);
  });
});

describe('crear y actualizar', () => {
  it('genera el slug del nombre y lo desambigua', async () => {
    const a = await crear({ name: 'test- Repetida' });
    const b = await crear({ name: 'test- Repetida' });

    expect(a.slug).not.toBe(b.slug);
  });

  it('la nueva va AL FINAL del orden', async () => {
    const { body: antes } = await http().get('/admin/categories').set(auth()).expect(200);
    const maximo = Math.max(...antes.data.map((c: { order: number }) => c.order));

    const nueva = await crear({ name: 'test- Última' });

    const { body } = await http().get('/admin/categories').set(auth()).expect(200);
    const suya = body.data.find((c: { id: string }) => c.id === nueva.id);
    expect(suya.order).toBeGreaterThan(maximo);
  });

  it('renombrar NO regenera el slug: rompería los enlaces compartidos', async () => {
    const c = await crear({ name: 'test- Nombre viejo' });

    const { body } = await http()
      .patch(`/admin/categories/${c.id}`)
      .set(auth())
      .send({ name: 'test- Nombre nuevo' })
      .expect(200);

    expect(body.data.slug).toBe(c.slug);
    expect(body.data.name).toBe('test- Nombre nuevo');
  });

  it('el slug sí se puede cambiar a mano', async () => {
    const c = await crear({ name: 'test- Con slug' });

    const { body } = await http()
      .patch(`/admin/categories/${c.id}`)
      .set(auth())
      .send({ slug: 'test-slug-elegido' })
      .expect(200);

    expect(body.data.slug).toBe('test-slug-elegido');
  });
});

/** La plantilla del Task 1A, replicada en este modelo. */
describe('vaciar TODOS los opcionales a la vez', () => {
  it('los borra todos y sobrevive a la relectura', async () => {
    const c = await crear({
      name: 'test- Con todo',
      tagline: 'un tagline',
      description: 'una descripción',
      coverKey: 'covers/x.jpg',
      metaTitle: 'un título',
      metaDescription: 'una meta',
    });

    await http()
      .patch(`/admin/categories/${c.id}`)
      .set(auth())
      .send({
        tagline: null,
        description: null,
        coverKey: null,
        metaTitle: null,
        metaDescription: null,
      })
      .expect(200);

    const { body } = await http().get('/admin/categories').set(auth()).expect(200);
    const suya = body.data.find((x: { id: string }) => x.id === c.id);
    expect({
      tagline: suya.tagline,
      description: suya.description,
      coverUrl: suya.coverUrl,
      metaTitle: suya.metaTitle,
      metaDescription: suya.metaDescription,
    }).toEqual({
      tagline: null,
      description: null,
      coverUrl: null,
      metaTitle: null,
      metaDescription: null,
    });
  });

  it('un PATCH que no menciona un campo NO lo toca', async () => {
    const c = await crear({ name: 'test- Intacta', tagline: 'no me toques' });

    await http()
      .patch(`/admin/categories/${c.id}`)
      .set(auth())
      .send({ name: 'test- Intacta II' })
      .expect(200);

    const { body } = await http().get('/admin/categories').set(auth()).expect(200);
    expect(body.data.find((x: { id: string }) => x.id === c.id).tagline).toBe('no me toques');
  });
});
