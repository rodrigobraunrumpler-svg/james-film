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

const http = () => request(app.getHttpServer());

beforeAll(async () => {
  prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  await prisma.$connect();

  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication<NestExpressApplication>();
  configurarApp(app as NestExpressApplication);
  await app.init();
});

afterAll(async () => {
  await prisma.whatsappClick.deleteMany({ where: { source: 'galeria' } });
  await app.close();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.whatsappClick.deleteMany({ where: { source: 'galeria' } });
});

describe('POST /track/whatsapp', () => {
  it('es público: el visitante de la landing no tiene sesión', async () => {
    await http().post('/track/whatsapp').send({ source: 'galeria' }).expect(204);
    expect(await prisma.whatsappClick.count({ where: { source: 'galeria' } })).toBe(1);
  });

  it('un cuerpo vacío también cuenta: el clic es el dato, el resto es contexto', async () => {
    const antes = await prisma.whatsappClick.count();
    await http().post('/track/whatsapp').send({}).expect(204);
    expect(await prisma.whatsappClick.count()).toBe(antes + 1);
  });

  it('guarda el paquete cuando existe', async () => {
    const paquete = await prisma.package.findFirstOrThrow();
    await http()
      .post('/track/whatsapp')
      .send({ packageId: paquete.id, source: 'galeria' })
      .expect(204);

    const fila = await prisma.whatsappClick.findFirstOrThrow({ where: { source: 'galeria' } });
    expect(fila.packageId).toBe(paquete.id);
  });

  it('un packageId que ya no existe NO tumba el clic: se guarda sin atribución', async () => {
    // Escenario real: James borra un paquete después de que Astro generase la
    // página. Perder de qué paquete venía es barato; perder el clic no.
    await http()
      .post('/track/whatsapp')
      .send({ packageId: 'cl000000000000000000000000', source: 'galeria' })
      .expect(204);

    const fila = await prisma.whatsappClick.findFirstOrThrow({ where: { source: 'galeria' } });
    expect(fila.packageId).toBeNull();
  });

  /**
   * El dato que convierte «alguien preguntó por un día cogido» en «el 24 de
   * octubre te lo pidieron tres veces». La landing ya lo sabía y lo tiraba.
   */
  it('guarda QUÉ día preguntaba cuando viene del calendario', async () => {
    await http()
      .post('/track/whatsapp')
      .send({ source: 'calendario-ocupado', requestedDate: '2026-10-24' })
      .expect(204);

    const fila = await prisma.whatsappClick.findFirst({
      where: { source: 'calendario-ocupado' },
      orderBy: { createdAt: 'desc' },
    });
    // Medianoche UTC: es fecha de calendario. En Lima guardaría el día anterior.
    expect(fila?.requestedDate?.toISOString().slice(0, 10)).toBe('2026-10-24');
  });

  it('sin fecha se guarda en null: el hero no pregunta por ningún día', async () => {
    await http().post('/track/whatsapp').send({ source: 'hero' }).expect(204);
    const fila = await prisma.whatsappClick.findFirst({
      where: { source: 'hero' },
      orderBy: { createdAt: 'desc' },
    });
    expect(fila?.requestedDate).toBeNull();
  });

  /**
   * Se valida la FORMA y nada más. Este endpoint es público y el clic ES el
   * lead: rechazarlo por un dato accesorio cambiaría la única métrica del
   * negocio por un detalle. Pero de aquí sale un `@db.Date`, así que cualquier
   * cadena no puede entrar.
   */
  it('una fecha con formato inválido es 422, no un 500 al insertar', async () => {
    await http()
      .post('/track/whatsapp')
      .send({ source: 'calendario-libre', requestedDate: '24/10/2026' })
      .expect(422);
  });

  it('un source fuera de la lista cerrada es 422: un typo no agrupa nada', async () => {
    await http().post('/track/whatsapp').send({ source: 'inventado' }).expect(422);
  });

  it('rechaza campos que no están en el DTO', async () => {
    await http().post('/track/whatsapp').send({ source: 'galeria', userId: 'x' }).expect(422);
  });
});
