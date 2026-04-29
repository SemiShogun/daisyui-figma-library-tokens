/**
 * Transforms a Figma "All collections" JSON export into:
 *   1. @theme       — Tailwind 4 base tokens (fonts, spacing, text scale)
 *   2. @plugin "daisyui/theme" blocks — your custom themes
 *   3. :root        — global daisyUI vars (--depth, --noise, --size-*)
 *                     and your component design tokens (list, navbar, ...)
 *
 * Collections currently handled:
 *   theme, tailwind-spacing, tailwind-typography,
 *   size, depth, noise,
 *   list, navbar, footer, modal, stat, card,
 *   fieldset-labels, utilities, device, component-font-size
 *
 * Collections intentionally skipped (logged as info):
 *   themes-alias  — duplicates daisyUI's 35 built-in themes; enable those
 *                   via `themes:` in @plugin "daisyui" if you want them.
 *   border, radius — already provided per-theme inside the `theme` collection.
 *                    These standalone collections are multi-mode pickers
 *                    (no-radius, round-circle, etc.) — wire them up as
 *                    runtime toggles if needed.
 *   join, join-direction, square-apply — state-based, not flat tokens.
 *
 * Configure mode selections in MODE_SELECTION below.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { ThemeBuilder } from './ThemeBuilder.js';

const INPUT = process.argv[2] || './tokens/figma-export.json';
const OUTPUT = process.argv[3] || './dist/theme.css';

async function main() {
  const data = JSON.parse(await readFile(INPUT, 'utf8'));
  const themeBuilder = new ThemeBuilder(data);

  themeBuilder.reportSkips();

  const stringOutput = [
    '/* Auto-generated from Figma export. Please do not edit. */',
    '/* Run `npm run build` after updating tokens/figma-export.json. */',
    '/* ============================================================ */',
    '/*  Tailwind base tokens                                         */',
    '/* ============================================================ */',
    themeBuilder.buildTailwindTheme(),
    '/* ============================================================ */',
    '/*  daisyUI themes                                               */',
    '/* ============================================================ */',
    themeBuilder.buildDaisyThemes(),
    '/* ============================================================ */',
    '/*  Global vars + custom design tokens                           */',
    '/* ============================================================ */',
    themeBuilder.buildCustomVars(),
    '',
  ];

  await mkdir(dirname(resolve(OUTPUT)), { recursive: true });
  await writeFile(OUTPUT, stringOutput.join('\n'));
  console.log(`\u2713 Wrote ${OUTPUT}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
