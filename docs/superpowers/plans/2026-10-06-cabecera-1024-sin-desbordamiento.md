# Cabecera sin desbordamiento a 1024 px Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evitar que la cabecera de escritorio desborde 40 px cuando muestra sus seis destinos a 1024 px.

**Architecture:** La prueba de cabecera usará `/testimonios` como caso máximo determinista. El CTA de WhatsApp conservará su enlace y su objetivo de 48×48 px, ocultará visualmente el número entre `lg` y `xl`, y recuperará el contenido completo desde `xl`.

**Tech Stack:** Astro 7, Tailwind CSS 4, Playwright 1.62, TypeScript 6.

## Global Constraints

- No modificar los enlaces del menú, el selector de tema, el menú móvil ni la utilidad global `marco`.
- Mantener un objetivo táctil mínimo de 48×48 px.
- Mantener el número de WhatsApp disponible para tecnologías de asistencia.
- Mostrar nuevamente el número desde 1280 px (`xl`).
- La corrección debe eliminar el scroll horizontal a 1024 px sin partir palabras.

---

### Task 1: Compactar el CTA de la cabecera en escritorio estrecho

**Files:**
- Modify: `apps/web/e2e/responsive.spec.ts:108-145`
- Modify: `apps/web/src/components/Barra.astro:181-212`
- Test: `apps/web/e2e/responsive.spec.ts`

**Interfaces:**
- Consumes: `Barra` recibe `display: string` y genera el enlace `[data-wa]` dentro de `nav[aria-label="Principal"]`.
- Produces: el mismo enlace y texto accesible, con presentación compacta desde 1024 hasta 1279 px y completa desde 1280 px.

- [x] **Step 1: Hacer determinista la prueba de regresión**

Cambiar la navegación del bloque `el menú de escritorio cabe` a la ruta que siempre declara los seis destinos y añadir la medición explícita del documento:

```ts
await page.goto('/testimonios');
await page.evaluate(() => document.fonts.ready);

const mal = await page.evaluate(() => {
  const nav = document.querySelector('nav[aria-label="Principal"]');
  if (!nav) return { partidas: [] as string[], seSale: false, scroll: 0 };
  const rango = document.createRange();
  const partidas: string[] = [];
  for (const a of nav.querySelectorAll(':scope > a')) {
    const texto = [...a.childNodes].find(
      (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
    );
    if (!texto) continue;
    rango.selectNodeContents(texto);
    if (rango.getClientRects().length > 1) partidas.push(a.textContent?.trim() ?? '');
  }
  const wa = nav.querySelector('a[data-wa]')?.getBoundingClientRect();
  return {
    partidas,
    seSale: wa ? Math.round(wa.right) > document.documentElement.clientWidth : false,
    scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
});

expect(mal.partidas, `se parten en dos líneas: ${mal.partidas.join(', ')}`).toEqual([]);
expect(mal.seSale, 'el botón de WhatsApp se sale de la pantalla').toBe(false);
expect(mal.scroll, `la cabecera mete ${mal.scroll}px de scroll horizontal`).toBeLessThanOrEqual(1);
```

- [x] **Step 2: Ejecutar la prueba y confirmar RED**

Con la vista previa del build actual disponible en `http://127.0.0.1:4321`, ejecutar:

```bash
pnpm --filter web exec playwright test e2e/responsive.spec.ts --grep "el menú de escritorio cabe" --project=escritorio
```

Expected: FAIL en el caso de 1024 px con `el botón de WhatsApp se sale de la pantalla` o `40px de scroll horizontal`.

- [x] **Step 3: Implementar el CTA compacto mínimo**

Sustituir únicamente las clases y el texto del CTA de escritorio en `Barra.astro`:

```astro
<a
  href={href}
  data-wa
  data-fuente={fuente ?? 'barra'}
  target="_blank"
  rel="noopener"
  class="ml-1 flex size-12 shrink-0 items-center justify-center rounded-control boton-wa font-semibold whitespace-nowrap xl:w-auto xl:gap-2.5 xl:px-3.5 2xl:px-5"
>
  <Icono nombre="chat" tamano={18} grosor={2.1} />
  <span class="sr-only xl:not-sr-only">{display}</span>
</a>
```

- [x] **Step 4: Construir y confirmar GREEN en la regresión**

Ejecutar:

```bash
pnpm --filter web build
pnpm --filter web exec playwright test e2e/responsive.spec.ts --grep "el menú de escritorio cabe" --project=escritorio
```

Expected: build con exit 0 y los seis anchos del bloque en PASS, incluido 1024 px.

- [x] **Step 5: Ejecutar la verificación de `apps/web`**

Ejecutar:

```bash
pnpm --filter web typecheck
pnpm --filter web lint
pnpm --filter web exec playwright test e2e/responsive.spec.ts
```

Expected: typecheck y lint con exit 0; matriz responsive completa sin fallos en los proyectos `movil` y `escritorio`.

- [x] **Step 6: Revisar el diff y crear el commit**

```bash
git diff --check
git diff -- apps/web/e2e/responsive.spec.ts apps/web/src/components/Barra.astro
git add apps/web/e2e/responsive.spec.ts apps/web/src/components/Barra.astro docs/superpowers/plans/2026-10-06-cabecera-1024-sin-desbordamiento.md
git commit -m "fix(web): prevent header overflow at 1024px"
```
