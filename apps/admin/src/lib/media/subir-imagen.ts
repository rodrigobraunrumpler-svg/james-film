import type { UploadPurpose } from '@james-film/contracts';
import { subir } from './cola/subir';
import { subidas } from './servicios';
import { ErrorValidacion } from './validacion/errores';
import { normalizarImagen } from './validacion/normalizar-imagen';

/** Un SVG no se rasteriza: convertirlo lo dejaría en un PNG del tamaño del viewBox. */
const ES_VECTOR = 'image/svg+xml';

/**
 * Comprobación BARATA, no una frontera de seguridad — es trivial de esquivar y
 * el comentario está aquí para que nadie crea lo contrario. La frontera real es
 * el ORIGEN: R2 se sirve desde el subdominio `media.`, distinto al de la
 * landing, así que un `<script>` dentro de un SVG no toca ni sus cookies ni su
 * DOM. Esto solo atrapa el caso accidental: un export con metadatos raros.
 */
const SOSPECHOSO = /<script|onload\s*=|javascript:/i;

export interface ResultadoSubida {
  /** Lo que se guarda en la columna. NUNCA la URL. */
  key: string;
  width?: number;
  height?: number;
}

export interface OpcionesSubirImagen {
  archivo: File;
  proposito: UploadPurpose;
  onProgreso?: (fraccion: number) => void;
}

/**
 * Normaliza, firma y sube — en ese orden, porque la firma incluye el
 * `content-length` y hay que conocer el tamaño FINAL antes de pedirla.
 */
export async function subirImagen({
  archivo,
  proposito,
  onProgreso,
}: OpcionesSubirImagen): Promise<ResultadoSubida> {
  let blob: Blob = archivo;
  let dimensiones: { width?: number; height?: number } = {};

  if (archivo.type === ES_VECTOR) {
    // El SVG se sube TAL CUAL: pasarlo por normalizarImagen lo decodificaría a
    // bitmap y devolvería un PNG. El síntoma sería «el logo se ve borroso en
    // pantallas grandes» y nadie lo ataría a la subida.
    const texto = await archivo.text();
    if (SOSPECHOSO.test(texto)) {
      throw new ErrorValidacion(
        `«${archivo.name}» lleva código dentro. Vuelve a exportarlo como SVG plano.`,
      );
    }
  } else {
    const normalizada = await normalizarImagen(archivo);
    blob = normalizada.blob;
    dimensiones = { width: normalizada.width, height: normalizada.height };
  }

  const { data } = await subidas.firmar({
    proposito,
    mimeType: blob.type,
    sizeBytes: blob.size,
  });

  await subir({
    url: data.uploadUrl,
    cuerpo: blob,
    contentType: blob.type,
    onProgreso: ({ cargado, total }) => onProgreso?.(total > 0 ? cargado / total : 0),
  });

  return { key: data.key, ...dimensiones };
}
