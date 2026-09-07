/**
 * Deriva TODOS los artboards claros a partir de su gemelo oscuro.
 *
 *   node derivar-claro.mjs
 *
 * Existe porque el claro se quedó atrás dos veces mientras se mantenía a mano.
 * Lo único que separa a las dos versiones es COLOR; la estructura tiene que ser
 * la misma por construcción, no por disciplina.
 *
 * Lo que NO se traduce, que es la parte con criterio:
 *  · Los reels y las portadas siguen OSCUROS en los dos temas: su fondo es el
 *    material —vídeo—, no la superficie de la página. Y el texto encima, claro.
 *  · El botón de WhatsApp lleva texto oscuro sobre verde en los dos. Sobre
 *    #25D366 el negro contrasta 6,3 y el blanco 3,1.
 *  · Las previas de Google y de WhatsApp usan los colores de SU destino.
 *    Reconocerlas es el punto; con nuestra paleta dejarían de parecerse.
 */
import { readFileSync, writeFileSync } from 'node:fs';

/** oscuro → claro. `Piezas` no entra: ya enseña las dos paletas a la vez. */
const PARES = [
  ['Main.dc.html', 'Claro.dc.html'],
  ['Escritorio.dc.html', 'EscritorioClaro.dc.html'],
  ['Calendario.dc.html', 'CalendarioClaro.dc.html'],
  ['Galeria.dc.html', 'GaleriaClaro.dc.html'],
];

