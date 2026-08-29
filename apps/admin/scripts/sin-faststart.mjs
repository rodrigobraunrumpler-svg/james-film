import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Mueve la caja `moov` al FINAL, que es exactamente lo que distingue un MP4 sin
 * faststart. No basta con reordenar bytes: `stco`/`co64` guardan desplazamientos
 * ABSOLUTOS dentro del fichero, así que al adelantarse `mdat` hay que restarles
 * el tamaño de `moov` o el vídeo deja de decodificar.
 */
const [entrada, salida] = process.argv.slice(2);
const buf = readFileSync(entrada);

/** Cajas de primer nivel: [tamaño 4][tipo 4][carga]. */
function cajas(b, inicio = 0, fin = b.length) {
  const out = [];
  let p = inicio;
  while (p + 8 <= fin) {
    let tam = b.readUInt32BE(p);
    const tipo = b.toString('latin1', p + 4, p + 8);
    let cabecera = 8;
    if (tam === 1) {
      tam = Number(b.readBigUInt64BE(p + 8));
      cabecera = 16;
    } else if (tam === 0) tam = fin - p;
    if (tam < cabecera || p + tam > fin) break;
    out.push({ tipo, inicio: p, fin: p + tam, cabecera });
    p += tam;
  }
  return out;
}

const nivel1 = cajas(buf);
const moov = nivel1.find((c) => c.tipo === 'moov');
const mdat = nivel1.find((c) => c.tipo === 'mdat');
if (!moov || !mdat) throw new Error('sin moov o sin mdat');
if (moov.inicio > mdat.inicio) throw new Error('ya está sin faststart');

const delta = moov.fin - moov.inicio;
const nuevoMoov = Buffer.from(buf.subarray(moov.inicio, moov.fin));

/** Recorre en profundidad buscando stco/co64 y corrige cada entrada. */
let corregidos = 0;
(function recorrer(b, inicio, fin) {
  for (const c of cajas(b, inicio, fin)) {
    if (c.tipo === 'stco' || c.tipo === 'co64') {
      const base = c.inicio + c.cabecera + 4; // salta version+flags
      const n = b.readUInt32BE(base);
      for (let i = 0; i < n; i++) {
        if (c.tipo === 'stco') {
          const off = base + 4 + i * 4;
          b.writeUInt32BE(b.readUInt32BE(off) - delta, off);
        } else {
          const off = base + 4 + i * 8;
          b.writeBigUInt64BE(b.readBigUInt64BE(off) - BigInt(delta), off);
        }
        corregidos++;
      }
    } else if (['moov', 'trak', 'mdia', 'minf', 'stbl'].includes(c.tipo)) {
      recorrer(b, c.inicio + c.cabecera, c.fin);
    }
  }
})(nuevoMoov, 0, nuevoMoov.length);

const resto = nivel1.filter((c) => c.tipo !== 'moov').map((c) => buf.subarray(c.inicio, c.fin));
writeFileSync(salida, Buffer.concat([...resto, nuevoMoov]));

console.log(`orden original: ${nivel1.map((c) => c.tipo).join(' ')}`);
console.log(`orden nuevo:    ${[...resto.map(() => ''), ''].length ? nivel1.filter(c=>c.tipo!=='moov').map(c=>c.tipo).join(' ') + ' moov' : ''}`);
console.log(`desplazamientos corregidos: ${corregidos}  (delta ${delta} bytes)`);
