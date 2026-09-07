/**
 * Los textos que James NO edita.
 *
 * La regla: lo que él cambia desde el panel viene de la API; lo estructural
 * vive aquí. **Un texto en dos sitios es un texto que se contradice** — y el
 * que gana suele ser el que él no ve.
 *
 * Aquí no hay ni un precio, ni un número de WhatsApp, ni el titular del hero:
 * todo eso es suyo y se edita en Configuración.
 */

/**
 * La oferta, con las palabras que la gente TECLEA.
 *
 * Contado sobre el build: «XV años» salía 11 veces y **«15 años» cero**, igual
 * que «filmación» y «matrimonio». La web hablaba en vocabulario de productor
 * —«reels», «aftermovie»— y el cliente busca en el suyo. Se escribe la variante
 * **una vez**, donde cabe sin forzar la voz: repetir sinónimos es relleno, se
 * nota al leer, y esta página tiene una voz que funciona.
 */
export const OFERTA =
  'Reels y aftermovies para **bodas, XV años (15 años) y cumpleaños**. Te llegan en 48 horas, listos para subir.';

/** Las pistas. Una por acción, y dice lo que VA A PASAR, no lo que la cosa es. */
export const PISTAS = {
  whatsapp: 'Se abre tu WhatsApp con el mensaje ya escrito. Preguntar no cuesta nada.',
  whatsappCorta: 'Se abre tu WhatsApp con el mensaje ya escrito.',
  paquetes: 'Compáralos y dime cuál te sirve. Si ninguno encaja, lo armamos a tu medida.',
  precios:
    'Los precios son referenciales: cambian según la distancia y las horas. Escríbeme y te digo el tuyo.',
  galerias: 'Vertical, para el celular. Es exactamente lo que subes a tus redes.',
  galeria: 'Toca cualquiera para verlo a pantalla completa. Así se entrega.',
  calendario: 'Toca el día de tu evento y te escribo con la fecha ya puesta.',
  diaOcupado: 'Ese día ya está tomado. Toca para preguntar por otra fecha.',
  preguntas: '¿Te queda otra duda? Pregúntamela por WhatsApp, contesto yo mismo.',
} as const;

/**
 * La cifra del bento. Va en NEGATIVO en los dos temas: entre tarjetas claras,
 * una oscura es lo que hace que el número salte. No sale de la base porque no
 * es un dato editable, es la promesa de la marca — y si un día cambia, cambia
 * también el copy de los paquetes.
 */
export const CIFRA_BENTO = {
  /**
   * ⚠ Aquí ponía **24 horas** y era el mismo dato falso que «7 reels»: el
   * flyer da **48h en el Básico y el Pro**, y 24h **solo en el Premium**. La
   * web prometía a todos la entrega del caro.
   *
   * 48 sigue siendo un número que nadie más en Ayacucho pone por escrito, y el
   * 24 se gana pagando — que es exactamente lo que hace que suba de paquete.
   */
  numero: '48 horas',
  que: 'tardan en llegarte tus reels',
  detalle: 'Con el Premium, en 24. Sin excepciones y sin recordártelo.',
} as const;

/** Las cabeceras de sección. */
export const SECCIONES = {
  confianza: { eyebrow: 'Por qué yo', titulo: 'No es grabar. Es que se vea.' },
  como: { eyebrow: 'Cómo funciona', titulo: 'Sin sorpresas, en tres pasos' },
  recibes: { eyebrow: 'Qué recibes', titulo: 'Lo que te llega al celular' },
  categorias: { eyebrow: 'Lo que grabo', titulo: 'Cada evento tiene su ritmo' },
  trabajos: { eyebrow: 'Trabajos', titulo: 'Míralos como te van a llegar' },
  paquetes: { eyebrow: 'Paquetes', titulo: 'Elige el que te encaje' },
  calendario: { eyebrow: 'Disponibilidad', titulo: '¿Está libre tu día?' },
  testimonios: { eyebrow: 'Lo que dicen', titulo: 'Mensajes de después del evento' },
  preguntas: { eyebrow: 'Antes de escribir', titulo: 'Lo que siempre me preguntan' },
  sobreMi: { eyebrow: 'Sobre mí', titulo: '' },
  cierre: { titulo: '¿Qué día es tu evento?' },
} as const;

