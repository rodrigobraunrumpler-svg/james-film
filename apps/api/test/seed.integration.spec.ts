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
      // 5 + 6 + 7, las viñetas del flyer. Se quedó en 16 cuando se corrigieron
      // los datos de los paquetes contra el flyer y nadie movió la cuenta.
      items: 18,
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
    // Se borra la fila ANTES, y no es cosmética: desde que existe el
    // `TriggerDeployInterceptor`, cada mutación de los otros ficheros de la
    // suite incrementa `pendingChanges` sobre esta misma base. Sin el borrado
    // este test leía 241 y afirmaba 0 — una afirmación sobre los DATOS, no
    // sobre el seed. Lo que se prueba es qué CREA el seed, así que la fila
    // tiene que no existir cuando corre.
    await prisma.deployState.deleteMany({ where: { id: 'singleton' } });

    correrSeed();

    const d = await prisma.deployState.findUniqueOrThrow({ where: { id: 'singleton' } });
    expect(d.pendingChanges).toBe(0);
    expect(d.status).toBe('IDLE');
  });
});

describe('el seed NO pisa lo que escribe James', () => {
  /**
   * El fallo que este bloque existe para que no vuelva: con el objeto entero en
   * `update`, y sabiendo que el seed corre también en producción, el siguiente
   * despliegue le devolvía los precios, las redes y el número de WhatsApp a los
   * valores del flyer. Sin error y sin log.
   */
  it('conserva un precio editado a mano', async () => {
    correrSeed();
    const antes = await prisma.package.findFirstOrThrow({ select: { id: true, slug: true } });
    await prisma.package.update({ where: { id: antes.id }, data: { priceAmount: 99_900 } });

    correrSeed();

    const despues = await prisma.package.findUniqueOrThrow({ where: { id: antes.id } });
    expect(despues.priceAmount).toBe(99_900);
  });

  it('conserva los ajustes del sitio, incluido el número de WhatsApp', async () => {
    correrSeed();
    await prisma.siteSettings.update({
      where: { id: 'singleton' },
      data: { whatsappNumber: '51999888777', aboutText: 'Lo reescribió James' },
    });

    correrSeed();

    const ajustes = await prisma.siteSettings.findUniqueOrThrow({ where: { id: 'singleton' } });
    expect(ajustes.whatsappNumber).toBe('51999888777');
    expect(ajustes.aboutText).toBe('Lo reescribió James');
  });

  it('conserva los bullets de un paquete, y no los duplica', async () => {
    correrSeed();
    const paquete = await prisma.package.findFirstOrThrow({
      select: { id: true, _count: { select: { items: true } } },
    });
    const item = await prisma.packageItem.findFirstOrThrow({ where: { packageId: paquete.id } });
    await prisma.packageItem.update({ where: { id: item.id }, data: { text: 'Texto de James' } });

    correrSeed();

    const despues = await prisma.packageItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(despues.text).toBe('Texto de James');
    // Y sin duplicar: el reemplazo entero solo corre cuando no había ninguno.
    const cuantos = await prisma.packageItem.count({ where: { packageId: paquete.id } });
    expect(cuantos).toBe(paquete._count.items);
  });

  it('conserva una red social editada', async () => {
    correrSeed();
    await prisma.socialLink.updateMany({ where: {}, data: { handle: 'otro_handle' } });

    correrSeed();

    const redes = await prisma.socialLink.findMany({ select: { handle: true } });
    expect(redes.every((r) => r.handle === 'otro_handle')).toBe(true);
  });

  it('SEED_RESET=true sí restaura los valores del flyer', async () => {
    correrSeed();
    await prisma.siteSettings.update({
      where: { id: 'singleton' },
      data: { whatsappNumber: '51000000000' },
    });

    execSync('pnpm exec dotenv -e .env.test -- tsx prisma/seed.ts', {
      cwd: new URL('..', import.meta.url).pathname,
      stdio: 'pipe',
      env: { ...process.env, SEED_RESET: 'true' },
    });

    const ajustes = await prisma.siteSettings.findUniqueOrThrow({ where: { id: 'singleton' } });
    expect(ajustes.whatsappNumber).not.toBe('51000000000');
  });
});
