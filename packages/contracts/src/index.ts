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
  | 'FOTO_PERFIL'
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
  /**
   * Hay una hoja de autorización de imagen firmada para este evento.
   *
   * **Bloquea la publicación**, igual que en los testimonios: en una galería
   * salen caras de gente real y en los XV años salen MENORES. Fuera del DTO
   * público —allí no significaría nada— y por eso no mueve el
   * `openapi-public.json` que el CI congela.
   */
  hasConsent: boolean;
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
  /**
   * Cuántos de esos `mediaCount` son FOTOS. Los vídeos son la resta.
   *
   * Sin esto la landing solo tenía un total y escribía «reels» en todas
   * partes, así que una galería de tres fotos anunciaba «3 reels» — una cifra
   * falsa en la portada, que es justo lo que este proyecto no publica. Se manda
   * el desglose y la palabra la elige quien pinta.
   */
  photoCount: number;
}

/** Lo que ve el admin en la lista: estado, último cambio y datos de la portada. */
export interface AdminGalleryListItemDto extends GalleryListItemDto {
  isPublished: boolean;
  /** Para que la lista pueda avisar antes de que James pulse «Publicar». */
  hasConsent: boolean;
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
  /**
   * Las portadas de sus tres galerías más recientes. La tarjeta enseña QUÉ hay
   * dentro en vez de solo el nombre: una lista de nombres no dice nada de un
   * catálogo que es visual. Van vacías mientras la categoría no tenga galerías
   * publicadas con portada.
   */
  recentCoverUrls: string[];
  /**
   * A qué paquete acaban yendo los clics de esta categoría, derivado por
   * `PackageCategory` — no hace falta una columna `categoryId` en el clic.
   * Ordenado de más a menos y recortado a los tres primeros: la tarjeta pinta
   * una barra, no una tabla.
   */
  clickMix: CategoryClickShareDto[];
  /** La suma de `clickMix`. Cero es un estado legítimo, no un fallo. */
  clickTotal: number;
}

