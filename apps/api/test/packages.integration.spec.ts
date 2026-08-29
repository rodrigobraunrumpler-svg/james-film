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

interface Paquete {
  id: string;
  slug: string;
  items: { id: string; text: string; included: boolean; order: number }[];
  isHighlighted: boolean;
  priceAmount: number | null;
  categoryIds: string[];
  subtitle: string | null;
  priceNote: string | null;
  idealFor: string | null;
  icon: string | null;
  badgeText: string | null;
  whatsappMessage: string | null;
  accentColor: string | null;
}

const crear = async (body: Record<string, unknown>): Promise<Paquete> => {
  const { body: res } = await http()
    .post('/admin/packages')
    .set(auth())
    .send({ name: 'test- Paquete', ...body })
    .expect(201);
  return res.data as Paquete;
};

const leer = async (id: string): Promise<Paquete> => {
  const { body } = await http().get('/admin/packages').set(auth()).expect(200);
  return (body.data as Paquete[]).find((p) => p.id === id)!;
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

const limpiar = () => prisma.package.deleteMany({ where: { slug: { startsWith: 'test-' } } });

/**
 * Destacar un paquete de prueba DESMARCA el del seed —el flag es exclusivo—,
 * así que borrar el de prueba dejaría la base sin ninguno y el recuento del
 * seed fallaría en otro fichero, lejos de la causa.
 */
const restaurarDestacado = async (): Promise<void> => {
  const pro = await prisma.package.findUnique({ where: { slug: 'pro' }, select: { id: true } });
  if (!pro) return;
  await prisma.package.updateMany({ data: { isHighlighted: false } });
  await prisma.package.update({ where: { id: pro.id }, data: { isHighlighted: true } });
};

beforeEach(limpiar);

afterAll(async () => {
  await limpiar();
  await restaurarDestacado();
  await app.close();
  await prisma.$disconnect();
});

describe('los bullets viajan con el paquete', () => {
  it('se crean con el orden del array', async () => {
    const p = await crear({
      items: [{ text: 'Uno' }, { text: 'Dos', included: false }, { text: 'Tres' }],
    });

    expect(p.items.map((i) => i.text)).toEqual(['Uno', 'Dos', 'Tres']);
    expect(p.items.map((i) => i.order)).toEqual([0, 1, 2]);
    expect(p.items[1].included).toBe(false);
  });

  it('los ids SOBREVIVEN a un guardado: son la clave de React de cada fila', async () => {
    // Recrearlos remontaría la lista entera en cada guardado y el foco saltaría
    // del campo que se está escribiendo.
    const p = await crear({ items: [{ text: 'Uno' }, { text: 'Dos' }] });
    const idsAntes = p.items.map((i) => i.id);

    await http()
      .patch(`/admin/packages/${p.id}`)
      .set(auth())
      .send({
        items: [
          { id: idsAntes[0], text: 'Uno editado' },
          { id: idsAntes[1], text: 'Dos' },
        ],
      })
      .expect(200);

    const despues = await leer(p.id);
    expect(despues.items.map((i) => i.id)).toEqual(idsAntes);
    expect(despues.items[0].text).toBe('Uno editado');
  });

  it('quitar un bullet lo borra y renumera el resto', async () => {
    const p = await crear({ items: [{ text: 'A' }, { text: 'B' }, { text: 'C' }] });

    await http()
      .patch(`/admin/packages/${p.id}`)
      .set(auth())
      .send({ items: [{ id: p.items[0].id, text: 'A' }, { id: p.items[2].id, text: 'C' }] })
      .expect(200);

    const despues = await leer(p.id);
    expect(despues.items.map((i) => i.text)).toEqual(['A', 'C']);
    expect(despues.items.map((i) => i.order)).toEqual([0, 1]);
  });

  it('reordenar el array reordena los bullets', async () => {
    const p = await crear({ items: [{ text: 'A' }, { text: 'B' }] });

    await http()
      .patch(`/admin/packages/${p.id}`)
      .set(auth())
      .send({ items: [{ id: p.items[1].id, text: 'B' }, { id: p.items[0].id, text: 'A' }] })
      .expect(200);

    expect((await leer(p.id)).items.map((i) => i.text)).toEqual(['B', 'A']);
  });

  it('un id de OTRO paquete se rechaza: movería el bullet de sitio', async () => {
    // No hay índice único (id, packageId) que lo impida.
    const a = await crear({ name: 'test- A', items: [{ text: 'de A' }] });
    const b = await crear({ name: 'test- B', items: [{ text: 'de B' }] });

    await http()
      .patch(`/admin/packages/${b.id}`)
      .set(auth())
      .send({ items: [{ id: a.items[0].id, text: 'robado' }] })
      .expect(400);

    // Y el de A sigue donde estaba.
    expect((await leer(a.id)).items[0].text).toBe('de A');
  });

  it('no mandar `items` NO los toca', async () => {
    const p = await crear({ items: [{ text: 'Intacto' }] });

    await http().patch(`/admin/packages/${p.id}`).set(auth()).send({ name: 'test- Otro' }).expect(200);

    expect((await leer(p.id)).items.map((i) => i.text)).toEqual(['Intacto']);
  });
});

describe('destacado exclusivo', () => {
  it('marcar uno desmarca el otro, aunque se manden dos PATCH seguidos', async () => {
    const a = await crear({ name: 'test- Uno' });
    const b = await crear({ name: 'test- Dos' });

    await http().patch(`/admin/packages/${a.id}/highlight`).set(auth()).expect(200);
    await http().patch(`/admin/packages/${b.id}/highlight`).set(auth()).expect(200);

    const { body } = await http().get('/admin/packages').set(auth()).expect(200);
    const destacados = (body.data as Paquete[]).filter((p) => p.isHighlighted);
    expect(destacados).toHaveLength(1);
    expect(destacados[0].id).toBe(b.id);
  });

  it('el destacado sale PRIMERO en el listado público', async () => {
    const p = await crear({ name: 'test- Destacado', isHighlighted: true });

    const { body } = await http().get('/packages').expect(200);
    expect(body.data[0].id).toBe(p.id);
  });

  it('desactivarlo lo saca del público y NINGUNO hereda el destaque', async () => {
    // La sección de la landing sale plana y no falla nada: por eso el admin
    // avisa antes de desactivar el destacado.
    const p = await crear({ name: 'test- Destacado', isHighlighted: true });
    await http().patch(`/admin/packages/${p.id}`).set(auth()).send({ isActive: false }).expect(200);

    const { body } = await http().get('/packages').expect(200);
    expect(body.data.some((x: Paquete) => x.id === p.id)).toBe(false);
    expect(body.data.some((x: Paquete) => x.isHighlighted)).toBe(false);
  });
});

describe('precio', () => {
  it('guarda céntimos: S/ 300 son 30000', async () => {
    const p = await crear({ priceAmount: 30_000 });
    expect(p.priceAmount).toBe(30_000);
  });

  it('rechaza un precio con decimales, aunque el navegador lo haya dejado escribir', async () => {
    // `step="1"` no valida nada: el usuario puede teclear 300.5 y aquí no hay
    // submit nativo. La última palabra la tiene la API.
    await http()
      .post('/admin/packages')
      .set(auth())
      .send({ name: 'test- Decimal', priceAmount: 30_050.5 })
      .expect(422);
  });

  it('acepta que no haya precio', async () => {
    const p = await crear({ priceAmount: null });
    expect(p.priceAmount).toBeNull();
  });
});

describe('vínculo con categorías', () => {
  it('reemplaza los vínculos enteros', async () => {
    const cats = await prisma.category.findMany({ select: { id: true }, take: 2 });
    const p = await crear({ categoryIds: [cats[0].id] });
    expect(p.categoryIds).toEqual([cats[0].id]);

    const { body } = await http()
      .patch(`/admin/packages/${p.id}`)
      .set(auth())
      .send({ categoryIds: [cats[1].id] })
      .expect(200);

    expect(body.data.categoryIds).toEqual([cats[1].id]);
  });
});

describe('borrado', () => {
  it('con clics registrados NO se borra: son la única métrica del proyecto', async () => {
    const p = await crear({ name: 'test- Con clics' });
    await prisma.whatsappClick.create({ data: { packageId: p.id } });

    const { body } = await http().delete(`/admin/packages/${p.id}`).set(auth()).expect(400);
    expect(body.message).toMatch(/Desactívalo/);

    await prisma.whatsappClick.deleteMany({ where: { packageId: p.id } });
  });

  it('sin clics sí se borra, y se lleva sus bullets', async () => {
    const p = await crear({ items: [{ text: 'A' }] });

    await http().delete(`/admin/packages/${p.id}`).set(auth()).expect(204);

    expect(await prisma.packageItem.count({ where: { packageId: p.id } })).toBe(0);
  });
});

describe('orden de rutas y validación', () => {
  it('PATCH /admin/packages/reorder no lo captura /:id', async () => {
    const a = await crear({ name: 'test- Primero' });
    const b = await crear({ name: 'test- Segundo' });

    const { body } = await http()
      .patch('/admin/packages/reorder')
      .set(auth())
      .send({ ids: [b.id, a.id] })
      .expect(200);

    expect(Array.isArray(body.data)).toBe(true);
  });

  it('un ícono fuera de la lista cerrada se rechaza', async () => {
    // Un typo dejaría un hueco en la web y nadie lo vería venir.
    await http()
      .post('/admin/packages')
      .set(auth())
      .send({ name: 'test- Icono', icon: 'no-existe' })
      .expect(422);
  });

  it('el listado público no expone los campos de gestión', async () => {
    await crear({ name: 'test- Público' });
    const { body } = await http().get('/packages').expect(200);

    expect(body.data[0]).not.toHaveProperty('isActive');
    expect(body.data[0]).not.toHaveProperty('whatsappClickCount');
    expect(body.data[0].items[0]).not.toHaveProperty('order');
  });
});

describe('vaciar TODOS los opcionales a la vez', () => {
  it('los borra todos', async () => {
    const p = await crear({
      subtitle: 'un subtítulo',
      priceNote: 'una nota',
      idealFor: 'para bodas',
      icon: 'star',
      badgeText: 'TOP',
      whatsappMessage: 'Hola',
      accentColor: '#C9A96A',
      priceAmount: 30_000,
    });

    await http()
      .patch(`/admin/packages/${p.id}`)
      .set(auth())
      .send({
        subtitle: null,
        priceNote: null,
        idealFor: null,
        icon: null,
        badgeText: null,
        whatsappMessage: null,
        accentColor: null,
        priceAmount: null,
      })
      .expect(200);

    const d = await leer(p.id);
    // El conjunto entero, no campo a campo: así el olvido se ve completo.
    expect({
      subtitle: d.subtitle,
      priceNote: d.priceNote,
      idealFor: d.idealFor,
      icon: d.icon,
      badgeText: d.badgeText,
      whatsappMessage: d.whatsappMessage,
      accentColor: d.accentColor,
      priceAmount: d.priceAmount,
    }).toEqual({
      subtitle: null,
      priceNote: null,
      idealFor: null,
      icon: null,
      badgeText: null,
      whatsappMessage: null,
      accentColor: null,
      priceAmount: null,
    });
  });
});

describe('la lista de íconos', () => {
  it('contiene TODOS los que ya usa el seed', async () => {
    // Este es el fallo que casi entra: la lista se escribió sin mirar el seed,
    // y con `@IsIn` puesto James habría abierto un paquete, guardado sin tocar
    // el ícono, y recibido un 422 sobre `trending-up`.
    const { body } = await http().get('/admin/icons').set(auth()).expect(200);
    const permitidos: string[] = body.data;

    const enUso = await prisma.package.findMany({
      where: { icon: { not: null } },
      select: { icon: true },
    });
    const deDiferenciadores = await prisma.differentiator.findMany({ select: { icon: true } });

    for (const { icon } of [...enUso, ...deDiferenciadores]) {
      expect(permitidos).toContain(icon);
    }
  });

  it('un paquete del seed se puede guardar SIN tocar su ícono', async () => {
    const pro = await prisma.package.findUniqueOrThrow({ where: { slug: 'pro' } });

    // Guardar solo el subtítulo no debe rebotar por un campo que no se envió.
    await http()
      .patch(`/admin/packages/${pro.id}`)
      .set(auth())
      .send({ subtitle: pro.subtitle })
      .expect(200);
  });

  it('exige sesión', async () => {
    await http().get('/admin/icons').expect(401);
  });
});
