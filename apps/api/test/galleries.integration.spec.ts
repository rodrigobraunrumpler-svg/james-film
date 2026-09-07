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
let categoriaId: string;

const http = () => request(app.getHttpServer());
const auth = () => ({ Authorization: `Bearer ${token}` });

const crear = async (body: Record<string, unknown>) => {
  const { body: res } = await http()
    .post('/admin/galleries')
    .set(auth())
    .send({ categoryId: categoriaId, ...body })
    .expect(201);
  return res.data as { id: string; slug: string };
};

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
  categoriaId = (await prisma.category.findUniqueOrThrow({ where: { slug: 'bodas' } })).id;
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.media.deleteMany();
  await prisma.gallery.deleteMany();
});

describe('controller público', () => {
  it('no devuelve galerías sin publicar', async () => {
    await crear({ title: 'Borrador' });
    const { body } = await http().get('/galleries').expect(200);
    expect(body.data).toHaveLength(0);
  });

  it('no devuelve galerías con soft delete', async () => {
    const g = await crear({ title: 'Publicada' });
    await http().patch(`/admin/galleries/${g.id}`).set(auth()).send({ isPublished: true, hasConsent: true });
    await http().delete(`/admin/galleries/${g.id}`).set(auth()).expect(204);

    const { body } = await http().get('/galleries').expect(200);
    expect(body.data).toHaveLength(0);
  });

  it('ignora cualquier parámetro que intente desactivar el filtro', async () => {
    await crear({ title: 'Borrador' });
    // `forbidNonWhitelisted` lo rechaza en vez de ignorarlo: aún mejor.
    const res = await http().get('/galleries?isPublished=false');
    expect([200, 422]).toContain(res.status);
    if (res.status === 200) expect(res.body.data).toHaveLength(0);
  });

  it('la LISTA no trae los medios, solo cuántos hay', async () => {
    const g = await crear({ title: 'Con medios' });
    await http().patch(`/admin/galleries/${g.id}`).set(auth()).send({ isPublished: true, hasConsent: true });
    await prisma.media.createMany({
      data: [
        {
          galleryId: g.id,
          type: 'REEL',
          mimeType: 'video/mp4',
          sizeBytes: 1,
          storageKey: 'videos/1.mp4',
          status: 'READY',
        },
        {
          galleryId: g.id,
          type: 'REEL',
          mimeType: 'video/mp4',
          sizeBytes: 1,
          storageKey: 'videos/2.mp4',
          status: 'PENDING',
        },
      ],
    });

    const { body } = await http().get('/galleries').expect(200);
    expect(body.data[0]).not.toHaveProperty('media');
    // Solo cuenta los READY: un PENDING todavía no existe para el visitante.
    expect(body.data[0].mediaCount).toBe(1);
  });

  it('el detalle solo devuelve Media en READY', async () => {
    const g = await crear({ title: 'Detalle' });
    await http().patch(`/admin/galleries/${g.id}`).set(auth()).send({ isPublished: true, hasConsent: true });
    await prisma.media.createMany({
      data: [
        {
          galleryId: g.id,
          type: 'REEL',
          mimeType: 'video/mp4',
          sizeBytes: 1,
          storageKey: 'videos/ok.mp4',
          status: 'READY',
        },
        {
          galleryId: g.id,
          type: 'REEL',
          mimeType: 'video/mp4',
          sizeBytes: 1,
          storageKey: 'videos/no.mp4',
          status: 'FAILED',
        },
      ],
    });

    const { body } = await http().get('/galleries/detalle').expect(200);
    expect(body.data.media).toHaveLength(1);
    expect(body.data.media[0].url).toContain('videos/ok.mp4');
  });

  it('no expone campos internos en el DTO', async () => {
    const g = await crear({ title: 'Interna' });
    await http().patch(`/admin/galleries/${g.id}`).set(auth()).send({ isPublished: true, hasConsent: true });
    await prisma.media.create({
      data: {
        galleryId: g.id,
        type: 'REEL',
        mimeType: 'video/mp4',
        sizeBytes: 999,
        storageKey: 'videos/x.mp4',
        status: 'READY',
      },
    });

    const { body } = await http().get('/galleries/interna').expect(200);
    for (const campo of [
      'storageKey',
      'sizeBytes',
      'status',
      'error',
      'attempts',
      'clientUploadId',
      'deletedAt',
    ]) {
      expect(body.data.media[0]).not.toHaveProperty(campo);
    }
    expect(body.data).not.toHaveProperty('isPublished');
  });

  it('una galería sin publicar da 404, no 403: un 403 confirmaría que existe', async () => {
    await crear({ title: 'Secreta' });
    const res = await http().get('/galleries/secreta').expect(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('el orden es determinista aunque empaten: no repite ni pierde filas', async () => {
    // Ocho modelos tienen `order @default(0)`, o sea que empatan por defecto.
    // Sin desempate por id, Postgres puede devolverlas en distinto orden entre
    // páginas: una sale dos veces y otra ninguna.
    for (const t of ['Uno', 'Dos', 'Tres', 'Cuatro']) {
      const g = await crear({ title: t });
      await http().patch(`/admin/galleries/${g.id}`).set(auth()).send({ isPublished: true, hasConsent: true });
    }

    const p1 = await http().get('/galleries?page=1&pageSize=2').expect(200);
    const p2 = await http().get('/galleries?page=2&pageSize=2').expect(200);
    const ids = [...p1.body.data, ...p2.body.data].map((g: { id: string }) => g.id);

    expect(new Set(ids).size).toBe(4);
    expect(p1.body.meta.totalCount).toBe(4);
  });
});

describe('slug', () => {
  it('NO se regenera al renombrar: los links compartidos siguen vivos', async () => {
    const g = await crear({ title: 'XV de Camila' });
    expect(g.slug).toBe('xv-de-camila');

    await http()
      .patch(`/admin/galleries/${g.id}`)
      .set(auth())
      .send({ title: 'XV Años de Camila' })
      .expect(200);

    const { body } = await http().get(`/admin/galleries/${g.id}`).set(auth()).expect(200);
    expect(body.data.slug).toBe('xv-de-camila');
  });

  it('una galería borrada mantiene su slug ocupado: la nueva es -2', async () => {
    // Gallery_slug_key no es un índice parcial y el cron solo purga a los 30
    // días: si el sondeo filtrara deletedAt diría "libre" y el create reventaría.
    const g = await crear({ title: 'Boda Ana' });
    await http().delete(`/admin/galleries/${g.id}`).set(auth()).expect(204);

    const nueva = await crear({ title: 'Boda Ana' });
    expect(nueva.slug).toBe('boda-ana-2');
  });
});

describe('portada y estado (lo que necesita el editor)', () => {
  it('marcar portada rellena coverUrl en la lista, no la deja en null', async () => {
    // coverKey no lo escribe NADIE: ni create, ni update, ni el seed. Se deriva del
    // medio destacado, o marcar portada no cambiaría nada visible.
    const g = await crear({ title: 'Con portada' });
    const m = await prisma.media.create({
      data: {
        galleryId: g.id,
        type: 'REEL',
        mimeType: 'video/mp4',
        sizeBytes: 1,
        storageKey: 'videos/p.mp4',
        posterKey: 'posters/p.jpg',
        status: 'READY',
      },
    });

    const antes = await http().get('/admin/galleries').set(auth()).expect(200);
    expect(antes.body.data[0].coverUrl).toBeNull();

    await http().patch(`/admin/galleries/${g.id}/media/${m.id}/cover`).set(auth()).expect(200);

    const despues = await http().get('/admin/galleries').set(auth()).expect(200);
    expect(despues.body.data[0].coverUrl).toContain('posters/p.jpg');
  });

  it('?estado filtra borradores y publicadas, y rechaza cualquier otra cosa', async () => {
    const borrador = await crear({ title: 'Sigue en borrador' });
    const publicada = await crear({ title: 'Ya está en vivo' });
    await http().patch(`/admin/galleries/${publicada.id}`).set(auth()).send({ isPublished: true, hasConsent: true });

    const soloBorradores = await http()
      .get('/admin/galleries?estado=borradores')
      .set(auth())
      .expect(200);
    const idsBorrador = soloBorradores.body.data.map((g: { id: string }) => g.id);
    expect(idsBorrador).toContain(borrador.id);
    expect(idsBorrador).not.toContain(publicada.id);

    const soloPublicadas = await http()
      .get('/admin/galleries?estado=publicadas')
      .set(auth())
      .expect(200);
    const idsPublicada = soloPublicadas.body.data.map((g: { id: string }) => g.id);
    expect(idsPublicada).toContain(publicada.id);
    expect(idsPublicada).not.toContain(borrador.id);

    // Lista cerrada: sin el @IsIn, `?estado=cualquiercosa` devolvería la lista
    // entera y el filtro parecería roto en vez de rechazado.
    await http().get('/admin/galleries?estado=todo').set(auth()).expect(422);
  });

  it('?q busca en el título sin distinguir mayúsculas y recorta el vacío', async () => {
    await crear({ title: 'XV de Camila' });
    await crear({ title: 'Boda Ana & Luis' });

    const { body } = await http().get('/admin/galleries?q=camila').set(auth()).expect(200);
    expect(body.data.map((g: { title: string }) => g.title)).toEqual(['XV de Camila']);

    // `?q=` vacío NO debe filtrar por `contains: ''`: eso casa con todo pero
    // convierte cada tecleo del buscador en un scan inútil.
    const vacio = await http().get('/admin/galleries?q=%20%20').set(auth()).expect(200);
    expect(vacio.body.data.length).toBeGreaterThan(1);
  });

  it('/counts NO lo captura la ruta :id, y cuadra con la lista', async () => {
    const publicada = await crear({ title: 'Contada y publicada' });
    await http().patch(`/admin/galleries/${publicada.id}`).set(auth()).send({ isPublished: true, hasConsent: true });
    await crear({ title: 'Contada y en borrador' });

    // Si `@Get('counts')` se declarara DESPUÉS de `@Get(':id')`, esto sería un
    // 404 buscando una galería con id «counts».
    const { body } = await http().get('/admin/galleries/counts').set(auth()).expect(200);
    expect(body.data.todas).toBe(body.data.publicadas + body.data.borradores);

    const lista = await http().get('/admin/galleries?estado=borradores').set(auth()).expect(200);
    expect(lista.body.meta.totalCount).toBe(body.data.borradores);
  });

  it('destacar una galería desmarca la anterior: primera en la web solo puede haber una', async () => {
    const a = await crear({ title: 'Destacada A' });
    const b = await crear({ title: 'Destacada B' });

    await http().patch(`/admin/galleries/${a.id}`).set(auth()).send({ isFeatured: true }).expect(200);
    await http().patch(`/admin/galleries/${b.id}`).set(auth()).send({ isFeatured: true }).expect(200);

    // `isFeatured` solo sirve para ganar el orderBy de la lista pública, así que
    // dos marcadas dejaban al panel diciendo que las dos encabezan la web
    // mientras el `order` decidía en silencio cuál de verdad.
    expect((await prisma.gallery.findUniqueOrThrow({ where: { id: a.id } })).isFeatured).toBe(false);
    expect((await prisma.gallery.findUniqueOrThrow({ where: { id: b.id } })).isFeatured).toBe(true);

    // Y quitarla NO asciende a ninguna otra: quedarse sin destacada es válido,
    // ahí manda el `order`.
    await http()
      .patch(`/admin/galleries/${b.id}`)
      .set(auth())
      .send({ isFeatured: false })
      .expect(200);
    expect(await prisma.gallery.count({ where: { isFeatured: true } })).toBe(0);
  });

  it('la lista de admin trae updatedAt y los datos de la portada; la pública NO', async () => {
    const g = await crear({ title: 'Con portada' });
    const m = await prisma.media.create({
      data: {
        galleryId: g.id,
        type: 'REEL',
        mimeType: 'video/mp4',
        sizeBytes: 1,
        storageKey: 'videos/d.mp4',
        posterKey: 'posters/d.jpg',
        durationSec: 72,
        status: 'READY',
        isFeatured: true,
      },
    });
    expect(m.id).toBeDefined();
    await http().patch(`/admin/galleries/${g.id}`).set(auth()).send({ isPublished: true, hasConsent: true });

    const admin = await http().get(`/admin/galleries?q=Con portada`).set(auth()).expect(200);
    expect(admin.body.data[0]).toMatchObject({ coverType: 'REEL', coverDurationSec: 72 });
    expect(typeof admin.body.data[0].updatedAt).toBe('string');

    // La lista pública usaba el mapper del ADMIN y colaba `isPublished`; con
    // `updatedAt` en el DTO habría colado también el instante de edición.
    const publica = await http().get('/galleries').expect(200);
    expect(publica.body.data[0]).not.toHaveProperty('isPublished');
    expect(publica.body.data[0]).not.toHaveProperty('updatedAt');
    expect(publica.body.data[0]).not.toHaveProperty('coverType');
  });

  it('la portada de un VÍDEO sin poster no mete un .mp4 en coverUrl', async () => {
    const g = await crear({ title: 'Sin poster' });
    const m = await prisma.media.create({
      data: {
        galleryId: g.id,
        type: 'REEL',
        mimeType: 'video/mp4',
        sizeBytes: 1,
        storageKey: 'videos/np.mp4',
        status: 'READY',
      },
    });
    await http().patch(`/admin/galleries/${g.id}/media/${m.id}/cover`).set(auth()).expect(200);

    const { body } = await http().get('/admin/galleries').set(auth()).expect(200);
    // Un .mp4 dentro de un <img> no se ve: mejor null y que la UI ponga su placeholder.
    expect(body.data[0].coverUrl).toBeNull();
  });

  it('el detalle de admin trae status y error; el público NO', async () => {
    const g = await crear({ title: 'Estados' });
    await http().patch(`/admin/galleries/${g.id}`).set(auth()).send({ isPublished: true, hasConsent: true });
    await prisma.media.createMany({
      data: [
        {
          galleryId: g.id,
          type: 'REEL',
          mimeType: 'video/mp4',
          sizeBytes: 1,
          storageKey: 'videos/ok.mp4',
          status: 'READY',
        },
        {
          galleryId: g.id,
          type: 'REEL',
          mimeType: 'video/mp4',
          sizeBytes: 1,
          storageKey: 'videos/ko.mp4',
          status: 'FAILED',
          error: 'La subida quedó incompleta',
        },
      ],
    });

    // El editor DEBE poder distinguir el bueno del roto tras una recarga.
    const admin = await http().get(`/admin/galleries/${g.id}`).set(auth()).expect(200);
    expect(admin.body.data.media).toHaveLength(2);
    const roto = admin.body.data.media.find((m: { status: string }) => m.status === 'FAILED');
    expect(roto.error).toContain('incompleta');

    // Y el público no ve ni el roto ni el campo.
    const publico = await http().get('/galleries/estados').expect(200);
    expect(publico.body.data.media).toHaveLength(1);
    expect(publico.body.data.media[0]).not.toHaveProperty('status');
  });

  it('mediaCount de la lista de admin NO cuenta los rotos', async () => {
    const g = await crear({ title: 'Cuenta' });
    await prisma.media.createMany({
      data: [
        {
          galleryId: g.id,
          type: 'REEL',
          mimeType: 'video/mp4',
          sizeBytes: 1,
          storageKey: 'videos/a.mp4',
          status: 'READY',
        },
        {
          galleryId: g.id,
          type: 'REEL',
          mimeType: 'video/mp4',
          sizeBytes: 1,
          storageKey: 'videos/b.mp4',
          status: 'FAILED',
        },
        {
          galleryId: g.id,
          type: 'REEL',
          mimeType: 'video/mp4',
          sizeBytes: 1,
          storageKey: 'videos/c.mp4',
          status: 'PENDING',
        },
      ],
    });

    const { body } = await http().get('/admin/galleries').set(auth()).expect(200);
    expect(body.data[0].mediaCount).toBe(1);
  });
});

describe('borrado', () => {
  it('es soft, y propaga deletedAt a sus medios', async () => {
    // Sin la propagación, el Cascade de Postgres borraría las filas sin que la
    // app las vea y los objetos quedarían huérfanos en el bucket para siempre.
    const g = await crear({ title: 'Con medios' });
    await prisma.media.create({
      data: {
        galleryId: g.id,
        type: 'REEL',
        mimeType: 'video/mp4',
        sizeBytes: 1,
        storageKey: 'videos/h.mp4',
      },
    });

    await http().delete(`/admin/galleries/${g.id}`).set(auth()).expect(204);

    const galeria = await prisma.gallery.findUniqueOrThrow({ where: { id: g.id } });
    expect(galeria.deletedAt).not.toBeNull();
    const medio = await prisma.media.findFirstOrThrow({ where: { galleryId: g.id } });
    expect(medio.deletedAt).not.toBeNull();
  });
});

describe('admin', () => {
  it('sin token da 401', async () => {
    await http().get('/admin/galleries').expect(401);
  });

  it('el admin SÍ ve los borradores', async () => {
    await crear({ title: 'Borrador' });
    const { body } = await http().get('/admin/galleries').set(auth()).expect(200);
    expect(body.data).toHaveLength(1);
  });

  it('la portada es exclusiva POR GALERÍA', async () => {
    const a = await crear({ title: 'Boda Ana' });
    const b = await crear({ title: 'XV Camila' });
    const m = async (galleryId: string, key: string) =>
      prisma.media.create({
        data: {
          galleryId,
          type: 'REEL',
          mimeType: 'video/mp4',
          sizeBytes: 1,
          storageKey: key,
          status: 'READY',
        },
      });

    const a1 = await m(a.id, 'videos/a1.mp4');
    const b1 = await m(b.id, 'videos/b1.mp4');

    await http().patch(`/admin/galleries/${a.id}/media/${a1.id}/cover`).set(auth()).expect(200);
    await http().patch(`/admin/galleries/${b.id}/media/${b1.id}/cover`).set(auth()).expect(200);

    // Marcar la portada de una NO debe desmarcar la de la otra.
    expect((await prisma.media.findUniqueOrThrow({ where: { id: a1.id } })).isFeatured).toBe(true);
    expect((await prisma.media.findUniqueOrThrow({ where: { id: b1.id } })).isFeatured).toBe(true);
  });

  it('reordenar los medios persiste el orden', async () => {
    const g = await crear({ title: 'Orden' });
    const ids: string[] = [];
    for (const k of ['a', 'b', 'c']) {
      const m = await prisma.media.create({
        data: {
          galleryId: g.id,
          type: 'REEL',
          mimeType: 'video/mp4',
          sizeBytes: 1,
          storageKey: `videos/${k}.mp4`,
          status: 'READY',
        },
      });
      ids.push(m.id);
    }

    const invertido = [...ids].reverse();
    await http()
      .patch(`/admin/galleries/${g.id}/media/reorder`)
      .set(auth())
      .send({ ids: invertido })
      .expect(200);

    const medios = await prisma.media.findMany({
      where: { galleryId: g.id },
      orderBy: { order: 'asc' },
    });
    expect(medios.map((m) => m.id)).toEqual(invertido);
  });
});

describe('actualizar: null borra, undefined no toca', () => {
  it('vaciar la fecha la borra de verdad', async () => {
    const g = await crear({ title: 'Con fecha', eventDate: '2026-03-15' });

    const { body } = await http()
      .patch(`/admin/galleries/${g.id}`)
      .set(auth())
      .send({ eventDate: null })
      .expect(200);

    // Con `dto.eventDate ? … : undefined` esto devolvía '2026-03-15': el
    // autoguardado decía Guardado y la fecha reaparecía al recargar.
    expect(body.data.eventDate).toBeNull();
  });

  it('no mandar la fecha la deja como estaba', async () => {
    const g = await crear({ title: 'Intacta', eventDate: '2026-03-15' });

    const { body } = await http()
      .patch(`/admin/galleries/${g.id}`)
      .set(auth())
      .send({ title: 'Intacta editada' })
      .expect(200);

    expect(body.data.eventDate).toBe('2026-03-15');
  });

  it('vaciar descripción y lugar los borra', async () => {
    const g = await crear({ title: 'Con datos', description: 'algo', location: 'Ayacucho' });

    const { body } = await http()
      .patch(`/admin/galleries/${g.id}`)
      .set(auth())
      .send({ description: null, location: null })
      .expect(200);

    expect(body.data.description).toBeNull();
    expect(body.data.location).toBeNull();
  });
});

describe('isPublished: lo ve el admin, no la landing', () => {
  it('el detalle de admin lo trae', async () => {
    const g = await crear({ title: 'Borrador' });

    const { body } = await http().get(`/admin/galleries/${g.id}`).set(auth()).expect(200);

    // Sin esto el admin no distingue un borrador de una galería en vivo.
    expect(body.data.isPublished).toBe(false);
  });

  it('la lista de admin lo trae en cada fila', async () => {
    await crear({ title: 'Borrador de lista' });

    const { body } = await http().get('/admin/galleries').set(auth()).expect(200);

    expect(body.data[0]).toHaveProperty('isPublished', false);
  });

  it('el controller público NO lo expone', async () => {
    // Allí siempre valdría true —el controller filtra— y añadirlo movería el
    // openapi-public.json que el CI congela.
    const g = await crear({ title: 'Publicada' });
    await http()
      .patch(`/admin/galleries/${g.id}`)
      .set(auth())
      .send({ isPublished: true, hasConsent: true })
      .expect(200);

    const { body } = await http().get(`/galleries/${g.slug}`).expect(200);

    expect(body.data).not.toHaveProperty('isPublished');
  });

  it('publicar y despublicar va y vuelve', async () => {
    const g = await crear({ title: 'Ida y vuelta' });

    const publicada = await http()
      .patch(`/admin/galleries/${g.id}`)
      .set(auth())
      .send({ isPublished: true, hasConsent: true })
      .expect(200);
    expect(publicada.body.data.isPublished).toBe(true);
    await http().get(`/galleries/${g.slug}`).expect(200);

    const borrador = await http()
      .patch(`/admin/galleries/${g.id}`)
      .set(auth())
      .send({ isPublished: false })
      .expect(200);
    expect(borrador.body.data.isPublished).toBe(false);
    // 404 y no 403: un 403 confirmaría que ese enlace existe.
    await http().get(`/galleries/${g.slug}`).expect(404);
  });
});

/**
 * La plantilla que replica cada modelo de la fase 4: se vacían TODOS sus campos
 * opcionales de una vez. Un test por modelo, no uno por campo — es barato de
 * escribir y encuentra el olvido entero, que es como aparece este fallo.
 */
describe('vaciar TODOS los opcionales a la vez', () => {
  it('los borra todos y no deja ninguno con el valor anterior', async () => {
    const g = await crear({
      title: 'Con todo relleno',
      description: 'una descripción',
      eventDate: '2026-03-15',
      location: 'Ayacucho',
    });

    const { body } = await http()
      .patch(`/admin/galleries/${g.id}`)
      .set(auth())
      .send({ description: null, eventDate: null, location: null })
      .expect(200);

    // Se comprueba el conjunto, no campo a campo: si mañana se añade un
    // opcional nuevo y se olvida, este test no lo ve — pero el de su modelo sí.
    expect({
      description: body.data.description,
      eventDate: body.data.eventDate,
      location: body.data.location,
    }).toEqual({ description: null, eventDate: null, location: null });

    // Y sobrevive a la relectura: el fallo original devolvía bien el PATCH y
    // reaparecía el valor viejo al volver a pedir la galería.
    const relectura = await http().get(`/admin/galleries/${g.id}`).set(auth()).expect(200);
    expect(relectura.body.data.eventDate).toBeNull();
  });

  it('un PATCH que no menciona un campo NO lo toca', async () => {
    const g = await crear({ title: 'Intacto', description: 'no me toques', location: 'Ayacucho' });

    await http().patch(`/admin/galleries/${g.id}`).set(auth()).send({ title: 'Otro' }).expect(200);

    const { body } = await http().get(`/admin/galleries/${g.id}`).set(auth()).expect(200);
    expect(body.data.description).toBe('no me toques');
    expect(body.data.location).toBe('Ayacucho');
  });
});


/**
 * PUBLICAR EXIGE LA AUTORIZACIÓN DE IMAGEN.
 *
 * Es la misma puerta que ya tenían los testimonios y por una razón más fuerte:
 * en una galería salen caras de gente real y en los XV años salen **menores**.
 * Hasta ahora publicar era un botón sin fricción sobre lo único que puede
 * traerle a James un problema de verdad (Ley 29733, art. 15 del Código Civil).
 */
describe('consentimiento para publicar una galería', () => {
  const publicar = (id: string, body: Record<string, unknown> = {}) =>
    http()
      .patch(`/admin/galleries/${id}`)
      .set(auth())
      .send({ isPublished: true, ...body });

  it('sin autorización marcada, publicar da 422 con su código', async () => {
    const g = await crear({ title: 'test- Sin permiso' });
    const res = await publicar(g.id).expect(422);
    expect(res.body.code).toBe('CONSENT_REQUIRED');

    // Y no se ha publicado a medias.
    const fila = await prisma.gallery.findUniqueOrThrow({ where: { id: g.id } });
    expect(fila.isPublished).toBe(false);
  });

  it('nace SIN autorización, aunque nadie diga nada', async () => {
    const g = await crear({ title: 'test- Recien creada' });
    const fila = await prisma.gallery.findUniqueOrThrow({ where: { id: g.id } });
    expect(fila.hasConsent).toBe(false);
  });

  it('marcarla y publicar en el MISMO patch vale', async () => {
    // Es lo que hace el panel: una sola confirmación, un solo guardado.
    const g = await crear({ title: 'test- Permiso y publicar' });
    const { body } = await publicar(g.id, { hasConsent: true }).expect(200);
    expect(body.data.isPublished).toBe(true);
    expect(body.data.hasConsent).toBe(true);
  });

  it('con la autorización ya marcada antes, publicar sola vale', async () => {
    const g = await crear({ title: 'test- Permiso antes' });
    await http().patch(`/admin/galleries/${g.id}`).set(auth()).send({ hasConsent: true }).expect(200);
    await publicar(g.id).expect(200);
  });

  it('DESPUBLICAR nunca se bloquea, aunque se quite el permiso a la vez', async () => {
    // Quitar algo de la web es justo lo que hay que poder hacer sin fricción:
    // es como se atiende una solicitud de cancelación.
    const g = await crear({ title: 'test- Retirar' });
    await publicar(g.id, { hasConsent: true }).expect(200);

    const { body } = await http()
      .patch(`/admin/galleries/${g.id}`)
      .set(auth())
      .send({ isPublished: false, hasConsent: false })
      .expect(200);
    expect(body.data.isPublished).toBe(false);
  });

  it('el DTO del admin lo lleva; el público no lo menciona', async () => {
    const g = await crear({ title: 'test- DTO' });
    const { body: admin } = await http().get(`/admin/galleries/${g.id}`).set(auth()).expect(200);
    expect(admin.data).toHaveProperty('hasConsent');

    await publicar(g.id, { hasConsent: true }).expect(200);
    const { body: publico } = await http().get(`/galleries/${g.slug}`).expect(200);
    expect(publico.data, 'el consentimiento no es asunto del visitante').not.toHaveProperty(
      'hasConsent',
    );
  });
});