/** Los tres pasos. Es la sección que quita el miedo a lo que pasa DESPUÉS. */
export const PASOS = [
  {
    titulo: 'Me escribes por WhatsApp',
    texto:
      'Me dices la fecha y el tipo de evento. Te confirmo si estoy libre y cuánto cuesta el tuyo.',
  },
  {
    titulo: 'Grabo tu evento',
    texto: 'Llego con equipo y luz propios. Tú no tienes que organizar nada.',
  },
  {
    titulo: 'En 48 horas tienes tus reels',
    texto: 'Te llegan al celular, listos para subir. Con el Premium, en 24.',
  },
] as const;

/** Qué recibe. Se paga por un archivo que aún no existe; esto lo hace una cosa. */
export const ENTREGABLES = [
  {
    icono: 'movil',
    // «7 reels» era el mismo dato falso de la tira: el flyer da 4, 6 o 7 según
    // el paquete. Aquí se dice lo que SIEMPRE es cierto —la forma— y el número
    // lo dice cada tarjeta de paquete, que es donde se decide.
    titulo: 'Tus reels verticales',
    texto: 'De 20 a 60 segundos, con música y textos. Listos para subir.',
  },
  {
    icono: 'video',
    titulo: '1 aftermovie',
    // Del flyer: Pro 1-2 min, Premium 2-3. El Básico NO lo lleva, y por eso
    // esta tarjeta dice «en el Pro y el Premium» en vez de prometerlo a todos.
    texto: 'El resumen del día, de 1 a 3 minutos. En el Pro y el Premium.',
  },
  {
    icono: 'descarga',
    titulo: 'Todo el material bruto',
    texto: 'Sin editar, por si algún día lo quieres. Es tuyo.',
  },
  {
    icono: 'reloj',
    // El flyer da 48h en Básico y Pro, y 24h solo en el Premium. «En 24 horas»
    // a secas prometía la entrega del caro a quien contrata el barato.
    titulo: 'Por un enlace, sin USB',
    texto: 'En 48 horas —24 con el Premium—. Lo abres desde el celular y lo descargas.',
    destacado: true,
  },
] as const;

/**
 * Lo que NO cambia entre paquetes. Va antes de compararlos porque mata el miedo
 * a «elegir el barato y quedarme sin algo».
 *
 * ⚠ **Aquí ponía «7 reels» y era MENTIRA.** El flyer dice 4 · 6 · 7, así que la
 * web prometía a quien contrata el Básico casi el doble de lo que recibe. Se
 * quedan solo las promesas que el flyer sostiene en los tres:
 *  · «Material bruto» — Básico «incluido», Premium «en alta calidad».
 *  · «Cortes dinámicos y ganchos» — literal en Básico y Pro.
 *  · Vertical 9:16 y equipo propio son la marca, no un extra del paquete.
 *
 * La escalera ahora la hace la CANTIDAD (4 → 6 → 7), que se lee sola en las
 * tarjetas y es mejor argumento que una promesa igual para todos.
 */
export const EN_LOS_TRES = [
  'Vertical 9:16',
  'Equipo y luz propios',
  'Cortes dinámicos y ganchos',
  'Material bruto',
] as const;