/** El orden IMPORTA: de lo más específico a lo más general. */
const REGLAS = [
  // ── Cimientos ──
  ['background: #0A0908; color: #F2EFE9', 'background: #FBFAF7; color: #17150F'],
  ['body { margin: 0; background: #0A0908; }', 'body { margin: 0; background: #FBFAF7; }'],
  ['a { color: #C9A96A; text-decoration: none; }', 'a { color: #8A6D3B; text-decoration: none; }'],
  ['a:hover { color: #E5D3AC; }', 'a:hover { color: #6E5530; }'],
  ['color: #9C958C; }', 'color: #6B655C; }'],
  ['color: #9A7F47; font-weight: 500; }', 'color: #8A6D3B; font-weight: 500; }'],

  // ── El hero de escritorio: en claro no hay velo, el fondo es cálido ──
  [
    'radial-gradient(90% 130% at 76% 34%, #2B2620, #141210 52%, #0A0908)',
    'radial-gradient(90% 130% at 76% 34%, #FFFDF7, #F7F3EA 52%, #FBFAF7)',
  ],
  ['background: rgba(10,9,8,0.6); border: 1px solid #2E2A26;', 'background: #FFFFFF; border: 1px solid #E6E1D8;'],
  ['background: rgba(10,9,8,0.66); border: 1px solid #2E2A26;', 'background: #FFFFFF; border: 1px solid #E6E1D8;'],
  ['background: rgba(10,9,8,0.92)', 'background: rgba(251,250,247,0.94)'],
  ['background: rgba(10,9,8,.86)', 'background: rgba(251,250,247,.9)'],
  ['background: rgba(10,9,8,0.94)', 'background: rgba(255,255,255,0.94)'],
  ['rgba(201,169,106,.22)', 'rgba(201,169,106,.30)'],
  ['box-shadow: 0 24px 60px rgba(0,0,0,.5)', 'box-shadow: 0 18px 44px rgba(23,21,15,.16)'],
  ['box-shadow: 0 32px 80px rgba(0,0,0,.62)', 'box-shadow: 0 26px 62px rgba(23,21,15,.22)'],
  ['box-shadow: 0 10px 34px rgba(37,211,102,0.22)', 'box-shadow: 0 10px 28px rgba(37,211,102,0.30)'],

  // ── El cierre es un PANEL con margen, no un bloque a sangre: en claro, un
  //    rectángulo oscuro de borde a borde se lee como un fallo de render ──
  [
    'background: linear-gradient(160deg, #1E1B18, #0F0D0B)',
    'background: linear-gradient(160deg, #221E1A, #14110E)',
  ],

  // ── Superficies ──
  ['background: #141210', 'background: #F4F1EB'],
  ['background: #1E1B18', 'background: #FFFFFF'],
  ['border: 1px solid #2E2A26', 'border: 1px solid #E6E1D8'],
  ['border: 1px dashed #3D362F', 'border: 1px dashed #D8D2C6'],
  ['border-top: 1px solid #2E2A26', 'border-top: 1px solid #E6E1D8'],
  ['border-bottom: 1px solid #2E2A26', 'border-bottom: 1px solid #E6E1D8'],
  ['border-left: 1px solid #2E2A26', 'border-left: 1px solid #E6E1D8'],
  ['border-right: 1px solid #2E2A26', 'border-right: 1px solid #E6E1D8'],
  ['border: 1px solid #3D362F', 'border: 1px solid #D8D2C6'],
  ['background: rgba(8,7,6,0.82)', 'background: rgba(255,255,255,0.92)'],

  // ── Texto e iconos. El latón de LEER baja: el de la marca da 1,8:1 en blanco ──
  ['color: #9C958C', 'color: #6B655C'],
  ['color: #F2EFE9', 'color: #17150F'],
  ['stroke="#F2EFE9"', 'stroke="#17150F"'],
  ['color: #E5D3AC', 'color: #8A6D3B'],
  ['stroke="#E5D3AC"', 'stroke="#8A6D3B"'],
  ['stroke="#C9A96A"', 'stroke="#8A6D3B"'],
  ['color: #9A7F47', 'color: #8A6D3B'],
  ['stroke="#9A7F47"', 'stroke="#8A6D3B"'],
  ['background: #9A7F47', 'background: #C9A96A'],
  // El check del Básico: #9C958C da 2,5:1 sobre blanco; WCAG pide 3 a lo gráfico
  ['stroke="#9C958C"', 'stroke="#8C857A"'],
  ['<span style="color: #C9A96A;">historias</span>', '<span style="color: #8A6D3B;">historias</span>'],
  ['strong style="color: #C9A96A; font-weight: 600;"', 'strong style="color: #8A6D3B; font-weight: 600;"'],
  ['color: #3D362F', 'color: #C4BCAF'],
  ['background: #3D362F', 'background: #D8D2C6'],
  ['stroke="rgba(242,239,233,0.44)"', 'stroke="rgba(255,255,255,0.55)"'],
  ['stroke="rgba(242,239,233,0.42)"', 'stroke="rgba(255,255,255,0.55)"'],
  ['stroke="rgba(242,239,233,0.34)"', 'stroke="rgba(255,255,255,0.5)"'],

  // ── El fondo `void` pasa a blanco ──
  ['background: #0A0908;', 'background: #FFFFFF;'],
  ['background: linear-gradient(140deg, #FFFFFF, #F4F1EB)', 'background: linear-gradient(140deg, #FFFDF8, #FBF7EE)'],

  // ── El PRO: borde más grueso, y su insignia se invierte ──
  ['border: 1px solid #C9A96A; background: #FFFFFF;', 'border: 1.5px solid #C9A96A; background: #FFFDF8;'],
  ['border: 1px solid #C9A96A; background: #F4F1EB;', 'border: 1.5px solid #C9A96A; background: #FFFDF8;'],
  [
    'background: #C9A96A; color: #0A0908; font-size: 12px; font-weight: 600',
    'background: #8A6D3B; color: #FFFFFF; font-size: 12px; font-weight: 600',
  ],
  // ── El PREMIUM: su acento «hueso» es INVISIBLE sobre blanco. Se invierte al
  //    negro cálido: la jerarquía se conserva, el color se da la vuelta ──
  ['border: 1px solid #F2EFE9; background: #F4F1EB;', 'border: 1px solid #17150F; background: #FFFFFF;'],
  ['border: 1px solid #F2EFE9; background: #FFFFFF;', 'border: 1px solid #17150F; background: #FFFFFF;'],

  // ── Las clases del calendario de escritorio ──
  ['.lib { border-color: #2E2A26; color: #F2EFE9; }', '.lib { border-color: #E6E1D8; color: #17150F; }'],
  ['.ocu { color: #6B655C;', '.ocu { color: #9A9287;'],
  ['.ran { background: rgba(201,169,106,.18); border-color: rgba(201,169,106,.4); color: #E5D3AC; }',
   '.ran { background: rgba(201,169,106,.22); border-color: rgba(201,169,106,.55); color: #8A6D3B; }'],
  ['.fue { color: #3D362F; }', '.fue { color: #C4BCAF; }'],
  ['.libre { border-color: #2E2A26; color: #F2EFE9; }', '.libre { border-color: #E6E1D8; color: #17150F; }'],
  ['.ocupado { color: #6B655C;', '.ocupado { color: #9A9287;'],
  ['.rango { background: rgba(201,169,106,.18); border-color: rgba(201,169,106,.4); color: #E5D3AC; }',
   '.rango { background: rgba(201,169,106,.22); border-color: rgba(201,169,106,.55); color: #8A6D3B; }'],
  ['.fuera { color: #3D362F; }', '.fuera { color: #C4BCAF; }'],

  // ── La trama del día ocupado, sobre claro ──
  ['rgba(155,148,140,.14)', 'rgba(23,21,15,.10)'],
  ['rgba(155,148,140,.3)', 'rgba(23,21,15,.22)'],
];

