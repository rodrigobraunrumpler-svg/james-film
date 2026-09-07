/**
 * Corta los peers OPCIONALES `prisma` y `typescript` de @prisma/client y borra
 * del store virtual todo lo que deje de ser alcanzable desde `node_modules/`.
 * Medido: 449 MB -> 186 MB. El cliente generado importa
 * `@prisma/client/runtime/client`, que no requiere ninguno de los dos.
 */
import { readdirSync, realpathSync, rmSync } from 'node:fs';
import { join, sep } from 'node:path';

const nm = join(process.argv[2] ?? process.cwd(), 'node_modules');
const vs = join(nm, '.pnpm');
const PEERS_OPCIONALES = ['prisma', 'typescript'];

for (const d of readdirSync(vs)) {
  if (!d.startsWith('@prisma+client@')) continue;
  for (const p of PEERS_OPCIONALES) rmSync(join(vs, d, 'node_modules', p), { recursive: true, force: true });
}

const hijos = (d) => {
  let out = [], l = [];
  try { l = readdirSync(d, { withFileTypes: true }); } catch { return out; }
  for (const e of l) {
    if (e.name.startsWith('.')) continue;
    if (e.name.startsWith('@')) { try { for (const s of readdirSync(join(d, e.name))) out.push(join(d, e.name, s)); } catch {} }
    else out.push(join(d, e.name));
  }
  return out;
};
const paquete = (p) => {
  let r; try { r = realpathSync(p); } catch { return null; }
  return r.startsWith(vs + sep) ? r.slice(vs.length + 1).split(sep)[0] : null;
};

const vivos = new Set();
const pila = hijos(nm).map(paquete).filter(Boolean);
while (pila.length) {
  const v = pila.pop();
  if (vivos.has(v)) continue;
  vivos.add(v);
  for (const p of hijos(join(vs, v, 'node_modules'))) { const n = paquete(p); if (n && n !== v) pila.push(n); }
}

let n = 0;
for (const d of readdirSync(vs)) {
  if (d === 'node_modules' || vivos.has(d)) continue;
  rmSync(join(vs, d), { recursive: true, force: true }); n++;
}
// `.modules.yaml` es contabilidad de pnpm —en la imagen final no hay pnpm— y
// lleva dentro un `prunedAt` con la hora del build. Es el UNICO fichero que
// impide que el mismo commit produzca la misma imagen byte a byte: medido con
// dos builds --no-cache, de 10 capas solo esa se diferenciaba, y solo por esa
// linea. Borrarlo cierra la reproducibilidad.
rmSync(join(nm, '.modules.yaml'), { force: true });

console.log(`podar-prod: ${vivos.size} vivos, ${n} borrados`);
