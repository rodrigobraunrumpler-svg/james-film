import { expect, test } from '@playwright/test';
import { irAlPanel } from './apoyo';

test.describe('paquetes', () => {
  test('el precio se edita en soles enteros y se ve formateado', async ({ page }) => {
    // En la base van céntimos. Enteros es cómo se EDITA, no cómo se muestra.
    await irAlPanel(page);
    await page.getByRole('link', { name: 'Paquetes' }).first().click();
    await expect(page.getByRole('heading', { name: 'Paquetes' })).toBeVisible();

    await page.getByRole('button', { name: 'Editar' }).first().click();
    const precio = page.getByLabel('Precio en soles');
    await precio.fill('450');
    await page.getByRole('button', { name: 'Guardar' }).click();

    await expect(page.getByText('S/ 450.00').first()).toBeVisible({ timeout: 15_000 });
  });

  test('un precio con decimales no se guarda', async ({ page }) => {
    await irAlPanel(page);
    await page.getByRole('link', { name: 'Paquetes' }).first().click();
    await page.getByRole('button', { name: 'Editar' }).first().click();

    await page.getByLabel('Precio en soles').fill('300.5');
    await page.getByRole('button', { name: 'Guardar' }).click();

    await expect(page.getByText(/Solo soles enteros/)).toBeVisible();
  });
});

test.describe('testimonios', () => {
  test('NO deja publicar uno sin consentimiento', async ({ page }) => {
    // Nombre único por ejecución: si una corrida anterior falló a mitad y dejó
    // su fila, un nombre fijo encuentra dos y el localizador revienta. El test
    // no debe depender de que la anterior terminara bien.
    const nombre = `Clienta E2E ${Date.now()}`;
    // §19 y Ley 29733: es el único punto que puede traerle un problema real a
    // James. La puerta está en la interfaz Y en el servidor.
    await irAlPanel(page);
    await page.getByRole('link', { name: 'Testimonios' }).first().click();
    await expect(page.getByRole('heading', { name: 'Testimonios' })).toBeVisible();

    await page.getByRole('button', { name: 'Nuevo testimonio' }).click();
    await page.getByLabel('Nombre').fill(nombre);
    await page.getByRole('button', { name: 'Guardar' }).click();

    const fila = page.getByRole('listitem').filter({ hasText: nombre });
    await expect(fila).toBeVisible({ timeout: 15_000 });

    // Nace en borrador y sin consentimiento: publicar está deshabilitado.
    await expect(fila.getByRole('button', { name: 'Publicar' })).toBeDisabled();
    await expect(fila.getByText('Sin consentimiento')).toBeVisible();

    // Y el motivo está escrito, no en un tooltip.
    await expect(
      page.getByText(new RegExp(`hasta que confirmes que ${nombre} dio su permiso`)),
    ).toBeVisible();

    // Limpieza: el E2E devuelve la base como la encontró. El borrado ya no usa
    // el confirm() nativo — exige escribir el nombre, porque se lleva del
    // servidor la captura y la foto de una persona real.
    await fila.getByRole('button', { name: 'Borrar' }).click();
    await page.getByLabel(/Escribe/).fill(nombre);
    await page.getByRole('button', { name: 'Borrar para siempre' }).click();
    await expect(fila).toHaveCount(0, { timeout: 15_000 });
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

  test('el enlace de prueba abre el wa.me real', async ({ page }) => {
    await irAlPanel(page);
    await page.getByRole('link', { name: 'Configuración' }).first().click();
    await page.getByRole('tab', { name: 'Contacto y redes' }).click();

    const enlace = page.getByRole('link', { name: 'Probar este número' });
    await expect(enlace).toHaveAttribute('href', /^https:\/\/wa\.me\/\d{10,}$/);
  });
});
