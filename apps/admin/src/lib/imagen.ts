/**
 * Una portada que no carga se ESCONDE y deja ver el degradado que hay debajo:
 * un fallo de red no debe parecer un fallo de datos, y el icono de imagen rota
 * encima de la tarjeta es justo eso.
 *
 * Pero se avisa por consola. Sin este `warn`, un bucket mal configurado —403 en
 * cada objeto— se ve EXACTAMENTE igual que una galería a la que aún no le han
 * subido nada: seis degradados y ni un error en ninguna parte. Pasó, y costó
 * encontrarlo.
 */
export function ocultarSiFalla(e: { currentTarget: HTMLImageElement }): void {
  const img = e.currentTarget;
  img.style.display = 'none';
  console.warn(`[imagen] no se pudo cargar: ${img.currentSrc || img.src}`);
}
