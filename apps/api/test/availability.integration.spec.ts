import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configurarApp } from '../src/bootstrap.js';
import { hashPassword } from '../src/common/hash.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { AvailabilityService } from '../src/modules/availability/availability.service.js';
import { hoyEnLima, masMeses } from '../src/modules/availability/fechas.js';

let app: INestApplication;
let prisma: PrismaClient;
let token: string;

const http = () => request(app.getHttpServer());
const admin = () => http().put('/admin/availability').set('Authorization', `Bearer ${token}`);

/** Mañana en Lima. Marcar en pasado da 422, así que los tests usan futuro. */
const dentroDe = (dias: number): string => {
  const d = new Date(`${hoyEnLima()}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

const ADMIN = { email: 'disponibilidad@jamesfilm.test', password: 'password-de-prueba-larga' };

/** Las únicas fuentes que siembra este fichero; nadie más las usa. */
const FUENTES_DEL_SPEC: string[] = ['calendario-libre', 'calendario-ocupado'];

beforeAll(async () => {
  prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  await prisma.$connect();

  await prisma.user.upsert({
    where: { email: ADMIN.email },
    update: { role: 'ADMIN', passwordHash: await hashPassword(ADMIN.password) },
    create: {
      email: ADMIN.email,
      name: 'Admin de prueba',
      role: 'ADMIN',
      passwordHash: await hashPassword(ADMIN.password),
    },
  });

  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication<NestExpressApplication>();
  configurarApp(app as NestExpressApplication);
  await app.init();

  const { body } = await http()
    .post('/auth/login')
    .send({ email: ADMIN.email, password: ADMIN.password })
    .expect(200);
  token = body.data.accessToken as string;
});

afterAll(async () => {
  await prisma.busyDay.deleteMany();
  /**
   * Y su usuario. Un test que deja filas envenena al siguiente: el del seed
   * cuenta usuarios entre sus dos pasadas, y con éste vivo veía **dos** donde
   * esperaba uno — un fallo que parecía del seed y era de aquí.
   */
  await prisma.user.deleteMany({ where: { email: ADMIN.email } });
  await prisma.whatsappClick.deleteMany({ where: { source: { in: FUENTES_DEL_SPEC } } });
  await app.close();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.busyDay.deleteMany();
  /**
   * Y los clics, que este fichero también siembra.
   *
   * `masPedidas` cuenta filas de `WhatsappClick` por fecha pedida, así que sin
   * esto la afirmación es sobre un contador ACUMULADO: a la tercera corrida
   * seguida decía 9 donde el test siembra 3. Se borra por `source` —como hacen
   * el resto de specs— y no la tabla entera: los ficheros van en serie, pero
   * un `deleteMany()` a pelo se llevaría por delante lo que siembre otro.
   */
  await prisma.whatsappClick.deleteMany({ where: { source: { in: FUENTES_DEL_SPEC } } });
});

describe('GET /availability · lo que ve la landing', () => {
  it('con la tabla vacía, todo está libre y `until` dice hasta dónde se sabe', async () => {
    const { body } = await http().get('/availability').expect(200);

    // Por defecto TODO está libre: se guarda la excepción, no la norma.
    expect(body.data.busy).toEqual([]);
    expect(body.data.until).toBe(masMeses(hoyEnLima(), 12));
  });

  it('NUNCA lleva la nota ni el id: es un dato de un cliente sin permiso', async () => {
    await admin().send({ dates: [dentroDe(5)], busy: true, note: 'Boda de Rosa · Huanta' }).expect(200);

    const { body } = await http().get('/availability').expect(200);
    const crudo = JSON.stringify(body);

    expect(body.data.busy).toEqual([dentroDe(5)]);
    // Ley 29733: en la web un día ocupado dice «ocupado» y nada más.
    expect(crudo).not.toContain('Rosa');
    expect(crudo).not.toContain('Huanta');
    expect(body.data.busy[0]).toBe(dentroDe(5));
  });

  it('un día más allá de la ventana de 12 meses no aparece', async () => {
    const lejos = masMeses(hoyEnLima(), 14);
    await admin().send({ dates: [lejos], busy: true }).expect(200);

    const { body } = await http().get('/availability').expect(200);
    expect(body.data.busy).not.toContain(lejos);
  });

  it('es público: el visitante de la landing no tiene sesión', async () => {
    await http().get('/availability').expect(200);
  });
});

describe('PUT /admin/availability', () => {
  it('marcar dos veces las mismas fechas deja UNA fila por día', async () => {
    const f = [dentroDe(10), dentroDe(11)];
    await admin().send({ dates: f, busy: true }).expect(200);
    await admin().send({ dates: f, busy: true }).expect(200);

    expect(await prisma.busyDay.count()).toBe(2);
  });

  it('marcar varias fechas de una vez las mete en el MISMO grupo', async () => {
    // «24 y 25 de octubre» es UNA boda, no dos días sueltos.
    await admin().send({ dates: [dentroDe(20), dentroDe(21)], busy: true }).expect(200);

    const filas = await prisma.busyDay.findMany({ select: { groupId: true } });
    expect(filas).toHaveLength(2);
    expect(filas[0]!.groupId).toBe(filas[1]!.groupId);
    expect(filas[0]!.groupId).not.toBeNull();
  });

  it('marcarlas en DOS llamadas deja grupos DISTINTOS', async () => {
    // Son dos decisiones distintas, y el sistema no debe adivinar que iban
    // juntas: un sábado de boda seguido de un domingo de cumpleaños es real.
    await admin().send({ dates: [dentroDe(30)], busy: true }).expect(200);
    await admin().send({ dates: [dentroDe(31)], busy: true }).expect(200);

    const filas = await prisma.busyDay.findMany({ orderBy: { date: 'asc' } });
    expect(filas[0]!.groupId).not.toBe(filas[1]!.groupId);
  });

  it('desmarcar lo que no existía responde 200, no 404', async () => {
    await admin().send({ dates: [dentroDe(99)], busy: false }).expect(200);
  });

  it('desmarcar el día del medio de un grupo de tres no rompe nada', async () => {
    const f = [dentroDe(40), dentroDe(41), dentroDe(42)];
    await admin().send({ dates: f, busy: true }).expect(200);
    await admin().send({ dates: [f[1]!], busy: false }).expect(200);

    const filas = await prisma.busyDay.findMany({ orderBy: { date: 'asc' } });
    expect(filas.map((x) => x.date.toISOString().slice(0, 10))).toEqual([f[0], f[2]]);
    // Siguen compartiendo grupo: se pintan como dos bloques y no hay nada que
    // reparar. Por eso el grupo es una etiqueta y no un rango.
    expect(filas[0]!.groupId).toBe(filas[1]!.groupId);
  });

  it('367 fechas dan 422 con su `details`, no una denegación de servicio gratis', async () => {
    const muchas = Array.from({ length: 367 }, (_, i) => dentroDe(i + 1));
    const { body } = await admin().send({ dates: muchas, busy: true }).expect(422);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(body.details?.length).toBeGreaterThan(0);
  });

  it('marcar una fecha pasada da 422, no 500', async () => {
    const { body } = await admin().send({ dates: [dentroDe(-3)], busy: true }).expect(422);
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  it('DESMARCAR una fecha pasada da 200: un día mal puesto se tiene que poder quitar', async () => {
    // La regla ingenua «pasado → 422» dejaría un error de arrastre ahí para
    // siempre, y equivocarse arrastrando es justo lo que va a pasar.
    await prisma.busyDay.create({ data: { date: new Date(`${dentroDe(-5)}T00:00:00.000Z`) } });
    await admin().send({ dates: [dentroDe(-5)], busy: false }).expect(200);
    expect(await prisma.busyDay.count()).toBe(0);
  });

  it('exige sesión', async () => {
    await http().put('/admin/availability').send({ dates: [dentroDe(1)], busy: true }).expect(401);
  });
});

describe('GET /admin/availability/summary · la pantalla de una sola petición', () => {
  const resumen = () =>
    http().get('/admin/availability/summary').set('Authorization', `Bearer ${token}`);

  it('exige sesión: lleva notas privadas de clientes', async () => {
    await http().get('/admin/availability/summary').expect(401);
  });

  it('las próximas van agrupadas: «24 y 25» es UNA reserva, no dos', async () => {
    await admin()
      .send({ dates: [dentroDe(10), dentroDe(11)], busy: true, note: 'Boda de Ana' })
      .expect(200);

    const { body } = await resumen().expect(200);
    expect(body.data.proximas).toHaveLength(1);
    expect(body.data.proximas[0]).toMatchObject({
      from: dentroDe(10),
      to: dentroDe(11),
      note: 'Boda de Ana',
    });
  });

  it('una reserva que ya pasó NO está en «próximas»', async () => {
    // En pasado no se puede marcar por la API, y hace bien: se siembra directo.
    await prisma.busyDay.create({
      data: { date: new Date(`${dentroDe(-20)}T00:00:00.000Z`), groupId: 'g-vieja' },
    });
    const { body } = await resumen().expect(200);
    expect(body.data.proximas).toHaveLength(0);
  });

  /**
   * El dato que James no tiene en ninguna otra parte: grabó y no publicó.
   */
  it('un día ocupado que ya pasó y sin galería sale en «sinGaleria»', async () => {
    await prisma.busyDay.create({
      data: { date: new Date(`${dentroDe(-15)}T00:00:00.000Z`), groupId: 'g-sin' },
    });
    const { body } = await resumen().expect(200);
    expect(body.data.sinGaleria.map((r: { from: string }) => r.from)).toContain(dentroDe(-15));
  });

  it('y deja de salir en cuanto hay una galería con esa fecha', async () => {
    const categoria = await prisma.category.findFirstOrThrow();
    await prisma.busyDay.create({
      data: { date: new Date(`${dentroDe(-15)}T00:00:00.000Z`), groupId: 'g-con' },
    });
    const galeria = await prisma.gallery.create({
      data: {
        slug: `resumen-cubierta-${Date.now()}`,
        title: 'Cubierta',
        categoryId: categoria.id,
        eventDate: new Date(`${dentroDe(-15)}T00:00:00.000Z`),
      },
    });

    const { body } = await resumen().expect(200);
    expect(body.data.sinGaleria.map((r: { from: string }) => r.from)).not.toContain(dentroDe(-15));

    await prisma.gallery.delete({ where: { id: galeria.id } });
  });

  /**
   * Una boda de dos días con la galería puesta en el PRIMERO: la reserva entera
   * cuenta como publicada. Con la comparación por día exacto, el segundo día
   * habría salido como trabajo sin publicar.
   */
  it('la galería del primer día cubre la reserva entera', async () => {
    const categoria = await prisma.category.findFirstOrThrow();
    await prisma.busyDay.createMany({
      data: [
        { date: new Date(`${dentroDe(-16)}T00:00:00.000Z`), groupId: 'g-boda' },
        { date: new Date(`${dentroDe(-15)}T00:00:00.000Z`), groupId: 'g-boda' },
      ],
    });
    const galeria = await prisma.gallery.create({
      data: {
        slug: `resumen-boda-${Date.now()}`,
        title: 'Boda de dos días',
        categoryId: categoria.id,
        eventDate: new Date(`${dentroDe(-16)}T00:00:00.000Z`),
      },
    });

    const { body } = await resumen().expect(200);
    expect(body.data.sinGaleria).toHaveLength(0);

    await prisma.gallery.delete({ where: { id: galeria.id } });
  });

  it('los sábados se cuentan por mes y desde HOY, y marcar uno lo resta', async () => {
    const { body: antes } = await resumen().expect(200);
    expect(antes.data.sabados).toHaveLength(3);
    const [primero] = antes.data.sabados;
    expect(primero.free).toBeLessThanOrEqual(primero.total);

    // El próximo sábado que caiga dentro del primer mes del resumen.
    let sabado: string | null = null;
    for (let i = 1; i <= 28 && sabado === null; i++) {
      const iso = dentroDe(i);
      if (new Date(`${iso}T00:00:00.000Z`).getUTCDay() !== 6) continue;
      if (iso.slice(0, 7) !== hoyEnLima().slice(0, 7)) break;
      sabado = iso;
    }
    if (sabado === null) return; // fin de mes sin sábados por delante: nada que medir

    await admin().send({ dates: [sabado], busy: true }).expect(200);
    const { body: despues } = await resumen().expect(200);
    expect(despues.data.sabados[0].free).toBe(primero.free - 1);
    expect(despues.data.sabados[0].total).toBe(primero.total);
  });

  it('las MÁS PEDIDAS salen ordenadas y dicen si ese día está cogido', async () => {
    const cogido = dentroDe(12);
    const libre = dentroDe(13);
    await admin().send({ dates: [cogido], busy: true }).expect(200);

    for (let i = 0; i < 3; i++) {
      await http()
        .post('/track/whatsapp')
        .send({ source: 'calendario-ocupado', requestedDate: cogido })
        .expect(204);
    }
    await http()
      .post('/track/whatsapp')
      .send({ source: 'calendario-libre', requestedDate: libre })
      .expect(204);

    const { body } = await resumen().expect(200);
    const top = body.data.masPedidas as { date: string; count: number; busy: boolean }[];
    expect(top[0]).toMatchObject({ date: cogido, count: 3, busy: true });
    expect(top.find((d) => d.date === libre)).toMatchObject({ count: 1, busy: false });
  });

  it('separa los clics del día libre de los del ocupado', async () => {
    await http().post('/track/whatsapp').send({ source: 'calendario-libre' }).expect(204);
    await http().post('/track/whatsapp').send({ source: 'calendario-ocupado' }).expect(204);
    await http().post('/track/whatsapp').send({ source: 'calendario-ocupado' }).expect(204);

    const { body } = await resumen().expect(200);
    expect(body.data.clicks.free).toBeGreaterThanOrEqual(1);
    expect(body.data.clicks.busy).toBeGreaterThanOrEqual(2);
  });
});

describe('la zona horaria, que es donde se cuela todo', () => {
  it('a las 20:00 de Lima, `hoyEnLima` sigue siendo HOY y no mañana', () => {
    // 2026-10-24 20:00 en Lima son las 01:00 UTC del 25. Con `new Date()` a
    // secas, marcar «hoy» a esa hora daría 422 por fecha pasada.
    const veinteHorasLima = new Date('2026-10-25T01:00:00.000Z');
    expect(hoyEnLima(veinteHorasLima)).toBe('2026-10-24');
  });

  it('`until` no se desplaza un día por la hora del servidor', async () => {
    const servicio = app.get(AvailabilityService);
    const tarde = await servicio.publica(new Date('2026-10-25T01:00:00.000Z'));
    const manana = await servicio.publica(new Date('2026-10-24T14:00:00.000Z'));
    expect(tarde.until).toBe(manana.until);
    expect(tarde.until).toBe('2027-10-24');
  });
});

describe('agrupar · una boda de dos días es UNA reserva', () => {
  it('colapsa por grupo y deja los sueltos como reservas de un día', () => {
    const servicio = app.get(AvailabilityService);
    const reservas = servicio.agrupar([
      { date: '2026-10-24', note: 'Boda', groupId: 'g1' },
      { date: '2026-10-25', note: 'Boda', groupId: 'g1' },
      { date: '2026-11-02', note: null, groupId: null },
    ]);

    expect(reservas).toHaveLength(2);
    expect(reservas[0]).toEqual({ id: 'g1', from: '2026-10-24', to: '2026-10-25', note: 'Boda' });
    expect(reservas[1]!.from).toBe('2026-11-02');
  });
});
