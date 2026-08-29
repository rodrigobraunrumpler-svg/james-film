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

/** Lee SOLO la ventana de cabecera. Un vídeo de 200 MB no cabe en un iPhone. */
export async function inspeccionarMp4(blob: BlobLeible): Promise<CabeceraMp4> {
  const hasta = Math.min(blob.size, CABECERA_BYTES);
  return analizarCabecera(await blob.slice(0, hasta).arrayBuffer());
}

export function validarMp4(a: ArchivoElegido, cabecera: CabeceraMp4): string | null {
  if (cabecera.codec === 'hevc') {
    return (
      `«${a.name}» está en HEVC (H.265). Tu iPhone lo reproduce, pero la web no. ` +
      `En CapCut, en Exportar, elige el códec H.264.`
    );
  }

  if (!cabecera.faststart) {
    return (
      `«${a.name}» no está preparado para reproducirse en la web: quien lo abra ` +
      `tendría que esperar a que se descargue entero. Vuelve a exportarlo desde CapCut.`
    );
  }

  return null;
}
