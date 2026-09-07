/**
 * La línea de PUBLICIDAD PARA NEGOCIOS.
 *
 * Sale entera del segundo flyer, palabra por palabra: no es contenido
 * inventado. Es media empresa que la web no tenía — restaurantes, gimnasios,
 * tiendas y corporativos— con otro público, otro mensaje y otro CTA:
 * «¡Hablemos de tu **proyecto**!», no «de tu evento».
 *
 * **No lleva precios, y es fiel al flyer**: el de eventos los publica y éste
 * no. Aquí la conversión es la conversación, no comparar tres columnas.
 */

export const NEGOCIOS = {
  eyebrow: 'Publicidad de negocios',
  titulo: 'Publicidad que vende, contenido que conecta.',
  entradilla:
    'Impulsa tu marca con contenido profesional que genera **confianza, visibilidad y ventas**.',
  segundo:
    'Trabajo con **influencers, modelos y anfitrionas** para crear piezas publicitarias que destacan tu negocio en cualquier plataforma.',
  cta: '¡HABLEMOS DE TU PROYECTO!',
  cierre: {
    titulo: 'Haz que tu marca sea imposible de ignorar.',
    // En singular como TODO el resto del sitio —«Soy James», «llego con equipo
    // propio», «contesto yo mismo»—. Dos voces en la misma web se leen como dos
    // negocios distintos, y el que contrata quiere saber quién va a ir.
    texto: 'Hago contenido que vende, conecta y posiciona tu negocio.',
  },
} as const;

/** El proceso, tal cual la tira del flyer. */
export const PROCESO_NEGOCIOS = [
  { icono: 'camara', texto: 'Grabación' },
  { icono: 'rayo', texto: 'Edición' },
  { icono: 'chat', texto: 'Publicidad' },
  { icono: 'barras', texto: 'Resultados' },
] as const;

/** «¿Qué creamos para tu negocio?» — los cinco del flyer, con su frase. */
export const QUE_CREAMOS = [
  {
    titulo: 'Publicidad para redes',
    texto: 'Videos cortos que atrapan y convierten.',
    icono: 'reproducir',
  },
  {
    titulo: 'Promoción de productos',
    texto: 'Resalta los beneficios y genera deseo.',
    icono: 'caja',
  },
  {
    titulo: 'Restaurantes y gastronomía',
    texto: 'Muestra tu sabor, ambiente y experiencia.',
    icono: 'camara',
  },
  {
    titulo: 'Negocios locales y servicios',
    texto: 'Contenido que posiciona tu marca localmente.',
    icono: 'ubicacion',
  },
  {
    titulo: 'Corporativos y empresas',
    texto: 'Imágenes que transmiten confianza y profesionalismo.',
    icono: 'personas',
  },
] as const;

/** Con quién trabaja. Es lo que ningún competidor de Ayacucho ofrece. */
export const TRABAJAMOS_CON = ['Influencers', 'Modelos', 'Anfitrionas'] as const;

/**
 * «¿Por qué yo?» — los del flyer, menos uno.
 *
 * **«Resultados comprobados» se cayó, y no por estilo.** El DL 1044 (art. 8.3)
 * dice que quien publica una afirmación objetiva tiene que poder acreditarla
 * ANTES de publicarla, y que la carga de probarlo es suya. Con cero galerías y
 * cero testimonios detrás, ese chip no lo sostiene nada. En su sitio va la
 * entrega en 48 h, que sí está acreditada por la propia web: aparece en los
 * tres paquetes, en «qué recibes» y en los términos del servicio.
 *
 * Regla general para esta lista: solo entra lo que la web pueda demostrar sin
 * que nadie tenga que creerse nada.
 */
export const POR_QUE_NEGOCIOS = [
  { titulo: 'Equipo y luz propios', icono: 'camara' },
  { titulo: 'Edición cinematográfica', icono: 'video' },
  { titulo: 'Te llega en 48 horas', icono: 'rayo' },
  { titulo: 'Ideas creativas', icono: 'persona' },
  { titulo: 'Grabo en todo Ayacucho', icono: 'barras' },
] as const;
