import { execSync } from 'node:child_process';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

let prisma: PrismaClient;

const correrSeed = () =>
  execSync('pnpm exec dotenv -e .env.test -- tsx prisma/seed.ts', {
    cwd: new URL('..', import.meta.url).pathname,
    stdio: 'pipe',
  });

const contar = async () => ({
  categorias: await prisma.category.count(),
  paquetes: await prisma.package.count(),
  items: await prisma.packageItem.count(),
  vinculos: await prisma.packageCategory.count(),
  diferenciadores: await prisma.differentiator.count(),
  redes: await prisma.socialLink.count(),
  usuarios: await prisma.user.count(),
});

beforeAll(async () => {
  prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('seed', () => {
  it('es idempotente: dos ejecuciones dejan los mismos datos', async () => {
    correrSeed();
    const primera = await contar();

    correrSeed();
    const segunda = await contar();

    expect(segunda).toEqual(primera);
    expect(primera).toEqual({
      categorias: 4,
      paquetes: 3,
      items: 16,
      vinculos: 6,
      diferenciadores: 4,
      redes: 2,
      usuarios: 1,
    });
  });

  it('carga los precios en céntimos y el destacado es único', async () => {
    correrSeed();

    const pro = await prisma.package.findUniqueOrThrow({ where: { slug: 'pro' } });
    expect(pro.priceAmount).toBe(60000);
    expect(pro.badgeText).toBe('NUESTRO MÁS VENDIDO');

    expect(await prisma.package.count({ where: { isHighlighted: true } })).toBe(1);
  });

  it('el WhatsApp lleva prefijo de país y el aboutText conserva el Markdown', async () => {
    correrSeed();

    const s = await prisma.siteSettings.findUniqueOrThrow({ where: { id: 'singleton' } });
    expect(s.whatsappNumber).toBe('51994724944');
    // El resaltado dorado del flyer: si se pierde, el bloque queda plano (§14)
    expect(s.aboutText).toContain('**James**');
    expect(s.aboutText).toContain('**contenido que genera impacto**');
  });

  it('la contraseña del admin se guarda con argon2id, nunca en claro', async () => {
    correrSeed();

    const u = await prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' } });
    expect(u.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(u.passwordHash).not.toContain(process.env.SEED_ADMIN_PASSWORD!);
  });

  it('deja el singleton de DeployState listo para la barra de publicación', async () => {
    correrSeed();

    const d = await prisma.deployState.findUniqueOrThrow({ where: { id: 'singleton' } });
    expect(d.pendingChanges).toBe(0);
    expect(d.status).toBe('IDLE');
  });
});