/** Las cuatro preguntas que frenan de verdad. */
export const PREGUNTAS = [
  {
    // La consulta de más intención del negocio —«cuánto cuesta un video de boda
    // en Ayacucho»— y no había ni una línea que la respondiera. Va la primera:
    // es lo que frena antes de escribir, y casi nadie por aquí publica precios.
    p: '¿Cuánto cuesta un video de boda o de 15 años en Ayacucho?',
    r: 'Desde S/ 300 el Básico, S/ 600 el Pro y S/ 900 el Premium. Cambia según las horas de cobertura y la distancia, así que escríbeme y te digo el tuyo antes de cerrar nada.',
  },
  {
    p: '¿Viajas fuera de Ayacucho?',
    r: 'Sí. Filmación en Huanta, Huamanga y alrededores sin recargo; más lejos lo hablamos y te digo el precio antes de cerrar nada.',
  },
  {
    p: '¿Cuándo tengo que pagar?',
    r: 'Una parte al reservar la fecha y el resto el día del evento. Sin adelanto no aparto el día.',
  },
  {
    p: '¿Y si el día se pone feo o llueve?',
    r: 'Se graba igual: llevo luz propia. Lo que cambia es dónde hacemos las tomas de pareja, y eso lo resolvemos ahí mismo.',
  },
  {
    p: '¿Puedo pedir cambios en los reels?',
    r: 'Una ronda de ajustes entra en todos los paquetes. Me dices qué cambiar y te lo devuelvo corregido.',
  },
] as const;

/**
 * El menú. CUATRO y no más: cada entrada es una salida que aleja del botón
 * verde. Diferenciadores y Categorías se cruzan bajando, no se navegan.
 */
/**
 * Hay DOS entradas para «Trabajos» y dos para «Testimonios», y no es un
 * descuido: una es el ancla de la portada y la otra la página propia.
 *
 * La portada pasa `#trabajos` —ahí la sección existe y el observador la marca
 * al pasar— y **las demás páginas pasan `/trabajos`**, que es una página que el
 * build genera siempre. Antes todas llevaban `#trabajos` escrito a mano: sin
 * galerías publicadas la portada no pinta esa sección, así que tocar «Trabajos»
 * desde `/negocios` te dejaba arriba de la portada sin moverte a ningún sitio.
 * Un enlace que no lleva a nada es peor que no tenerlo, y encima en el menú.
 *
 * Nunca aparecen las dos a la vez: `Barra` filtra por `anclas.includes(href)` y
 * ninguna página declara las dos. El orden de esta lista es el orden del menú,
 * por eso van pegadas a su pareja.
 *
 * **Con BARRA FINAL**, que es la forma canónica que emiten el `canonical` y el
 * sitemap (`build.format: 'directory'`, el defecto de Astro). Sin ella cada clic
 * del menú era una redirección 301 antes de pintar nada. Quien compare `href`
 * con `Astro.url.pathname` tiene que normalizar los dos lados.
 */
export const MENU = [
  { href: '#trabajos', texto: 'Trabajos', icono: 'play' },
  { href: '/trabajos/', texto: 'Trabajos', icono: 'play' },
  { href: '#paquetes', texto: 'Paquetes', icono: 'caja' },
  { href: '/fechas-libres/', texto: 'Fechas libres', icono: 'calendario' },
  { href: '/negocios/', texto: 'Negocios', icono: 'barras' },
  { href: '#testimonios', texto: 'Testimonios', icono: 'chat' },
  { href: '/testimonios/', texto: 'Testimonios', icono: 'chat' },
  { href: '/sobre-mi/', texto: 'Sobre mí', icono: 'persona' },
] as const;

/**
 * La línea de precio del hero, cuando todavía no hay eventos que contar.
 *
 * Va aquí y no suelta en el componente porque es texto de sección: no lo edita
 * James desde el panel, lo decide el proyecto. El número sí sale del dato —el
 * paquete más barato— y por eso entra como parámetro en vez de escrito.
 */
export const PRECIO_DESDE = (desde: string) =>
  `Paquetes desde ${desde} · te digo el tuyo por WhatsApp`;

/**
 * EL CUERPO de cada página de tipo de evento. Sin esto, la página no nace.
 *
 * Y esto corrige un fallo de diseño mío: la primera versión generaba
 * `/bodas/`, `/xv-anos/`… en cuanto la categoría tuviera `description` escrita
 * en el panel. Suena razonable y produce exactamente lo contrario de lo que se
 * buscaba: un `h1`, una frase, un párrafo, una rejilla vacía y **el mismo
 * bloque de paquetes que ya sale en la portada**. Cuatro páginas así son
 * *doorway pages* —Google las trata como spam— y con siete URLs indexables
 * serían más de la mitad del sitio arrastrando la confianza del dominio.
 *
 * El reparto: `description` en el panel es la ENTRADILLA, que James edita
 * cuando quiera; esto es el CUERPO, ~300 palabras propias por evento que se
 * escriben una vez. Y `getStaticPaths` exige las dos cosas, no una.
 *
 * **Se escribe UNA, se publica, y se mira cómo se comporta antes de escribir
 * las otras tres.** Los datos —qué se graba hora a hora, cuántas horas suele
 * necesitar, qué pasa en un salón de Ayacucho— los dicta James: eso no lo puede
 * inventar el código, y publicarlo a ojo sería el mismo error que «Resultados
 * comprobados».
 */
