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
let ajustesOriginales: Record<string, unknown>;

const http = () => request(app.getHttpServer());
const auth = () => ({ Authorization: `Bearer ${token}` });

const parchear = (cuerpo: Record<string, unknown>) =>
  http().patch('/admin/settings').set(auth()).send(cuerpo);

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

  const { body } = await http().get('/admin/settings').set(auth());
  ajustesOriginales = body.data;
});

afterAll(async () => {
  // Un test devuelve la base como la encontró: el recuento del seed y otros
  // ficheros dependen de estos valores.
  await parchear({
    whatsappNumber: ajustesOriginales.whatsappNumber,
    aboutText: ajustesOriginales.aboutText,
    brandName: ajustesOriginales.brandName,
  });
  await prisma.differentiator.deleteMany({ where: { title: { startsWith: 'TEST ' } } });
  await prisma.socialLink.deleteMany({ where: { platform: { startsWith: 'test-' } } });
  await app.close();
  await prisma.$disconnect();
});

/** 🔴 Es el campo más importante del producto: el clic a WhatsApp ES el lead. */
describe('el número de WhatsApp', () => {
  it('acepta el formato internacional sin «+»', async () => {
    const { body } = await parchear({ whatsappNumber: '51994724944' }).expect(200);
    expect(body.data.whatsappNumber).toBe('51994724944');
  });

  it('rechaza uno SIN prefijo internacional', async () => {
    // Sin prefijo el botón de la landing no funciona y NO FALLA NADA:
    // simplemente nadie escribe nunca. Por eso se valida en el servidor.
    const { body } = await parchear({ whatsappNumber: '994724944' }).expect(422);
    expect(body.code).toBe('VALIDATION_FAILED');
    // El mensaje trae el ejemplo correcto, no solo «formato inválido».
    expect(JSON.stringify(body)).toMatch(/51994724944/);
  });

  it('rechaza el «+», los espacios y los guiones', async () => {
    for (const malo of ['+51994724944', '51 994 724 944', '51-994-724-944', 'no-es-un-numero']) {
      await parchear({ whatsappNumber: malo }).expect(422);
    }
  });

  it('se puede borrar mandando null', async () => {
    const { body } = await parchear({ whatsappNumber: null }).expect(200);
    expect(body.data.whatsappNumber).toBeNull();
  });
});

describe('ajustes', () => {
  it('el público los lee sin sesión y NO expone claves, solo URLs', async () => {
    const { body } = await http().get('/settings').expect(200);

    expect(body.data).toHaveProperty('logoUrl');
    expect(body.data).not.toHaveProperty('logoKey');
    expect(body.data).not.toHaveProperty('heroMediaKey');
  });

  it('un PATCH parcial NO toca lo que no menciona', async () => {
    await parchear({ brandName: 'James Film', tagline: 'Una frase' }).expect(200);

    const { body } = await parchear({ brandName: 'James Film' }).expect(200);
    expect(body.data.tagline).toBe('Una frase');
  });

  it('vaciar los opcionales los borra', async () => {
    await parchear({ tagline: 'algo', slogan: 'algo', footerTagline: 'algo' }).expect(200);

    const { body } = await parchear({
      tagline: null,
      slogan: null,
      footerTagline: null,
    }).expect(200);

    expect({
      tagline: body.data.tagline,
      slogan: body.data.slogan,
      footerTagline: body.data.footerTagline,
    }).toEqual({ tagline: null, slogan: null, footerTagline: null });
  });

  it('rechaza un email inválido', async () => {
    await parchear({ email: 'no-es-un-email' }).expect(422);
  });

  it('exige sesión para escribir', async () => {
    await http().patch('/admin/settings').send({ brandName: 'X' }).expect(401);
  });
});

describe('diferenciadores', () => {
  const crear = (body: Record<string, unknown>) =>
    http()
      .post('/admin/differentiators')
      .set(auth())
      .send({ icon: 'zap', ...body });

  it('un título repetido devuelve 409 NOMBRANDO el campo', async () => {
    // Hay dos `@unique` distintos en este módulo: sin decir cuál, el aviso no
    // sirve de nada.
    await crear({ title: 'TEST Repetido' }).expect(201);

    const { body } = await crear({ title: 'TEST Repetido' }).expect(409);
    expect(body.message).toMatch(/título/i);
  });

  it('rechaza un ícono fuera de la lista cerrada', async () => {
    await crear({ title: 'TEST Icono', icon: 'no-existe' }).expect(422);
  });

  it('el público solo ve los activos', async () => {
    const { body: creado } = await crear({ title: 'TEST Oculto', isActive: false }).expect(201);

    const { body } = await http().get('/differentiators').expect(200);
    expect(body.data.some((d: { id: string }) => d.id === creado.data.id)).toBe(false);
  });

  it('PATCH /reorder no lo captura /:id', async () => {
    const { body: a } = await crear({ title: 'TEST Uno' }).expect(201);
    const { body: b } = await crear({ title: 'TEST Dos' }).expect(201);

    const { body } = await http()
      .patch('/admin/differentiators/reorder')
      .set(auth())
      .send({ ids: [b.data.id, a.data.id] })
      .expect(200);

    expect(Array.isArray(body.data)).toBe(true);
  });
});

describe('redes', () => {
  const crear = (body: Record<string, unknown>) =>
    http()
      .post('/admin/social-links')
      .set(auth())
      .send({ handle: '@x', url: 'https://ejemplo.com/x', ...body });

  it('una plataforma repetida devuelve 409 nombrando el campo', async () => {
    await crear({ platform: 'test-red' }).expect(201);

    const { body } = await crear({ platform: 'test-red' }).expect(409);
    expect(body.message).toMatch(/red/i);
  });

  it('la plataforma se normaliza a minúsculas: «TikTok» y «tiktok» son la misma', async () => {
    await crear({ platform: 'test-Mayus' }).expect(201);
    await crear({ platform: 'TEST-MAYUS' }).expect(409);
  });

  it('exige una URL completa: no se arma desde el handle', async () => {
    await crear({ platform: 'test-sin-url', url: 'james_film' }).expect(422);
  });

  it('el público solo ve las activas', async () => {
    const { body: creada } = await crear({ platform: 'test-oculta', isActive: false }).expect(201);

    const { body } = await http().get('/social-links').expect(200);
    expect(body.data.some((r: { id: string }) => r.id === creada.data.id)).toBe(false);
  });

  it('el público no expone isActive ni order', async () => {
    const { body } = await http().get('/social-links').expect(200);
    expect(body.data[0]).not.toHaveProperty('isActive');
    expect(body.data[0]).not.toHaveProperty('order');
  });
});
