# @yourcompany/daisy-theme

Custom daisyUI 5 theme synced from Figma. One source of truth for all webapps.

## How it works

```
Figma file  →  [export plugin]  →  tokens/figma-export.json
                                          │
                                          ▼
                                  scripts/build.mjs
                                          │
                                          ▼
                                  dist/theme.css   ←  npm publish
                                          │
                                          ▼
                              webapps `npm install` and import
```

## Workflow for the designer + dev

**When the theme changes in Figma:**

1. Designer opens the Figma file, runs a free variable-export plugin
   (e.g. *Variables to JSON*, *Design Tokens*, *export-variables* —
   anything that emits the W3C Design Tokens / DTCG format).
2. Save the resulting JSON over `tokens/figma-export.json` and commit.
3. Bump version + publish:
   ```bash
   npm version patch
   npm publish
   ```
   The `prepublishOnly` hook re-runs the build, so `dist/theme.css` is
   always fresh.

**In each consuming webapp:**

```bash
npm i -D @yourcompany/daisy-theme
```

Then in your main CSS file:

```css
@import "tailwindcss";
@plugin "daisyui";
@import "@yourcompany/daisy-theme/theme.css";
```

That's it. To pick up a new theme version: `npm update @yourcompany/daisy-theme`.

## Local development

```bash
npm install            # no runtime deps, just dev tooling if you add any
npm run build          # regenerates dist/theme.css from tokens/figma-export.json
```

## Adapting to your Figma plugin

Every plugin emits slightly different JSON. The script handles the most common
case — W3C DTCG with mode-keyed root (`{ "Light": {...}, "Dark": {...} }`).

If your plugin emits something else, edit two spots in `scripts/build.mjs`:

- **`THEMES` array** — set `mode` to whatever your plugin calls each mode, or
  to `null` if there are no modes.
- **`MAPPING` object** — left side is the slash-joined path inside a single
  mode's tree. Right side is the daisyUI CSS variable name. If your designer
  named a Figma variable `colors/brand/primary` instead of `color/primary`,
  change the left side to match.

Run `npm run build` and check the warnings — the script logs every token it
expected but didn't find.

## Adding a new theme variant

Add another entry to `THEMES` in `scripts/build.mjs`:

```js
{ name: 'mytheme-highcontrast', mode: 'High Contrast',
  default: false, prefersdark: false, colorScheme: 'light' },
```

Make sure that mode key exists in `tokens/figma-export.json`.
