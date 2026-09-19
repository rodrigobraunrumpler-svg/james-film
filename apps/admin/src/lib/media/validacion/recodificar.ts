import type { ArchivoElegido } from './archivo';
import { ErrorValidacion } from './errores';
import type { CabeceraMp4 } from './faststart';
import { MAX_BITRATE_MBPS, MAX_LADO_LARGO } from './limites';

/**
 * El lado largo del archivo que se PRODUCE, no el techo que se acepta.
 *
 * `MAX_LADO_LARGO` son 2160 y es una frontera —por encima se rechaza—; esto es
 * el objetivo de entrega de §4, 1080x1920. Recodificar a 2160 daría un archivo
 * que pasa por los pelos y pesa el doble sin que nadie lo note en un móvil.
 */
export const LADO_LARGO_OBJETIVO = 1920;

/**
 * Bits por segundo del vídeo que se PRODUCE, con margen bajo `MAX_BITRATE_MBPS`.
 *
 * Un nivel cualitativo NO sirve aquí: `Quality('high')` a 1080p sacó **30,6
 * Mbps** en un clip real de James, el doble del techo, y la conversión acababa
 * rechazada por la misma puerta que venía a esquivar — gastando medio minuto de
 * móvil para nada. La calidad se pide por número porque lo que hay que
 * garantizar es el TAMAÑO, no la nitidez.
 *
 * 10 Mbps a 1080p en H.264 es holgado para un reel, y deja sitio al audio: el
 * validador mide el bitrate MEDIO del archivo entero, pistas de sonido
 * incluidas.
 */
export const BITRATE_OBJETIVO_BPS = 10_000_000;

/**
 * Por qué hay que recodificar, o `null` si el archivo ya sirve.
 *
 * Devuelve el MOTIVO y no un booleano a propósito: es lo que la tesela enseña
 * si la recodificación resulta imposible, y lo que evita el mensaje genérico
 * que §4 prohíbe.
 */
export function motivoParaRecodificar(
  cabecera: CabeceraMp4,
  meta?: { width: number; height: number; bitrateMbps: number },
): string | null {
  // Se sabe con 64 KB de cabecera, antes de decodificar nada. Es el caso de
  // James: su iPhone graba HEVC salvo que se toque un ajuste, y ese vídeo no
  // lo reproduce quien entre desde un equipo sin decodificador por hardware.
  if (cabecera.codec === 'hevc') return 'está en HEVC y la web necesita H.264';

  if (!meta) return null;

  // Estos dos solo se saben tras leer los metadatos, o sea después de sacar el
  // póster. Van aquí para que la decisión viva en UN sitio.
  if (Math.max(meta.width, meta.height) > MAX_LADO_LARGO) return 'viene en 4K';
  if (meta.bitrateMbps > MAX_BITRATE_MBPS) return 'pesa demasiado por segundo';

  return null;
}

/**
 * HEVC o 4K → MP4 con H.264, 1080p y faststart, **en el navegador**.
 *
 * Se recodifica, no se reempaqueta: cambiar de contenedor es mover los mismos
 * datos de caja, pero cambiar de códec obliga a descomprimir cada fotograma y
 * volver a comprimirlo. Por eso tarda y por eso el progreso NO es opcional —
 * sin él, medio minuto de iPhone quieto se lee como que se colgó.
 *
 * `mediabunny` va con **import dinámico**: un archivo que ya sirve no descarga
 * ni un byte de la librería. Y usa `quality`, no `bitrate`, que está marcado
 * `@deprecated` en sus propios tipos.
 */
export async function recodificarAMp4(
  archivo: File,
  onProgreso: (fraccion: number) => void = () => {},
): Promise<File> {
  const {
    ALL_FORMATS,
    BlobSource,
    BufferTarget,
    Conversion,
    Input,
    Mp4OutputFormat,
    Output,
    Quality,
  } = await import('mediabunny');

  // La referencia se guarda aparte: `conversion.output.target` está tipado como
  // el `Target` genérico, que no expone `buffer`.
  const destino = new BufferTarget();

  const conversion = await Conversion.init({
    input: new Input({ source: new BlobSource(archivo), formats: ALL_FORMATS }),
    output: new Output({
      // `in-memory` escribe el `moov` DELANTE, que es lo que evita que el
      // navegador de quien visita tenga que bajarse el reel entero antes de
      // pintar el primer fotograma.
      format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
      target: destino,
    }),
    // El iPhone mete pistas de más —audio espacial, seis de metadatos de
    // movimiento— que a la web no le sirven de nada y ocupan.
    tracks: 'primary',
    video: async (pista) => {
      const ancho = await pista.getDisplayWidth();
      const alto = await pista.getDisplayHeight();

      return {
        codec: 'avc',
        quality: new Quality({ bitrate: BITRATE_OBJETIVO_BPS, bitrateMode: 'variable' }),
        // Solo UNA dimensión: la otra se deduce conservando la proporción, así
        // que no hay bandas negras. Y solo si el vídeo es MÁS grande —dar el
        // objetivo a secas AGRANDARÍA uno pequeño, que es perder calidad y
        // ganar peso a la vez.
        ...(Math.max(ancho, alto) > LADO_LARGO_OBJETIVO
          ? ancho >= alto
            ? { width: LADO_LARGO_OBJETIVO }
            : { height: LADO_LARGO_OBJETIVO }
          : {}),
      };
    },
  });

  // Falla ANTES de gastar un minuto de móvil. `discardedTracks` dice por qué,
  // y lo más probable es que el equipo no sepa decodificar HEVC — en cuyo caso
  // la salida está en el iPhone, no aquí.
  if (!conversion.isValid) {
    throw new ErrorValidacion(
      `«${archivo.name}» no se puede convertir en este dispositivo. Exporta el vídeo en MP4 ` +
        `con códec H.264, o graba con Ajustes › Cámara › Formatos › «Más compatible».`,
    );
  }

  conversion.onProgress = (fraccion) => onProgreso(fraccion);
  await conversion.execute();

  const buffer = destino.buffer;
  if (!buffer) {
    throw new ErrorValidacion(
      `La conversión de «${archivo.name}» no devolvió nada. Vuelve a intentarlo.`,
    );
  }

  return new File([buffer], nombreMp4(archivo), { type: 'video/mp4' });
}

/**
 * `IMG_8559.MOV` → `IMG_8559.mp4`. El nombre no decide nada —la clave en R2 es
 * un UUID— pero es lo que la tesela enseña y lo que sale en los mensajes: dejar
 * `.MOV` en un archivo que ya es MP4 haría dudar de si la conversión ocurrió.
 */
export const nombreMp4 = (a: ArchivoElegido): string =>
  `${a.name.replace(/\.[^.]+$/, '')}.mp4`;
