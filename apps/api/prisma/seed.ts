/**
 * Seed con los datos reales del flyer (docs/preview.webp, §14).
 *
 * IDEMPOTENTE: se ejecuta en local, en cada branch de CI y una vez en producción.
 * Todo va por `upsert` sobre una clave natural; correrlo dos veces no duplica nada.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/common/hash.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// "XV Años" y "Quinceañeras" del flyer son la misma categoría (ver CLAUDE.md).
const CATEGORIAS = [
  { slug: 'bodas', name: 'Bodas', order: 0 },
  { slug: 'xv-anos', name: 'XV Años', order: 1 },
  { slug: 'cumpleanos', name: 'Cumpleaños', order: 2 },
  { slug: 'eventos', name: 'Eventos', order: 3 },
];

// priceAmount en CÉNTIMOS. accentColor se guarda pero la web v1 no lo consume (§6).
const PAQUETES = [
  {
    slug: 'basico',
    name: 'BÁSICO',
    subtitle: 'Viral Highlights',
    priceAmount: 30_000,
    idealFor: 'Pequeños eventos, cumpleaños',
    icon: 'clapperboard',
    accentColor: '#C9A96A',
    badgeText: null,
    isHighlighted: false,
    order: 0,
    whatsappMessage: 'Hola James, me interesa el paquete Básico para mi evento',
    categorias: ['cumpleanos', 'eventos'],
    items: [
      'Cobertura: 3 - 4 horas',
      '7 Reels / TikToks en tendencia',
      'Cortes dinámicos y ganchos (Hooks)',
      'Entrega rápida: 24h - 48h',
      'Material bruto incluido',
    ],
  },
  {
    slug: 'pro',
    name: 'PRO',
    subtitle: 'Memorias & Tendencias',
    priceAmount: 60_000,
    idealFor: 'Quinceañeras, Cumpleaños grandes',
    icon: 'trending-up',
    accentColor: '#22D3EE',
    badgeText: 'NUESTRO MÁS VENDIDO',
    isHighlighted: true,
    order: 1,
    whatsappMessage: 'Hola James, me interesa el paquete Pro para mi evento',
    categorias: ['xv-anos', 'cumpleanos'],
    items: [
      'Cobertura: 6 - 7 horas',
      '7 Reels / TikToks Virales',
      '1 Video Resumen "Aftermovie" (1-2 min)',
      '1 Mini-Reel expres (Same Day Edit / 12h)',
      'Edición ágil, textos dinámicos, música trending',
      'Material bruto en alta calidad',
    ],
  },
  {
    slug: 'premium',
    name: 'PREMIUM',
    subtitle: 'La Alfombra Roja / Experiencia Viral',
    priceAmount: 90_000,
    idealFor: 'Bodas, XV años',
    icon: 'crown',
    accentColor: '#E879F9',
    badgeText: null,
    isHighlighted: false,
    order: 2,
    whatsappMessage: 'Hola James, me interesa el paquete Premium para mi boda',
    categorias: ['bodas', 'xv-anos'],
    items: [
      'Cobertura completa: hasta 10 horas',
      '7 Reels / TikToks Virales',
      '1 Video Resumen "Aftermovie" (2-3 min)',
      'Entrega Express (Reels en 24h)',
      'Entrevistas y tomas estéticas',
    ],
  },
];

// Iconos de la lista cerrada de lucide (CLAUDE.md): un typo dejaría un hueco en la web.
const DIFERENCIADORES = [
  { title: 'CALIDAD PROFESIONAL', icon: 'camera', order: 0 },
  { title: 'ENTREGA RÁPIDA', icon: 'zap', order: 1 },
  { title: 'CONTENIDO QUE CONECTA', icon: 'users', order: 2 },
  { title: 'RESULTADOS REALES', icon: 'bar-chart-3', order: 3 },
];

// La url va completa, no se arma desde el handle: cada red tiene su formato (§12).
const REDES = [
  { platform: 'tiktok', handle: '@james_film', url: 'https://www.tiktok.com/@james_film', order: 0 },
  { platform: 'instagram', handle: 'James_film30', url: 'https://www.instagram.com/james_film30', order: 1 },
];

// Markdown: el resaltado dorado del flyer. En texto plano el bloque queda sin personalidad (§14).
const ABOUT_TEXT = [
  '¡Hola! Soy **James**, creador de contenido audiovisual.',
  'Me especializo en capturar y contar historias que conectan, inspiran y venden.',
  'Llevo tu evento al siguiente nivel con videos profesionales y **contenido que genera impacto**.',
].join(' ');

const AJUSTES = {
  brandName: 'James Film',
  role: 'CREADOR DE CONTENIDO',
  tagline: 'Transformo momentos en historias',
  slogan: 'CREA. CAPTURA. IMPACTA.',
  aboutText: ABOUT_TEXT,
  whatsappNumber: '51994724944', // internacional SIN el +, listo para wa.me/ (§8)
  whatsappDisplay: '994 724 944',
  whatsappMessage: 'Hola James, me interesa contratar tus servicios',
  ctaText: '¡HABLEMOS DE TU EVENTO!',
  footerTagline: 'HISTORIAS REALES. EMOCIONES REALES. RECUERDOS PARA SIEMPRE.',
  metaTitle: 'James Film · Creador de contenido audiovisual',
  metaDescription: 'Reels y aftermovies para bodas, XV años y eventos en Ayacucho.',
};

/**
 * `update: {}` en todo el CONTENIDO, y no es un descuido: el trabajo del seed es
 * **crear** el estado inicial, no mantenerlo sincronizado. Desde que existe el
 * admin, la fuente de verdad del contenido es lo que escribe James.
 *
 * Con el objeto entero en `update`, y sabiendo que este seed corre también en
 * producción, el siguiente despliegue le devolvía los precios, las redes, el
 * `aboutText` y **el número de WhatsApp** a los valores del flyer. Sin error y
 * sin log: nada lo habría relacionado con el deploy.
 *
 * Es el mismo principio que ya se aplicaba al usuario más abajo —el seed no
 * debe poder degradar una credencial real— extendido al contenido.
 *
 * `SEED_RESET=true` restaura los valores del flyer. Explícito y para local:
 * nunca en el comando de producción.
 */
