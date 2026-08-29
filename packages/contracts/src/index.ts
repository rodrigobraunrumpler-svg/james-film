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

export type MediaStatus = 'PENDING' | 'READY' | 'FAILED';

/**
 * Lo que el navegador declara ANTES de subir. La API valida mime y tamaño y solo
 * entonces firma: firmar primero y validar después deja una URL válida en manos
 * de quien mandó basura (§4).
 */
export interface PresignItemInput {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  type: MediaType;
  /** Idempotencia: reenviar el mismo devuelve el MISMO mediaId, no uno nuevo. */
  clientUploadId: string;
  width?: number;
  height?: number;
  durationSec?: number;
  /** El poster que extrae el canvas. Se valida y se firma igual que el vídeo. */
  posterMimeType?: string;
  posterSizeBytes?: number;
}

export interface PresignItemResult {
  mediaId: string;
  uploadUrl: string;
  posterUploadUrl: string | null;
  storageKey: string;
  posterKey: string | null;
}

/** Lo que el editor necesita para mover su máquina de estados por archivo. */
export interface MediaConfirmResult {
  id: string;
  status: MediaStatus;
  orientation: Orientation;
  /** Qué falló, en castellano. Sin esto el aviso del dashboard no dice nada. */
  error: string | null;
}

// ------------------------------------------------------------
//  Subidas que NO son Media
// ------------------------------------------------------------

/**
 * Nueve columnas `*Key` repartidas en cuatro modelos que **no** son filas
 * `Media`: son claves sueltas. El cliente declara PARA QUÉ sube, y el servidor
 * decide prefijo, tipos permitidos y techo — nunca al revés, o sería dejarle
 * elegir dónde escribe dentro del bucket.
 */
export type UploadPurpose =
  | 'PORTADA_CATEGORIA'
  | 'IMAGEN_PAQUETE'
  | 'AVATAR_TESTIMONIO'
  | 'CAPTURA_TESTIMONIO'
  | 'LOGO'
  | 'FIRMA'
  | 'OG'
  | 'HERO_VIDEO'
  | 'HERO_POSTER';

export interface PresignUploadInput {
  proposito: UploadPurpose;
  mimeType: string;
  sizeBytes: number;
}

export interface PresignUploadResult {
  /** Lo que se guarda en la columna. NUNCA la URL. */
  key: string;
  uploadUrl: string;
}

// ------------------------------------------------------------
//  Galerías y categorías
// ------------------------------------------------------------

/** Fecha sin hora, formato `YYYY-MM-DD`. Formatear siempre con `timeZone: 'UTC'`. */
export type IsoDate = string;

/** Instante real en ISO-8601. Se muestra en `America/Lima`, no en UTC. */
export type IsoDateTime = string;

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
/**
 * Lo que ve el ADMIN, no el público. Añade el estado de subida porque el editor
 * tiene que poder distinguir un medio subido de uno a medias tras una recarga:
 * `buscarPorId` devuelve PENDING y FAILED con una `url` que apunta a un objeto
 * que nunca llegó, y sin esto serían tarjetas idénticas a las buenas.
 *
 * Aparte del MediaDto público a propósito: añadirlo allí movería el
 * openapi-public.json que el CI congela, y exponer un campo debe ser deliberado.
 */
export interface AdminMediaDto extends MediaDto {
  status: MediaStatus;
  /** Qué falló, en castellano. Lo escribe el confirm. */
  error: string | null;
}

export interface AdminGalleryDto extends Omit<GalleryDto, 'media'> {
  media: AdminMediaDto[];
  /**
   * Sin esto el admin no distingue una galería publicada de un borrador, que es
   * lo primero que hay que ver en la lista. Fuera del DTO público a propósito:
   * allí siempre valdría `true` —el controller filtra— y añadirlo movería el
   * `openapi-public.json` que el CI congela.
   */
  isPublished: boolean;
}

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

/** Lo que ve el admin en la lista: estado, último cambio y datos de la portada. */
export interface AdminGalleryListItemDto extends GalleryListItemDto {
  isPublished: boolean;
  /**
   * Para «Publicada hace 3 días» / «Editada hace 2 horas». No hay `publishedAt`
   * en el schema: la frase cambia según `isPublished`, el instante es el mismo.
   */
  updatedAt: IsoDateTime;
  /** Tipo del medio destacado. `null` si la galería aún no tiene portada. */
  coverType: MediaType | null;
  /** Duración de la portada en segundos, si es vídeo y se pudo medir. */
  coverDurationSec: number | null;
}

/** Los tres números de las pestañas. Endpoint propio: no cabe en el meta paginado. */
export interface GalleryCountsDto {
  todas: number;
  publicadas: number;
  borradores: number;
}

/** Cuánto ocupa el trabajo de James en R2, para el medidor del sidebar. */
export interface StorageUsageDto {
  usedBytes: number;
  quotaBytes: number;
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

/**
 * Lo que ve el admin. Los recuentos viajan con la fila para que el aviso de
 * borrado pueda decir **cuántas** galerías la usan antes de que James pulse,
 * en vez de después. El 409 del servidor sigue existiendo: la API no puede
 * confiar en que la interfaz haya avisado.
 */
export interface AdminCategoryDto extends CategoryDto {
  isActive: boolean;
  order: number;
  metaTitle: string | null;
  metaDescription: string | null;
  galleryCount: number;
  packageCount: number;
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

/** Lo que ve el admin de un bullet: además, su posición. */
export interface AdminPackageItemDto extends PackageItemDto {
  order: number;
}

export interface AdminPackageDto extends Omit<PackageDto, 'items'> {
  items: AdminPackageItemDto[];
  isActive: boolean;
  order: number;
  /** Se guarda y se edita; la web v1 NO lo consume. */
  accentColor: string | null;
  categoryIds: string[];
  /**
   * Clics a WhatsApp atribuidos a este paquete. Viaja con la fila porque
   * borrarlo pone su `packageId` a `null` en cada uno: son la única métrica de
   * negocio del proyecto, así que el borrado solo se ofrece si esto es 0.
   */
  whatsappClickCount: number;
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

/**
 * Lo que ve el admin. `hasConsent` SÍ aparece aquí —es lo que hay que
 * gestionar— pero nunca en el DTO público: allí, si un testimonio llega, es
 * que ya lo tenía.
 */
export interface AdminTestimonialDto extends TestimonialDto {
  hasConsent: boolean;
  isActive: boolean;
  isFeatured: boolean;
  order: number;
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

/** Lo que ve el admin: además, si está activo y su posición. */
export interface AdminDifferentiatorDto extends DifferentiatorDto {
  isActive: boolean;
  order: number;
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

export interface AdminSocialLinkDto extends SocialLinkDto {
  isActive: boolean;
  order: number;
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
  /** Borrar una categoría que aún usan galerías o paquetes. Lleva el número. */
  | 'CATEGORY_IN_USE'
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
