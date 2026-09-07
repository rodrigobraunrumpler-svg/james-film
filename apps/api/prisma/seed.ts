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
/**
 * Los tres paquetes, **copiados del flyer, valor por valor**.
 *
 * Lo que había antes no coincidía: ponía 7 reels en los tres cuando el flyer
 * dice 4 · 6 · 7, le daba al Pro 6-7 horas donde el flyer dice 4-5, y le
 * inventaba un «Mini-Reel exprés (Same Day / 12h)» que no existe en ninguna
 * parte. La web publicaba una promesa que James no hace, y quien contratara el
 * Básico esperando siete reels iba a recibir cuatro.
 *
 * **La escalera es la CANTIDAD**: 4 → 6 → 7. Eso es lo que separa los tres, y
 * se lee solo sin que nadie lo explique.
 */
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
      '4 Reels / TikToks en tendencia',
      'Cortes dinámicos y ganchos (Hooks)',
      'Entrega rápida: 48h',
      'Material bruto incluido',
    ],
  },
  {
    slug: 'pro',
    name: 'PRO',
    subtitle: 'Memorias & Tendencias',
    priceAmount: 60_000,
    idealFor: 'Eventos medianos, XV años, bodas civiles',
    icon: 'trending-up',
    accentColor: '#22D3EE',
    badgeText: 'NUESTRO MÁS VENDIDO',
    isHighlighted: true,
    order: 1,
    whatsappMessage: 'Hola James, me interesa el paquete Pro para mi evento',
    categorias: ['xv-anos', 'cumpleanos'],
    items: [
      'Cobertura: 4 - 5 horas',
      '6 Reels / TikToks',
      '1 Video Resumen «Aftermovie» (1-2 min)',
      'Cortes dinámicos y ganchos (Hooks)',
      'Entrega rápida: 48h',
      'Material bruto incluido',
    ],
  },
  {
    slug: 'premium',
    name: 'PREMIUM',
    subtitle: 'La Alfombra Roja / Experiencia Viral',
    priceAmount: 90_000,
    idealFor: 'Bodas, XV años, eventos grandes',
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
      '1 Video Resumen «Aftermovie» (2-3 min)',
      'Entrega Express: Reels en 24h',
      'Entrevistas y tomas estéticas',
      'Material bruto en alta calidad',
      'Flyers para promoción del evento',
    ],
  },
];

// Iconos de la lista cerrada de lucide (CLAUDE.md): un typo dejaría un hueco en la web.
/**
 * Los cuatro del flyer, **con subtítulo**. Sin él la web pintaba cuatro cajas
 * con una etiqueta dentro y medio bento en blanco: el componente ya sabe pintar
 * `subtitle`, lo que faltaba era el dato.
 *
 * Y en frase, no en MAYÚSCULAS. En el flyer las capitales funcionan porque
 * compiten con fotos; en la web van justo debajo de «No es grabar. Es que se
 * vea.» y ahí se leen como etiquetas de un formulario, no como argumentos.
 *
 * Cada subtítulo dice algo COMPROBABLE. «Calidad profesional» es lo que dice
 * todo el mundo; «cámara, luz y audio propios» es lo que se puede desmentir.
 *
 * ⚠ El `upsert` de abajo usa el TÍTULO como clave natural, así que **renombrar
 * uno aquí no lo renombra: crea otro**. Al pasar estos cuatro de mayúsculas a
 * frase aparecieron ocho filas, y lo cazó el test de idempotencia del seed
 * contando diferenciadores. Si vuelves a cambiar un título, hay que renombrar
 * también las filas que ya existan.
 */
const DIFERENCIADORES = [
  {
    title: 'Calidad profesional',
    subtitle: 'Cámara, luz y audio propios. No dependo de lo que haya en el salón.',
    icon: 'camera',
    order: 0,
  },
  {
    title: 'Entrega rápida',
    subtitle: 'Grabo el sábado y el lunes ya lo estás subiendo.',
    icon: 'zap',
    order: 1,
  },
  {
    title: 'Contenido que conecta',
    subtitle: 'Cortes y ganchos pensados para que el dedo se pare.',
    icon: 'users',
    order: 2,
  },
  {
    title: 'Resultados reales',
    subtitle: 'Te llega listo para publicar. Tú no editas nada.',
    icon: 'bar-chart-3',
    order: 3,
  },
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

/**
 * Clics de ejemplo para que el panel tenga forma en local y en el E2E.
 *
 * Bandera propia y NO `SEED_RESET`: restaurar el contenido del flyer y
 * fabricar telemetría son cosas distintas, y esta segunda **nunca** puede
 * correr en producción — el clic a WhatsApp es la única métrica del negocio y
 * un solo clic inventado la deja sin valor. Por eso también se salta si ya hay
 * clics reales: un `db:seed` en el servidor equivocado no debe poder mezclar.
 */
const DEMO_CLICS = process.env.SEED_DEMO_CLICKS === 'true';

/**
 * Los 30 días del prototipo, de más antiguo a más reciente. Escritos y no
 * aleatorios: un `Math.random()` daría una gráfica distinta en cada corrida y
 * un test sobre ella no podría afirmar nada.
 */
const CLICS_POR_DIA = [
  1, 0, 2, 1, 3, 2, 1, 4, 2, 1, 0, 1, 3, 5, 2, 1, 2, 4, 3, 1, 2, 0, 1, 3, 2, 4, 3, 2, 5, 3,
];

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

  if (DEMO_CLICS) await sembrarClics();

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

/**
 * Reparte los clics entre los paquetes con el mismo peso que el prototipo
 * —Pro más que Básico, Premium el que menos— y deja una parte sin paquete,
 * que son los del hero y el pie.
 */
async function sembrarClics(): Promise<void> {
  const yaHay = await prisma.whatsappClick.count();
  if (yaHay > 0) {
    console.log('Ya hay clics registrados: no se siembran de ejemplo.');
    return;
  }

  const paquetes = await prisma.package.findMany({
    orderBy: { order: 'asc' },
    select: { id: true, slug: true },
  });
  // `null` = clic del hero o del pie, sin paquete que atribuir.
  const reparto: (string | null)[] = [];
  for (const p of paquetes) {
    const veces = p.slug.includes('pro') ? 4 : p.slug.includes('premium') ? 1 : 2;
    for (let i = 0; i < veces; i++) reparto.push(p.id);
  }
  reparto.push(null);

  const DIA = 86_400_000;
  const ahora = Date.now();
  const filas: { packageId: string | null; source: string; createdAt: Date }[] = [];

  let n = 0;
  CLICS_POR_DIA.forEach((cuantos, indice) => {
    // El último elemento del array es HOY: por eso el desfase se cuenta desde
    // el final. Al revés, la semana en latón del prototipo saldría al principio.
    const desfase = CLICS_POR_DIA.length - 1 - indice;
    for (let i = 0; i < cuantos; i++) {
      const packageId = reparto[n % reparto.length] ?? null;
      filas.push({
        packageId,
        source: packageId ? 'paquetes' : 'hero',
        // A media mañana en Lima: dentro del día en UTC y en `America/Lima`,
        // así la serie no se corre un día según dónde se formatee.
        createdAt: new Date(ahora - desfase * DIA - 12 * 3_600_000 + i * 60_000),
      });
      n++;
    }
  });

  await prisma.whatsappClick.createMany({ data: filas });
  console.log(`Sembrados ${filas.length} clics de ejemplo (SEED_DEMO_CLICKS).`);
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
