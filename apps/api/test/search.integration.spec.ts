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

interface Resultado {
  kind: string;
  id: string;
  label: string;
  hint: string | null;
  href: string;
  coverUrl: string | null;
}

const buscar = async (q: string): Promise<Resultado[]> => {
  const { body } = await http().get('/admin/search').query({ q }).set(auth()).expect(200);
  return body.data as Resultado[];
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
  await prisma.gallery.deleteMany({ where: { slug: { startsWith: 'test-' } } });
  await app.close();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.gallery.deleteMany({ where: { slug: { startsWith: 'test-' } } });
});

describe('GET /admin/search', () => {
  it('exige sesión', async () => {
    await http().get('/admin/search').query({ q: 'bod' }).expect(401);
  });

  it('con un solo carácter devuelve 422, no un scan de las cuatro tablas', async () => {
    await http().get('/admin/search').query({ q: 'a' }).set(auth()).expect(422);
  });

  it('« a » con espacios tampoco pasa: se recorta ANTES de medir', async () => {
    await http().get('/admin/search').query({ q: '  a  ' }).set(auth()).expect(422);
  });

  it('encuentra una categoría del seed y le pone su ruta del admin', async () => {
    const r = await buscar('bod');
    const cat = r.find((x) => x.kind === 'CATEGORY');

    expect(cat?.label).toBe('Bodas');
    expect(cat?.href).toBe('/categorias');
  });

  it('no distingue mayúsculas: «BODAS» encuentra «Bodas»', async () => {
    expect((await buscar('BODAS')).some((x) => x.label === 'Bodas')).toBe(true);
  });

  it('una galería en borrador se marca como tal, no por su recuento', async () => {
    const categoria = await prisma.category.findFirstOrThrow();
    const g = await prisma.gallery.create({
      data: { slug: 'test-buscar-camila', title: 'test- XV de Camila', categoryId: categoria.id },
      select: { id: true },
    });

    const r = await buscar('Camila');
    const encontrada = r.find((x) => x.id === g.id);

    // Lo primero que hay que saber de una galería es si está en vivo.
    expect(encontrada?.kind).toBe('GALLERY');
    expect(encontrada?.hint).toBe('Borrador');
    expect(encontrada?.href).toBe(`/galerias/${g.id}`);
  });

  it('una publicada enseña cuántos medios tiene', async () => {
    const categoria = await prisma.category.findFirstOrThrow();
    const g = await prisma.gallery.create({
      data: {
        slug: 'test-buscar-rojas',
        title: 'test- Boda Rojas',
        categoryId: categoria.id,
        isPublished: true,
      },
      select: { id: true },
    });

    expect((await buscar('Rojas')).find((x) => x.id === g.id)?.hint).toBe('0 medios');
  });

  it('lo que no casa no sale', async () => {
    expect(await buscar('zzzznoexiste')).toEqual([]);
  });

  it('un medio borrado no cuenta en el recuento del resultado', async () => {
    const categoria = await prisma.category.findFirstOrThrow();
    const g = await prisma.gallery.create({
      data: {
        slug: 'test-buscar-borrado',
        title: 'test- Con borrado',
        categoryId: categoria.id,
        isPublished: true,
        media: {
          create: [
            {
              type: 'REEL',
              status: 'READY',
              storageKey: 'videos/a.mp4',
              mimeType: 'video/mp4',
              sizeBytes: 1024,
              order: 0,
            },
            {
              type: 'REEL',
              status: 'READY',
              storageKey: 'videos/b.mp4',
              mimeType: 'video/mp4',
              sizeBytes: 1024,
              order: 1,
              deletedAt: new Date(),
            },
          ],
        },
      },
      select: { id: true },
    });

    // Singular cuando toca: «1 medios» se lee como un fallo.
    expect((await buscar('Con borrado')).find((x) => x.id === g.id)?.hint).toBe('1 medio');
  });
});
