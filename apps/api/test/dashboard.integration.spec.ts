/**
 * La forma del panel se IMPORTA, no se copia.
 *
 * Estaba escrita a mano aquí —un `interface Panel` con los campos de la fase
 * 4— y por eso el typecheck se cayó al añadir `bySource` y `saturdays`: el
 * test los leía en runtime y el tipo local no los tenía. Con el DTO de
 * contracts, un campo que la API añada o quite mueve este fichero o no compila.
 */
import type { DashboardDto } from '@james-film/contracts';
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

const DIA = 86_400_000;

const panel = async (): Promise<DashboardDto> => {
  const { body } = await http().get('/admin/dashboard').set(auth()).expect(200);
  return body.data as DashboardDto;
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
  await prisma.media.deleteMany({ where: { gallery: { slug: { startsWith: 'test-' } } } });
  await prisma.gallery.deleteMany({ where: { slug: { startsWith: 'test-' } } });
  await prisma.whatsappClick.deleteMany({ where: { source: 'test-panel' } });
  await app.close();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.media.deleteMany({ where: { gallery: { slug: { startsWith: 'test-' } } } });
  await prisma.gallery.deleteMany({ where: { slug: { startsWith: 'test-' } } });
  await prisma.whatsappClick.deleteMany({ where: { source: 'test-panel' } });
});