/**
 * Los bloques marcados con `<!--oscuro: … -->` … `<!--/oscuro-->` en el fuente
 * conservan sus colores en los dos temas.
 *
 * Es el panel de cierre: es oscuro a propósito —cierra con la marca y separa el
 * pie sin una línea— y sin protegerlo, las reglas de arriba le volteaban el
 * texto a oscuro y dejaban «¿Qué día es tu evento?» negro sobre negro. Pasó de
 * verdad, dos veces, en dos sitios distintos.
 *
 * Se marca en el FUENTE y no se apaña en el script a propósito: la marca viaja
 * pegada al bloque que protege, así que no se puede olvidar al moverlo.
 */
function protegido(html, transformar) {
  const partes = html.split(/(<!--oscuro:[\s\S]*?-->[\s\S]*?<!--\/oscuro-->)/);
  return partes.map((parte, i) => (i % 2 === 1 ? parte : transformar(parte))).join('');
}

/**
 * EL HERO MÓVIL NO SE PUEDE DERIVAR CAMBIANDO COLORES, y esto es la excepción
 * que justifica el resto del script.
 *
 * En oscuro el titular se apoya ENCIMA del vídeo, sobre un velo negro. En claro
 * ese velo no existe —un velo negro sobre una página blanca es un agujero— así
 * que el reel pasa a ser una TARJETA y el titular va DEBAJO, en texto oscuro.
 * Eso es estructura, no color.
 *
 * Sin esta función, el intercambio de colores dejaba el hero con fondo oscuro y
 * texto oscuro: el titular estaba ahí y no se veía. Pasó de verdad.
 */
