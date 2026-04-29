
import { MODE_SELECTION, THEME_META, THEME_COLOR_MAP, THEME_DIM_MAP, COMPONENT_COLLECTIONS, SKIPPED_COLLECTIONS } from './Configuration.js';
export class ThemeBuilder {

    constructor(data) {
        this.data = data;
        this.data.theme = this.data.theme || {};
    }

    // ---------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------

    createTitle(title) {
        lines.push('');
        lines.push(`/* ${title} */`);
    }

    formatValue(v) {
        const colorRegex = /^#[0-9a-f]{6}(ff)?$/i;
        if (typeof v === 'boolean') return v ? '1' : '0';
        if (typeof v === 'number') return `${v}px`;
        if (typeof v === 'string' && colorRegex.test(v)) return this.cleanColor(v);
        return String(v); // pass-through for "150%", etc.
    }

    cleanColor(value) {
        if (typeof value !== 'string') return value;
        const colorRegex = /^#[0-9a-f]{6}(ff)?$/i;
        const m = colorRegex.exec(value);
        return m ? `#${m[1]}` : value;
    }

    report() {
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
    }
    // ---------------------------------------------------------------------------
    // Builders
    // ---------------------------------------------------------------------------

    buildTailwindTheme() {
        const lines = ['@theme {'];
        // Fonts (All themes use the same font)
        const aTheme = this.data.theme && Object.values(this.data.theme)[0];
        if (aTheme?.['main-font-family-primary']) {
            lines.push(`  --font-sans: "${aTheme['main-font-family-primary']}", ui-sans-serif, system-ui, sans-serif;`);
        }
        if (aTheme?.['main-font-family-code']) {
            lines.push(`  --font-mono: "${aTheme['main-font-family-code']}", ui-monospace, SFMono-Regular, monospace;`);
        }

        // Spacing — values are 4px grid, so a single base var covers Tailwind's p-1, p-2, etc.
        if (this.data['tailwind-spacing']) {
            this.createTitle('Spacing — 4px grid base unit');
            lines.push('  --spacing: 0.25rem;');
        }

        // Typography
        const typo = this.data['tailwind-typography']?.value;
        if (typo) {
            const sizes = [];
            const weights = [];
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
                this.createTitle('Font sizes');
                for (const [n, v] of sizes) lines.push(`  --text-${n}: ${this.formatValue(v)};`);
            }
            if (weights.length) {
                this.createTitle('Font weights');
                for (const [n, v] of weights) lines.push(`  --font-weight-${n}: ${v};`);
            }
            if (leadings.length) {
                this.createTitle('Line heights');
                for (const [n, v] of leadings) lines.push(`  --leading-${n}: ${this.formatValue(v)};`);
            }
        }

        lines.push('}');
        return lines.join('\n');
    }

    buildDaisyThemes() {
        const blocks = [];
        for (const [name, tokens] of Object.entries(this.data.theme)) {
            const meta = THEME_META[name];
            if (!meta) {
                console.warn(`\u26a0  No metadata for theme "${name}" — skipping. Add to THEME_META.`);
                continue;
            }
            const lines = [];
            lines.push(`@plugin "daisyui/theme" {`);
            lines.push(`  name: "${name}";`);
            if (meta.default) lines.push('  default: true;');
            if (meta.prefersdark) lines.push('  prefersdark: true;');
            lines.push(`  color-scheme: ${meta.colorScheme};`);
            lines.push('');

            const missing = [];
            for (const [k, css] of Object.entries(THEME_COLOR_MAP)) {
                if (tokens[k] === undefined) { missing.push(k); continue; }
                lines.push(`  ${css}: ${this.cleanColor(tokens[k])};`);
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

    buildCustomVars() {
        const lines = [':root {'];

        // size — mode key encodes base px (e.g. "4-5" → 4.5px)
        const sizeMode = MODE_SELECTION.size;
        if (this.data.size?.[sizeMode]) {
            const base = parseFloat(sizeMode.replace('-', '.'));
            this.createTitle(`size — mode "${sizeMode}"`);
            lines.push(`  --size-field: ${base}px;`);
            lines.push(`  --size-selector: ${base}px;`);
        }

        // depth — daisyUI's --depth + extra shadow vars
        const depthMode = MODE_SELECTION.depth;
        const depth = this.data.depth?.[depthMode];
        if (depth) {
            this.createTitle(`depth — mode "${depthMode}"`)
            lines.push(`  --depth: ${depth.depth ? 1 : 0};`);
            for (const [k, v] of Object.entries(depth)) {
                if (k === 'depth') continue;
                lines.push(`  --${k}: ${formatValue(v)};`);
            }
        }

        // noise
        const noiseMode = MODE_SELECTION.noise;
        if (this.data.noise?.[noiseMode]) {
            this.createTitle('noise — mode "${noiseMode}')
            lines.push(`  --noise: ${this.data.noise[noiseMode].noise ? 1 : 0};`);
        }

        // Component collections
        for (const name of COMPONENT_COLLECTIONS) {
            const coll = this.data[name];
            if (!coll) continue;
            const modeKey = Object.keys(coll)[0];
            const tokens = coll[modeKey];
            if (!tokens) continue;

            this.createTitle(`Component Collection - ${name}`)
            for (const [k, v] of Object.entries(tokens)) {
                lines.push(`  --${k}: ${this.formatValue(v)};`);
            }
        }

        lines.push('}');
        return lines.join('\n');
    }

}