#!/usr/bin/env node
// Poda el build del TV box: deja solo lo alcanzable desde index.html.
// El escritorio (three.js, editor, música, docs...) no se usa en el TV y ocupa
// rootfs. Un archivo de assets/ se conserva si su nombre aparece en algún archivo
// ya alcanzado (imports, chunks lazy, CSS, fuentes, wasm).
//
// Uso: node scripts/prune-tv-dist.mjs <dist>
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve(process.argv[2] ?? 'dist');
const assetsDir = path.join(dist, 'assets');
if (!fs.existsSync(path.join(dist, 'index.html')) || !fs.existsSync(assetsDir)) {
  console.error(`prune-tv-dist: ${dist} no parece un build de vite`);
  process.exit(1);
}

// Entradas que el TV no sirve.
for (const page of ['docs.html', 'nex-music.html', 'admin.html']) fs.rmSync(path.join(dist, page), { force: true });

const assets = fs.readdirSync(assetsDir);
const textual = /\.(html|js|mjs|css|json|svg)$/;
const keep = new Set();
const queue = [path.join(dist, 'index.html')];

while (queue.length) {
  const file = queue.pop();
  if (!textual.test(file)) continue;
  const text = fs.readFileSync(file, 'utf8');
  for (const name of assets) {
    if (keep.has(name) || !text.includes(name)) continue;
    keep.add(name);
    queue.push(path.join(assetsDir, name));
  }
}

let freed = 0;
let removed = 0;
for (const name of assets) {
  if (keep.has(name)) continue;
  const p = path.join(assetsDir, name);
  freed += fs.statSync(p).size;
  fs.rmSync(p);
  removed++;
}
console.log(`prune-tv-dist: ${keep.size} assets conservados, ${removed} quitados (${(freed / 1048576).toFixed(1)} MB)`);
