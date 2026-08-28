import { randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';
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
let galeriaId: string;

const http = () => request(app.getHttpServer());
const auth = () => ({ Authorization: `Bearer ${token}` });

const reel = (extra: Record<string, unknown> = {}) => ({
  filename: 'reel.mp4',
  mimeType: 'video/mp4',
  sizeBytes: 12,
  type: 'REEL',
  clientUploadId: randomUUID(),
  width: 1080,
  height: 1920,
  durationSec: 45,
  ...extra,
});

const presign = (items: unknown[]) =>
  http().post(`/admin/galleries/${galeriaId}/media/presign`).set(auth()).send({ items });

const confirmar = (id: string) => http().post(`/admin/media/${id}/confirm`).set(auth());

const subir = (url: string, cuerpo: string, tipo = 'video/mp4') =>
  fetch(url, { method: 'PUT', headers: { 'content-type': tipo }, body: cuerpo });

beforeAll(async () => {
  execSync('pnpm exec dotenv -e .env.test -- tsx prisma/seed.ts', {
    cwd: new URL('..', import.meta.url).pathname,
    stdio: 'pipe',
  });
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
    .send({ email: 'test@jamesfilm.local', password: 'test-password' });
  token = login.body.data.accessToken;
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.media.deleteMany();
  await prisma.gallery.deleteMany();
  const cat = await prisma.category.findUniqueOrThrow({ where: { slug: 'bodas' } });
  const { body } = await http()
    .post('/admin/galleries')
    .set(auth())
    .send({ title: 'XV de Camila', categoryId: cat.id });
  galeriaId = body.data.id;
});

describe('presign: valida ANTES de firmar', () => {
  it('rechaza un mime no permitido', async () => {
    const res = await presign([reel({ mimeType: 'application/zip' })]).expect(422);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(await prisma.media.count()).toBe(0);
  });

  it('rechaza un archivo por encima del límite', async () => {
    const res = await presign([reel({ sizeBytes: 900 * 1024 * 1024 })]).expect(400);
    expect(res.body.code).toBe('FILE_TOO_LARGE');
    expect(await prisma.media.count()).toBe(0);
  });

  it('rechaza un type incoherente con el mimeType', async () => {
    // Un PHOTO con video/mp4 pasaría las dos validaciones por separado y
    // crearía un Media que la landing renderizaría como imagen.
    const res = await presign([reel({ type: 'PHOTO' })]).expect(400);
    expect(res.body.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('el poster también se valida, y el error llega atado a su campo', async () => {
    const res = await presign([
      reel({ posterMimeType: 'text/html', posterSizeBytes: 10 }),
    ]).expect(422);

    expect(res.body.code).toBe('VALIDATION_FAILED');
    // La ruta con índice es lo que permite al editor marcar EL archivo concreto
    // del lote que falla, en vez de teñir de rojo la subida entera.
    expect(res.body.details).toContainEqual(
      expect.objectContaining({ field: 'items.0.posterMimeType' }),
    );
  });
});

describe('presign: lote e idempotencia', () => {
  it('firma N archivos en UN roundtrip, sin colisiones de clave', async () => {
    const { body } = await presign([reel(), reel(), reel(), reel()]).expect(201);
    expect(body.data).toHaveLength(4);
    expect(new Set(body.data.map((r: { storageKey: string }) => r.storageKey)).size).toBe(4);
    // Nombre UUID, nunca el original: evita colisiones y path traversal (§17).
    expect(body.data[0].storageKey).toMatch(/^videos\/[0-9a-f-]{36}\.mp4$/);
  });

  it('el mismo clientUploadId devuelve el MISMO media, no uno nuevo', async () => {
    const item = reel();
    const a = await presign([item]).expect(201);
    const b = await presign([item]).expect(201);

    expect(b.body.data[0].mediaId).toBe(a.body.data[0].mediaId);
    expect(await prisma.media.count()).toBe(1);
  });

  it('firma también el poster cuando el navegador lo declara', async () => {
    const { body } = await presign([
      reel({ posterMimeType: 'image/jpeg', posterSizeBytes: 500 }),
    ]).expect(201);

    expect(body.data[0].posterUploadUrl).toBeTruthy();
    // La extensión sale del mime declarado, no de una constante.
    expect(body.data[0].posterKey).toMatch(/^posters\/[0-9a-f-]{36}\.jpg$/);
  });

  it('el poster en WebP se rechaza: Safari no lo puede generar', async () => {
    // canvas.toBlob('image/webp') no existe en Safari —ni iOS ni macOS— y la spec
    // obliga a caer a PNG SIN error. Aceptar webp aquí significaría que en el iPhone
    // de James ningún reel tendría miniatura, y en silencio.
    const res = await presign([
      reel({ posterMimeType: 'image/webp', posterSizeBytes: 500 }),
    ]).expect(422);

    expect(res.body.details).toContainEqual(
      expect.objectContaining({ field: 'items.0.posterMimeType' }),
    );
  });

  it('una foto va al prefijo photos/', async () => {
    const { body } = await presign([
      reel({ type: 'PHOTO', mimeType: 'image/jpeg', filename: 'f.jpg' }),
    ]).expect(201);
    expect(body.data[0].storageKey).toMatch(/^photos\/[0-9a-f-]{36}\.jpg$/);
  });
});

describe('orden', () => {
  it('los medios nuevos nacen AL FINAL, no empatando en 0', async () => {
    // ReorderService numera solo los ids que recibe: con order @default(0), las dos
    // fotos del martes se colarían entre los primeros de una grilla ya ordenada.
    const a = await presign([reel(), reel(), reel()]).expect(201);
    const primeros = await prisma.media.findMany({
      where: { id: { in: a.body.data.map((r: { mediaId: string }) => r.mediaId) } },
      orderBy: { order: 'asc' },
      select: { order: true },
    });
    expect(primeros.map((m) => m.order)).toEqual([0, 1, 2]);

    const b = await presign([reel()]).expect(201);
    const nuevo = await prisma.media.findUniqueOrThrow({ where: { id: b.body.data[0].mediaId } });
    expect(nuevo.order).toBe(3);
  });
});

describe('confirm: verifica con HEAD', () => {
  it('una subida completa pasa a READY', async () => {
    const { body } = await presign([reel()]).expect(201);
    const { mediaId, uploadUrl } = body.data[0];

    expect((await subir(uploadUrl, 'hola mundo!!')).ok).toBe(true);
    const res = await confirmar(mediaId).expect(200);

    expect(res.body.data).toMatchObject({ status: 'READY', error: null });
  });

  it('una subida TRUNCADA queda FAILED con el motivo, no READY', async () => {
    // Sin esta verificación, una subida cortada por pérdida de red quedaría
    // READY con un vídeo roto que nadie descubre hasta que un visitante lo abre.
    const { body } = await presign([reel({ sizeBytes: 1000 })]).expect(201);
    const { mediaId, uploadUrl } = body.data[0];

    // Se firmó para 1000 bytes; el bucket rechaza otro tamaño, así que no llega nada.
    await subir(uploadUrl, 'x'.repeat(400));

    const res = await confirmar(mediaId).expect(200);
    expect(res.body.data.status).toBe('FAILED');
    expect(res.body.data.error).toBeTruthy();

    const fila = await prisma.media.findUniqueOrThrow({ where: { id: mediaId } });
    expect(fila.attempts).toBe(1);
  });

  it('confirmar sin haber subido nada da FAILED, no un 500', async () => {
    const { body } = await presign([reel()]).expect(201);
    const res = await confirmar(body.data[0].mediaId).expect(200);
    expect(res.body.data.status).toBe('FAILED');
  });

  it('es idempotente: dos confirmaciones no rompen ni duplican', async () => {
    const { body } = await presign([reel()]).expect(201);
    const { mediaId, uploadUrl } = body.data[0];
    await subir(uploadUrl, 'hola mundo!!');

    const a = await confirmar(mediaId).expect(200);
    const b = await confirmar(mediaId).expect(200);

    expect(a.body.data.status).toBe('READY');
    expect(b.body.data.status).toBe('READY');
    expect(await prisma.media.count()).toBe(1);
  });

  it('la orientación se deriva de width/height, no la elige el cliente', async () => {
    const casos: [number, number, string][] = [
      [1080, 1920, 'VERTICAL'],
      [1920, 1080, 'HORIZONTAL'],
      [1080, 1080, 'SQUARE'],
    ];

    for (const [width, height, esperada] of casos) {
      const { body } = await presign([reel({ width, height })]).expect(201);
      await subir(body.data[0].uploadUrl, 'hola mundo!!');
      const res = await confirmar(body.data[0].mediaId).expect(200);
      expect(res.body.data.orientation).toBe(esperada);
    }
  });
});

describe('borrado', () => {
  it('es soft: la fila queda con deletedAt y el archivo sigue en el bucket', async () => {
    const { body } = await presign([reel()]).expect(201);
    const { mediaId, uploadUrl } = body.data[0];
    await subir(uploadUrl, 'hola mundo!!');
    await confirmar(mediaId);

    await http().delete(`/admin/media/${mediaId}`).set(auth()).expect(204);

    const fila = await prisma.media.findUniqueOrThrow({ where: { id: mediaId } });
    expect(fila.deletedAt).not.toBeNull();
  });
});

describe('auth', () => {
  it('presign sin token da 401', async () => {
    await http().post(`/admin/galleries/${galeriaId}/media/presign`).send({ items: [] }).expect(401);
  });
});
