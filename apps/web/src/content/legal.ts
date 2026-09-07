/**
 * Los tres documentos legales.
 *
 * No son relleno: `CLAUDE.md` los llama **el único punto que puede traerle un
 * problema real a James**, porque publica caras de gente —y en los XV, de
 * MENORES— y porque la Ley 29733 obliga a decir qué se hace con los datos.
 *
 * Están escritos en el idioma que habla su cliente, no en jerga: quien entra a
 * ver reels de una boda no va a leer tres pantallas de artículos. Cada sección
 * dice **qué pasa**, no qué dice la norma.
 *
 * DOS COSAS QUE NO SE INVENTAN AQUÍ:
 *  · No hay RUC, ni razón social, ni dirección fiscal. James no los ha dado, y
 *    ponerlos a ojo sería peor que no tenerlos: un dato falso en un aviso de
 *    privacidad es exactamente el problema del que protege. **El correo SÍ
 *    existe** —está en `SiteSettings.email`— y desde ahora es el canal escrito
 *    para ejercer derechos; el WhatsApp sigue siendo el rápido.
 *  · Esto lo tiene que leer un abogado antes de que la web salga. Es un texto
 *    honesto sobre lo que la web hace de verdad, no un dictamen.
 *
 * LO QUE FALTA Y DEPENDE DE JAMES, escrito aquí para que no se pierda: el
 * art. 18 de la Ley 29733 obliga a identificar al TITULAR del banco de datos
 * —nombre o razón social y domicilio— y a publicar la finalidad y los plazos de
 * conservación. La sección «Quién responde de esto» ya existe abajo con lo que
 * se sabe hoy; en cuanto James dé esos datos, entran ahí. **Los plazos no se
 * escriben de memoria**: el reglamento vigente es el del DS 016-2024-JUS y un
 * plazo publicado es exigible.
 */

/**
 * Se sube A MANO al cambiar cualquier texto de este fichero. Derivarlo de la
 * fecha de build lo movería en cada despliegue y diría «actualizado hoy»
 * cuando no ha cambiado ni una coma.
 */
export const ACTUALIZADO = '2026-09-05';

export interface SeccionLegal {
  titulo: string;
  parrafos?: string[];
  lista?: string[];
}

export interface DocumentoLegal {
  slug: string;
  titulo: string;
  entradilla: string;
  secciones: SeccionLegal[];
}

/**
 * QUIÉN RESPONDE. Va en los TRES documentos, no en uno.
 *
 * El art. 18 de la Ley 29733 obliga a identificar al titular del banco de datos
 * y a decir cómo contactarlo. Faltaba entero: los tres documentos explicaban
 * muy bien qué se hace con los datos y ninguno decía quién lo hace.
 *
 * Se escribe con lo que es CIERTO hoy —el nombre comercial y el correo— y no
 * con un RUC inventado. **Cuando James dé razón social y domicilio, entran
 * aquí**, en este único sitio, y aparecen en los tres a la vez.
 */
const QUIEN_RESPONDE: SeccionLegal = {
  titulo: 'Quién responde de esto',
  parrafos: [
    'Detrás de esta web hay una persona, no una empresa con departamento legal: James, creador de contenido audiovisual en Ayacucho. Él decide qué se publica y él responde de lo que se guarda.',
    'Para cualquier cosa relacionada con tus datos o tu imagen —preguntar, corregir o pedir que se retire algo— el correo está en el pie de cualquier página, y el WhatsApp en la barra de arriba. Los dos llegan a la misma persona.',
  ],
};

