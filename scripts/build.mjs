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

const INPUT  = process.argv[2] || './tokens/figma-export.json';
const OUTPUT = process.argv[3] || './dist/theme.css';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const MODE_SELECTION = {
  size:  '4',     // '3' | '4' | '4-5' | '5'    base px for fields & selectors
  depth: 'true',  // 'true' | 'false'           drop shadows on/off
  noise: 'false', // 'true' | 'false'           noise texture on/off
};

const THEME_META = {
  light:     { default: true,  prefersdark: false, colorScheme: 'light' },
  dark:      { default: false, prefersdark: true,  colorScheme: 'dark'  },
  corporate: { default: false, prefersdark: false, colorScheme: 'light' },
  night:     { default: false, prefersdark: false, colorScheme: 'dark'  },
};

// "theme" collection (per-theme) → daisyUI variable names
const THEME_COLOR_MAP = {
  'main-color-primary-primary':     '--color-primary',
  'main-color-primary-content':     '--color-primary-content',
  'main-color-secondary-secondary': '--color-secondary',
  'main-color-secondary-content':   '--color-secondary-content',
  'main-color-accent-bg':           '--color-accent',
  'main-color-accent-content':      '--color-accent-content',
  'main-color-neutral-neutral':     '--color-neutral',
  'main-color-neutral-content':     '--color-neutral-content',
  'main-color-base-100':            '--color-base-100',
  'main-color-base-200':            '--color-base-200',
  'main-color-base-300':            '--color-base-300',
  'main-color-base-content':        '--color-base-content',
  'main-color-info-info':           '--color-info',
  'main-color-info-content':        '--color-info-content',
  'main-color-success-success':     '--color-success',
  'main-color-success-content':     '--color-success-content',
  'main-color-warning-warning':     '--color-warning',
  'main-color-warning-content':     '--color-warning-content',
  'main-color-error-error':         '--color-error',
  'main-color-error-content':       '--color-error-content',
};

const THEME_DIM_MAP = {
  'main-radius-fields':       '--radius-field',
  'main-radius-selectors':    '--radius-selector',
  'main-radius-boxes':        '--radius-box',
  'main-border-width-border': '--border',
};

const COMPONENT_COLLECTIONS = [
  'list', 'navbar', 'footer', 'modal', 'stat', 'card',
  'fieldset-labels', 'utilities', 'device', 'component-font-size',
];