describe('GET /admin/dashboard', () => {
  it('exige sesión', async () => {
    await http().get('/admin/dashboard').expect(401);
  });

  it('la serie trae 30 días, terminados en HOY y con los ceros rellenos', async () => {
    const { clicks } = await panel();

    expect(clicks.daily).toHaveLength(30);
    // Sin los ceros, la gráfica se comprimiría saltándose los huecos y dos
    // semanas flojas se leerían como dos semanas buenas seguidas.
    expect(clicks.daily.every((d) => typeof d.count === 'number')).toBe(true);
    // HOY **en Lima**, no en UTC. Este assert decía `new Date().toISOString()`
    // y pasaba por casualidad: solo falla entre las 19:00 y las 24:00 de Lima,
    // que es justo la franja en la que la gente escribe.
    expect(clicks.daily.at(-1)?.date).toBe(
      new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date()),
    );

    // Ordenada de más antigua a más reciente, sin huecos de un día.
    const fechas = clicks.daily.map((d) => d.date);
    expect([...fechas].sort()).toEqual(fechas);
  });

  it('un clic de las 20:00 de Lima cae en ESE día, no en el siguiente', async () => {
    /**
     * Perú es UTC−5, así que las 20:00 de Lima son las 01:00 UTC del día
     * siguiente. Agrupando en UTC, **todo clic a partir de las 19:00 contaba
     * como mañana**: casi un tercio del día atribuido mal, y en un negocio
     * donde se escribe por la tarde eso no es un detalle.
     *
     * Se inserta con `createdAt` explícito en vez de simular el reloj: lo que
     * se prueba es cómo se AGRUPA una fila, no cuándo la creó nadie.
     */
    const ayerLima = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(
      new Date(Date.now() - 86_400_000),
    );
    // Las 20:00 de Lima de ese día = 01:00 UTC del día siguiente.
    const instante = new Date(`${ayerLima}T20:00:00-05:00`);

    const antes = (await panel()).clicks.daily.find((d) => d.date === ayerLima)?.count ?? 0;
    await prisma.whatsappClick.create({ data: { source: 'hero', createdAt: instante } });
    const despues = (await panel()).clicks.daily.find((d) => d.date === ayerLima)?.count ?? 0;

    expect(despues).toBe(antes + 1);
  });

  it('cuenta la ventana de 30 días y NO la anterior', async () => {
    const antes = await panel();

    await prisma.whatsappClick.createMany({
      data: [
        { source: 'test-panel', createdAt: new Date(Date.now() - 2 * DIA) },
        { source: 'test-panel', createdAt: new Date(Date.now() - 5 * DIA) },
        // Fuera de la ventana: cuenta en `previousTotal`, no en `total`.
        { source: 'test-panel', createdAt: new Date(Date.now() - 40 * DIA) },
      ],
    });

    const despues = await panel();
    expect(despues.clicks.total).toBe(antes.clicks.total + 2);
    expect(despues.clicks.previousTotal).toBe(antes.clicks.previousTotal + 1);
  });

  it('un clic sin paquete va a noPackage, no a byPackage', async () => {
    const antes = await panel();
    await prisma.whatsappClick.create({ data: { source: 'test-panel' } });

    const despues = await panel();
    expect(despues.clicks.noPackage).toBe(antes.clicks.noPackage + 1);
    expect(despues.clicks.byPackage.some((p) => p.packageId === null)).toBe(false);
  });

  /**
   * De DÓNDE salió el clic es otra pregunta que de qué paquete, y el Panel solo
   * contestaba la segunda: sin esto no se puede saber si el calendario —o la
   * línea de negocios, que es medio producto— trae gente o no.
   */
  it('reparte los clics por FUENTE, de más a menos y sin las que no tuvieron ninguno', async () => {
    await prisma.whatsappClick.createMany({
      data: [
        { source: 'calendario-ocupado' },
        { source: 'calendario-ocupado' },
        { source: 'negocios' },
      ],
    });

    const { clicks } = await panel();
    const cal = clicks.bySource.find((f) => f.source === 'calendario-ocupado');
    const neg = clicks.bySource.find((f) => f.source === 'negocios');
    expect(cal!.clicks).toBeGreaterThanOrEqual(2);
    expect(neg!.clicks).toBeGreaterThanOrEqual(1);
    // Ordenado de más a menos, y sin ceros: una lista de fuentes a cero ocupa
    // el mismo sitio que los dos datos que importan y no informa.
    expect(clicks.bySource.every((f) => f.clicks > 0)).toBe(true);
    expect([...clicks.bySource].sort((a, b) => b.clicks - a.clicks)).toEqual(clicks.bySource);
  });

  it('los sábados libres viajan en la misma respuesta: se ven al abrir, no si los buscas', async () => {
    const { saturdays } = await panel();
    expect(saturdays).toHaveLength(3);
    for (const m of saturdays) {
      expect(m.free).toBeLessThanOrEqual(m.total);
      expect(m.month).toMatch(/^\d{4}-\d{2}-01$/);
    }
  });

  /**
   * El único aviso del Panel que James no sabe ya por su cuenta: un borrador lo
   * creó él y un archivo fallido lo vio fallar, pero que una boda de hace tres
   * semanas no tenga galería no lo sabe nadie.
   */
  it('avisa de un día ocupado que ya pasó y no tiene galería', async () => {
    const hace = new Date(Date.now() - 20 * DIA).toISOString().slice(0, 10);
    await prisma.busyDay.create({
      data: { date: new Date(`${hace}T00:00:00.000Z`), note: 'Boda de Rosa', groupId: 'g-panel' },
    });

    const { attention } = await panel();
    const aviso = attention.find((a) => a.kind === 'EVENT_WITHOUT_GALLERY');
    expect(aviso).toBeDefined();
    expect(aviso!.title).toContain(hace);
    expect(aviso!.detail).toContain('Boda de Rosa');
    // Cada aviso lleva su acción: uno que no se puede resolver desde donde se
    // lee obliga a buscar la pantalla, y entonces se ignora.
    expect(aviso!.href).toBe('/?nueva=1');
    expect(aviso!.grave).toBe(false);

    await prisma.busyDay.deleteMany({ where: { groupId: 'g-panel' } });
  });

  it('y deja de avisar en cuanto existe la galería de ese día', async () => {
    const hace = new Date(Date.now() - 21 * DIA).toISOString().slice(0, 10);
    const categoria = await prisma.category.findFirstOrThrow();
    await prisma.busyDay.create({
      data: { date: new Date(`${hace}T00:00:00.000Z`), groupId: 'g-panel-2' },
    });
    const galeria = await prisma.gallery.create({
      data: {
        slug: `panel-cubierta-${Date.now()}`,
        title: 'Cubierta',
        categoryId: categoria.id,
        eventDate: new Date(`${hace}T00:00:00.000Z`),
      },
    });

    const { attention } = await panel();
    expect(
      attention.filter((a) => a.kind === 'EVENT_WITHOUT_GALLERY' && a.title.includes(hace)),
    ).toHaveLength(0);

    await prisma.gallery.delete({ where: { id: galeria.id } });
    await prisma.busyDay.deleteMany({ where: { groupId: 'g-panel-2' } });
  });

  it('agrupa los medios fallidos POR GALERÍA: ocho reels rotos son UN aviso', async () => {
    const categoria = await prisma.category.findFirstOrThrow();
    const galeria = await prisma.gallery.create({
      data: {
        slug: 'test-panel-fallidos',
        title: 'test- Fallidos',
        categoryId: categoria.id,
        media: {
          create: Array.from({ length: 8 }, (_, i) => ({
            type: 'REEL' as const,
            status: 'FAILED' as const,
            storageKey: `videos/test-${i}.mp4`,
            mimeType: 'video/mp4',
            sizeBytes: 1024,
            order: i,
          })),
        },
      },
      select: { id: true },
    });

    const { attention } = await panel();
    const avisos = attention.filter((a) => a.kind === 'MEDIA_FAILED' && a.galleryId === galeria.id);

    // Ocho avisos idénticos entrenan a descartarlos sin leer.
    expect(avisos).toHaveLength(1);
    expect(avisos[0]?.title).toContain('8');
    expect(avisos[0]?.href).toBe(`/galerias/${galeria.id}`);
  });

  it('un borrador de hoy NO avisa; uno de hace una semana sí', async () => {
    const categoria = await prisma.category.findFirstOrThrow();

    const reciente = await prisma.gallery.create({
      data: { slug: 'test-panel-hoy', title: 'test- Hoy', categoryId: categoria.id },
      select: { id: true },
    });
    const rancio = await prisma.gallery.create({
      data: {
        slug: 'test-panel-viejo',
        title: 'test- Viejo',
        categoryId: categoria.id,
        createdAt: new Date(Date.now() - 7 * DIA),
      },
      select: { id: true },
    });

    const { attention } = await panel();
    const borradores = attention.filter((a) => a.kind === 'STALE_DRAFT').map((a) => a.galleryId);

    // Antes de tres días es trabajo en curso, no un problema.
    expect(borradores).not.toContain(reciente.id);
    expect(borradores).toContain(rancio.id);
  });

  it('una galería publicada no aparece como borrador rancio', async () => {
    const categoria = await prisma.category.findFirstOrThrow();
    const publicada = await prisma.gallery.create({
      data: {
        slug: 'test-panel-publicada',
        title: 'test- Publicada',
        categoryId: categoria.id,
        isPublished: true,
        createdAt: new Date(Date.now() - 30 * DIA),
      },
      select: { id: true },
    });

    const { attention } = await panel();
    expect(attention.filter((a) => a.kind === 'STALE_DRAFT').map((a) => a.galleryId)).not.toContain(
      publicada.id,
    );
  });

  it('cada aviso lleva su acción y una ruta del admin a la que ir', async () => {
    const categoria = await prisma.category.findFirstOrThrow();
    await prisma.gallery.create({
      data: {
        slug: 'test-panel-accion',
        title: 'test- Acción',
        categoryId: categoria.id,
        createdAt: new Date(Date.now() - 9 * DIA),
      },
    });

    const { attention } = await panel();
    // Un aviso que no se puede resolver desde donde se lee obliga a buscar la
    // pantalla, y entonces se ignora.
    for (const a of attention) {
      expect(a.accion.length).toBeGreaterThan(0);
      expect(a.href.startsWith('/')).toBe(true);
      expect(a.id.length).toBeGreaterThan(0);
    }
  });

  it('el estado del deploy y el espacio viajan en la misma respuesta', async () => {
    const { deploy, storage } = await panel();

    expect(['IDLE', 'QUEUED', 'BUILDING', 'SUCCESS', 'FAILED']).toContain(deploy.status);
    expect(storage.quotaBytes).toBeGreaterThan(0);
    expect(storage.usedBytes).toBeGreaterThanOrEqual(0);
  });
});
