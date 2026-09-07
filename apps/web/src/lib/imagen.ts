/**
 * Los TRES anchos de todo el sitio: 400, 800 y 1600. Ni uno más (§4, §17).
 *
 * Un cuarto ancho es una variante más que Cloudflare cachea, otro tamaño que
 * comprobar y una decisión más en cada `<img>`. Con tres se cubre desde un
 * móvil de 320 hasta un monitor a 2x, y el `sizes` hace el resto.
 */
export const ANCHOS = [400, 800, 1600] as const;

/** `?width=` es la transformación de Cloudflare Images sobre el dominio `media.`. */
const conAncho = (url: string, w: number) => `${url}${url.includes('?') ? '&' : '?'}width=${w}`;

export const srcset = (url: string): string =>
  ANCHOS.map((w) => `${conAncho(url, w)} ${w}w`).join(', ');

/** El `src` de respaldo: el mediano, que es el que sirve si `srcset` no aplica. */
export const src = (url: string): string => conAncho(url, 800);

/**
 * `sizes` por tipo de hueco. Se declara aquí y no en cada componente porque un
 * `sizes` mal puesto hace que el navegador baje el ancho equivocado, y eso no
 * se ve mirando la página: solo se ve en la pestaña de red.
 */
export const SIZES = {
  /** Rejilla de dos columnas en móvil, tres o cuatro arriba. */
  tesela: '(min-width: 1024px) 320px, (min-width: 640px) 33vw, 50vw',
  /** Portada de categoría: cuatro en fila desde `lg`. */
  categoria: '(min-width: 1024px) 25vw, 50vw',
  /** El reel del hero, que es lo más grande que se pinta. */
  hero: '(min-width: 1024px) 300px, 100vw',
} as const;

/**
 * Una portada que no carga se ESCONDE y deja ver el degradado, y AVISA por
 * consola. Sin el `onerror`, R2 caído pinta el icono de imagen rota encima de
 * la tarjeta y un fallo de red parece un fallo de datos; sin el aviso, un
 * bucket mal configurado se ve exactamente igual que una galería vacía.
 *
 * Es la misma pareja de mitades que ya rige en el admin.
 */
export const ESCONDER_SI_FALLA =
  "this.style.display='none';console.warn('[james-film] no cargó la imagen:',this.currentSrc||this.src)";

/**
 * La imagen de compartir: 1200×630 desde una portada 9:16.
 *
 * `gravity=0.5x0.3` y no el centro: un reel vertical recortado a un rectángulo
 * apaisado por la mitad deja el pecho de la novia y le corta la cara. El 0.3
 * sube el encuadre a donde están las caras en un plano vertical.
 *
 * **Hay que verificarlo con una foto REAL antes de publicar** (T7.2). Una OG
 * que decapita a la novia es peor que no tener ninguna: se ve en cada WhatsApp
 * que comparta el enlace, que es justo como circula este negocio.
 */
export const og = (url: string): string =>
  `${url}${url.includes('?') ? '&' : '?'}width=1200&height=630&fit=cover&gravity=0.5x0.3`;
