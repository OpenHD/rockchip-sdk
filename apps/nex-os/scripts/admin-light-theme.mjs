#!/usr/bin/env node
// Genera src/admin/admin-light.css: el tema claro del panel admin.
// El panel está escrito con clases de Tailwind pensadas para fondo oscuro (text-zinc-300, bg-white/5…).
// En vez de duplicar cada clase con variantes, este script busca todas las clases de color que usa el panel
// y les da un equivalente claro bajo [data-theme="light"]. Volver a correrlo al agregar clases de color nuevas:
//   node scripts/admin-light-theme.mjs
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../src/admin/', import.meta.url));
const OUT = join(ROOT, 'admin-light.css');
const INK = '17 19 28'; // tinta del tema claro (casi negro azulado)

const TEXT = {
  'zinc-100': '#18181b', 'zinc-200': '#27272a', 'zinc-300': '#3f3f46', 'zinc-400': '#52525b',
  'zinc-500': '#5f5f6b', 'zinc-600': '#71717a',
  'emerald-100': '#065f46', 'emerald-200': '#047857', 'emerald-300': '#047857', 'emerald-400': '#059669',
  'indigo-200': '#3730a3', 'indigo-300': '#4338ca',
  'rose-200': '#9f1239', 'rose-300': '#be123c', 'rose-400': '#e11d48',
  'amber-100': '#78350f', 'amber-200': '#92400e', 'amber-300': '#b45309',
  'sky-300': '#0369a1',
};
// Fondos fijos oscuros: los de página pasan al gris claro; tarjetas, menús y modales a blanco.
const PAGE_HEX = new Set(['05070c', '0a0b10']);
// text-white se mantiene blanco sobre botones y avatares de color sólido.
const KEEP_WHITE = [
  ':not([class~="bg-indigo-500"])', ':not([class~="bg-rose-500/90"])', ':not([class~="bg-emerald-500/90"])',
  ':not([class~="bg-gradient-to-br"]:not([class~="from-indigo-500/40"]))',
].join('');

const round = (n) => Math.round(n * 1000) / 1000;
const ink = (a) => `rgb(${INK} / ${round(Math.min(1, a))})`;
const hexRgb = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(' ');

function alphaOf(raw) {
  if (!raw) return null;
  const v = raw.replace(/^\[|\]$/g, '');
  return v.includes('.') ? Number(v) : Number(v) / 100;
}

/** Declaraciones del tema claro para una utilidad sin variantes, o null si no cambia. */
function lightRule(util) {
  let m = util.match(/^bg-\[#([0-9a-fA-F]{6})\](?:\/(\d+))?$/);
  if (m) {
    const base = PAGE_HEX.has(m[1].toLowerCase()) ? 'f4f5f9' : 'ffffff';
    const a = alphaOf(m[2]);
    return { decl: `background-color: rgb(${hexRgb(base)} / ${a ?? 1})` };
  }
  m = util.match(/^(bg|text|border|ring|divide|shadow)-(white|black|[a-z]+-\d+)(?:\/(\[[\d.]+\]|\d+))?$/);
  if (!m) return null;
  const [, kind, color, rawAlpha] = m;
  const a = alphaOf(rawAlpha);
  switch (kind) {
    case 'bg':
      if (color === 'white') return a === null ? null : { decl: `background-color: ${ink(a * 0.8 + 0.01)}` };
      if (color === 'black') return { decl: `background-color: ${ink((a ?? 1) * 0.5)}` };
      if (color === 'zinc-800') return { decl: 'background-color: #e4e4e7' };
      if (color === 'zinc-900') return { decl: 'background-color: #f4f4f5' };
      return null;
    case 'text':
      if (color === 'white') return { decl: `color: ${ink(a ?? 1)}`, keepWhite: true };
      if (TEXT[color]) return { decl: a === null ? `color: ${TEXT[color]}` : `color: rgb(${hexRgb(TEXT[color].slice(1))} / ${a})` };
      return null;
    case 'border':
      if (color === 'white') return { decl: `border-color: ${ink((a ?? 1) * 0.6 + 0.05)}` };
      if (color === 'zinc-800') return { decl: 'border-color: #e4e4e7' };
      return null;
    case 'divide':
      return color === 'white' ? { decl: `border-color: ${ink((a ?? 1) * 0.6 + 0.05)}`, divide: true } : null;
    case 'ring':
      return color === 'white' ? { decl: `--tw-ring-color: ${ink((a ?? 1) * 0.6 + 0.05)}` } : null;
    case 'shadow':
      return color === 'black' ? { decl: `--tw-shadow-color: ${ink(0.08)}` } : null;
    default:
      return null;
  }
}

function selector(token) {
  const parts = token.split(':');
  const util = parts.pop();
  const rule = lightRule(util);
  if (!rule) return null;
  const variants = new Set(parts);
  const attr = `[class~="${token}"]`;
  let sel = `[data-theme="light"] ${variants.has('group-hover') ? '.group:hover ' : ''}${attr}`;
  if (rule.keepWhite) sel += KEEP_WHITE;
  if (variants.has('hover')) sel += ':hover';
  if (variants.has('focus')) sel += ':focus';
  if (variants.has('placeholder')) sel += '::placeholder';
  if (rule.divide) sel += ' > :not([hidden]) ~ :not([hidden])';
  return `${sel} { ${rule.decl}; }`;
}

function files(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(tsx?|css)$/.test(f) && f !== 'admin-light.css' ? [p] : [];
  });
}

const TOKEN = /(?:[a-z-]+:)*(?:bg|text|border|ring|divide|shadow)-(?:white|black|[a-z]+-\d+|\[#[0-9a-fA-F]{6}\])(?:\/(?:\[[\d.]+\]|\d+))?(?![\w\-[/])/g;
const tokens = new Set(files(ROOT).flatMap((f) => readFileSync(f, 'utf8').match(TOKEN) ?? []));
const rules = [...tokens].sort().map(selector).filter(Boolean);

writeFileSync(OUT, `/* Tema claro del panel admin. GENERADO por scripts/admin-light-theme.mjs: no editar a mano. */

:root[data-theme="light"] { color-scheme: light; }
[data-theme="light"] body {
  background:
    radial-gradient(1200px 600px at 10% -10%, rgba(99, 102, 241, 0.07), transparent 60%),
    radial-gradient(900px 500px at 110% 10%, rgba(16, 185, 129, 0.05), transparent 60%),
    #f4f5f9;
  background-attachment: fixed;
  color: #27272a;
}
[data-theme="light"] * { scrollbar-color: rgba(17, 19, 28, 0.18) transparent; }
[data-theme="light"] input[type='date']::-webkit-calendar-picker-indicator { filter: none; }

${rules.join('\n')}
`);
console.log(`admin-light.css: ${rules.length} reglas de ${tokens.size} clases de color`);
