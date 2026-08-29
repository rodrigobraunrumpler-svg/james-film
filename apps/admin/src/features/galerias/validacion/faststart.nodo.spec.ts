import { describe, expect, it, vi } from 'vitest';
import { CABECERA_BYTES } from './limites';
import { analizarCabecera, inspeccionarMp4, validarMp4 } from './faststart';

const texto = (s: string) => new TextEncoder().encode(s);

/** Una caja ISO-BMFF: [tamaño u32][tipo 4 chars][contenido]. */
function caja(tipo: string, contenido: Uint8Array = new Uint8Array(0)): Uint8Array {
  const salida = new Uint8Array(8 + contenido.length);
  new DataView(salida.buffer).setUint32(0, salida.length);
  salida.set(texto(tipo), 4);
  salida.set(contenido, 8);
  return salida;
}

const unir = (...partes: Uint8Array[]): Uint8Array => {
  const total = partes.reduce((n, p) => n + p.length, 0);
  const salida = new Uint8Array(total);
  let cursor = 0;
  for (const p of partes) {
    salida.set(p, cursor);
    cursor += p.length;
  }
  return salida;
};

/** `analizarCabecera` recibe un ArrayBuffer, que es lo que da `Blob.arrayBuffer()`. */
const buffer = (...partes: Uint8Array[]): ArrayBuffer => unir(...partes).buffer as ArrayBuffer;

const relleno = (n: number) => new Uint8Array(n);
/** Un stsd con su sample entry, que es donde vive el FourCC del códec. */
const stsd = (codec: string) => caja('stsd', unir(relleno(8), caja(codec, relleno(16))));

const FTYP = caja('ftyp', texto('isommp42'));

describe('analizarCabecera', () => {
  it('detecta moov antes de mdat', () => {
    const buf = buffer(FTYP, caja('moov', stsd('avc1')), caja('mdat', relleno(64)));

    expect(analizarCabecera(buf).faststart).toBe(true);
  });

  it('lo rechaza si moov va después: el navegador se bajaría el archivo entero', () => {
    const buf = buffer(FTYP, caja('mdat', relleno(64)), caja('moov', stsd('avc1')));

    expect(analizarCabecera(buf).faststart).toBe(false);
  });

  it('sin moov a la vista tampoco es faststart', () => {
    expect(analizarCabecera(buffer(FTYP, caja('mdat', relleno(200)))).faststart).toBe(false);
  });

  it('reconoce H.264 por su FourCC', () => {
    const buf = buffer(FTYP, caja('moov', stsd('avc1')), caja('mdat'));

    expect(analizarCabecera(buf).codec).toBe('h264');
  });

  it('reconoce HEVC, que iOS reproduce pero R2 no debe servir', () => {
    const buf = buffer(FTYP, caja('moov', stsd('hvc1')), caja('mdat'));

    expect(analizarCabecera(buf).codec).toBe('hevc');
  });

  it('un códec que no reconoce NO se inventa: queda desconocido', () => {
    // Rechazar por no reconocerlo bloquearía exports legítimos. La API sigue
    // teniendo la última palabra.
    const buf = buffer(FTYP, caja('moov', stsd('mp4v')), caja('mdat'));

    expect(analizarCabecera(buf).codec).toBe('desconocido');
  });

  it('una caja de tamaño 0 (hasta el final) no cuelga el bucle', () => {
    const abierta = new Uint8Array(8 + 32);
    new DataView(abierta.buffer).setUint32(0, 0);
    abierta.set(texto('mdat'), 4);

    expect(() => analizarCabecera(buffer(FTYP, abierta))).not.toThrow();
  });

  it('un tamaño imposible no cuelga el bucle', () => {
    const rota = new Uint8Array(16);
    new DataView(rota.buffer).setUint32(0, 3); // menor que la propia cabecera
    rota.set(texto('moov'), 4);

    expect(() => analizarCabecera(buffer(FTYP, rota))).not.toThrow();
  });

  it('un archivo que no es MP4 no revienta', () => {
    expect(() => analizarCabecera(buffer(texto('esto no es un mp4')))).not.toThrow();
  });
});

describe('inspeccionarMp4', () => {
  it('NO lee más de 64 KB del archivo', async () => {
    const cabecera = buffer(FTYP, caja('moov', stsd('avc1')), caja('mdat'));
    const slice = vi.fn(() => ({ arrayBuffer: () => Promise.resolve(cabecera) }));

    // 200 MB: leerlo entero en el iPhone sería quedarse sin memoria antes de subir.
    await inspeccionarMp4({ size: 200 * 1024 * 1024, slice });

    expect(slice).toHaveBeenCalledTimes(1);
    expect(slice).toHaveBeenCalledWith(0, CABECERA_BYTES);
  });

  it('un archivo más pequeño que la ventana se lee entero, sin pedir de más', async () => {
    const cabecera = buffer(FTYP, caja('moov', stsd('avc1')), caja('mdat'));
    const slice = vi.fn(() => ({ arrayBuffer: () => Promise.resolve(cabecera) }));

    await inspeccionarMp4({ size: 1024, slice });

    expect(slice).toHaveBeenCalledWith(0, 1024);
  });
});

describe('validarMp4', () => {
  const archivo = { name: 'reel.mp4', size: 1000, type: 'video/mp4' };

  it('acepta H.264 con faststart', () => {
    expect(validarMp4(archivo, { faststart: true, codec: 'h264' })).toBeNull();
  });

  it('rechaza HEVC nombrando H.264, no "formato inválido"', () => {
    const error = validarMp4(archivo, { faststart: true, codec: 'hevc' });

    expect(error).toContain('H.264');
    expect(error).toContain('CapCut');
  });

  it('rechaza sin faststart explicando el síntoma que causaría', () => {
    const error = validarMp4(archivo, { faststart: false, codec: 'h264' });

    expect(error).toContain('CapCut');
  });

  it('el códec desconocido pasa: la API tiene la última palabra', () => {
    expect(validarMp4(archivo, { faststart: true, codec: 'desconocido' })).toBeNull();
  });
});
