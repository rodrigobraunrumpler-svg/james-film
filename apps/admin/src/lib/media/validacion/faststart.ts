import type { ArchivoElegido } from './archivo';
import { CABECERA_BYTES } from './limites';

export type Codec = 'h264' | 'hevc' | 'desconocido';

export interface CabeceraMp4 {
  /** `moov` antes de `mdat`. Sin esto el navegador se baja el archivo entero antes de pintar. */
  faststart: boolean;
  codec: Codec;
}

/** Lo mínimo de `Blob` que hace falta. Así el test no materializa 200 MB. */
export interface BlobLeible {
  size: number;
  slice(inicio: number, fin: number): { arrayBuffer(): Promise<ArrayBuffer> };
}

const CABECERA_CAJA = 8;

const fourCC = (v: DataView, offset: number): string =>
  String.fromCharCode(
    v.getUint8(offset),
    v.getUint8(offset + 1),
    v.getUint8(offset + 2),
    v.getUint8(offset + 3),
  );

/** Los FourCC del sample entry. iOS reproduce HEVC, pero R2 no debe servirlo (§4). */
const CODECS: Record<string, Codec> = {
  avc1: 'h264',
  avc3: 'h264',
  hvc1: 'hevc',
  hev1: 'hevc',
  dvh1: 'hevc',
  dvhe: 'hevc',
};

/**
 * Recorre las cajas ISO-BMFF de nivel superior con lo que quepa en la ventana.
 * No valida el archivo entero: solo mira el ORDEN de `moov` y `mdat`, y busca
 * el FourCC del códec, que vive en el `stsd` y siempre cae al principio del
 * `moov` (el `stbl` lo pone antes de las tablas grandes).
 */
export function analizarCabecera(buffer: ArrayBuffer): CabeceraMp4 {
  const vista = new DataView(buffer);
  let cursor = 0;
  let faststart = false;

  while (cursor + CABECERA_CAJA <= vista.byteLength) {
    const declarado = vista.getUint32(cursor);
    const tipo = fourCC(vista, cursor + 4);

    if (tipo === 'moov') {
      faststart = true;
      break;
    }
    if (tipo === 'mdat') break;

    // `0` = hasta el final del archivo, `1` = tamaño de 64 bits en los 8 bytes
    // siguientes. Cualquier otro valor por debajo de la cabecera es basura: sin
    // este suelo el cursor no avanzaría y el bucle no terminaría nunca.
    if (declarado === 0) break;
    const salto = declarado === 1 ? Number(vista.getBigUint64(cursor + CABECERA_CAJA)) : declarado;
    if (!Number.isFinite(salto) || salto < CABECERA_CAJA) break;

    cursor += salto;
  }

  return { faststart, codec: buscarCodec(buffer) };
}

/** Barrido del FourCC. Solo afirma en positivo: lo que no reconoce queda abierto. */
function buscarCodec(buffer: ArrayBuffer): Codec {
  const bytes = new Uint8Array(buffer);
  const vista = new DataView(buffer);

  for (let i = 0; i + 4 <= bytes.length; i++) {
    const codec = CODECS[fourCC(vista, i)];
    if (codec) return codec;
  }
  return 'desconocido';
}

/**
 * Lee SOLO ventanas de 64 KB. Un vídeo de 200 MB no cabe en un iPhone.
 *
 * DOS ventanas, y la segunda no es un lujo: **sin faststart el `moov` está al
 * FINAL**, así que el FourCC del códec no cae en la de entrada y el códec sale
 * `desconocido`. Como `validarMp4` solo bloquea lo que reconoce, un **HEVC sin
 * faststart se colaba entero** y acababa publicado sin que Chrome pudiera
 * reproducirlo — justo el fallo que el bloqueo de HEVC existe para impedir.
 *
 * Salió con un `IMG_*.MOV` real del iPhone de James: `ftyp → wide → mdat` de
 * 106 MB, con el `moov` detrás. Ninguna caja fabricada a mano lo habría
 * enseñado, porque todas las de los tests traen el `moov` delante.
 *
 * La cola se lee **solo si hizo falta**: con faststart, la primera ventana ya
 * trae el códec y esto no llega a ejecutarse.
 */
export async function inspeccionarMp4(blob: BlobLeible): Promise<CabeceraMp4> {
  const hasta = Math.min(blob.size, CABECERA_BYTES);
  const cabecera = analizarCabecera(await blob.slice(0, hasta).arrayBuffer());

  if (cabecera.codec !== 'desconocido' || blob.size <= CABECERA_BYTES) return cabecera;

  const cola = await blob.slice(blob.size - CABECERA_BYTES, blob.size).arrayBuffer();
  // `faststart` NO se recalcula: que el moov esté al final es precisamente lo
  // que nos ha traído hasta aquí, y la primera ventana ya lo determinó bien.
  return { faststart: cabecera.faststart, codec: buscarCodec(cola) };
}

export interface RevisionMp4 {
  /** Impide subir: el archivo no serviría en la web. */
  error: string | null;
  /** Se sube igual, pero conviene que James lo sepa. */
  aviso: string | null;
}

/**
 * HEVC BLOQUEA y faststart solo AVISA, y la diferencia es real:
 *
 * - Un H.265 no lo reproduce Chrome ni Firefox. Subirlo es publicar un vídeo
 *   que media web no puede abrir: no hay grado, no sirve.
 * - Un MP4 sin faststart **se reproduce perfectamente**; lo único que pasa es
 *   que el navegador no puede empezar hasta tenerlo entero, así que el primer
 *   play tarda. Es un inconveniente, no una imposibilidad.
 *
 * Bloquear el segundo dejaba a James SIN SALIDA cuando su editor no ofrece esa
 * opción —y varios no la ofrecen—: el archivo estaba bien y no había forma de
 * subirlo. Cambiar un inconveniente por una imposibilidad es peor negocio.
 */
export function validarMp4(a: ArchivoElegido, cabecera: CabeceraMp4): RevisionMp4 {
  // Va ANTES que el contenedor a propósito: un .MOV del iPhone suele fallar por
  // las dos cosas, y de las dos esta es la única que James puede arreglar de
  // raíz. Decirle «es un .MOV» le haría convertir archivos uno a uno para
  // siempre; decirle lo del ajuste lo arregla para todos los que grabe después.
  if (cabecera.codec === 'hevc') {
    return {
      error:
        `«${a.name}» está grabado en HEVC (H.265). Tu iPhone lo reproduce, pero la web no. ` +
        `Si sale de la cámara: Ajustes › Cámara › Formatos › «Más compatible», y vuelve a ` +
        `grabarlo. Si ya está editado, expórtalo con códec H.264.`,
      aviso: null,
    };
  }

  if (!cabecera.faststart) {
    return {
      error: null,
      aviso:
        'Tarda en arrancar la primera vez: al exportar, activa «inicio rápido» ' +
        'u «optimizar para web» si tu editor lo ofrece.',
    };
  }

  return { error: null, aviso: null };
}