export interface ContenidoDeCategoria {
  /** Qué se graba, hora a hora. El apartado que ninguna otra página tiene. */
  comoEs: { titulo: string; texto: string }[];
  /** Preguntas de ESE evento, no las generales de la portada. */
  preguntas: { p: string; r: string }[];
}

export const CATEGORIA_CONTENIDO: Record<string, ContenidoDeCategoria> = {
  // Vacío a propósito. En cuanto haya un bloque aquí, esa categoría —y solo
  // esa— empieza a generar su página.
};

/** La tira de contexto: lo que se comprueba antes de escribir a un desconocido. */
/**
 * DÓNDE GRABA, en un solo sitio.
 *
 * Estaba en tres y no coincidían: la tira de contexto decía «Ayacucho y
 * alrededores», la respuesta del FAQ prometía «Huanta, Huamanga y alrededores»
 * y el `areaServed` del JSON-LD declaraba una sola ciudad. Tres verdades sobre
 * lo mismo, y la que lee la máquina era la más pobre.
 *
 * De aquí salen las tres. Y es además la lista que James copia tal cual en las
 * áreas de servicio de su ficha de Google, que es donde de verdad se decide si
 * aparece en el mapa: si las dos no coinciden, la incoherencia la ve Google.
 */
export const ZONAS = ['Ayacucho', 'Huamanga', 'Huanta'] as const;

export const CONTEXTO = {
  lugar: 'Ayacucho y alrededores',
  horario: 'Contesto de 9 a. m. a 9 p. m.',
} as const;

/** Los tres pasos del calendario. Quitan la duda de qué pasa al pulsar un día. */
export const PASOS_FECHA = [
  { n: 1, texto: 'Tocas el día de tu evento.' },
  { n: 2, texto: 'Se abre tu WhatsApp con la fecha ya escrita.' },
  { n: 3, texto: 'Te confirmo al momento si está libre.' },
] as const;

/**
 * Qué significa cada día. Sin esto la rejilla es decoración: la trama diagonal
 * no dice «ocupado» a nadie que no lo haya visto antes.
 */
export const ESTADOS_DIA = [
  { estado: 'libre', titulo: 'Libre', texto: 'Tócalo y te escribo con esa fecha.' },
  { estado: 'ocupado', titulo: 'Ocupado', texto: 'Ya está tomado. Tócalo y te paso las fechas más cercanas.' },
  /**
   * «Elegido» y no «Tu fecha». Los otros dos rótulos describen el ESTADO de la
   * casilla —libre, ocupado— y éste decía algo sobre quien mira: nosotros no
   * sabemos cuál es su fecha, solo cuál ha tocado. En una leyenda titulada «qué
   * significa cada día», eso se lee como una suposición.
   */
  {
    estado: 'elegido',
    titulo: 'Elegido',
    texto: 'El día que has tocado. Un segundo toque en otro coge el rango entre los dos.',
  },
] as const;

/** Con barra final, como el resto: es la forma canónica y evita la redirección. */
export const LEGALES = [
  { href: '/privacidad/', texto: 'Privacidad' },
  { href: '/terminos/', texto: 'Términos' },
  { href: '/uso-de-imagen/', texto: 'Uso de imagen' },
] as const;

/** La línea del flyer. Cierra la página con la voz de la marca. */
export const CIERRE_MARCA = 'HISTORIAS REALES. EMOCIONES REALES. RECUERDOS PARA SIEMPRE.';
