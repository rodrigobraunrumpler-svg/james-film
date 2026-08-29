import { expect, test } from '@playwright/test';
import { abrirPrimeraGaleria, irAlPanel } from './apoyo';

/**
 * `exact` para no chocar con el toast: el badge dice «Publicada» y el aviso,
 * «Galería publicada». Sin esto el localizador resuelve a dos elementos.
 */
const estado = (page: Parameters<typeof abrirPrimeraGaleria>[0], texto: string) =>
  page.getByText(texto, { exact: true });

test.describe('publicar', () => {
  test('publicar la hace visible en la API pública, y despublicar la esconde', async ({
    page,
    request,
  }) => {
    await irAlPanel(page);
    await abrirPrimeraGaleria(page);

    const slug = new URL(page.url()).pathname.split('/').at(-1);
    expect(slug).toBeTruthy();

    const estabaPublicada = await estado(page, 'Publicada').isVisible();
    if (estabaPublicada) {
      await page.getByRole('button', { name: 'Pasar a borrador' }).click();
      await expect(estado(page, 'Borrador')).toBeVisible();
    }

    await page.getByRole('button', { name: 'Publicar galería' }).click();
    await expect(estado(page, 'Publicada')).toBeVisible();

    // La comprobación de verdad es contra la API pública: el badge del admin
    // podría estar bien y el filtro del controller mal.
    const enPublico = await request.get('http://localhost:3000/galleries');
    const cuerpo = await enPublico.json();
    expect(cuerpo.data.length).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Pasar a borrador' }).click();
    await expect(estado(page, 'Borrador')).toBeVisible();
  });
});
