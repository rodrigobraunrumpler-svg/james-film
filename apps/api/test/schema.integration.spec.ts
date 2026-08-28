import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

let prisma: PrismaClient;

beforeAll(async () => {
  prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  await prisma.$connect();
});

afterAll(async () => {
  // Limpiar TAMBIÉN al final: `beforeEach` deja las filas del último test en la base,
  // y el fichero del seed cuenta todas las categorías. Un test debe devolver la base
  // como la encontró.
  await limpiar();
  await prisma.$disconnect();
});

/** En este orden: Media cuelga de Gallery, y Gallery de Category con Restrict. */
async function limpiar(): Promise<void> {
  await prisma.media.deleteMany();
  await prisma.gallery.deleteMany();
  await prisma.category.deleteMany({ where: { slug: { startsWith: 'test-' } } });
}

beforeEach(limpiar);

describe('schema', () => {
  it('eventDate guarda solo la fecha, sin componente horario', async () => {
    const category = await prisma.category.create({ data: { slug: 'test-tz', name: 'TZ' } });
    const gallery = await prisma.gallery.create({
      data: {
        slug: 'test-tz-gal',
        title: 'TZ',
        categoryId: category.id,
        eventDate: new Date('2026-03-15T18:45:00Z'),
      },
    });

    const found = await prisma.gallery.findUniqueOrThrow({ where: { id: gallery.id } });
    expect(found.eventDate?.toISOString()).toBe('2026-03-15T00:00:00.000Z');
  });

  it('no se puede borrar una categoría que tiene galerías', async () => {
    // Slugs con prefijo `test-`: el seed usa `bodas` y `xv-anos`, y el @unique chocaría
    // según el orden en que vitest ejecute los dos ficheros de integración.
    const category = await prisma.category.create({
      data: { slug: 'test-bodas', name: 'Bodas' },
    });
    await prisma.gallery.create({
      data: { slug: 'test-xv-camila', title: 'XV de Camila', categoryId: category.id },
    });

    await expect(prisma.category.delete({ where: { id: category.id } })).rejects.toThrow();
    // Contra la categoría concreta, no contra el total: el seed deja las suyas.
    expect(await prisma.category.findUnique({ where: { slug: 'test-bodas' } })).not.toBeNull();
  });

  it('el mismo clientUploadId no se puede repetir dentro de una galería', async () => {
    const category = await prisma.category.create({ data: { slug: 'test-c', name: 'C' } });
    const gallery = await prisma.gallery.create({
      data: { slug: 'test-g', title: 'G', categoryId: category.id },
    });
    const base = {
      galleryId: gallery.id,
      type: 'REEL' as const,
      mimeType: 'video/mp4',
      sizeBytes: 1000,
      clientUploadId: 'upload-abc',
    };

    await prisma.media.create({ data: { ...base, storageKey: 'videos/uno.mp4' } });
    await expect(
      prisma.media.create({ data: { ...base, storageKey: 'videos/dos.mp4' } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});