function heroClaro(html) {
  const ini = html.indexOf('  <!-- ═══ HERO ═══ -->');
  const fin = html.indexOf('  <!-- ═══ CONFIANZA');
  if (ini < 0 || fin < 0) return html;
  return (
    html.slice(0, ini) +
    `  <!-- ═══ HERO CLARO · el reel es una TARJETA y el titular va DEBAJO ═══ -->
  <div class="e" style="--i: 0; display: flex; flex-direction: column; gap: 18px; padding: 22px 20px 26px;">
    <div style="position: relative; aspect-ratio: 4/5; border-radius: 18px; background: radial-gradient(120% 90% at 62% 26%, #4A3A28 0%, #1C1512 55%, #080706 100%); color: #F2EFE9; box-shadow: 0 18px 46px rgba(23,21,15,0.16); overflow: hidden;">
      <div style="position: absolute; top: 14px; left: 14px; display: flex; align-items: center; gap: 8px; padding: 7px 12px; border-radius: 999px; background: rgba(255,255,255,0.92);">
        <span class="vivo" style="width: 7px; height: 7px; border-radius: 999px; background: #8A6D3B;"></span>
        <span style="font-size: 12px; color: #17150F; letter-spacing: 0.04em;">Grabando en Ayacucho</span>
      </div>
      <span style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m10 8 6 4-6 4V8Z"/></svg>
      </span>
    </div>

    <div style="display: flex; flex-direction: column; gap: 11px;">
      <span class="eyebrow">Creador de contenido · Ayacucho</span>
      <h1 class="d" style="margin: 0; font-size: 40px;">Transformo momentos en <span style="color: #8A6D3B;">historias</span></h1>
      <p style="margin: 0; font-size: 17px; line-height: 1.45;">
        Reels y aftermovies para <strong style="font-weight: 600;">bodas, XV años y cumpleaños</strong>. Los primeros, en 24 horas.
      </p>
    </div>

    <div style="display: flex; align-items: center; gap: 10px;">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8A6D3B" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
      <span style="font-size: 15px;">30 eventos grabados</span>
      <span style="width: 4px; height: 4px; border-radius: 999px; background: #C9A96A;"></span>
      <a href="#calendario" style="font-size: 15px; color: #8A6D3B; text-decoration: underline; text-underline-offset: 3px;">3 sábados libres</a>
    </div>

    <div style="display: flex; flex-direction: column; gap: 10px;">
      <a href="#" style="display: flex; align-items: center; justify-content: center; gap: 10px; height: 58px; border-radius: 12px; background: #25D366; color: #0A0908; font-size: 17px; font-weight: 600; box-shadow: 0 10px 28px rgba(37,211,102,0.30);">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0A0908" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.4L3 21l2.2-5.5A8.4 8.4 0 1 1 21 11.5Z"/></svg>
        ¡HABLEMOS DE TU EVENTO!
      </a>
      <p class="pista" style="margin: 0; text-align: center;">Se abre tu WhatsApp con el mensaje ya escrito. Preguntar no cuesta nada.</p>
    </div>
  </div>

` +
    html.slice(fin)
  );
}

/**
 * Un elemento cuyo PROPIO fondo es un degradado de portada se queda con texto
 * claro: esas cajas son la foto, y la foto no cambia con el tema. Lo caza el
 * comprobador de abajo, así que no hace falta acordarse tarjeta por tarjeta.
 */
function respetarCajasDeFoto(html) {
  return html.replace(/style="([^"]*radial-gradient\(120% 90%[^"]*)"/g, (m, est) =>
    `style="${est
      .replace(/color: #17150F/g, 'color: #F2EFE9')
      .replace(/color: #6B655C/g, 'color: #A79F94')}"`,
  );
}

/**
 * Todo fondo oscuro RECIBE su color claro, aunque en el fuente no lo declarara.
 *
 * Heredar el color del tema es la trampa: en oscuro funciona por accidente
 * —la raíz ya es clara— y en claro deja texto negro sobre negro. Pasó cuatro
 * veces: el hero, la cifra del bento, el panel de cierre y las portadas.
 * Darles color explícito no puede empeorar nada y cierra la clase entera.
 */
function darColorALoOscuro(html) {
  const OSCURO = /#(0A0908|0F0D0B|141210|1E1B18|080706|14110E|221E1A|1C1512|191418|141A17|1B1410|1A1212|12161A|0B141A|1F2C33|4A3A28|3A3140|2E3A33|453322|3F2B2B|2B3340)/i;
  return html.replace(/style="([^"]*)"/g, (m, est) => {
    const fondo = /(?:^|;)\s*background(?:-color)?:\s*([^;]+)/i.exec(est)?.[1] ?? '';
    const tieneColor = /(?:^|;)\s*color:\s*/i.test(est);
    if (!fondo || !OSCURO.test(fondo) || tieneColor) return m;
    return `style="${est.replace(/;?\s*$/, '')}; color: #F2EFE9;"`;
  });
}

