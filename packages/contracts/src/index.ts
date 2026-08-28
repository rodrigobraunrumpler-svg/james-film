/**
 * Contrato público entre la API y sus dos consumidores (admin y landing).
 *
 * ESTE PAQUETE NO EXPORTA NINGÚN VALOR DE RUNTIME: solo `type` e `interface`.
 * Se borra al compilar, así que ninguna app necesita transpilarlo ni configurar
 * el bundler. En cuanto aparezca aquí un `const`, un `enum` o una función, eso
 * deja de ser cierto.
 *
 * Escrito a mano, NUNCA derivado de Prisma: exponer un campo tiene que ser un
 * acto deliberado. Si se derivara del schema, añadir una columna interna
 * (`error`, `attempts`, `clientUploadId`) la publicaría sin que nadie lo decida.
 */

// ------------------------------------------------------------
//  Media
// ------------------------------------------------------------

export type MediaType = 'REEL' | 'AFTERMOVIE' | 'PHOTO';
export type Orientation = 'VERTICAL' | 'HORIZONTAL' | 'SQUARE';

/**
 * Lo que la landing y el admin ven de un medio.
 * `status`, `error`, `attempts`, `sizeBytes` y `storageKey` son internos y no salen:
 * el público solo recibe medios ya en READY.
 */
export interface MediaDto {
  id: string;
  type: MediaType;
  orientation: Orientation;
  /** URL absoluta. La construye MediaUrlInterceptor desde storageKey. */
  url: string;
  posterUrl: string | null;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  alt: string | null;
  caption: string | null;
  order: number;
  /** Portada de la galería. Exclusiva por galería. */
  isFeatured: boolean;
}

// ------------------------------------------------------------
//  Galerías y categorías
// ------------------------------------------------------------

/** Fecha sin hora, formato `YYYY-MM-DD`. Formatear siempre con `timeZone: 'UTC'`. */
export type IsoDate = string;

export interface GalleryDto {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  eventDate: IsoDate | null;
  location: string | null;
  coverUrl: string | null;
  isFeatured: boolean;
  category: CategoryRefDto;
  media: MediaDto[];
}

/** Categoría vista desde dentro de una galería: sin la lista de galerías, para no ciclar. */
/**
 * La lista NO devuelve los medios, solo cuántos hay. Si los incluyera, el build
 * de Astro se traería todos los reels de todas las galerías en una respuesta que
 * crece sin techo con cada evento. El detalle por slug sí los trae.
 */
export interface GalleryListItemDto {
  id: string;
  slug: string;
  title: string;
  eventDate: IsoDate | null;
  location: string | null;
  coverUrl: string | null;
  isFeatured: boolean;
  category: CategoryRefDto;
  mediaCount: number;
}

export interface CategoryRefDto {
  id: string;
  slug: string;
  name: string;
}

export interface CategoryDto extends CategoryRefDto {
  tagline: string | null;
  description: string | null;
  coverUrl: string | null;
}

// ------------------------------------------------------------
//  Paquetes
// ------------------------------------------------------------

export interface PackageItemDto {
  id: string;
  text: string;
  /** false = se muestra tachado. */
  included: boolean;
}

export interface PackageDto {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  /** CÉNTIMOS. S/ 300 son 30000. Formatear con Intl.NumberFormat. */
  priceAmount: number | null;
  currency: string;
  priceNote: string | null;
  idealFor: string | null;
  /** Nombre de ícono lucide, de la lista cerrada de copy.ts. */
  icon: string | null;
  imageUrl: string | null;
  badgeText: string | null;
  /** Mensaje pre-llenado del CTA. Si es null se usa el de SiteSettings. */
  whatsappMessage: string | null;
  /** Solo uno puede estar en true. Lo fuerza la API. */
  isHighlighted: boolean;
  items: PackageItemDto[];
}

// ------------------------------------------------------------
//  Testimonios
// ------------------------------------------------------------

export type TestimonialFormat = 'TEXT' | 'SCREENSHOT';
export type TestimonialSource = 'WHATSAPP' | 'INSTAGRAM' | 'TIKTOK' | 'DIRECTO';

/**
 * `hasConsent` NO sale en el contrato: es una condición para publicar, no un dato
 * del público. Si un testimonio llega aquí, es que ya tenía consentimiento.
 */
export interface TestimonialDto {
  id: string;
  format: TestimonialFormat;
  source: TestimonialSource;
  authorName: string;
  authorHandle: string | null;
  avatarUrl: string | null;
  eventType: string | null;
  eventDate: IsoDate | null;
  quote: string | null;
  screenshotUrl: string | null;
  externalUrl: string | null;
  rating: number | null;
  galleryId: string | null;
}

// ------------------------------------------------------------
//  Diferenciadores y redes
// ------------------------------------------------------------

export interface DifferentiatorDto {
  id: string;
  title: string;
  subtitle: string | null;
  icon: string;
}

