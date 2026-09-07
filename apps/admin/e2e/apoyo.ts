import path from 'node:path';
import { expect, type Locator, type Page } from '@playwright/test';

export const CREDENCIALES = {
  email: process.env.SEED_ADMIN_EMAIL ?? '',
  password: process.env.SEED_ADMIN_PASSWORD ?? '',
};

// `__dirname` y no `import.meta.url`: Playwright transpila los specs a
// CommonJS —apps/admin no es ESM— y ahí `import.meta` es un error de sintaxis.
export const REEL = path.join(__dirname, 'fixtures', 'reel.mp4');
export const REEL_HEVC = path.join(__dirname, 'fixtures', 'reel-hevc.mp4');
/**
 * El mismo `reel.mp4` con la caja `moov` movida AL FINAL —y los `stco`
 * corregidos, que si no el vídeo deja de decodificar—. Generado con el script
 * de `scripts/sin-faststart.mjs`, no con ffmpeg: aquí no está instalado.
 */
export const REEL_SIN_FASTSTART = path.join(__dirname, 'fixtures', 'reel-sin-faststart.mp4');

export const ESTADO_SESION = path.join(__dirname, '.auth', 'sesion.json');

/**
 * Espera a que terminen las animaciones de entrada de `el` (o de la página).
 *
 * **Se saltan las INFINITAS**: la luz ambiente del panel es
 * `deriva 24s infinite alternate`, y `animation.finished` de una animación que
 * no acaba nunca no resuelve nunca. Sin este filtro la espera agota el timeout
 * de 60 s y el fallo parece del test, no de la animación.
 *
 * Y hace falta: medir con una animación de entrada en curso da números falsos
 * —un botón de 44px bajo `scale(0.97)` mide 43,65— y capturar da una foto a
 * medias. Un `waitForTimeout` a ojo se queda corto en una máquina lenta.
 */
export async function esperarAnimaciones(objetivo: Page | Locator): Promise<void> {
  // `page.evaluate(fn)` llama a `fn(undefined)` y `locator.evaluate(fn)` llama a
  // `fn(elemento)`: la misma función no vale para los dos, así que hay dos
  // ramas. El filtro es el mismo y se escribe donde se lee.
  if ('goto' in objetivo) {
    await objetivo.evaluate(() =>
      Promise.all(
        // `document.getAnimations()` NO acepta opciones: ya devuelve las del
        // documento entero. El `subtree` es solo de `Element`.
        document
          .getAnimations()
          .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
          .map((a) => a.finished.catch(() => undefined)),
      ).then(() => undefined),
    );
    return;
  }
  await objetivo.evaluate((el: Element) =>
    Promise.all(
      el
        .getAnimations({ subtree: true })
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ).then(() => undefined),
  );
}

/**
 * El recuento cuando la lista ya está QUIETA: dos lecturas seguidas iguales.
 *
 * Contar nada más abrir una galería da un número que todavía se mueve —los
 * tests anteriores del fichero suben reels de verdad a la misma galería y su
 * `confirm` puede seguir en vuelo—, y comparar contra él después de recargar
 * fallaba una vez de cada tres. No era un timeout corto: era medir mientras
 * el dato cambiaba.
 */
export async function recuentoEstable(locator: Locator, intentos = 12): Promise<number> {
  let previo = -1;
  for (let i = 0; i < intentos; i++) {
    const actual = await locator.count();
    if (actual === previo) return actual;
    previo = actual;
    await locator.page().waitForTimeout(500);
  }
  return previo;
}

/**
 * Baja del todo y se asegura de que de verdad es el final: la página CRECE
 * mientras se scrollea —las portadas van llegando— así que un solo
 * `scrollTo(scrollHeight)` deja el final más abajo de donde estaba al medir.
 * Se repite hasta que la altura no cambia entre dos pasadas.
 */
export async function bajarDelTodo(page: Page, intentos = 10): Promise<void> {
  let previa = -1;
  for (let i = 0; i < intentos; i++) {
    const altura = await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
      return document.documentElement.scrollHeight;
    });
    if (altura === previa) return;
    previa = altura;
    await page.waitForTimeout(300);
  }
}

