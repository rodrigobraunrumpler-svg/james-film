import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configurarApp } from '../src/bootstrap.js';
import { StorageService } from '../src/storage/storage.service.js';
import { PrismaClient } from '../src/generated/prisma/client.js';

let app: INestApplication;
let prisma: PrismaClient;
let token: string;
let borradosDelBucket: string[];

const http = () => request(app.getHttpServer());
const auth = () => ({ Authorization: `Bearer ${token}` });

interface Testimonio {
  id: string;
  hasConsent: boolean;
  isActive: boolean;
  isFeatured: boolean;
  authorName: string;
  eventDate: string | null;
  quote: string | null;
  rating: number | null;
}

const crear = async (body: Record<string, unknown> = {}): Promise<Testimonio> => {
  const { body: res } = await http()
    .post('/admin/testimonials')
    .set(auth())
    .send({ authorName: 'Clienta de prueba', ...body })
    .expect(201);
  return res.data as Testimonio;
};

beforeAll(async () => {
  prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  await prisma.$connect();

  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication<NestExpressApplication>();

  // Se espía el borrado en el bucket sin tocar MinIO: lo que importa es que se
  // pida, y con qué clave.
  borradosDelBucket = [];
  const storage = app.get(StorageService);
  storage.delete = async (key: string) => {
    borradosDelBucket.push(key);
  };

  configurarApp(app as NestExpressApplication);
  await app.init();

  const login = await http()
    .post('/auth/login')
    .send({ email: process.env.SEED_ADMIN_EMAIL, password: process.env.SEED_ADMIN_PASSWORD });
  token = login.body.data.accessToken;
});

beforeEach(async () => {
  borradosDelBucket = [];
  await prisma.testimonial.deleteMany();
});

afterAll(async () => {
  await prisma.testimonial.deleteMany();
  await app.close();
  await prisma.$disconnect();
});

/** §19 y Ley 29733: es el único punto que puede traerle un problema real a James. */
describe('la puerta del consentimiento', () => {
  it('un testimonio NACE en borrador, aunque se pida activo', async () => {
    // Es el único isActive del schema que no arranca en true: con el contrario,
    // uno recién creado sería publicable y SIN consentimiento.
    const t = await crear();
    expect(t.isActive).toBe(false);
    expect(t.hasConsent).toBe(false);
  });

  it('publicar sin consentimiento da 422 CONSENT_REQUIRED', async () => {
    const t = await crear();

    const { body } = await http()
      .patch(`/admin/testimonials/${t.id}`)
      .set(auth())
      .send({ isActive: true })
      .expect(422);

    expect(body.code).toBe('CONSENT_REQUIRED');
    expect(body.message).toMatch(/consentimiento/i);
  });

  it('crear ya publicado sin consentimiento también rebota', async () => {
    await http()
      .post('/admin/testimonials')
      .set(auth())
      .send({ authorName: 'Sin permiso', isActive: true })
      .expect(422);
  });

  it('con consentimiento sí se publica', async () => {
    const t = await crear({ hasConsent: true });

    const { body } = await http()
      .patch(`/admin/testimonials/${t.id}`)
      .set(auth())
      .send({ isActive: true })
      .expect(200);

    expect(body.data.isActive).toBe(true);
  });

  it('QUITAR el consentimiento a uno ya publicado también rebota', async () => {
    // Se comprueba el estado RESULTANTE, no solo el campo que llega: si no,
    // este camino dejaría un publicado sin consentimiento.
    const t = await crear({ hasConsent: true, isActive: false });
    await http()
      .patch(`/admin/testimonials/${t.id}`)
      .set(auth())
      .send({ isActive: true })
      .expect(200);

    const { body } = await http()
      .patch(`/admin/testimonials/${t.id}`)
      .set(auth())
      .send({ hasConsent: false })
      .expect(422);

    expect(body.code).toBe('CONSENT_REQUIRED');
  });

  it('despublicar y quitar el consentimiento A LA VEZ sí se puede', async () => {
    const t = await crear({ hasConsent: true });
    await http()
      .patch(`/admin/testimonials/${t.id}`)
      .set(auth())
      .send({ isActive: true })
      .expect(200);

    await http()
      .patch(`/admin/testimonials/${t.id}`)
      .set(auth())
      .send({ hasConsent: false, isActive: false })
      .expect(200);
  });
});

describe('el controller público', () => {
  it('NO devuelve uno sin consentimiento aunque esté activo', async () => {
    // La combinación imposible por la API, forzada directamente en la base:
    // si algún día algo la crea, el público sigue sin verla.
    const t = await crear({ hasConsent: true });
    await prisma.testimonial.update({
      where: { id: t.id },
      data: { isActive: true, hasConsent: false },
    });

    const { body } = await http().get('/testimonials').expect(200);
    expect(body.data).toHaveLength(0);
  });

  it('no expone `hasConsent`: es una condición para publicar, no un dato', async () => {
    const t = await crear({ hasConsent: true });
    await http()
      .patch(`/admin/testimonials/${t.id}`)
      .set(auth())
      .send({ isActive: true })
      .expect(200);

    const { body } = await http().get('/testimonials').expect(200);
    expect(body.data[0]).not.toHaveProperty('hasConsent');
    expect(body.data[0]).not.toHaveProperty('isActive');
  });

  it('`galleryId` solo ACOTA, nunca amplía lo que se ve', async () => {
    const t = await crear({ hasConsent: true });
    await http()
      .patch(`/admin/testimonials/${t.id}`)
      .set(auth())
      .send({ isActive: true })
      .expect(200);

    const { body } = await http().get('/testimonials?galleryId=no-existe').expect(200);
    expect(body.data).toHaveLength(0);
  });
});

