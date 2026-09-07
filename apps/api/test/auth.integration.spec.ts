import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configurarApp } from '../src/bootstrap.js';
import { PrismaClient } from '../src/generated/prisma/client.js';

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

const EMAIL = 'test@jamesfilm.local';
const PASSWORD = 'test-password';

let app: INestApplication;
let prisma: PrismaClient;

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

const http = () => request(app.getHttpServer());

async function login(password = PASSWORD): Promise<Tokens> {
  const res = await http().post('/auth/login').send({ email: EMAIL, password }).expect(200);
  return res.body.data as Tokens;
}

const refrescar = (refreshToken: string) => http().post('/auth/refresh').send({ refreshToken });

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
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.session.deleteMany();
});

describe('login', () => {
  it('devuelve un par de tokens y crea la sesión', async () => {
    const { accessToken, refreshToken } = await login();

    expect(accessToken.split('.')).toHaveLength(3); // JWT
    expect(refreshToken).toMatch(/^[0-9a-f]{64}$/); // 32 bytes en hex

    const sesion = await prisma.session.findFirstOrThrow();
    // El token viaja al cliente; en la base solo vive su hash.
    expect(sesion.tokenHash).toBe(sha256(refreshToken));
    expect(sesion.prevHash).toBeNull();
  });

  it('una contraseña incorrecta no revela si el email existe', async () => {
    const existe = await http().post('/auth/login').send({ email: EMAIL, password: 'mal' });
    const noExiste = await http()
      .post('/auth/login')
      .send({ email: 'nadie@x.com', password: 'mal' });

    expect(existe.status).toBe(401);
    expect(noExiste.status).toBe(401);
    expect(existe.body.code).toBe('INVALID_CREDENTIALS');
    expect(existe.body.message).toBe(noExiste.body.message);
  });

  it('el tiempo de respuesta tampoco lo revela', async () => {
    // Sin verificación señuelo, el email inexistente responde en ~1ms y el
    // existente gasta ~50ms en argon2: el reloj delata lo que el mensaje calla.
    const medir = async (email: string) => {
      const marcas: number[] = [];
      for (let i = 0; i < 5; i++) {
        const t = performance.now();
        await http().post('/auth/login').send({ email, password: 'mal' });
        marcas.push(performance.now() - t);
      }
      return marcas.sort((a, b) => a - b)[2]!; // mediana
    };

    const conUsuario = await medir(EMAIL);
    const sinUsuario = await medir('nadie@x.com');
    const proporcion = Math.max(conUsuario, sinUsuario) / Math.min(conUsuario, sinUsuario);

    expect(proporcion).toBeLessThan(3);
  });
});