/** Login de verdad. Lo usan el setup y el propio spec de login, nadie más. */
export async function entrar(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(CREDENCIALES.email);
  // `exact` porque `getByLabel` busca por SUBCADENA y el botón del ojo se
  // llama «Mostrar la contraseña»: sin esto son dos coincidencias.
  await page.getByLabel('Contraseña', { exact: true }).fill(CREDENCIALES.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Galerías' })).toBeVisible();
}

/**
 * Con la sesión ya puesta por `storageState`. El resto de specs entra por aquí:
 * repetir el login en cada test agota el límite de 5/min del endpoint —que es
 * correcto que exista— y el fallo parecería de credenciales.
 */
export async function irAlPanel(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Galerías' })).toBeVisible();
}

/**
 * Borra los testimonios que dejó una corrida del E2E, pase lo que pase.
 *
 * El test que los crea ya limpia al final, y aun así apareció uno **publicado
 * en la web de James**: la limpieza del final solo corre si el test LLEGA al
 * final, y una corrida que falla a mitad deja la fila viva para siempre. Aquí
 * va en un `afterAll`, que corre también cuando el test revienta.
 *
 * Por la pasarela y no por Prisma: el E2E no tiene acceso a la base, y la
 * pasarela ya lleva la sesión en la cookie del contexto.
 */
export async function limpiarTestimoniosDePrueba(page: Page): Promise<void> {
  const res = await page.request.get('/api/admin/testimonials');
  if (!res.ok()) return;
  const { data } = (await res.json()) as { data: { id: string; authorName: string }[] };
  for (const t of data.filter((x) => x.authorName.startsWith(PREFIJO_TESTIMONIO))) {
    await page.request.delete(`/api/admin/testimonials/${t.id}`);
  }
}

/** El prefijo por el que se reconocen. Lo comparten el test y la limpieza. */
export const PREFIJO_TESTIMONIO = 'Clienta E2E';

/** El estado vacío de Galerías, que es lo que se ve sobre una base limpia. */
const SIN_GALERIAS = 'Aún no tienes galerías';

/**
 * Crea una galería por el formulario y vuelve a la lista.
 *
 * La categoría no se toca: el formulario preselecciona la primera activa
 * (`activas[0]`), y el seed deja cuatro. Con el nombre basta.
 */
export async function crearGaleria(page: Page, nombre = 'Galería E2E'): Promise<void> {
  // La lista de galerías es la RAÍZ, no `/galerias`: esa ruta solo existe como
  // `/galerias/[id]` para el editor. Los atajos del panel y del ⌘K apuntan a
  // `/?nueva=1`, y ese es el camino bueno.
  await page.goto('/?nueva=1');
  await page.getByLabel('Nombre del evento').fill(nombre);
  await page.getByRole('button', { name: 'Crear y subir reels' }).click();
  // Al crear se entra al editor: esperar al campo del título confirma que la
  // fila existe de verdad, no que la petición salió.
  await expect(page.getByLabel('Título', { exact: true })).toBeVisible();
  await page.goto('/');
}

/**
 * Abre la primera galería de la lista, CREÁNDOLA si no hay ninguna.
 *
 * Aquí ponía «el seed deja al menos una» y era falso: el seed crea el contenido
 * del flyer --categorías, paquetes, redes-- y CERO galerías, porque corre
 * también en producción y una galería de mentira acabaría en la web de James.
 * En una máquina de desarrollo siempre hay alguna de sesiones anteriores, así
 * que el fallo solo aparece sobre una base limpia: en CI, esperando 60 s a un
 * enlace que no iba a existir nunca.
 */
export async function abrirPrimeraGaleria(page: Page): Promise<void> {
  const enlaces = page.getByRole('list').getByRole('link');
  const vacio = page.getByText(SIN_GALERIAS);

  // Se espera a un estado DEFINIDO --hay galerías o no las hay--, no al enlace
  // a secas: `irAlPanel` solo garantiza el título de la pantalla, que se pinta
  // con el skeleton todavía puesto. Con `waitFor()` sobre el enlace, «vacía» y
  // «todavía cargando» son indistinguibles y las dos agotan el timeout.
  await expect(enlaces.first().or(vacio)).toBeVisible();
  if (await vacio.isVisible()) await crearGaleria(page);

  await enlaces.first().click();
  await expect(page.getByLabel('Título', { exact: true })).toBeVisible();
}

/**
 * Abre la primera galería que TENGA medios, y espera a que la grilla esté
 * pintada. `count()` no espera: llamarlo justo después de abrir devuelve 0 y el
 * test se salta solo, que es la peor forma de pasar.
 */
export async function abrirGaleriaConMedios(page: Page): Promise<boolean> {
  // Mismo motivo que en `abrirPrimeraGaleria`: sobre una base limpia no hay
  // ningún enlace, y esperarlo a secas agota el timeout en vez de devolver
  // `false`, que es lo que este helper promete a quien lo llama.
  const vacio = page.getByText(SIN_GALERIAS);
  await expect(page.getByRole('list').getByRole('link').first().or(vacio)).toBeVisible();
  if (await vacio.isVisible()) return false;

  const enlaces = await page.getByRole('list').getByRole('link').all();

  for (const enlace of enlaces) {
    const texto = (await enlace.textContent()) ?? '';
    if (/(^|\D)0 medios/.test(texto)) continue;
    await enlace.click();
    await expect(page.getByLabel('Título', { exact: true })).toBeVisible();
    const teselas = page.getByRole('button', { name: /^Ver / });
    await teselas.first().waitFor({ timeout: 10_000 });
    return true;
  }
  return false;
}
