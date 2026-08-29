import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configurarApp } from '../src/bootstrap.js';
import { hashPassword } from '../src/common/hash.js';
import { PrismaClient } from '../src/generated/prisma/client.js';

let app: INestApplication;
let prisma: PrismaClient;

const http = () => request(app.getHttpServer());

const EDITOR = { email: 'editor@jamesfilm.test', password: 'editor-password-larga' };

const entrar = async (email: string, password: string): Promise<string> => {
  const { body } = await http().post('/auth/login').send({ email, password }).expect(200);
  return body.data.accessToken as string;
};

beforeAll(async () => {
  prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  await prisma.$connect();

  await prisma.user.upsert({
    where: { email: EDITOR.email },
    update: { role: 'EDITOR', passwordHash: await hashPassword(EDITOR.password) },
    create: {
      email: EDITOR.email,
      name: 'Editor de prueba',
      role: 'EDITOR',
      passwordHash: await hashPassword(EDITOR.password),
    },
  });

  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication<NestExpressApplication>();
  configurarApp(app as NestExpressApplication);
  await app.init();
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: EDITOR.email } });
  await app.close();
  await prisma.$disconnect();
});

/**
 * `@AdminController` aplica `@Roles('ADMIN')` una vez por controller. Antes de
 * él, `RolesGuard` estaba registrado como guard global pero **devolvía `true`
 * en todas las peticiones**, porque ningún controller declaraba `@Roles()`: era
 * maquinaria muerta con aspecto de protección.
 */
describe('@AdminController aplica el rol', () => {
  const RUTAS_ADMIN = [
    '/admin/galleries',
    '/admin/categories',
  ];

  it.each(RUTAS_ADMIN)('un EDITOR autenticado recibe 403 en %s', async (ruta) => {
    const token = await entrar(EDITOR.email, EDITOR.password);

    // 403 y no 401: la sesión es válida, lo que falta es el rol.
    await http().get(ruta).set({ Authorization: `Bearer ${token}` }).expect(403);
  });

  it.each(RUTAS_ADMIN)('un ADMIN sí entra en %s', async (ruta) => {
    const token = await entrar(
      process.env.SEED_ADMIN_EMAIL ?? '',
      process.env.SEED_ADMIN_PASSWORD ?? '',
    );

    await http().get(ruta).set({ Authorization: `Bearer ${token}` }).expect(200);
  });

  it('sin sesión sigue siendo 401, no 403', async () => {
    // El orden importa: primero se comprueba quién eres, luego qué puedes.
    await http().get('/admin/galleries').expect(401);
  });

  it('lo público sigue abierto: el rol no se ha filtrado a los controllers públicos', async () => {
    await http().get('/galleries').expect(200);
  });
});
