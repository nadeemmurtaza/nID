#!/usr/bin/env node
// WCAG contrast check for the colour pairings tokens.css promises. Parses the
// light (:root) and dark (prefers-color-scheme) blocks, resolves var() chains
// and composites translucent colours over the page, then asserts each pairing
// meets its floor (4.5:1 for text, 3:1 for UI components and large text).
// Run: node packages/design-tokens/check-contrast.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'tokens.css'), 'utf8');

function declarations(block) {
  const out = {};
  for (const m of block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) out[m[1]] = m[2].trim();
  return out;
}
const rootBlock = css.match(/:root\s*\{([\s\S]*?)\n\}/)[1];
const darkBlock = css.match(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root[^{]*\{([\s\S]*?)\n\s*\}\s*\n\}/)[1];
const light = declarations(rootBlock);
const dark = { ...light, ...declarations(darkBlock) };

function resolve(theme, name, depth = 0) {
  let v = theme[name];
  if (v === undefined || depth > 10) throw new Error(`cannot resolve ${name}`);
  const ref = v.match(/^var\((--[a-z0-9-]+)\)$/i);
  return ref ? resolve(theme, ref[1], depth + 1) : v;
}
function parse(c) {
  c = c.trim();
  let m = c.match(/^#([0-9a-f]{3,8})$/i);
  if (m) {
    let h = m[1];
    if (h.length === 3) h = [...h].map((x) => x + x).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1];
  }
  m = c.match(/^rgba?\(([^)]+)\)$/i);
  if (m) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], p[3] ?? 1];
  }
  throw new Error(`cannot parse colour ${c}`);
}
const over = (fg, bg) => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3])).concat(1);
const lum = ([r, g, b]) => {
  const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// [foreground token, background token, floor, what it is]
const PAIRS = [
  ['--color-ink', '--color-page', 4.5, 'body text on page'],
  ['--color-ink', '--color-surface', 4.5, 'body text on cards'],
  ['--color-ink-muted', '--color-page', 4.5, 'secondary text on page'],
  ['--color-ink-muted', '--color-surface', 4.5, 'secondary text on cards'],
  ['--color-ink-faint', '--color-page', 4.5, 'tertiary text and placeholders on page'],
  ['--color-ink-faint', '--color-surface', 4.5, 'tertiary text and placeholders on cards'],
  ['--color-accent', '--color-page', 4.5, 'accent used as link/text on page'],
  ['--color-accent', '--color-surface', 4.5, 'accent used as link/text on cards'],
  ['--color-on-accent', '--color-accent', 4.5, 'button label on accent fill'],
  ['--color-positive', '--color-page', 4.5, 'positive/verified text on page'],
  ['--color-positive', '--color-surface', 4.5, 'positive/verified text on cards'],
  ['--color-on-positive', '--color-positive', 4.5, 'label on positive fill'],
  ['--color-negative', '--color-page', 4.5, 'error text on page'],
  ['--color-negative', '--color-surface', 4.5, 'error text on cards'],
  ['--color-on-negative', '--color-negative', 4.5, 'label on negative fill'],
  ['--color-warning', '--color-page', 4.5, 'warning text on page'],
  ['--color-warning', '--color-surface', 4.5, 'warning text on cards'],
  ['--color-info', '--color-page', 4.5, 'info text on page'],
  ['--color-border-strong', '--color-page', 3, 'input and control borders (non-text, 3:1)'],
];

let failed = 0;
for (const [name, theme] of [['light', light], ['dark', dark]]) {
  for (const [fg, bg, floor, label] of PAIRS) {
    if (theme[fg] === undefined && fg !== '--color-border-strong') continue;
    let fgTok = fg;
    if (fg === '--color-border-strong' && theme[fg] === undefined) fgTok = '--border-strong';
    if (theme[fgTok] === undefined || theme[bg] === undefined) continue;
    const page = parse(resolve(theme, '--color-page'));
    const b = over(parse(resolve(theme, bg)), page);
    const f = over(parse(resolve(theme, fgTok)), b);
    const r = ratio(f, b);
    const ok = r >= floor;
    if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} [${name}] ${label}: ${r.toFixed(2)}:1 (needs ${floor}:1)`);
  }
}
console.log(failed ? `\n${failed} pairing(s) below their floor` : '\nAll pairings meet their floor');
process.exit(failed ? 1 : 0);
