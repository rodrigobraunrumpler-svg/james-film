import type { WhatsappSource } from '@james-film/contracts';
import type { IsoDate } from './fechas';
import { largo, rango } from './fechas';

/**
 * EL CONSTRUCTOR DE MENSAJES, y hay uno solo.
 *
 * Lo usan el hero, cada paquete, el calendario y el pie. Con cuatro sitios
 * armando la cadena, en dos semanas dicen cosas distintas.
 *
 * **El TEXTO BASE sale de la BASE, no de aquí.** `whatsappMessage` existe en
 * `SiteSettings` y en cada `Package`, y James los edita desde Configuración.
 * Esta función solo AÑADE la frase de contexto —la fecha, el rango, el «otra
 * fecha»— y nunca reescribe ni reordena el base.
 *
 * No es una preferencia: **el admin ya PROMETE esa igualdad.** Su botón de
 * «Probar este número» abre WhatsApp con ese mismo texto para que James vea lo
 * que va a pasar al pulsar el de la web. Si la web compusiera el suyo, ese
 * botón pasaría a mentir, y en silencio.
 */

/** De dónde salió el clic. Es una lista CERRADA en la API (`FUENTES`). */
/**
 * La lista la manda el CONTRATO, no una copia de aquí. Con dos listas, añadir
 * una fuente en la web compilaba y la API la rechazaba con un 422 que nadie ve.
 */
export type Fuente = WhatsappSource;

interface Opciones {
  /** El número en formato internacional SIN `+`. Sin prefijo no funciona nada. */
  numero: string;
  /** `paquete.whatsappMessage ?? ajustes.whatsappMessage`, ya resuelto. */
  base: string;
  /** Una fecha, o dos para un rango. */
  desde?: IsoDate | null;
  hasta?: IsoDate | null;
  /** El día elegido está ocupado: se pregunta por otra fecha, no se calla. */
  ocupado?: boolean;
}

/**
 * LA SEGUNDA LÍNEA. Vacía si no hay fecha.
 *
 * Va aparte y no pegada al base porque el mensaje tiene **dos lectores con
 * intereses distintos**:
 *
 *  · El CLIENTE lo manda. Lo ve en su pantalla, con su nombre encima, antes de
 *    pulsar enviar. Si parece un formulario generado por una máquina le da
 *    corte y lo reescribe — y ahí se pierde el dato.
 *  · JAMES lo recibe entre otros veinte, mirando el móvil un segundo entre
 *    grabación y grabación. Su primera pregunta es SIEMPRE la fecha: está
 *    verificado en una conversación real suya, donde preguntó «qué fecha será
 *    señorita su boda» antes que nada y tardó 23 minutos en el mensaje
 *    siguiente. Ese hueco es donde se pierden clientes.
 *
 * Dos líneas contentan a los dos: la primera es la frase de James tal cual —la
 * voz del cliente— y la segunda lleva el dato, siempre en el mismo sitio.
 *
 * **Sin negrita**, y no es por sobriedad: WhatsApp no formatea hasta que el
 * mensaje se ENVÍA, así que el cliente vería `*sábado 12*` con los asteriscos
 * crudos justo en el momento de decidir si lo manda. Un mensaje que parece roto
 * ahí cuesta el clic, que es lo único que este proyecto mide.
 *
 * **Y SIN EMOJI, por el MISMO argumento que echó a la negrita.** Llevaba un
 * 📅 de ancla, y en un WhatsApp Web sin fuente de emoji instalada se pinta como
 * `�` —el carácter de reemplazo— justo en el cuadro de texto, o sea justo en el
 * momento en que el cliente decide si lo manda. Visto con los ojos, no
 * supuesto. El enlace que genera la web es correcto (`%F0%9F%93%85`, UTF-8
 * impecable); el que falla es el equipo donde se abre, y ésos no los elegimos
 * nosotros.
 *
 * El ancla que hacía el emoji la hace ya la LÍNEA EN BLANCO: el dato está
 * siempre solo, en su propio párrafo y en el mismo sitio. Un carácter fuera del
 * BMP en el único texto que decide el negocio es riesgo sin contrapartida.
 */
function contexto({ desde, hasta, ocupado }: Opciones): string {
  if (!desde) return '';
  if (ocupado) {
    // Un día ocupado NO es un callejón: el que quería el 12 muchas veces coge
    // el 19, y perder a ése sí es perder. Por eso se pregunta, no se pide perdón.
    return `${largo(desde)}. Vi que está ocupado, ¿tienes otra fecha por esas semanas?`;
  }
  if (hasta && hasta !== desde) return `${rango(desde, hasta)}. ¿Los tienes libres?`;
  return `${largo(desde)}. ¿Lo tienes libre?`;
}

export function mensaje(o: Opciones): string {
  // Si el base viene vacío, la frase de contexto ES el mensaje: nunca se manda
  // un enlace de WhatsApp con el cuadro de texto en blanco.
  const base = o.base.trim();
  const extra = contexto(o).trim();
  if (!base) return extra;
  if (!extra) return base;
  /**
   * Se PUNTÚA la costura, no se reescribe el base.
   *
   * El texto que James edita en Configuración no tiene por qué acabar en punto,
   * y al pegarle la frase de contexto salía «…me interesa contratar tus
   * servicios Vi que el sábado 5 está ocupado». Añadir el punto no reordena ni
   * cambia una palabra suya: solo cierra la frase antes del salto.
   *
   * El salto es DOBLE: WhatsApp junta visualmente dos líneas seguidas y el
   * bloque se lee como un párrafo, que es justo lo que se quería evitar.
   */
  const cerrado = /[.!?…]$/.test(base) ? base : `${base}.`;
  return `${cerrado}\n\n${extra}`;
}

/** El enlace completo. `wa.me` con el número sin `+` y el texto codificado. */
export function enlace(o: Opciones): string {
  return `https://wa.me/${o.numero}?text=${encodeURIComponent(mensaje(o))}`;
}