/** El texto que va SOBRE un reel se queda claro: ahí el fondo sigue negro. */
function respetarLoQueVaSobreVideo(html) {
  return html
    .replace(
      /(background: linear-gradient\(to top, rgba\(10,9,8,[.0-9]+\)[^"]*?)color: #17150F;/g,
      '$1color: #F2EFE9;',
    )
    .replace(/(rgba\(10,9,8,\.94\)[\s\S]{0,340}?)color: #6B655C;/g, '$1color: #B9B2A6;');
}

/** Las burbujas de WhatsApp y el resultado de Google llevan SUS colores. */
function respetarPrevias(html) {
  return html
    .replace(/background: #0B141A;[\s\S]{0,900}?<\/div>/g, (m) =>
      m.replace(/color: #17150F/g, 'color: #E9EDEF').replace(/color: #6B655C/g, 'color: #8696A0'),
    );
}

/**
 * Busca texto oscuro sobre fondo oscuro en el resultado CLARO. Es el fallo que
 * se coló tres veces —el hero, la cifra del bento y el panel de cierre— y las
 * tres se vieron a ojo, no con una regla. Ahora falla aquí y no en el diseño.
 */
function comprobar(nombre, html) {
  const esOscuro = (v) =>
    /#(0A0908|0F0D0B|141210|1E1B18|17150F|080706|14110E|221E1A|1C1512|191418|141A17|1B1410|1A1212|12161A|0B141A|005C4B|1F2C33|2B2620|4A3A28|3A3140|2E3A33|453322|3F2B2B|2B3340)/i.test(v);
  const esTextoOscuro = (v) => /#(0A0908|17150F|6B655C|141210|8C857A)/i.test(v);
  const avisos = [];
  const re = /style="([^"]*)"/g;
  let m;
  while ((m = re.exec(html))) {
    const est = m[1];
    // Se leen POR SEPARADO: mezclarlos hacía que el botón verde de WhatsApp
    // —fondo #25D366, texto #0A0908, correcto— saliera como sospechoso.
    const fondo = /(?:^|;)\s*background(?:-color)?:\s*([^;]+)/i.exec(est)?.[1] ?? '';
    const texto = /(?:^|;)\s*color:\s*([^;]+)/i.exec(est)?.[1] ?? '';
    if (!fondo || !esOscuro(fondo)) continue;
    if (texto && esTextoOscuro(texto)) {
      avisos.push(`fondo ${fondo.trim().slice(0, 46)} · texto ${texto.trim()}`);
    } else if (!texto) {
      // EL AGUJERO QUE DEJÓ PASAR EL PANEL DE CIERRE: un fondo oscuro que NO
      // declara color hereda el de la raíz, y en claro la raíz es oscura. El
      // texto salía negro sobre negro y el comprobador decía «sin sospechas».
      // Un fondo oscuro tiene que declarar su color, siempre.
      avisos.push(`fondo ${fondo.trim().slice(0, 46)} · SIN color propio (hereda el del tema)`);
    }
  }
  if (avisos.length) {
    console.warn(`  ⚠ ${nombre}: ${avisos.length} texto oscuro sobre fondo oscuro`);
    for (const a of avisos.slice(0, 5)) console.warn(`      ${a}`);
  }
  return avisos.length;
}

let n = 0;
let sospechas = 0;
for (const [oscuro, claro] of PARES) {
  const origen = new URL(`./${oscuro}`, import.meta.url);
  let out;
  try {
    out = readFileSync(origen, 'utf8');
  } catch {
    console.warn(`· ${oscuro} no existe, se salta`);
    continue;
  }
  out = protegido(out, (trozo) => {
    for (const [de, a] of REGLAS) trozo = trozo.split(de).join(a);
    return darColorALoOscuro(respetarPrevias(respetarCajasDeFoto(respetarLoQueVaSobreVideo(trozo))));
  });
  // El hero móvil cambia de ESTRUCTURA, no solo de color. Ver `heroClaro`.
  if (claro === 'Claro.dc.html') out = heroClaro(out);
  writeFileSync(new URL(`./${claro}`, import.meta.url), out);
  console.log(`  ${oscuro} → ${claro} (${out.split('\n').length} líneas)`);
  sospechas += comprobar(claro, out);
  n += 1;
}
console.log(`${n} artboards claros derivados${sospechas ? `, ${sospechas} sospecha(s) que revisar` : ', sin sospechas'}.`);