describe('rotación del refresh', () => {
  it('rota: el token nuevo sirve y el anterior pasa a prevHash', async () => {
    const { refreshToken: t0 } = await login();
    const { body } = await refrescar(t0).expect(200);
    const t1 = (body.data as Tokens).refreshToken;

    expect(t1).not.toBe(t0);
    const sesion = await prisma.session.findFirstOrThrow();
    expect(sesion.tokenHash).toBe(sha256(t1));
    expect(sesion.prevHash).toBe(sha256(t0));
    expect(sesion.revokedAt).toBeNull();
  });

  it('VENTANA DE GRACIA: el anterior recién rotado se acepta y NO revoca', async () => {
    // Es el caso de dos invocaciones concurrentes de la pasarela en serverless,
    // donde no hay single-flight posible entre procesos.
    const { refreshToken: t0 } = await login();
    await refrescar(t0).expect(200);

    const segundo = await refrescar(t0).expect(200);
    expect((segundo.body.data as Tokens).refreshToken).toBeDefined();

    const sesion = await prisma.session.findFirstOrThrow();
    expect(sesion.revokedAt).toBeNull();
  });

  /**
   * El que llega tarde recibe SU MISMO token, no uno nuevo.
   *
   * Antes se le daba uno recién rotado, y por ahí se colaba el fallo que echaba
   * a James del panel: cada petición de la ráfaga minaba un token distinto y la
   * cadena solo puede recordar dos, así que los del medio quedaban huérfanos.
   *
   * Este test afirma la regla en su forma más pequeña. La ráfaga de verdad
   * —cuatro a la vez— está en el test de abajo; ésta la comprueba sin
   * concurrencia, que es lo que la hace legible cuando falle.
   */
  it('en la ventana de gracia NO se inventa un tercer token', async () => {
    const { refreshToken: t0 } = await login();

    const a = (await refrescar(t0).expect(200)).body.data as Tokens;
    expect(a.refreshToken, 'el primero sí rota: es el que llegó a tiempo').not.toBe(t0);

    const b = (await refrescar(t0).expect(200)).body.data as Tokens;
    expect(b.refreshToken, 'el que llega tarde tiene que recibir el suyo').toBe(t0);

    // Y los dos que quedan vivos son exactamente los dos que la fila recuerda.
    const sesion = await prisma.session.findFirstOrThrow();
    expect(sesion.tokenHash).toBe(sha256(a.refreshToken));
    expect(sesion.prevHash).toBe(sha256(t0));
  });

  /**
   * LA CARRERA DE VERDAD: CUATRO A LA VEZ, no dos seguidas.
   *
   * El test de arriba existía y pasaba, y aun así el fallo estuvo publicado:
   * dos `await` seguidos no son una carrera. Cada petición lee la fila DESPUÉS
   * de que la anterior la haya escrito, así que la cadena avanza ordenada y
   * nunca se bifurca.
   *
   * Lo que ocurre de verdad es esto: James abre el panel con el access token
   * recién caducado, la pantalla dispara varias consultas a la vez y salen
   * cuatro 401 simultáneos. Las cuatro refrescan con el MISMO token y las
   * cuatro leen la misma fila antes de que ninguna escriba.
   *
   * Con el código anterior, de los cuatro tokens emitidos **dos nacían
   * muertos** —ni `tokenHash` ni `prevHash`—, y la pasarela guardaba en la
   * cookie el de la respuesta que llegara última. Si le tocaba un muerto, el
   * siguiente 401 daba `SESSION_EXPIRED`, la cookie se borraba y James veía
   * «Tu sesión caducó» a los quince minutos de entrar, con un refresh token de
   * treinta días perfectamente bueno.
   *
   * Se afirma la propiedad que importa: **todo token que la API entrega, sirve**.
   * No cuántos se emiten —eso es un detalle de la implementación— sino que
   * ninguno nazca muerto. Se prueban en sesiones distintas porque usar uno
   * consume al otro, que es el comportamiento correcto.
   */
  it('CUATRO refrescos SIMULTÁNEOS: ningún token emitido nace muerto', async () => {
    for (const cual of ['rotado', 'sin rotar'] as const) {
      await prisma.session.deleteMany();
      const { refreshToken: t0 } = await login();

      const respuestas = await Promise.all([0, 1, 2, 3].map(() => refrescar(t0)));
      for (const r of respuestas) expect(r.status, 'un refresco de la ráfaga falló').toBe(200);

      const emitidos = respuestas.map((r) => (r.body.data as Tokens).refreshToken);
      const distintos = [...new Set(emitidos)];
      // Como mucho dos: el que rota el que gana, y el que ya tenían los demás.
      expect(distintos.length, `la ráfaga emitió ${distintos.length} tokens: ${distintos.length > 2 ? 'la cadena se bifurcó' : ''}`).toBeLessThanOrEqual(2);

      const rotado = distintos.find((t) => t !== t0);
      const aProbar = cual === 'rotado' ? rotado : t0;
      expect(aProbar, `no salió un token «${cual}» de la ráfaga`).toBeTruthy();
      const r = await refrescar(aProbar!);
      expect(r.status, `el token «${cual}» nació muerto: ${r.body?.code ?? ''}`).toBe(200);
    }
  });

  it('fuera de la ventana, el anterior SÍ es reuso y revoca la sesión', async () => {
    const { refreshToken: t0 } = await login();
    await refrescar(t0).expect(200);

    await prisma.session.updateMany({ data: { updatedAt: new Date(Date.now() - 300_000) } });

    const res = await refrescar(t0).expect(401);
    expect(res.body.code).toBe('SESSION_REVOKED');

    const sesion = await prisma.session.findFirstOrThrow();
    expect(sesion.revokedAt).not.toBeNull();
  });

  it('un token desconocido da 401 sin tocar ninguna sesión', async () => {
    await login();
    const res = await refrescar('a'.repeat(64)).expect(401);
    expect(res.body.code).toBe('SESSION_EXPIRED');
    expect(await prisma.session.count({ where: { revokedAt: null } })).toBe(1);
  });

  it('una sesión caducada no refresca', async () => {
    const { refreshToken } = await login();
    await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    await refrescar(refreshToken).expect(401);
  });
});

describe('logout y guardas', () => {
  it('logout revoca la sesión y su token deja de servir', async () => {
    const { refreshToken } = await login();
    await http().post('/auth/logout').send({ refreshToken }).expect(204);
    await refrescar(refreshToken).expect(401);
  });

  it('/auth/me sin token da 401 con código', async () => {
    const res = await http().get('/auth/me').expect(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('/auth/me con token devuelve el usuario SIN el hash de la contraseña', async () => {
    const { accessToken } = await login();
    const { body } = await http()
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(body.data).toMatchObject({ email: EMAIL, role: 'ADMIN' });
    expect(body.data).not.toHaveProperty('passwordHash');
  });

  it('un token manipulado no pasa', async () => {
    const { accessToken } = await login();
    const roto = `${accessToken.slice(0, -4)}xxxx`;
    await http().get('/auth/me').set('Authorization', `Bearer ${roto}`).expect(401);
  });
});