const SKIPPED_COLLECTIONS = new Set([
  'themes-alias', 'border', 'radius',
  'join', 'join-direction', 'square-apply',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function cleanColor(value) {
  if (typeof value !== 'string') return value;
  const m = /^#([0-9a-f]{6})ff$/i.exec(value);
  return m ? `#${m[1]}` : value;
}

function formatValue(v) {
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (typeof v === 'number')  return `${v}px`;
  if (typeof v === 'string' && /^#[0-9a-f]{6}(ff)?$/i.test(v)) return cleanColor(v);
  return String(v); // pass-through for "150%", etc.
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------
function buildTailwindTheme(data) {
  const lines = ['@theme {'];

  // Fonts (any theme — they're identical across)
  const aTheme = data.theme && Object.values(data.theme)[0];
  if (aTheme?.['main-font-family-primary']) {
    lines.push(`  --font-sans: "${aTheme['main-font-family-primary']}", ui-sans-serif, system-ui, sans-serif;`);
  }
  if (aTheme?.['main-font-family-code']) {
    lines.push(`  --font-mono: "${aTheme['main-font-family-code']}", ui-monospace, SFMono-Regular, monospace;`);
  }

  // Spacing — values are 4px grid, so a single base var covers Tailwind's p-1, p-2, etc.
  if (data['tailwind-spacing']) {
    lines.push('');
    lines.push('  /* Spacing — 4px grid base unit */');
    lines.push('  --spacing: 0.25rem;');
  }

  // Typography
  const typo = data['tailwind-typography']?.value;
  if (typo) {
    const sizes    = [];
    const weights  = [];
    const leadings = [];
    for (const [key, val] of Object.entries(typo)) {
      let m;
      if ((m = /^tailwind-typography-size-(.+)$/.exec(key))) {
        sizes.push([m[1], val]);
      } else if ((m = /^tailwind-typography-weight-(\w+)-\d+-?$/.exec(key))) {
        weights.push([m[1], val]);
      } else if ((m = /^tailwind-typography-line-height-leading-(.+)$/.exec(key))) {
        leadings.push([m[1], val]);
      }
    }
    if (sizes.length) {
      lines.push('');
      lines.push('  /* Font sizes */');
      for (const [n, v] of sizes) lines.push(`  --text-${n}: ${formatValue(v)};`);
    }
    if (weights.length) {
      lines.push('');
      lines.push('  /* Font weights */');
      for (const [n, v] of weights) lines.push(`  --font-weight-${n}: ${v};`);
    }
    if (leadings.length) {
      lines.push('');
      lines.push('  /* Line heights */');
      for (const [n, v] of leadings) lines.push(`  --leading-${n}: ${formatValue(v)};`);
    }
  }

  lines.push('}');
  return lines.join('\n');
}

function buildDaisyThemes(themeData) {
  const blocks = [];
  for (const [name, tokens] of Object.entries(themeData)) {
    const meta = THEME_META[name];
    if (!meta) {
      console.warn(`\u26a0  No metadata for theme "${name}" — skipping. Add to THEME_META.`);
      continue;
    }
    const lines = [];
    lines.push(`@plugin "daisyui/theme" {`);
    lines.push(`  name: "${name}";`);
    if (meta.default)     lines.push('  default: true;');
    if (meta.prefersdark) lines.push('  prefersdark: true;');
    lines.push(`  color-scheme: ${meta.colorScheme};`);
    lines.push('');

    const missing = [];
    for (const [k, css] of Object.entries(THEME_COLOR_MAP)) {
      if (tokens[k] === undefined) { missing.push(k); continue; }
      lines.push(`  ${css}: ${cleanColor(tokens[k])};`);
    }
    lines.push('');
    for (const [k, css] of Object.entries(THEME_DIM_MAP)) {
      if (tokens[k] === undefined) { missing.push(k); continue; }
      lines.push(`  ${css}: ${tokens[k]}px;`);
    }
    lines.push('}');
    blocks.push(lines.join('\n'));

    if (missing.length) {
      console.warn(`\u26a0  Theme "${name}" missing ${missing.length} token(s): ${missing.join(', ')}`);
    }
  }
  return blocks.join('\n\n');
}

function buildCustomVars(data) {
  const lines = [':root {'];

  // size — mode key encodes base px (e.g. "4-5" → 4.5px)
  const sizeMode = MODE_SELECTION.size;
  if (data.size?.[sizeMode]) {
    const base = parseFloat(sizeMode.replace('-', '.'));
    lines.push('');
    lines.push(`  /* size — mode "${sizeMode}" */`);
    lines.push(`  --size-field: ${base}px;`);
    lines.push(`  --size-selector: ${base}px;`);
  }

  // depth — daisyUI's --depth + extra shadow vars
  const depthMode = MODE_SELECTION.depth;
  const depth = data.depth?.[depthMode];
  if (depth) {
    lines.push('');
    lines.push(`  /* depth — mode "${depthMode}" */`);
    lines.push(`  --depth: ${depth.depth ? 1 : 0};`);
    for (const [k, v] of Object.entries(depth)) {
      if (k === 'depth') continue;
      lines.push(`  --${k}: ${formatValue(v)};`);
    }
  }

  // noise
  const noiseMode = MODE_SELECTION.noise;
  if (data.noise?.[noiseMode]) {
    lines.push('');
    lines.push(`  /* noise — mode "${noiseMode}" */`);
    lines.push(`  --noise: ${data.noise[noiseMode].noise ? 1 : 0};`);
  }

  // Component collections — single mode each, emit verbatim
  for (const name of COMPONENT_COLLECTIONS) {
    const coll = data[name];
    if (!coll) continue;
    const modeKey = Object.keys(coll)[0];
    const tokens  = coll[modeKey];
    if (!tokens) continue;

    lines.push('');
    lines.push(`  /* ${name} */`);
    for (const [k, v] of Object.entries(tokens)) {
      lines.push(`  --${k}: ${formatValue(v)};`);
    }
  }

  lines.push('}');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const data = JSON.parse(await readFile(INPUT, 'utf8'));

  // Report on what we're processing vs skipping
  const known = new Set([
    'theme', 'tailwind-spacing', 'tailwind-typography',
    'size', 'depth', 'noise', ...COMPONENT_COLLECTIONS,
  ]);
  for (const collName of Object.keys(data)) {
    if (known.has(collName)) continue;
    if (SKIPPED_COLLECTIONS.has(collName)) {
      console.log(`\u2139  Skipping "${collName}" by design (see header comment in build.mjs).`);
    } else {
      console.warn(`\u26a0  Unknown collection "${collName}" — not emitted. Add a handler to build.mjs.`);
    }
  }

  const out = [
    '/* Auto-generated from Figma export. Do not edit by hand. */',
    '/* Run `npm run build` after updating tokens/figma-export.json. */',
    '',
    '/* ============================================================ */',
    '/*  Tailwind base tokens                                         */',
    '/* ============================================================ */',
    buildTailwindTheme(data),
    '',
    '/* ============================================================ */',
    '/*  daisyUI themes                                               */',
    '/* ============================================================ */',
    buildDaisyThemes(data.theme || {}),
    '',
    '/* ============================================================ */',
    '/*  Global vars + custom design tokens                           */',
    '/* ============================================================ */',
    buildCustomVars(data),
    '',
  ];

  await mkdir(dirname(resolve(OUTPUT)), { recursive: true });
  await writeFile(OUTPUT, out.join('\n'));
  console.log(`\u2713 Wrote ${OUTPUT}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
