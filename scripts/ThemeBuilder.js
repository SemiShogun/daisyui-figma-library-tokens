
import { MODE_SELECTION, THEME_META, THEME_COLOR_MAP, THEME_DIM_MAP, COMPONENT_COLLECTIONS, SKIPPED_COLLECTIONS } from './Configuration.js';
class CssWriter {
    constructor() {
        this.lines = [];
    }

    line(s = '') {
        this.lines.push(s);
        return this;
    }

    prop(key, value) {
        this.lines.push(`  ${key}: ${value};`);
        return this;
    }

    section(title) {
        this.lines.push('', `  /* ${title} */`);
        return this;
    }

    block(selector, fn) {
        this.lines.push(`${selector} {`);
        fn(this);
        this.lines.push('}');
        return this;
    }

    toString() {
        return this.lines.join('\n');
    }
}

export class ThemeBuilder {

    constructor(data) {
        this.data = data;
        this.data.theme = data.theme || {};
    }

    // ---------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------

    createTitle(lines, title) {
        lines.push('');
        lines.push(`/* ${title} */`);
    }

    formatValue(v) {
        if (typeof v === 'boolean') return v ? '1' : '0';
        if (typeof v === 'number') return `${v}px`;
        if (typeof v === 'string' && /^#[0-9a-f]{6}(ff)?$/i.test(v)) return this.cleanColor(v);
        return String(v); // pass-through for "150%", etc.
    }

    cleanColor(value) {
        if (typeof value !== 'string') return value;
        const m = /^#([0-9a-f]{6})ff$/i.exec(value);
        return m ? `#${m[1]}` : value;
    }

    reportSkips() {
        // Report on what we're processing vs skipping
        const known = new Set([
            'theme',
            'tailwind-spacing',
            'tailwind-typography',
            'size',
            'depth',
            'noise',
            ...COMPONENT_COLLECTIONS,
        ]);
        for (const collName of Object.keys(this.data)) {
            if (known.has(collName)) continue;
            if (SKIPPED_COLLECTIONS.has(collName)) {
                console.log(`\uFE15  Skipping "${collName}" by design (see header comment in build.mjs).`);
            } else {
                console.warn(`\u003F  Unknown collection "${collName}" — not emitted. Add a handler to build.mjs.`);
            }
        }
    }

    // ---------------------------------------------------------------------------
    // Builders
    // ---------------------------------------------------------------------------

    buildTailwindTheme() {
        const w = new CssWriter();
        w.block('@theme', () => {
            // Fonts (all themes share the same font)
            const aTheme = this.data.theme && Object.values(this.data.theme)[0];
            if (aTheme?.['main-font-family-primary']) {
                w.prop('--font-sans', `"${aTheme['main-font-family-primary']}", ui-sans-serif, system-ui, sans-serif`);
            }
            if (aTheme?.['main-font-family-code']) {
                w.prop('--font-mono', `"${aTheme['main-font-family-code']}", ui-monospace, SFMono-Regular, monospace`);
            }

            // Spacing — values are 4px grid, so a single base var covers Tailwind's p-1, p-2, etc.
            if (this.data['tailwind-spacing']) {
                w.section('Spacing — 4px grid base unit');
                w.prop('--spacing', '0.25rem');
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
                    w.section('Font sizes');
                    for (const [n, v] of sizes) w.prop(`--text-${n}`, this.formatValue(v));
                }
                if (weights.length) {
                    w.section('Font weights');
                    for (const [n, v] of weights) w.prop(`--font-weight-${n}`, v);
                }
                if (leadings.length) {
                    w.section('Line heights');
                    for (const [n, v] of leadings) w.prop(`--leading-${n}`, this.formatValue(v));
                }
            }
        });
        return w.toString();
    }

    buildDaisyThemes() {
        const blocks = [];
        for (const [name, tokens] of Object.entries(this.data.theme)) {
            const meta = THEME_META[name];
            if (!meta) {
                console.warn(`\u26a0  No metadata for theme "${name}" — skipping. Add to THEME_META.`);
                continue;
            }

            const w = new CssWriter();
            const missing = [];

            w.block('@plugin "daisyui/theme"', () => {
                w.prop('name', `"${name}"`);
                if (meta.default) w.prop('default', 'true');
                if (meta.prefersdark) w.prop('prefersdark', 'true');
                w.prop('color-scheme', meta.colorScheme);
                w.line();

                for (const [k, css] of Object.entries(THEME_COLOR_MAP)) {
                    if (tokens[k] === undefined) { missing.push(k); continue; }
                    w.prop(css, this.cleanColor(tokens[k]));
                }
                w.line();
                for (const [k, css] of Object.entries(THEME_DIM_MAP)) {
                    if (tokens[k] === undefined) { missing.push(k); continue; }
                    w.prop(css, `${tokens[k]}px`);
                }
            });

            blocks.push(w.toString());

            if (missing.length) {
                console.warn(`\u26a0  Theme "${name}" missing ${missing.length} token(s): ${missing.join(', ')}`);
            }
        }
        return blocks.join('\n\n');
    }

    buildCustomVars() {
        const w = new CssWriter();
        w.block(':root', () => {
            // size — mode key encodes base px (e.g. "4-5" → 4.5px)
            const sizeMode = MODE_SELECTION.size;
            if (this.data.size?.[sizeMode]) {
                const base = parseFloat(sizeMode.replace('-', '.'));
                w.section(`size — mode "${sizeMode}"`);
                w.prop('--size-field', `${base}px`);
                w.prop('--size-selector', `${base}px`);
            }

            // depth — daisyUI's --depth + extra shadow vars
            const depthMode = MODE_SELECTION.depth;
            const depth = this.data.depth?.[depthMode];
            if (depth) {
                w.section(`depth — mode "${depthMode}"`);
                w.prop('--depth', depth.depth ? '1' : '0');
                for (const [k, v] of Object.entries(depth)) {
                    if (k === 'depth') continue;
                    w.prop(`--${k}`, this.formatValue(v));
                }
            }

            // Noise
            const noiseMode = MODE_SELECTION.noise;
            if (this.data.noise?.[noiseMode]) {
                w.section(`noise — mode "${noiseMode}"`);
                w.prop('--noise', this.data.noise[noiseMode].noise ? '1' : '0');
            }

            // Component collections
            for (const name of COMPONENT_COLLECTIONS) {
                const coll = this.data[name];
                if (!coll) continue;
                const modeKey = Object.keys(coll)[0];
                const tokens = coll[modeKey];
                if (!tokens) continue;

                w.section(`Component Collection - ${name}`);
                for (const [k, v] of Object.entries(tokens)) {
                    w.prop(`--${k}`, this.formatValue(v));
                }
            }
        });
        return w.toString();
    }

}