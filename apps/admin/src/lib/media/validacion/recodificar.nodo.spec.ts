import { describe, expect, it } from 'vitest';
import { MAX_BITRATE_MBPS, MAX_LADO_LARGO } from './limites';
import {
  BITRATE_OBJETIVO_BPS,
  LADO_LARGO_OBJETIVO,
  motivoParaRecodificar,
  nombreMp4,
} from './recodificar';

const h264 = { faststart: true, codec: 'h264' } as const;
const meta = (over: Partial<{ width: number; height: number; bitrateMbps: number }> = {}) => ({
  width: 1080,
  height: 1920,
  bitrateMbps: 10,
  ...over,
});

describe('motivoParaRecodificar', () => {
  it('el HEVC se decide con la CABECERA, sin metadatos', () => {
    // Importa el orden: se sabe con 64 KB, así que se convierte antes de tocar
    // el decodificador y sin pedirle un fotograma a un vídeo que Chrome quizá
    // no sepa abrir.
    expect(motivoParaRecodificar({ faststart: true, codec: 'hevc' })).toContain('HEVC');
  });

  it('un H.264 que cabe no se toca', () => {
    expect(motivoParaRecodificar(h264, meta())).toBeNull();
  });

  it('sin metadatos todavía, un H.264 no decide nada', () => {
    // La primera pasada solo tiene la cabecera. Decidir aquí que «cabe» sería
    // afirmar algo que aún no se ha medido.
    expect(motivoParaRecodificar(h264)).toBeNull();
  });

  it('el lado largo manda, esté en el ancho o en el alto', () => {
    expect(motivoParaRecodificar(h264, meta({ width: 3840, height: 2160 }))).toContain('4K');
    expect(motivoParaRecodificar(h264, meta({ width: 2160, height: 3840 }))).toContain('4K');
  });

  it('el techo se acepta y un píxel más no', () => {
    expect(motivoParaRecodificar(h264, meta({ width: 1080, height: MAX_LADO_LARGO }))).toBeNull();
    expect(
      motivoParaRecodificar(h264, meta({ width: 1080, height: MAX_LADO_LARGO + 1 })),
    ).not.toBeNull();
  });

  it('el bitrate tiene su propio motivo: el vídeo de James cabía y pesaba', () => {
    // 1080x1920 a 105 Mbps pasa la puerta del tamaño y se traba en datos
    // móviles, que es como lo ven sus clientes.
    expect(motivoParaRecodificar(h264, meta({ bitrateMbps: MAX_BITRATE_MBPS }))).toBeNull();
    expect(motivoParaRecodificar(h264, meta({ bitrateMbps: MAX_BITRATE_MBPS + 0.1 }))).toContain(
      'segundo',
    );
  });
});

describe('nombreMp4', () => {
  it('cambia la extensión, no el nombre', () => {
    expect(nombreMp4({ name: 'IMG_8559.MOV', size: 1, type: 'video/quicktime' })).toBe(
      'IMG_8559.mp4',
    );
  });

  it('un nombre con puntos solo pierde la última extensión', () => {
    expect(nombreMp4({ name: 'boda.1.final.mov', size: 1, type: 'video/quicktime' })).toBe(
      'boda.1.final.mp4',
    );
  });
});

describe('el objetivo de reescalado', () => {
  it('es el de ENTREGA, por debajo del techo que se acepta', () => {
    // Recodificar a 2160 daría un archivo que pasa por los pelos y pesa el
    // doble sin que nadie lo note en un móvil.
    expect(LADO_LARGO_OBJETIVO).toBeLessThan(MAX_LADO_LARGO);
    expect(LADO_LARGO_OBJETIVO).toBe(1920);
  });
});

describe('el bitrate objetivo', () => {
  it('deja MARGEN bajo el techo, no lo roza', () => {
    // `Quality('high')` sacó 30,6 Mbps a 1080p en un clip real y la conversión
    // se rechazaba sola. Pedir un número es lo que garantiza el tamaño; un
    // nivel cualitativo garantiza nitidez, que no es lo que hace falta aquí.
    const objetivoMbps = BITRATE_OBJETIVO_BPS / 1_000_000;

    expect(objetivoMbps).toBeLessThan(MAX_BITRATE_MBPS);
    // Holgura para el audio y para los picos: el validador mide la MEDIA del
    // archivo entero, no solo la pista de vídeo.
    expect(objetivoMbps).toBeLessThanOrEqual(MAX_BITRATE_MBPS * 0.8);
  });
});
