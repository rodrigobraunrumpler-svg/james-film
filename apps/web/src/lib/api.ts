/**
 * El cliente de la API, SOLO para el build.
 *
 * El navegador no habla con la API salvo para registrar el clic a WhatsApp:
 * todo lo demás se pide aquí, en tiempo de build, y queda horneado en el HTML.
 * Cero servidor y cero base de datos en runtime.
 *
 * Está tipado con `@james-film/contracts`, así que **si la API cambia el
 * contrato, el build no compila** — que es exactamente cuando hay que
 * enterarse, no cuando la web ya está publicada con un hueco.
 */
import type {
  AvailabilityDto,
  ApiResponse,
  CategoryDto,
  DifferentiatorDto,
  GalleryDto,
  GalleryListItemDto,
  PackageDto,
  SiteSettingsDto,
  SocialLinkDto,
  TestimonialDto,
} from '@james-film/contracts';

const BASE = import.meta.env.PUBLIC_API_URL ?? 'http://localhost:3000';

/**
 * Un fallo aquí ABORTA el build, y el mensaje NOMBRA el endpoint.
 *
 * Es la regla del proyecto —«un deploy fallido es mejor que uno vacío»— y el
 * nombre del endpoint es lo que la hace útil: sin él, «build failed» obliga a
 * ir servicio por servicio. La causa real casi siempre es la misma en local
 * (la API no está levantada) y en producción (Neon arrancando en frío).
 */
class ErrorDeBuild extends Error {
  constructor(ruta: string, detalle: string) {
    super(
      `No se pudo construir la web: ${detalle}\n` +
        `  Endpoint:  GET ${BASE}${ruta}\n` +
        `  Qué mirar: que la API esté levantada y que PUBLIC_API_URL apunte a ella.`,
    );
    this.name = 'ErrorDeBuild';
  }
}

async function pedir<T>(ruta: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${ruta}`);
  } catch (e) {
    // Sin este `catch`, un `fetch` que no conecta lanza un `TypeError` pelado
    // que no menciona ni la ruta ni la variable de entorno.
    const causa = e instanceof Error ? e.message : String(e);
    throw new ErrorDeBuild(ruta, `la API no responde (${causa})`);
  }
  if (!res.ok) throw new ErrorDeBuild(ruta, `respondió ${res.status} ${res.statusText}`);

  const sobre = (await res.json()) as ApiResponse<T>;
  if (!sobre.success) throw new ErrorDeBuild(ruta, `${sobre.code}: ${sobre.message}`);
  return sobre.data;
}

/**
 * Lo que la landing NO PUEDE construir sin ello.
 *
 * `whatsappNumber` es opcional en el DTO —James puede vaciarlo desde el panel—
 * y **una landing sin número de WhatsApp es una landing sin negocio**: el clic
 * ES el lead, así que sin número no hay ninguna conversión posible. Publicarla
 * así es peor que no publicar.
 *
 * Lo demás tiene respaldo razonable y no aborta: sin `tagline` se usa el nombre
 * de la marca, sin `ctaText` un texto por defecto.
 */
export interface AjustesUsables extends Omit<SiteSettingsDto, 'whatsappNumber' | 'tagline'> {
  whatsappNumber: string;
  tagline: string;
}

function exigirLoImprescindible(a: SiteSettingsDto): AjustesUsables {
  if (!a.whatsappNumber?.trim()) {
    throw new ErrorDeBuild(
      '/settings',
      'no hay número de WhatsApp. Es la única conversión de la web: sin él, ' +
        'la landing no puede hacer su trabajo.\n' +
        '  Cómo se arregla: Configuración → Contacto y redes → Número de WhatsApp.',
    );
  }
  return { ...a, whatsappNumber: a.whatsappNumber.trim(), tagline: a.tagline ?? a.brandName };
}

export const api = {
  ajustes: async () => exigirLoImprescindible(await pedir<SiteSettingsDto>('/settings')),
  categorias: () => pedir<CategoryDto[]>('/categories'),
  paquetes: () => pedir<PackageDto[]>('/packages'),
  testimonios: () => pedir<TestimonialDto[]>('/testimonials'),
  diferenciadores: () => pedir<DifferentiatorDto[]>('/differentiators'),
  redes: () => pedir<SocialLinkDto[]>('/social-links'),
  /**
   * `GalleryListItemDto`, el PÚBLICO — nunca el de admin. El de admin lleva
   * `isPublished`, que aquí siempre valdría `true` (el controller filtra) y
   * que se colaría en la web al añadir un campo. Ya pasó una vez en la API.
   *
   * NO trae los medios: solo portada y recuento. Si los trajera, el build se
   * descargaría todos los reels de todos los eventos en una respuesta que
   * crece sin techo con cada boda.
   */
  galerias: () => pedir<GalleryListItemDto[]>('/galleries'),
  /** El detalle sí los trae. Uno por página, en `getStaticPaths`. */
  galeria: (slug: string) => pedir<GalleryDto>(`/galleries/${slug}`),
  /**
   * Los días ocupados, horneados en el build. No se pide desde el navegador:
   * en Render free la API duerme a los 15 minutos y el calendario se quedaría
   * cargando medio minuto justo cuando alguien lo mira. Frescura que tarda
   * treinta segundos en aparecer no es frescura.
   */
  disponibilidad: () => pedir<AvailabilityDto>('/availability'),
};

/**
 * Todo lo que la portada necesita, en paralelo.
 *
 * En serie serían siete viajes encadenados por cada build; en paralelo es uno.
 * Y si cualquiera falla, aborta el build entero con SU nombre.
 */
export async function datosDePortada() {
  const [
    ajustes,
    categorias,
    paquetes,
    testimonios,
    diferenciadores,
    redes,
    galerias,
    disponibilidad,
  ] =
    await Promise.all([
      api.ajustes(),
      api.categorias(),
      api.paquetes(),
      api.testimonios(),
      api.diferenciadores(),
      api.redes(),
      api.galerias(),
      api.disponibilidad(),
    ]);
  return {
    ajustes,
    categorias,
    paquetes,
    testimonios,
    diferenciadores,
    redes,
    galerias,
    disponibilidad,
  };
}
