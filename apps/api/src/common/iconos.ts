/**
 * Lista CERRADA de nombres lucide. La usan `Package.icon`,
 * `Differentiator.icon` y `SocialLink.icon`.
 *
 * Vive en la API y no en `packages/contracts` porque **es runtime**: la API
 * tiene que validar contra ella sí o sí —`whitelist` es seguridad, no
 * limpieza— así que aquí no es una copia, es la fuente. El admin la pide a
 * `GET /admin/icons`; `apps/web` lleva la suya en `copy.ts` porque renderiza en
 * build y un nombre inválido deja un hueco visible.
 *
 * Está en `common/` y no en el módulo de ajustes —como decía el plan— porque
 * la comparten tres módulos y ninguno es dueño de los otros.
 *
 * **Los siete primeros son los que YA usa el seed.** El primer borrador de esta
 * lista se inventó sin mirarlo, y con `@IsIn` puesto James habría abierto un
 * paquete, guardado sin tocar el ícono y recibido un 422 sobre `trending-up`.
 * Todos verificados contra `lucide-react`: `instagram` se cayó de la lista
 * porque **lucide quitó las marcas** y ya no lo exporta.
 */
export const ICONOS = [
  // En uso por el seed
  'clapperboard',
  'trending-up',
  'crown',
  'camera',
  'zap',
  'users',
  'bar-chart-3',
  // Disponibles
  'video',
  'film',
  'sparkles',
  'star',
  'heart',
  'gift',
  'clock',
  'award',
  'music',
  'calendar',
  'map-pin',
  'play',
  'message-circle',
  'at-sign',
  'share-2',
  'link',
] as const;

export type Icono = (typeof ICONOS)[number];

/** Lo que se pinta cuando el nombre no está en la lista. */
export const ICONO_POR_DEFECTO: Icono = 'link';
