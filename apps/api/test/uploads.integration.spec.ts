import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configurarApp } from '../src/bootstrap.js';

let app: INestApplication;
let token: string;

const http = () => request(app.getHttpServer());
const auth = () => ({ Authorization: `Bearer ${token}` });

const firmar = (cuerpo: Record<string, unknown>) =>
  http().post('/admin/uploads/presign').set(auth()).send(cuerpo);

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

describe('presign genérico', () => {
  it('el prefijo lo decide el SERVIDOR, no el cliente', async () => {
    // Mandar un prefijo sería dejarle elegir dónde escribe dentro del bucket.
    const { body } = await firmar({
      proposito: 'PORTADA_CATEGORIA',
      mimeType: 'image/jpeg',
      sizeBytes: 500_000,
    }).expect(201);

    expect(body.data.key).toMatch(/^covers\/[0-9a-f-]{36}\.jpg$/);
    expect(body.data.uploadUrl).toContain('X-Amz-Signature');
  });

  it('cada propósito escribe en su prefijo', async () => {
    const casos: [string, string, string][] = [
      ['AVATAR_TESTIMONIO', 'image/jpeg', 'avatars'],
      ['CAPTURA_TESTIMONIO', 'image/png', 'screenshots'],
      ['OG', 'image/jpeg', 'og'],
      ['HERO_POSTER', 'image/jpeg', 'posters'],
    ];

    for (const [proposito, mimeType, prefijo] of casos) {
      const { body } = await firmar({ proposito, mimeType, sizeBytes: 100_000 }).expect(201);
      expect(body.data.key.startsWith(`${prefijo}/`)).toBe(true);
    }
  });

  it('firma el content-type, no solo el tamaño', async () => {
    // Sin signableHeaders, alguien con la URL sube text/html bajo una clave
    // .jpg y el CDN lo sirve — XSS almacenado.
    const { body } = await firmar({
      proposito: 'OG',
      mimeType: 'image/png',
      sizeBytes: 1000,
    }).expect(201);

    const firmadas = new URL(body.data.uploadUrl).searchParams.get('X-Amz-SignedHeaders');
    expect(firmadas).toContain('content-type');
    expect(firmadas).toContain('content-length');
  });

  it('el SVG entra SOLO para el logo y la firma', async () => {
    await firmar({ proposito: 'LOGO', mimeType: 'image/svg+xml', sizeBytes: 20_000 }).expect(201);
    await firmar({ proposito: 'FIRMA', mimeType: 'image/svg+xml', sizeBytes: 20_000 }).expect(201);

    // En cualquier otro sitio, no: es la única entrada de un documento
    // ejecutable en todo el proyecto.
    const { body } = await firmar({
      proposito: 'PORTADA_CATEGORIA',
      mimeType: 'image/svg+xml',
      sizeBytes: 20_000,
    }).expect(400);
    expect(body.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('el hero tiene su propio techo, muy por debajo del de un vídeo normal', async () => {
    // Autoplayea en cada visita: con MAX_VIDEO_MB colarían 200 MB en la portada.
    await firmar({ proposito: 'HERO_VIDEO', mimeType: 'video/mp4', sizeBytes: 1_400_000 }).expect(
      201,
    );

    const { body } = await firmar({
      proposito: 'HERO_VIDEO',
      mimeType: 'video/mp4',
      sizeBytes: 3_000_000,
    }).expect(400);
    expect(body.code).toBe('FILE_TOO_LARGE');
    // El mensaje trae los dos números, o James no sabe cuánto recortar.
    expect(body.message).toMatch(/MB/);
  });

  it('el logo tiene techo de 1 MB', async () => {
    await firmar({ proposito: 'LOGO', mimeType: 'image/png', sizeBytes: 2_000_000 }).expect(400);
  });

  it('un propósito inventado se rechaza: la lista es cerrada', async () => {
    const { body } = await firmar({
      proposito: 'LO_QUE_SEA',
      mimeType: 'image/jpeg',
      sizeBytes: 1000,
    }).expect(422);
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  it('no escribe NADA en la base: es solo una firma', async () => {
    // Si creara fila, cancelar dejaría basura que nadie limpia. La clave se
    // guarda cuando el PATCH de la entidad la incluye.
    const antes = await http().get('/admin/categories').set(auth()).expect(200);
    await firmar({ proposito: 'PORTADA_CATEGORIA', mimeType: 'image/jpeg', sizeBytes: 1000 });
    const despues = await http().get('/admin/categories').set(auth()).expect(200);

    expect(despues.body.data).toEqual(antes.body.data);
  });

  it('exige sesión de ADMIN', async () => {
    await http()
      .post('/admin/uploads/presign')
      .send({ proposito: 'OG', mimeType: 'image/jpeg', sizeBytes: 1000 })
      .expect(401);
  });
});
