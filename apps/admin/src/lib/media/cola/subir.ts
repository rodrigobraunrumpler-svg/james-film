export interface ProgresoSubida {
  cargado: number;
  total: number;
}

export interface OpcionesSubida {
  url: string;
  cuerpo: Blob;
  contentType: string;
  onProgreso?: (p: ProgresoSubida) => void;
  /** Se llama con la función de aborto en cuanto la subida arranca. */
  onArrancar?: (abortar: () => void) => void;
  /** Sin eventos durante este tiempo se aborta. NO es un timeout global. */
  estancadoMs?: number;
  crearXhr?: () => XMLHttpRequest;
  ahora?: () => number;
}

export class ErrorSubida extends Error {
  constructor(
    message: string,
    readonly causa: 'estado' | 'red' | 'estancado' | 'cancelado',
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ErrorSubida';
  }
}

/**
 * 30 s SIN NINGÚN evento, nunca "progreso lento": 115 MB por 4G tardan minutos
 * legítimamente, y abortar por lentitud tiraría los 20 MB ya subidos de una
 * conexión sana. En móvil la degradación típica no es un error, es un
 * estancamiento — y el hueco de concurrencia quedaría ocupado para siempre.
 */
const ESTANCADO_MS = 30_000;
const LATIDO_MS = 5_000;

/**
 * `XMLHttpRequest` y no `fetch`: fetch no emite progreso de SUBIDA (§17), y sin
 * progreso real la barra sería indeterminada — justo lo que §9 prohíbe para las
 * subidas, que es donde James más necesita saber si avanza.
 */
export function subir(opciones: OpcionesSubida): Promise<void> {
  const {
    url,
    cuerpo,
    contentType,
    onProgreso,
    onArrancar,
    estancadoMs = ESTANCADO_MS,
    crearXhr = () => new XMLHttpRequest(),
    ahora = () => Date.now(),
  } = opciones;

  return new Promise<void>((resolver, fallar) => {
    const xhr = crearXhr();
    let ultimoEvento = ahora();
    let cancelado = false;

    const vigilante = setInterval(() => {
      if (ahora() - ultimoEvento <= estancadoMs) return;
      clearInterval(vigilante);
      cancelado = true;
      xhr.abort();
      fallar(new ErrorSubida('La subida se quedó parada. Reintentando…', 'estancado'));
    }, LATIDO_MS);

    const terminar = () => clearInterval(vigilante);

    xhr.upload.onprogress = (e) => {
      ultimoEvento = ahora();
      onProgreso?.({ cargado: e.loaded, total: e.total || cuerpo.size });
    };

    xhr.onload = () => {
      terminar();
      if (xhr.status >= 200 && xhr.status < 300) return resolver();
      fallar(new ErrorSubida(`El almacenamiento rechazó el archivo.`, 'estado', xhr.status));
    };

    xhr.onerror = () => {
      terminar();
      // R2 puede responder 403 SIN cabeceras CORS, y entonces el navegador lo
      // entrega como error de red genérico: aquí no hay status que leer. Por eso
      // el remedio del reintento es re-firmar siempre, no interpretar el fallo.
      fallar(new ErrorSubida('No se pudo conectar con el almacenamiento.', 'red'));
    };

    xhr.onabort = () => {
      terminar();
      if (!cancelado) fallar(new ErrorSubida('Subida cancelada.', 'cancelado'));
    };

    xhr.open('PUT', url);
    // SOLO el Content-Type firmado y ninguna cabecera más, o el bucket devuelve
    // 403: la firma incluye la lista exacta de cabeceras.
    xhr.setRequestHeader('Content-Type', contentType);

    onArrancar?.(() => {
      cancelado = true;
      xhr.abort();
      terminar();
      fallar(new ErrorSubida('Subida cancelada.', 'cancelado'));
    });

    xhr.send(cuerpo);
  });
}