const RESET = process.env.SEED_RESET === 'true';

async function main(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('Faltan SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD');
  }

  for (const c of CATEGORIAS) {
    await prisma.category.upsert({ where: { slug: c.slug }, update: RESET ? c : {}, create: c });
  }

  for (const p of PAQUETES) {
    const { items, categorias, ...datos } = p;
    const paquete = await prisma.package.upsert({
      where: { slug: datos.slug },
      update: RESET ? datos : {},
      create: datos,
      select: { id: true, _count: { select: { items: true } } },
    });

    // Los bullets son texto libre y no tienen clave natural, así que se
    // reemplazan enteros — pero SOLO si el paquete no tiene ninguno. Hacerlo
    // siempre borraba los que hubiera editado James.
    if (paquete._count.items === 0 || RESET) {
      await prisma.packageItem.deleteMany({ where: { packageId: paquete.id } });
      await prisma.packageItem.createMany({
        data: items.map((text, order) => ({ packageId: paquete.id, text, order })),
      });
    }

    for (const slug of categorias) {
      const categoria = await prisma.category.findUniqueOrThrow({ where: { slug } });
      await prisma.packageCategory.upsert({
        where: { packageId_categoryId: { packageId: paquete.id, categoryId: categoria.id } },
        update: {},
        create: { packageId: paquete.id, categoryId: categoria.id },
      });
    }
  }

  for (const d of DIFERENCIADORES) {
    await prisma.differentiator.upsert({
      where: { title: d.title },
      update: RESET ? d : {},
      create: d,
    });
  }

  for (const r of REDES) {
    await prisma.socialLink.upsert({
      where: { platform: r.platform },
      update: RESET ? r : {},
      create: r,
    });
  }

  await prisma.siteSettings.upsert({
    where: { id: 'singleton' },
    update: RESET ? AJUSTES : {},
    create: { id: 'singleton', ...AJUSTES },
  });

  // La barra de publicación de §9 lee este singleton desde el primer arranque.
  await prisma.deployState.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  });

  // `update: {}` a propósito: si el usuario ya existe, NO se le pisa la contraseña
  // con la del entorno. El seed no debe poder degradar una credencial real.
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: 'James',
      role: 'ADMIN',
      passwordHash: await hashPassword(password),
    },
  });

  console.log(RESET ? 'Seed listo (RESET: contenido restaurado).' : 'Seed listo.');
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
