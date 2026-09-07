/**
 * El tema del ADMIN. No de la web: la landing es oscura siempre, y eso no lo
 * decide James desde aquí.
 *
 * Tres valores, no dos: «sistema» es el de arranque y significa *seguir al
 * dispositivo*, que en el iPhone cambia solo al anochecer. Sin ese tercer
 * estado, elegir una vez congela el panel en claro aunque el móvil pase a
 * oscuro por la noche.
 */
export const TEMAS = ['sistema', 'claro', 'oscuro'] as const;
export type Tema = (typeof TEMAS)[number];

export const CLAVE_TEMA = 'jamesfilm:tema';

/** Lo que acaba en `<html data-tema>`: «sistema» se resuelve, no se escribe. */
export type TemaAplicado = 'claro' | 'oscuro';

export const esTema = (v: unknown): v is Tema =>
  typeof v === 'string' && (TEMAS as readonly string[]).includes(v);

/**
 * El script que corre ANTES del primer pintado. Va como cadena porque se
 * inyecta en el `<head>` con `dangerouslySetInnerHTML`: si esto viviera en un
 * efecto, la pantalla se pintaría oscura y saltaría a clara — un parpadeo que
 * se ve en cada carga y que en el móvil de James es medio segundo de negro.
 *
 * Todo en try/catch: en el modo privado de Safari `localStorage` LANZA al
 * leerlo, y un throw aquí dejaría la página en blanco antes de empezar.
 */
/**
 * El color de la barra del navegador por tema. NO puede quedarse en el
 * `themeColor` de la metadata de Next: ese elige por `prefers-color-scheme`, y
 * aquí el tema lo elige `data-tema`. Con el iPhone en oscuro y el panel en
 * claro, la barra de estado se quedaba negra sobre una pantalla blanca.
 */
export const COLOR_BARRA: Record<TemaAplicado, string> = {
  oscuro: '#0f0d0c',
  claro: '#f7f6f3',
};

/** Escribe el `<meta name="theme-color">` sin media, que gana al par de Next. */
export function pintarBarra(aplicado: TemaAplicado): void {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = COLOR_BARRA[aplicado];
}

export const SCRIPT_TEMA = `(function(){try{
var t=localStorage.getItem('${CLAVE_TEMA}');
if(t!=='claro'&&t!=='oscuro'){t=matchMedia('(prefers-color-scheme: light)').matches?'claro':'oscuro';}
document.documentElement.setAttribute('data-tema',t);
var m=document.createElement('meta');m.name='theme-color';
m.content=t==='claro'?'#f7f6f3':'#0f0d0c';document.head.appendChild(m);
}catch(e){document.documentElement.setAttribute('data-tema','oscuro');}})();`;
