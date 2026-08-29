import { beforeEach, describe, expect, it, vi } from 'vitest';

const firmar = vi.fn();
const subir = vi.fn();
const normalizarImagen = vi.fn();

vi.mock('./servicios', () => ({ subidas: { firmar: (d: unknown) => firmar(d) } }));
vi.mock('./cola/subir', () => ({ subir: (o: unknown) => subir(o) }));
vi.mock('./validacion/normalizar-imagen', () => ({
  normalizarImagen: (a: unknown) => normalizarImagen(a),
}));

const { subirImagen } = await import('./subir-imagen');

const svg = (contenido = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>') =>
  new File([contenido], 'logo.svg', { type: 'image/svg+xml' });

const jpg = () => new File([new Uint8Array(64)], 'foto.jpg', { type: 'image/jpeg' });

beforeEach(() => {
  vi.clearAllMocks();
  firmar.mockResolvedValue({ data: { key: 'brand/uuid.svg', uploadUrl: 'https://r2/put' } });
  subir.mockResolvedValue(undefined);
  normalizarImagen.mockResolvedValue({
    blob: new Blob([new Uint8Array(32)], { type: 'image/jpeg' }),
    width: 1200,
    height: 800,
  });
});

describe('subirImagen', () => {
  it('un SVG NO pasa por normalizarImagen: se subiría rasterizado', async () => {
    // El síntoma sería «el logo se ve borroso en pantallas grandes», y nadie
    // lo ataría a la subida.
    await subirImagen({ archivo: svg(), proposito: 'LOGO' });

    expect(normalizarImagen).not.toHaveBeenCalled();
    expect(subir).toHaveBeenCalledWith(expect.objectContaining({ contentType: 'image/svg+xml' }));
  });

  it('un SVG con código dentro se rechaza antes de firmar nada', async () => {
    const malicioso = svg('<svg><script>alert(1)</script></svg>');

    await expect(subirImagen({ archivo: malicioso, proposito: 'LOGO' })).rejects.toThrow(/SVG/);
    expect(firmar).not.toHaveBeenCalled();
  });

  it('una foto SÍ se normaliza, y se firma con el tamaño FINAL', async () => {
    // La firma incluye content-length: firmar con el tamaño original dejaría un
    // 403 permanente al subir el normalizado.
    await subirImagen({ archivo: jpg(), proposito: 'PORTADA_CATEGORIA' });

    expect(normalizarImagen).toHaveBeenCalled();
    expect(firmar).toHaveBeenCalledWith({
      proposito: 'PORTADA_CATEGORIA',
      mimeType: 'image/jpeg',
      sizeBytes: 32,
    });
  });

  it('devuelve la KEY, no la URL: en la base va la key', async () => {
    const r = await subirImagen({ archivo: jpg(), proposito: 'OG' });

    expect(r.key).toBe('brand/uuid.svg');
    expect(r).not.toHaveProperty('url');
  });

  it('devuelve las dimensiones de la imagen normalizada', async () => {
    const r = await subirImagen({ archivo: jpg(), proposito: 'IMAGEN_PAQUETE' });

    expect(r).toMatchObject({ width: 1200, height: 800 });
  });

  it('si la subida falla, NO devuelve una clave que no existe en el bucket', async () => {
    // Guardarla dejaría la columna apuntando a un objeto que nunca llegó, y la
    // landing pintaría un hueco sin que nada haya fallado visiblemente.
    subir.mockRejectedValue(new Error('red'));

    await expect(subirImagen({ archivo: jpg(), proposito: 'OG' })).rejects.toThrow();
  });

  it('informa del progreso real', async () => {
    subir.mockImplementation(async (o: { onProgreso?: (p: unknown) => void }) => {
      o.onProgreso?.({ cargado: 25, total: 100 });
    });
    const progresos: number[] = [];

    await subirImagen({ archivo: jpg(), proposito: 'OG', onProgreso: (f) => progresos.push(f) });

    expect(progresos).toEqual([0.25]);
  });
});