describe('destacado', () => {
  it('destacar NO publica: son flags distintos', async () => {
    // Es la combinación que en el admin PARECE publicada y no lo está.
    const t = await crear();
    const { body } = await http()
      .patch(`/admin/testimonials/${t.id}/feature`)
      .set(auth())
      .expect(200);

    expect(body.data.isFeatured).toBe(true);
    expect(body.data.isActive).toBe(false);

    const publico = await http().get('/testimonials').expect(200);
    expect(publico.body.data).toHaveLength(0);
  });

  it('es exclusivo: marcar uno desmarca el otro', async () => {
    const a = await crear({ authorName: 'Ana' });
    const b = await crear({ authorName: 'Bea' });

    await http().patch(`/admin/testimonials/${a.id}/feature`).set(auth()).expect(200);
    await http().patch(`/admin/testimonials/${b.id}/feature`).set(auth()).expect(200);

    const { body } = await http().get('/admin/testimonials').set(auth()).expect(200);
    expect((body.data as Testimonio[]).filter((t) => t.isFeatured)).toHaveLength(1);
  });

  it('el destacado sale PRIMERO en el listado público', async () => {
    const a = await crear({ authorName: 'Ana', hasConsent: true });
    const b = await crear({ authorName: 'Bea', hasConsent: true });
    for (const t of [a, b]) {
      await http()
        .patch(`/admin/testimonials/${t.id}`)
        .set(auth())
        .send({ isActive: true })
        .expect(200);
    }
    await http().patch(`/admin/testimonials/${b.id}/feature`).set(auth()).expect(200);

    const { body } = await http().get('/testimonials').expect(200);
    expect(body.data[0].authorName).toBe('Bea');
  });
});

describe('borrado', () => {
  it('se lleva la captura y el avatar del bucket', async () => {
    // Una captura de WhatsApp con el nombre y la cara de una clienta no debe
    // sobrevivir a que James decida quitarla.
    const t = await crear({
      screenshotKey: 'screenshots/abc.jpg',
      avatarKey: 'avatars/abc.jpg',
    });

    await http().delete(`/admin/testimonials/${t.id}`).set(auth()).expect(204);

    expect(borradosDelBucket).toEqual(['screenshots/abc.jpg', 'avatars/abc.jpg']);
    expect(await prisma.testimonial.count({ where: { id: t.id } })).toBe(0);
  });

  it('sin captura no intenta borrar nada del bucket', async () => {
    const t = await crear();
    await http().delete(`/admin/testimonials/${t.id}`).set(auth()).expect(204);
    expect(borradosDelBucket).toEqual([]);
  });
});

describe('validación', () => {
  it('rechaza un rating fuera de 1..5', async () => {
    // El schema lo declara Int? sin tope: un 7 pintaría siete estrellas.
    await http()
      .post('/admin/testimonials')
      .set(auth())
      .send({ authorName: 'X', rating: 7 })
      .expect(422);
    await http()
      .post('/admin/testimonials')
      .set(auth())
      .send({ authorName: 'X', rating: 0 })
      .expect(422);
    await crear({ rating: 5 });
  });

  it('PATCH /reorder no lo captura /:id', async () => {
    const a = await crear({ authorName: 'Ana' });
    const b = await crear({ authorName: 'Bea' });

    const { body } = await http()
      .patch('/admin/testimonials/reorder')
      .set(auth())
      .send({ ids: [b.id, a.id] })
      .expect(200);

    expect(Array.isArray(body.data)).toBe(true);
  });

  it('la fecha del evento no se desfasa de día', async () => {
    const t = await crear({ eventDate: '2026-03-15' });
    expect(t.eventDate).toBe('2026-03-15');
  });
});

describe('vaciar TODOS los opcionales a la vez', () => {
  it('los borra todos', async () => {
    const t = await crear({
      authorHandle: '@ana',
      eventType: 'Boda',
      eventDate: '2026-03-15',
      quote: 'Todo increíble',
      externalUrl: 'https://ejemplo.com/post',
      rating: 5,
    });

    const { body } = await http()
      .patch(`/admin/testimonials/${t.id}`)
      .set(auth())
      .send({
        authorHandle: null,
        eventType: null,
        eventDate: null,
        quote: null,
        externalUrl: null,
        rating: null,
      })
      .expect(200);

    expect({
      authorHandle: body.data.authorHandle,
      eventType: body.data.eventType,
      eventDate: body.data.eventDate,
      quote: body.data.quote,
      externalUrl: body.data.externalUrl,
      rating: body.data.rating,
    }).toEqual({
      authorHandle: null,
      eventType: null,
      eventDate: null,
      quote: null,
      externalUrl: null,
      rating: null,
    });
  });
});