/** Un tramo de la barra de clics de una categoría. */
export interface CategoryClickShareDto {
  packageId: string;
  packageName: string;
  count: number;
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
  /** La cara de James. **No es el logo**: ése es una tira de película. */
  photoUrl: string | null;
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
/**
 * De dónde salió el clic. Es la MISMA lista cerrada que `@IsIn(FUENTES)` valida
 * en la API: con `string` a secas, la landing compilaba mandando una fuente que
 * no existe, la API devolvía 422 y el clic se perdía **sin ruido**. Ya pasó.
 * Al añadir una hay que tocar `FUENTES` y regenerar el snapshot del OpenAPI.
 */
export type WhatsappSource =
  | 'hero'
  /**
   * El botón verde de la BARRA superior y el del MENÚ desplegable.
   *
   * Los tres mandaban `hero`, y con eso ninguna mejora del hero se podía medir:
   * el panel daría el mismo número antes y después porque estaría contando
   * juntos el botón que se ve en la primera pantalla y el que acompaña durante
   * toda la página. Son intenciones distintas — uno se pulsa tras leer la
   * oferta, el otro tras haber bajado.
   */
  | 'barra'
  | 'menu'
  | 'paquetes'
  | 'footer'
  | 'galeria'
  | 'calendario-libre'
  | 'calendario-ocupado'
  /** La línea de PUBLICIDAD PARA NEGOCIOS, que es otro público y otro CTA. */
  | 'negocios';

export interface TrackWhatsappClickInput {
  packageId?: string;
  source?: WhatsappSource;
  /**
   * Qué DÍA preguntaba, cuando el clic sale del calendario. Fecha de
   * calendario (`YYYY-MM-DD`), no instante.
   *
   * La landing ya la sabe —la escribe dentro del mensaje de WhatsApp— y la
   * tiraba, así que se podía contar cuánta gente pregunta por un día cogido
   * pero no CUÁL. Se manda solo desde el calendario: un clic del hero no
   * pregunta por ninguna fecha, y rellenarla ahí ensuciaría el recuento.
   */
  requestedDate?: IsoDate | null;
}


// ------------------------------------------------------------
//  Disponibilidad — qué días NO tiene libres
// ------------------------------------------------------------

/** Un día ocupado tal y como lo ve el ADMIN. `note` nunca sale al público. */
export interface BusyDayDto {
  date: IsoDate;
  note: string | null;
  /** Los días de una misma reserva lo comparten. `null` si es un día suelto. */
  groupId: string | null;
}

/**
 * Una reserva, ya agrupada: lo que el Panel pinta y lo que el aviso cuenta.
 * «24 y 25 de octubre» es UNA de éstas, no dos días.
 */
export interface BookingDto {
  /** El `groupId`, o la propia fecha cuando es un día suelto. */
  id: string;
  from: IsoDate;
  to: IsoDate;
  note: string | null;
}

/**
 * Lo que consume la landing. Solo fechas: sin notas, sin ids, sin nada que
 * identifique a un cliente.
 */
export interface AvailabilityDto {
  /** Días ocupados, en orden. Lo que NO esté aquí y caiga dentro de la ventana, libre. */
  busy: IsoDate[];
  /**
   * Hasta dónde llega el dato. **Es imprescindible**: sin él la landing no
   * puede distinguir «libre» de «no lo sé», y un día a catorce meses vista
   * saldría libre cuando en realidad no hay información. Un día más allá de
   * `until` NO se pinta — ni libre ni ocupado.
   */
  until: IsoDate;
  /**
   * La última vez que James tocó el calendario, para el «actualizado hace X».
   * `null` si nunca ha marcado nada.
   */
  updatedAt: IsoDateTime | null;
}

/**
 * Marca o desmarca. Un solo endpoint para el toque, el arrastre y el rango.
 * Marcar varias fechas de una vez las mete en el MISMO grupo: es lo que
 * convierte «24 y 25» en una reserva en vez de en dos días sueltos.
 */
/**
 * Todo lo que la pantalla de Disponibilidad necesita, **en una sola petición**.
 *
 * Mismo criterio que el Panel: la pantalla no puede pintarse a trozos —el
 * bloque de «lo que viene» decide el alto de todo lo de abajo— y cuatro
 * peticiones darían cuatro saltos de layout en el 4G de James.
 */
export interface AvailabilitySummaryDto {
  /** Las reservas que vienen, ya agrupadas. «24 y 25» es UNA, no dos. */
  proximas: BookingDto[];
  /**
   * Sábados libres por mes, los próximos tres. Es el número que la web publica
   * («quedan 2 sábados libres en setiembre») y el que decide si sube el precio
   * o mueve algo. Que lo vea él antes que el cliente.
   */
  sabados: SaturdayCountDto[];
  /**
   * Reservas que YA PASARON y de las que no hay ninguna galería con esa fecha:
   * trabajo grabado y sin publicar. Es el único dato de esta pantalla que él no
   * tiene en ninguna otra parte, y es dinero parado.
   */
  sinGaleria: BookingDto[];
  /**
   * Clics a WhatsApp salidos del calendario en los últimos 30 días.
   *
   * `ocupado` es el número interesante: gente que quería un día que ya estaba
   * cogido. Dice cuánta demanda está rechazando, que es lo que justifica subir
   * precios o buscar un segundo cámara.
   */
  clicks: CalendarClicksDto;
  /**
   * Las fechas más pedidas desde el calendario en 30 días, la más pedida
   * primero. Es el dato accionable: saber que el 24 de octubre lo han pedido
   * tres veces y lo tiene cogido decide si sube el precio ese fin de semana,
   * busca un segundo cámara o le escribe él al que preguntó.
   */
  masPedidas: RequestedDateDto[];
  /** Cuándo tocó el calendario por última vez. `null` si nunca. */
  updatedAt: IsoDateTime | null;
}

export interface SaturdayCountDto {
  /** El primer día del mes, como fecha de calendario. */
  month: IsoDate;
  free: number;
  total: number;
}

export interface CalendarClicksDto {
  free: number;
  busy: number;
}

/** Una fecha que la gente pide y James no tiene. Lo que decide subir el precio. */
export interface RequestedDateDto {
  date: IsoDate;
  /** Cuántos escribieron por ese día en la ventana. */
  count: number;
  /** `true` si ese día está marcado como ocupado: entonces es demanda rechazada. */
  busy: boolean;
}

export interface SetAvailabilityInput {
  dates: IsoDate[];
  busy: boolean;
  /** Solo se aplica cuando `busy` es true. Se escribe en todos los días. */
  note?: string | null;
}

// ------------------------------------------------------------
//  Panel — la pantalla que abre James
// ------------------------------------------------------------

export type DeployStatus = 'IDLE' | 'QUEUED' | 'BUILDING' | 'SUCCESS' | 'FAILED';

/**
 * Cada aviso lleva su ACCIÓN, no solo su texto: un aviso que no se puede
 * resolver desde donde se lee obliga a buscar la pantalla, y entonces se
 * ignora. `id` es lo que el admin guarda en `localStorage` al descartarlo
 * —sin tabla, decisión de §2— así que tiene que ser estable entre cargas.
 */
export type AttentionKind =
  | 'DEPLOY_FAILED'
  | 'MEDIA_FAILED'
  | 'STALE_DRAFT'
  /**
   * Un día marcado como ocupado que ya pasó y del que no hay ninguna galería.
   * Grabó y no publicó: es trabajo hecho que no está trayendo clientes, y es lo
   * único del Panel que James no sabe ya por su cuenta.
   */
  | 'EVENT_WITHOUT_GALLERY';

export interface AttentionItemDto {
  id: string;
  kind: AttentionKind;
  title: string;
  detail: string;
  /** Ruta del admin a la que lleva el botón. */
  href: string;
  accion: string;
  /** Miniatura cuando el aviso es sobre una galería. */
  coverUrl: string | null;
  /** El degradado de la galería se deriva de esto cuando no hay portada. */
  galleryId: string | null;
  /** Lo pinta en rojo en vez de en latón. Solo el deploy fallido lo es. */
  grave: boolean;
  /**
   * Cuándo pasó. Va en ISO y lo formatea el admin con `Intl.RelativeTimeFormat`
   * —«hace 2 horas»—: la API no devuelve texto de interfaz. `null` cuando el
   * aviso no tiene un instante concreto.
   */
  since: IsoDateTime | null;
}

/** Un día de la serie de 30. `date` es fecha de calendario, se formatea en UTC. */
export interface ClickDayDto {
  date: IsoDate;
  count: number;
}

/**
 * El único número que mide el negocio. `previousTotal` es la ventana MÓVIL
 * anterior (`now - 60d` a `now - 30d`), no el mes de calendario: así el
 * cálculo no depende de la zona horaria.
 */
export interface ClickStatsDto {
  total: number;
  previousTotal: number;
  daily: ClickDayDto[];
  byPackage: CategoryClickShareDto[];
  /** Clics desde el hero o el pie, sin paquete asociado. */
  noPackage: number;
  /**
   * De DÓNDE salieron, no de qué paquete. Son dos preguntas distintas y el
   * Panel solo contestaba la segunda: sin esto no se sabe si el calendario —o
   * la línea de negocios, que es medio producto— trae clientes o no los trae.
   * Ordenado de más a menos y sin las fuentes que no tuvieron ninguno.
   */
  bySource: SourceClickShareDto[];
}

export interface SourceClickShareDto {
  source: WhatsappSource;
  clicks: number;
}

export interface DeployStateDto {
  status: DeployStatus;
  pendingChanges: number;
  error: string | null;
  finishedAt: IsoDateTime | null;
}

export interface DashboardDto {
  attention: AttentionItemDto[];
  clicks: ClickStatsDto;
  storage: StorageUsageDto;
  deploy: DeployStateDto;
  /** Para el atajo «Subir a …»: la última galería que James tocó. */
  ultimaGaleria: { id: string; title: string } | null;
  /**
   * Sábados libres de los tres próximos meses, contados desde HOY.
   *
   * Es el número de escasez que la web publica —«quedan 2 sábados libres en
   * setiembre»— y estaba solo en Disponibilidad, o sea únicamente si iba a
   * buscarlo. En el Panel lo ve al abrir, que es donde decide si sube el precio
   * o mueve algo.
   */
  saturdays: SaturdayCountDto[];
}

// ------------------------------------------------------------
//  Buscador ⌘K
// ------------------------------------------------------------

export type SearchKind = 'GALLERY' | 'PACKAGE' | 'CATEGORY' | 'TESTIMONIAL';

/**
 * Un resultado del buscador global. Deliberadamente plano: el atajo tiene que
 * poder pintar cualquier tipo con el mismo componente, y el día que entre un
 * quinto modelo no debería tocar la interfaz.
 */
export interface SearchResultDto {
  kind: SearchKind;
  id: string;
  /** Lo que se lee grande. */
  label: string;
  /** La línea de debajo: estado, precio, recuento. Puede faltar. */
  hint: string | null;
  href: string;
  coverUrl: string | null;
}
