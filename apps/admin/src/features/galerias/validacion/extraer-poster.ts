import { ErrorValidacion } from './errores';
import { MIME_POSTER } from './limites';

/**
 * Lo mínimo de `<video>` que se usa. Estructural para poder inyectar un doble:
 * happy-dom no decodifica vídeo —`loadedmetadata` no dispara y `duration` es
 * `NaN`— así que un test contra el DOM real pasaría sin comprobar nada.
 */
export interface VideoLike {
  muted: boolean;
  playsInline: boolean;
  preload: string;
  src: string;
  currentTime: number;
  readonly duration: number;
  readonly videoWidth: number;
  readonly videoHeight: number;
  addEventListener(tipo: string, cb: () => void): void;
  removeAttribute(nombre: string): void;
  load(): void;
}

export interface CanvasLike {
  width: number;
  height: number;
  getContext(tipo: '2d'): { drawImage(...args: never[]): void } | null;
  toBlob(cb: (blob: Blob | null) => void, tipo?: string, calidad?: number): void;
}

/** El doble del test además guarda lo dibujado, para poder aseverarlo. */
export interface CanvasFalso extends CanvasLike {
  dibujos: unknown[][];
}

export interface DepsPoster {
  crearVideo(): VideoLike;
  crearCanvas(): CanvasLike;
  crearUrl(archivo: Blob): string;
  revocarUrl(url: string): void;
  timeoutMs?: number;
}

export interface PosterExtraido {
  poster: Blob;
  width: number;
  height: number;
  durationSec: number;
}

const NO_SE_PUDO =
  'No se pudo leer este vídeo. Expórtalo como MP4 (H.264) desde CapCut y vuelve a intentarlo.';

/** 15 s: lo que tarda un aftermovie grande en abrir en un iPhone con poca RAM. */
const TIMEOUT_POR_DEFECTO = 15_000;

export const depsNavegador = (): DepsPoster => ({
  crearVideo: () => document.createElement('video') as unknown as VideoLike,
  crearCanvas: () => document.createElement('canvas') as unknown as CanvasLike,
  crearUrl: (archivo) => URL.createObjectURL(archivo),
  revocarUrl: (url) => URL.revokeObjectURL(url),
});

/** Un evento del vídeo, o el `error` que lo cancela. Nunca se queda colgado. */
const esperarEvento = (video: VideoLike, tipo: string): Promise<void> =>
  new Promise((ok, fallar) => {
    video.addEventListener(tipo, () => ok());
    video.addEventListener('error', () => fallar(new ErrorValidacion(NO_SE_PUDO)));
  });

/**
 * Poster + metadatos de un solo pase. Es lo que hace innecesario el worker de
 * ffmpeg (§4): el navegador ya tiene el decodificador.
 *
 * Va con CONCURRENCIA 1 — un `<video>` decodificando a la vez. La concurrencia
 * 3 son las subidas, que es otra cosa.
 */
export async function extraerPoster(
  archivo: Blob,
  deps: DepsPoster = depsNavegador(),
): Promise<PosterExtraido> {
  const url = deps.crearUrl(archivo);
  const video = deps.crearVideo();

  // Sin `muted` + `playsInline`, iOS no carga los metadatos de un vídeo que no
  // se está reproduciendo: la promesa no se resolvería nunca.
  video.muted = true;
  video.playsInline = true;
  video.preload = 'metadata';

  let temporizador: ReturnType<typeof setTimeout> | undefined;

  try {
    const trabajo = (async () => {
      video.src = url;
      await esperarEvento(video, 'loadedmetadata');

      const { videoWidth: width, videoHeight: height, duration } = video;
      if (!width || !height || !Number.isFinite(duration) || duration <= 0) {
        throw new ErrorValidacion(NO_SE_PUDO);
      }

      // El primer frame casi siempre es negro: la portada saldría en negro y
      // James pensaría que la subida falló.
      const seeked = esperarEvento(video, 'seeked');
      video.currentTime = duration / 2;
      await seeked;

      const canvas = deps.crearCanvas();
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new ErrorValidacion('Este navegador no puede generar la miniatura.');
      ctx.drawImage(...([video, 0, 0, width, height] as never[]));

      const poster = await new Promise<Blob>((ok, fallar) =>
        canvas.toBlob(
          (b) => (b ? ok(b) : fallar(new ErrorValidacion('No se pudo generar el poster.'))),
          MIME_POSTER,
          0.8,
        ),
      );

      // `toBlob` cae a PNG SIN lanzar error ante un tipo no soportado, así que
      // el tipo se ASEVERA. Si no, el content-type firmado no cuadraría con lo
      // subido y R2 devolvería 403 al final de toda la subida.
      if (poster.type !== MIME_POSTER) {
        throw new ErrorValidacion('Este navegador no pudo generar el poster del vídeo.');
      }

      // `durationSec` es Int en la base: el redondeo se hace aquí, no allí.
      return { poster, width, height, durationSec: Math.round(duration) };
    })();

    const rescate = new Promise<never>((_, fallar) => {
      temporizador = setTimeout(
        () => fallar(new ErrorValidacion(NO_SE_PUDO)),
        deps.timeoutMs ?? TIMEOUT_POR_DEFECTO,
      );
    });

    return await Promise.race([trabajo, rescate]);
  } finally {
    clearTimeout(temporizador);
    deps.revocarUrl(url);
    // `revokeObjectURL` solo NO basta: sin esto el decodificador sigue ocupado,
    // y validando ocho reels seguidos el iPhone se queda sin memoria.
    video.removeAttribute('src');
    video.load();
  }
}