export interface SocialLinkDto {
  id: string;
  /** String libre, no enum: una red nueva no debe obligar a migrar. */
  platform: string;
  handle: string;
  /** URL completa. No se arma desde el handle: cada red tiene su formato. */
  url: string;
  icon: string | null;
}

// ------------------------------------------------------------
//  Configuración del sitio
// ------------------------------------------------------------

export interface SiteSettingsDto {
  brandName: string;
  role: string | null;
  tagline: string | null;
  slogan: string | null;
  /** Markdown, solo negrita: el resaltado dorado del flyer. Se renderiza en build. */
  aboutText: string | null;
  logoUrl: string | null;
  signatureUrl: string | null;
  /** Internacional SIN el `+`, listo para `wa.me/`. Ej: "51994724944". */
  whatsappNumber: string | null;
  /** Formateado para mostrar. Ej: "994 724 944". */
  whatsappDisplay: string | null;
  whatsappMessage: string | null;
  ctaText: string | null;
  email: string | null;
  heroMediaUrl: string | null;
  heroPosterUrl: string | null;
  footerTagline: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImageUrl: string | null;
}

// ------------------------------------------------------------
//  Utilidades
// ------------------------------------------------------------

// ------------------------------------------------------------
//  Sobre de respuesta
// ------------------------------------------------------------

/**
 * Resumen de una página. `isFirstPage`, `isLastPage`, `previousPage` y `nextPage`
 * son derivables, y aun así viajan: el cliente no debería repetir la aritmética de
 * paginación en cada control que pinta. `disabled={meta.isFirstPage}` se lee mejor
 * que `disabled={meta.currentPage <= 1}` y no se equivoca.
 *
 * Con cero resultados: `pageCount: 0`, `isFirstPage` e `isLastPage` en `true`,
 * y ambos vecinos en `null`.
 */
export interface PaginationMeta {
  totalCount: number;
  pageCount: number;
  currentPage: number;
  /** Necesario para "mostrando 1-20 de 47" y para un selector de tamaño. */
  pageSize: number;
  isFirstPage: boolean;
  isLastPage: boolean;
  previousPage: number | null;
  nextPage: number | null;
}

/**
 * El código es el contrato; el mensaje es para humanos y puede reescribirse sin
 * romper a nadie. El admin hace `switch (error.code)`, nunca compara cadenas.
 *
 * Es un tipo unión, no un enum: `packages/contracts` no emite runtime.
 */
export type ErrorCode =
  // Genéricos
  | 'VALIDATION_FAILED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL'
  // Sesión — cada uno pide una reacción distinta en el admin
  | 'INVALID_CREDENTIALS'
  | 'SESSION_EXPIRED'
  | 'SESSION_REVOKED'
  // Contenido
  | 'SLUG_TAKEN'
  | 'CONSENT_REQUIRED'
  // Subidas
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'FILE_TOO_LARGE'
  | 'UPLOAD_SIZE_MISMATCH';

/**
 * Un error de validación por campo. Con esta forma el admin puede llamar
 * directamente a `setError(field, { message })` de react-hook-form, en vez de
 * parsear el array de frases en inglés que devuelve class-validator.
 */
export interface FieldError {
  /** Ruta del campo, con puntos para lo anidado: "title", "items.0.text". */
  field: string;
  /** La restricción que falló: "isNotEmpty", "minLength", "isEmail". */
  code: string;
  message: string;
}

/** Toda respuesta correcta de la API. `meta` solo viaja en las listas. */
export interface ApiSuccess<T> {
  success: true;
  code: 'OK';
  data: T;
  meta?: PaginationMeta;
  timestamp: string;
}

/** Toda respuesta de error de la API. */
export interface ApiFailure {
  success: false;
  statusCode: number;
  code: ErrorCode;
  /** En castellano y accionable. Puede cambiar entre versiones: no es contrato. */
  message: string;
  /** Solo en VALIDATION_FAILED. */
  details?: FieldError[];
  /** Correlaciona con los logs. Se rellena en la fase 6 con el request id de pino. */
  requestId?: string;
  timestamp: string;
}

/**
 * Unión discriminada por `success`: TypeScript estrecha sola tras un `if`.
 * Astro la consume en build time sin lanzar; el cliente del admin lanza `ApiError`
 * antes de devolver, así que allí solo se ve la rama de éxito.
 */
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

/** Atajo para las listas: `data` es el array y `meta` está garantizado. */
export interface ApiPaginated<T> extends ApiSuccess<T[]> {
  meta: PaginationMeta;
}

// ------------------------------------------------------------
//  Tracking
// ------------------------------------------------------------

/** El clic a WhatsApp ES el lead: sin formulario, sin fricción. */
export interface TrackWhatsappClickInput {
  packageId?: string;
  /** Dónde estaba el botón: "hero" | "paquetes" | "footer". */
  source?: string;
}
