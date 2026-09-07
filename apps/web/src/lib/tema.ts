/**
 * El tema de la landing, con la misma forma que el del admin.
 *
 * El oscuro es la marca y el que sale por defecto; el claro existe porque se
 * entra desde un móvil a pleno sol en Ayacucho.
 */
export const TEMAS = ['sistema', 'claro', 'oscuro'] as const;
export type Tema = (typeof TEMAS)[number];
export type TemaAplicado = 'claro' | 'oscuro';

export const CLAVE_TEMA = 'jamesfilm:tema';

/** El color de la barra del navegador. Va con el tema, no con el del sistema. */
export const COLOR_BARRA: Record<TemaAplicado, string> = {
  oscuro: '#0a0908',
  claro: '#fbfaf7',
};

/**
 * Script BLOQUEANTE, en el `<head>` y antes de pintar nada.
 *
 * Leerlo en un efecto pintaría la pantalla oscura y saltaría a clara: el
 * parpadeo se ve, y en una landing es lo primero que ve un cliente.
 *
 * **El defecto es OSCURO aunque el sistema pida claro.** No es un descuido: el
 * oscuro es la marca —el flyer lo es— y solo se cede a la preferencia del
 * visitante cuando la ha declarado él, no cuando la declara su sistema
 * operativo por él.
 */
export const SCRIPT_TEMA = `(function(){try{
var t=localStorage.getItem('${CLAVE_TEMA}');
if(t!=='claro'&&t!=='oscuro'){t='oscuro';}
document.documentElement.setAttribute('data-tema',t);
document.documentElement.classList.add('js');
var m=document.createElement('meta');m.name='theme-color';
m.content=t==='claro'?'${COLOR_BARRA.claro}':'${COLOR_BARRA.oscuro}';
document.head.appendChild(m);
}catch(e){document.documentElement.setAttribute('data-tema','oscuro');}})();`;
