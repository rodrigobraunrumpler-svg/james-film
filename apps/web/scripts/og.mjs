/**
 * Genera `public/og.jpg`, la imagen que sale al pegar el enlace en un chat.
 *
 * Se ejecuta A MANO —`node scripts/og.mjs` desde `apps/web`— y el resultado se
 * commitea. NO va en el build: meter un navegador headless en Cloudflare Pages
 * para una imagen que cambia una vez al año es pagar en cada deploy por algo
 * que no se mueve.
 *
 * Las fuentes se empotran en base64 desde `public/fonts`: si se cargaran por
 * red, la captura saldría con la fuente del sistema y la imagen dejaría de ser
 * de la marca. Y **sin una sola cifra**: un «12 eventos» aquí caduca solo.
 */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const b64 = (f) => readFileSync(f).toString('base64');
const bricolage = b64('public/fonts/bricolage-var.woff2');
const inter = b64('public/fonts/inter-var.woff2');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'Bricolage Grotesque';src:url(data:font/woff2;base64,${bricolage}) format('woff2-variations');font-weight:400 800}
@font-face{font-family:'Inter';src:url(data:font/woff2;base64,${inter}) format('woff2-variations');font-weight:400 600}
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;height:630px;background:#0A0908;color:#F2EFE9;font-family:'Inter',system-ui;
  display:flex;flex-direction:column;justify-content:center;gap:26px;padding:0 88px;position:relative;overflow:hidden}
.aura{position:absolute;top:-260px;right:-120px;width:760px;height:760px;border-radius:50%;
  background:radial-gradient(circle,rgba(201,169,106,.20) 0%,rgba(201,169,106,.05) 46%,transparent 70%)}
.marca{display:flex;align-items:center;gap:16px;font-family:'Bricolage Grotesque';font-weight:800;
  font-size:34px;letter-spacing:.10em;text-transform:uppercase;color:#F2EFE9;position:relative}
.tira{width:38px;height:38px;border:2.5px solid #C9A96A;border-radius:7px;position:relative;flex:none}
.tira:before,.tira:after{content:'';position:absolute;top:5px;bottom:5px;width:5px;
  background:repeating-linear-gradient(#C9A96A 0 5px,transparent 5px 10px)}
.tira:before{left:4px}.tira:after{right:4px}
h1{font-family:'Bricolage Grotesque';font-weight:800;font-size:74px;line-height:1.04;
  letter-spacing:-0.025em;max-width:15ch;position:relative}
h1 b{color:#C9A96A;font-weight:800}
p{font-size:29px;color:#9C958C;position:relative}
.pie{display:flex;align-items:center;gap:14px;font-size:24px;color:#E5D3AC;position:relative}
.punto{width:9px;height:9px;border-radius:50%;background:#C9A96A}
</style></head><body>
<div class="aura"></div>
<div class="marca"><span class="tira"></span>James Film</div>
<h1>Reels y aftermovies para <b>tu evento</b></h1>
<p>Bodas, XV años y cumpleaños. Te llegan en 48 horas, listos para subir.</p>
<div class="pie"><span class="punto"></span>Ayacucho y alrededores</div>
</body></html>`;

const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await pagina.setContent(html, { waitUntil: 'load' });
await pagina.evaluate(() => document.fonts.ready);
await pagina.screenshot({ path: 'public/og.jpg', type: 'jpeg', quality: 88 });
await navegador.close();
console.log('public/og.jpg generado');
