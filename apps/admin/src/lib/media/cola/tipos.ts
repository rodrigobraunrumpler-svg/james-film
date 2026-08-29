import type { MediaType } from '@james-film/contracts';

/**
 * SELECCIONADO → VALIDANDO → EXTRAYENDO_POSTER → FIRMANDO → SUBIENDO → CONFIRMANDO → LISTO
 *
 * El reintento vuelve SIEMPRE a FIRMANDO, nunca a VALIDANDO ni a
 * EXTRAYENDO_POSTER: la firma incluye `content-length`, así que un
 * `canvas.toBlob` que devuelva unos bytes distintos dejaría el item en un 403
 * permanente que no converge.
 */
export type EstadoItem =
  | 'SELECCIONADO'
  | 'VALIDANDO'
  | 'EXTRAYENDO_POSTER'
  | 'FIRMANDO'
  | 'SUBIENDO'
  | 'CONFIRMANDO'
  | 'LISTO'
  | 'FALLIDO';

export interface ItemCola {
  /**
   * Identidad. Se genera UNA vez al entrar en la cola y sobrevive a los
   * reintentos. El nombre del archivo NO sirve: el picker de iOS devuelve
   * `image.jpeg` para todas las fotos, y colisionar en el upsert subiría dos
   * fotos a la misma key. Es también la clave de React de la tarjeta.
   */
  clientUploadId: string;
  /**
   * Lo que viaja al presign. Nace igual que `clientUploadId` y solo cambia
   * cuando un `confirm` devuelve FAILED: reutilizarla haría que el upsert
   * recuperase la fila recién borrada, que `confirmar` ignora por `deletedAt`.
   * La clave de React no cambia con ella — remontar la tarjeta en mitad de un
   * reintento le borraría el progreso a la vista.
   */
  identidad: string;
  galleryId: string;
  archivo: File;
  tipo: MediaType;
  estado: EstadoItem;
  /** 0..1. Solo del archivo principal; el poster son 50 KB y no se pinta. */
  progreso: number;
  bytesSubidos: number;
  mediaId: string | null;
  /** El fallo que impidió subirlo. */
  motivo: string | null;
  /** Se subió bien, pero algo conviene saberlo. En gris, no en rojo. */
  aviso: string | null;
  intentos: number;
  /** Para el presupuesto temporal del reintento, no para un contador. */
  empezoEn: number;
}

export const EN_CURSO: readonly EstadoItem[] = [
  'SELECCIONADO',
  'VALIDANDO',
  'EXTRAYENDO_POSTER',
  'FIRMANDO',
  'SUBIENDO',
  'CONFIRMANDO',
];

export const estaEnCurso = (i: ItemCola): boolean => EN_CURSO.includes(i.estado);

/** Ocupa un hueco de red: es lo que la concurrencia 3 limita. */
export const ocupaRed = (i: ItemCola): boolean =>
  i.estado === 'FIRMANDO' || i.estado === 'SUBIENDO' || i.estado === 'CONFIRMANDO';

/** Ocupa el decodificador: uno solo a la vez, un `<video>` por vez. */
export const ocupaDecodificador = (i: ItemCola): boolean =>
  i.estado === 'VALIDANDO' || i.estado === 'EXTRAYENDO_POSTER';
