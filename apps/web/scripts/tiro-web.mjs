import { chromium } from '@playwright/test';
const SALIDA = process.argv[2];
const nav = await chromium.launch({ channel: process.env.PW_CANAL === 'chromium' ? undefined : 'chrome' });
for (const [tema, anchos] of [['oscuro', [[390, 844], [1440, 900]]], ['claro', [[390, 844], [1440, 900]]]]) {
  for (const [w, h] of anchos) {
    const ctx = await nav.newContext({ viewport: { width: w, height: h } });
    await ctx.addInitScript((t) => localStorage.setItem('jamesfilm:tema', t), tema);
    const p = await ctx.newPage();
    await p.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
    // Se RECORRE la página antes de capturar. La entrada de cada bloque va con
    // `IntersectionObserver`, y un `fullPage` no hace scroll: sin esto, medio
    // sitio sale a opacidad 0 y parece que las secciones están vacías.
    await p.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight * 0.8) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 90));
      }
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 250));
    });

    // Se espera a que ACABEN las animaciones, saltándose las infinitas: la
    // promesa de una que no termina nunca no resuelve, y la captura se cuelga.
    await p.evaluate(async () => {
      const vivas = document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity);
      await Promise.all(vivas.map((a) => a.finished.catch(() => {})));
    });
    await p.waitForTimeout(200);
    await p.screenshot({ path: `${SALIDA}/web-${tema}-${w}.png`, fullPage: w > 800 });
    await ctx.close();
  }
}
await nav.close();
console.log('listo');
