import { expect, test } from '@playwright/test';
import {
  ESTADO_SESION,
  irAlPanel,
  limpiarTestimoniosDePrueba,
  PREFIJO_TESTIMONIO,
} from './apoyo';

test.describe('paquetes', () => {
  test('el precio se edita en soles enteros y se ve formateado', async ({ page }) => {
    // En la base van céntimos. Enteros es cómo se EDITA, no cómo se muestra.
    await irAlPanel(page);
    await page.getByRole('link', { name: 'Paquetes' }).first().click();
    await expect(page.getByRole('heading', { name: 'Paquetes' })).toBeVisible();

    // Editar vive en el menú de la tarjeta: en la tarjeta ocupaba media altura
    // y competía con el precio, que es lo único que hay que leer ahí.
    await page
      .getByRole('button', { name: /^Acciones de / })
      .first()
      .click();
    await page.getByRole('button', { name: 'Editar' }).click();
    const precio = page.getByLabel('Precio en soles');
    await precio.fill('450');
    await page.getByRole('button', { name: 'Guardar' }).click();

    // El precio va en DOS nodos: `S/ 450` grande y `.00` pequeño, porque los
    // céntimos no pueden pesar lo mismo que la cifra que se compara.
    await expect(page.getByText('S/ 450', { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('un precio con decimales no se guarda', async ({ page }) => {
    await irAlPanel(page);
    await page.getByRole('link', { name: 'Paquetes' }).first().click();
    // Editar vive en el menú de la tarjeta: en la tarjeta ocupaba media altura
    // y competía con el precio, que es lo único que hay que leer ahí.
    await page
      .getByRole('button', { name: /^Acciones de / })
      .first()
      .click();
    await page.getByRole('button', { name: 'Editar' }).click();

    await page.getByLabel('Precio en soles').fill('300.5');
    await page.getByRole('button', { name: 'Guardar' }).click();

    await expect(page.getByText(/Solo soles enteros/)).toBeVisible();
  });
});

test.describe('testimonios', () => {
  /**
   * La limpieza del final del test solo corre si el test LLEGA al final. Una
   * corrida que falla a mitad dejaba la fila viva — y apareció una **publicada
   * en la web**, con nombre «Clienta E2E 1788019980635». Esto corre también
   * cuando el test revienta.
   */
  test.afterAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: ESTADO_SESION });
    const page = await ctx.newPage();
    await limpiarTestimoniosDePrueba(page);
    await ctx.close();
  });

  test('NO deja publicar uno sin consentimiento', async ({ page }) => {
    // Nombre único por ejecución: si una corrida anterior falló a mitad y dejó
    // su fila, un nombre fijo encuentra dos y el localizador revienta. El test
    // no debe depender de que la anterior terminara bien.
    const nombre = `${PREFIJO_TESTIMONIO} ${Date.now()}`;
    // §19 y Ley 29733: es el único punto que puede traerle un problema real a
    // James. La puerta está en la interfaz Y en el servidor.
    await irAlPanel(page);
    await page.getByRole('link', { name: 'Testimonios' }).first().click();
    await expect(page.getByRole('heading', { name: 'Testimonios' })).toBeVisible();

    await page.getByRole('button', { name: 'Nuevo testimonio' }).click();
    await page.getByLabel('Nombre').fill(nombre);
    await page.getByRole('button', { name: 'Guardar' }).click();

    const tarjeta = page.getByRole('article').filter({ hasText: nombre });
    await expect(tarjeta).toBeVisible({ timeout: 15_000 });

    // Nace en borrador y sin consentimiento: lo ÚNICO que se ofrece es pedir el
    // permiso. Publicar ni siquiera aparece — tener las tres acciones a la vez
    // obligaba a mirar cuál estaba deshabilitada para saber en qué estado estás.
    await expect(tarjeta.getByRole('button', { name: 'Dio su permiso' })).toBeVisible();
    await expect(tarjeta.getByRole('button', { name: 'Publicar' })).toHaveCount(0);
    // La pastilla dice «Sin permiso» —lo que cabe en la tarjeta— y la PESTAÑA
    // del filtro dice «Sin consentimiento». Aquí se comprueba la tarjeta.
    await expect(tarjeta.getByText('Sin permiso')).toBeVisible();

    // Y el motivo está escrito, no en un tooltip.
    await expect(
      page.getByText(new RegExp(`Sin el permiso de ${nombre} no puede salir en la web`)),
    ).toBeVisible();

    // Limpieza: el E2E devuelve la base como la encontró. El borrado vive en el
    // menú `⋯` y exige escribir el nombre, porque se lleva del servidor la
    // captura y la foto de una persona real.
    await tarjeta.getByRole('button', { name: `Más acciones para ${nombre}` }).click();
    await page.getByRole('button', { name: 'Borrar', exact: true }).click();
    await page.getByLabel(/Escribe/).fill(nombre);
    await page.getByRole('button', { name: 'Borrar para siempre' }).click();
    await expect(tarjeta).toHaveCount(0, { timeout: 15_000 });
  });
});

test.describe('configuración', () => {
  test('rechaza un número de WhatsApp sin prefijo de país', async ({ page }) => {
    // Sin prefijo el botón de la landing no funciona y NADA falla: simplemente
    // nadie escribe nunca.
    await irAlPanel(page);
    await page.getByRole('link', { name: 'Configuración' }).first().click();
    await page.getByRole('tab', { name: 'Contacto y redes' }).click();

    const campo = page.getByLabel('Número de WhatsApp');
    const original = await campo.inputValue();

    await campo.fill('994724944');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText(/Ejemplo: 51994724944/)).toBeVisible();

    await campo.fill(original);
  });

  test('el enlace de prueba abre el wa.me real, CON el mensaje configurado', async ({ page }) => {
    // Sin el `?text=`, «Probar» abría un chat vacío: comprobaba que el número
    // existe, pero no lo que de verdad pasa al pulsar el botón de la web.
    // Probar un enlace distinto del que se publica es no probar nada.
    await irAlPanel(page);
    await page.getByRole('link', { name: 'Configuración' }).first().click();
    await page.getByRole('tab', { name: 'Contacto y redes' }).click();

    const enlace = page.getByRole('link', { name: /^Probar/ });
    await expect(enlace).toHaveAttribute('href', /^https:\/\/wa\.me\/\d{10,}(\?text=.+)?$/);

    // Con mensaje escrito, el enlace lo lleva y el botón lo dice.
    await page.getByLabel('Mensaje que se escribe solo').fill('Hola James, quiero un reel');
    await expect(page.getByRole('link', { name: 'Probar con el mensaje' })).toHaveAttribute(
      'href',
      /\?text=Hola%20James%2C%20quiero%20un%20reel$/,
    );
    await page.getByRole('button', { name: 'Descartar' }).click();
  });
});
