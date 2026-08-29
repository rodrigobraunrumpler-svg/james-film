import { test as setup } from '@playwright/test';
import { ESTADO_SESION, entrar } from './apoyo';

/**
 * UN solo login para toda la suite. La sesión vive en una cookie httpOnly del
 * dominio del admin, así que `storageState` la captura entera.
 */
setup('guardar la sesión', async ({ page }) => {
  await entrar(page);
  await page.context().storageState({ path: ESTADO_SESION });
});
