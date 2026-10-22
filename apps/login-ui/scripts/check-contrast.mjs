#!/usr/bin/env node
/**
 * Verifies login-ui's own colour pairs against WCAG AA using the shared
 * @nadeemmurtaza/design-system contrast engine -- run via `pnpm check-contrast`.
 */
import { contrastRatioHex, wcagLevel } from '@nadeemmurtaza/design-system';

const pairs = [
  ['white button label on accent fill', '#ffffff', '#2f6fed', 4.5],
  ['body text on page bg', '#111318', '#ffffff', 4.5],
  ['muted text on page bg', '#5b6270', '#ffffff', 4.5],
  ['danger text on page bg', '#c4392b', '#ffffff', 4.5],
  ['active control border on page bg (non-text, 3:1 floor)', '#8c929e', '#ffffff', 3],
];

let failed = false;
for (const [label, fg, bg, floor] of pairs) {
  const ratio = contrastRatioHex(fg, bg);
  const level = wcagLevel(ratio);
  const ok = ratio >= floor;
  if (!ok) failed = true;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}: ${ratio.toFixed(2)}:1 (${level}, floor ${floor}:1)`);
}

if (failed) {
  console.error('\nSome pairs are under their WCAG floor.');
  process.exit(1);
}
console.log('\nAll checked pairs clear their WCAG floor.');