export const LEGALES_DOC: DocumentoLegal[] = [
  {
    slug: 'privacidad',
    titulo: 'Política de privacidad',
    entradilla:
      'Esta web no te pide datos. No hay formulario, no hay registro y no hay boletín. Aun así, la Ley 29733 obliga a explicar qué ocurre con la poca información que se maneja, y aquí está, sin letra pequeña.',
    secciones: [
      {
        titulo: 'Qué NO se recoge',
        parrafos: [
          'No hay ningún formulario de contacto en esta web. No se te pide el nombre, ni el correo, ni el teléfono, ni ningún otro dato personal para navegar por ella.',
          'Tampoco se usan cookies de publicidad ni de seguimiento entre webs. No hay Google Analytics, ni píxel de Facebook, ni nada parecido.',
        ],
      },
      {
        titulo: 'Qué se guarda en tu propio navegador',
        parrafos: [
          'Si eliges el tema claro u oscuro, esa preferencia se guarda en tu dispositivo para que la web se vea igual la próxima vez. No sale de ahí, no se envía a ningún servidor y puedes borrarla vaciando los datos del sitio desde tu navegador.',
        ],
      },
      {
        titulo: 'Qué se registra al pulsar el botón de WhatsApp',
        parrafos: [
          'Cuando pulsas un botón de WhatsApp se registra que alguien lo pulsó, desde qué parte de la página y, si venía de un paquete concreto, cuál era. Sirve para saber qué secciones funcionan.',
          'Ese registro NO incluye tu número, ni tu nombre, ni tu mensaje, ni nada que permita identificarte. Es un recuento, no un perfil.',
        ],
      },
      {
        titulo: 'Qué pasa cuando escribes por WhatsApp',
        parrafos: [
          'A partir de ese momento la conversación ocurre dentro de WhatsApp, con las condiciones de privacidad de esa aplicación, que no dependen de esta web.',
          'Lo que se hable ahí —tu nombre, la fecha del evento, el lugar— se usa únicamente para atender tu consulta y, si contratas, para organizar el trabajo. No se cede a terceros ni se usa para enviarte publicidad.',
        ],
      },
      {
        titulo: 'Dónde vive lo que se publica',
        parrafos: [
          'Los vídeos y las fotos que ves aquí están alojados en servidores de Cloudflare, y los datos de la web en una base de datos alojada en Estados Unidos. Al ser un almacenamiento fuera del Perú, esto constituye un flujo transfronterizo de datos, y se te informa de ello como exige la ley.',
        ],
      },
      {
        titulo: 'Tus derechos',
        parrafos: [
          'La Ley 29733 te reconoce los derechos de acceso, rectificación, cancelación y oposición sobre tus datos personales. En la práctica, sobre esta web eso significa sobre todo una cosa: puedes pedir que se retire cualquier vídeo o foto donde aparezcas.',
        ],
        lista: [
          'Se atiende por el WhatsApp que aparece en esta web, que es el camino rápido.',
          'Y también por correo, que está en el pie de cualquier página. Escribir por correo deja constancia de la fecha, y desde esa fecha corren los plazos: si te importa que quede registro, usa ese.',
          'No hace falta explicar por qué. Basta con decir qué material es.',
          'Se retira de la web en cuanto se lee el mensaje, sin discutirlo.',
          'Si crees que no se ha respetado tu derecho, puedes acudir a la Autoridad Nacional de Protección de Datos Personales del Ministerio de Justicia y Derechos Humanos del Perú.',
        ],
      },
      {
        titulo: 'Cambios',
        parrafos: [
          'Si esta política cambia, cambia la fecha de arriba. No se avisa por correo porque no hay ninguna lista de correo a la que avisar.',
        ],
      },
      QUIEN_RESPONDE,
    ],
  },
  {
    slug: 'terminos',
    titulo: 'Términos del servicio',
    entradilla:
      'Lo que se acuerda al contratar, dicho antes de contratar. Nada de esto sustituye a lo que se hable por WhatsApp: si algo se pacta distinto, manda lo pactado.',
    secciones: [
      {
        titulo: 'Qué es este servicio',
        parrafos: [
          'Creación de contenido audiovisual para eventos: reels y TikToks verticales, y aftermovies cortos. Bodas, XV años, cumpleaños y eventos en general, en Ayacucho y alrededores.',
          'No es un servicio de fotografía de estudio ni de cobertura fotográfica tradicional. Lo que se entrega son vídeos pensados para redes sociales.',
        ],
      },
      {
        titulo: 'Los precios de esta web son referenciales',
        parrafos: [
          'Los precios que aparecen en los paquetes son una referencia para que te hagas una idea. El precio real cambia según la distancia hasta el lugar, las horas de cobertura y lo que incluya el evento.',
          'El precio definitivo se confirma por WhatsApp antes de reservar nada. Mientras no haya un precio confirmado por escrito, no hay acuerdo.',
        ],
      },
      {
        titulo: 'Reserva y pago',
        parrafos: [
          'La fecha se reserva con un adelanto acordado; el resto se paga el día del evento, salvo que se pacte otra cosa. Sin adelanto, la fecha no queda bloqueada y puede tomarla otra persona.',
        ],
      },
      {
        titulo: 'Entrega',
        parrafos: [
          'Los primeros reels se entregan en el plazo que indique el paquete contratado, contado desde el final del evento. El material completo se entrega después, por enlace de descarga.',
          'La entrega es digital. No se envían USB ni discos salvo que se acuerde aparte.',
        ],
      },
      {
        titulo: 'Si llueve o el evento se mueve',
        parrafos: [
          'Se graba igual: lo que cambia es dónde nos ponemos, no si se hace. Si el evento entero se cambia de fecha, se traslada la reserva a la nueva fecha siempre que esté libre, sin coste adicional.',
          'Si el evento se cancela, el adelanto cubre la fecha que quedó bloqueada y no se devuelve.',
        ],
      },
      {
        titulo: 'Cambios sobre lo entregado',
        parrafos: [
          'Cada paquete incluye una ronda de ajustes sobre lo entregado: cortes, música, textos. Cambios más allá de eso se presupuestan aparte.',
        ],
      },
      {
        titulo: 'Los derechos sobre el material',
        parrafos: [
          'El material grabado es obra de James Film y se entrega para tu uso personal: publicarlo en tus redes, compartirlo con tu familia, guardarlo.',
          'No se autoriza su uso comercial ni su reventa por parte de terceros sin permiso.',
          'James Film conserva el derecho de mostrar el material en su portafolio, salvo que pidas lo contrario. Eso se explica en el aviso de uso de imagen.',
        ],
      },
      QUIEN_RESPONDE,
    ],
  },
  {
    slug: 'uso-de-imagen',
    titulo: 'Uso de imagen',
    entradilla:
      'Aquí se publican caras de gente real. Esta página explica con qué permiso, y cómo se quita cualquier material en el que aparezcas. Es la parte más importante de las tres.',
    secciones: [
      {
        titulo: 'Qué se publica en esta web',
        parrafos: [
          'Fragmentos de los trabajos realizados: reels y aftermovies de bodas, XV años, cumpleaños y otros eventos. En ellos aparecen las personas que estaban en esos eventos.',
          'Solo se publica material de eventos cuyos contratantes han dado su autorización. Si un cliente no quiere que su evento aparezca, no aparece.',
        ],
      },
      {
        titulo: 'Menores de edad',
        parrafos: [
          'En los XV años y en muchos cumpleaños aparecen menores. Su imagen solo se publica con la autorización expresa del padre, la madre o quien tenga la tutela, y esa autorización se pide de forma específica, no dentro de una lista de condiciones generales.',
          'Esa autorización se puede retirar en cualquier momento y sin dar explicaciones. Al retirarla, el material se quita de la web.',
        ],
      },
      {
        titulo: 'Los testimonios',
        parrafos: [
          'Los mensajes de clientes que aparecen en la web son reales y se publican solo con permiso de quien los escribió. Ningún testimonio se publica sin ese permiso: es una condición del propio sistema, no una promesa.',
        ],
      },
      {
        titulo: 'Cómo pedir que se retire algo',
        parrafos: [
          'Si apareces en algún vídeo o foto de esta web y no quieres estar, escríbelo por el WhatsApp que aparece en la página. Es el camino más rápido y no necesitas justificar nada.',
          'Si prefieres que quede constancia por escrito, el correo está en el pie de cualquier página. Vale igual y deja fecha.',
        ],
        lista: [
          'Basta con decir en qué trabajo apareces. No hace falta señalar el segundo exacto.',
          'Se retira de la web en cuanto se lee el mensaje.',
          'Si el material ya se publicó en redes sociales, también se retira de ahí.',
          'Lo que ya haya descargado o compartido otra persona queda fuera del alcance de esta web, y así hay que decirlo.',
        ],
      },
      {
        titulo: 'Si contrataste el servicio',
        parrafos: [
          'Contratar el servicio no obliga a que tu evento salga en el portafolio. Puedes pedir que no se publique nada del tuyo, antes o después, y no cambia el precio ni el trabajo entregado.',
        ],
      },
      QUIEN_RESPONDE,
    ],
  },
];
