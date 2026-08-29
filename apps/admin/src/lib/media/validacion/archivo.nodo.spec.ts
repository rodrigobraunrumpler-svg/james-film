import { describe, expect, it } from 'vitest';
import { MAX_VIDEO_BYTES } from './limites';
import { bitrateMbps, escalarA, validarArchivo, validarMetadatosVideo } from './archivo';

/** Tipado estructural: un File lo satisface y el test no materializa 300 MB. */
const archivo = (over: Partial<{ name: string; size: number; type: string }> = {}) => ({
  name: 'reel.mp4',
  size: 35 * 1024 * 1024,
  type: 'video/mp4',
  ...over,
});

const mb = (n: number) => n * 1024 * 1024;

describe('validarArchivo', () => {
  it('acepta un MP4 de 35 MB, que es el reel de referencia', () => {
    expect(validarArchivo(archivo())).toBeNull();
  });

  it('rechaza un .mov antes de firmar nada, diciendo qué exportar', () => {
    // "lo que el navegador no puede reproducir" es el criterio equivocado en el
    // único navegador que importa: iOS Safari reproduce HEVC desde iOS 11.
    const error = validarArchivo(archivo({ name: 'clip.mov', type: 'video/quicktime' }));

    expect(error).toContain('MP4');
    expect(error).toMatch(/H\.264|1080p|calidad/);
  });

  it('un archivo de 300 MB se rechaza ANTES de empezar a subir', () => {
    const error = validarArchivo(archivo({ size: mb(300) }));

    // Y el mensaje trae los dos números: sin el suyo, James no sabe cuánto recortar.
    expect(error).toContain('300 MB');
    expect(error).toContain('200 MB');
  });

  it('acepta justo el límite y rechaza un byte más', () => {
    expect(validarArchivo(archivo({ size: MAX_VIDEO_BYTES }))).toBeNull();
    expect(validarArchivo(archivo({ size: MAX_VIDEO_BYTES + 1 }))).not.toBeNull();
  });

  it('las fotos tienen su propio techo, mucho más bajo', () => {
    const foto = { name: 'foto.jpg', type: 'image/jpeg', size: mb(20) };

    expect(validarArchivo(foto)).toContain('15 MB');
    expect(validarArchivo({ ...foto, size: mb(10) })).toBeNull();
  });

  it('un HEIC no se rechaza: se convierte antes de subir', () => {
    // Es lo que sale de la cámara del iPhone. Rechazarlo sería rechazar la
    // fuente más probable de fotos.
    expect(validarArchivo({ name: 'IMG_0001.HEIC', type: 'image/heic', size: mb(4) })).toBeNull();
  });

  it('rechaza un PDF sin pretender adivinar qué quería hacer', () => {
    expect(validarArchivo({ name: 'contrato.pdf', type: 'application/pdf', size: 1000 })).toContain(
      'vídeo',
    );
  });

  it('un archivo vacío se rechaza: subir 0 bytes deja un objeto roto en R2', () => {
    expect(validarArchivo(archivo({ size: 0 }))).not.toBeNull();
  });
});

describe('validarMetadatosVideo', () => {
  const meta = (over = {}) => ({ width: 1080, height: 1920, durationSec: 30, ...over });

  it('acepta un 1080x1920 de 30 s a CRF 20', () => {
    expect(validarMetadatosVideo(archivo(), meta())).toBeNull();
  });

  it('rechaza por encima de 2160p diciendo qué hacer', () => {
    const error = validarMetadatosVideo(archivo(), meta({ width: 2160, height: 3840 }));

    expect(error).toMatch(/H\.264|1080p|calidad/);
    expect(error).toContain('1080');
  });

  it('mide el lado LARGO, no la altura: un horizontal 4K también se rechaza', () => {
    expect(validarMetadatosVideo(archivo(), meta({ width: 3840, height: 2160 }))).not.toBeNull();
  });

  it('rechaza bitrate > 15 Mbps: se trabaría en datos móviles', () => {
    // 100 MB en 30 s ≈ 28 Mbps.
    const error = validarMetadatosVideo(archivo({ size: mb(100) }), meta({ durationSec: 30 }));

    expect(error).toContain('Mbps');
    expect(error).toMatch(/H\.264|1080p|calidad/);
  });

  it('no divide por cero cuando la duración es 0 o NaN', () => {
    expect(() => validarMetadatosVideo(archivo(), meta({ durationSec: 0 }))).not.toThrow();
    expect(() => validarMetadatosVideo(archivo(), meta({ durationSec: NaN }))).not.toThrow();
  });

  it('un vídeo sin duración legible se rechaza, no se deja pasar a ciegas', () => {
    // Si iOS no dio duración, tampoco dio dimensiones fiables: firmarlo sería
    // subir 200 MB para descubrir el problema en el servidor.
    expect(validarMetadatosVideo(archivo(), meta({ durationSec: NaN }))).not.toBeNull();
  });
});

describe('bitrateMbps', () => {
  it('35 MB en 30 s son 9.8 Mbps', () => {
    expect(bitrateMbps(mb(35), 30)).toBeCloseTo(9.79, 1);
  });

  it('duración 0 da Infinity, no NaN: así el umbral lo rechaza', () => {
    expect(bitrateMbps(mb(35), 0)).toBe(Infinity);
  });
});

describe('escalarA', () => {
  it('no toca lo que ya cabe', () => {
    expect(escalarA(1080, 1920, 2560)).toEqual({ width: 1080, height: 1920 });
  });

  it('escala por el lado largo y conserva la proporción', () => {
    expect(escalarA(4000, 3000, 2560)).toEqual({ width: 2560, height: 1920 });
  });

  it('con el lado largo en vertical escala por la altura', () => {
    expect(escalarA(3000, 4000, 2560)).toEqual({ width: 1920, height: 2560 });
  });

  it('redondea a entero: un canvas de 1920.5 px no existe', () => {
    const { width, height } = escalarA(4001, 3000, 2560);

    expect(Number.isInteger(width)).toBe(true);
    expect(Number.isInteger(height)).toBe(true);
  });

  it('nunca devuelve 0: una imagen larguísima y estrecha seguiría teniendo 1 px', () => {
    expect(escalarA(10_000, 3, 2560).height).toBeGreaterThanOrEqual(1);
  });
});
