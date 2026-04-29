// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
export const MODE_SELECTION = {
    size: '4',     // '3' | '4' | '4-5' | '5'    base px for fields & selectors
    depth: 'true',  // 'true' | 'false'           drop shadows on/off
    noise: 'false', // 'true' | 'false'           noise texture on/off
};

export const THEME_META = {
    light: { default: true, prefersdark: false, colorScheme: 'light' },
    dark: { default: false, prefersdark: true, colorScheme: 'dark' },
    corporate: { default: false, prefersdark: false, colorScheme: 'light' },
    night: { default: false, prefersdark: false, colorScheme: 'dark' },
};

// "theme" collection (per-theme) → daisyUI variable names
export const THEME_COLOR_MAP = {
    'main-color-primary-primary': '--color-primary',
    'main-color-primary-content': '--color-primary-content',
    'main-color-secondary-secondary': '--color-secondary',
    'main-color-secondary-content': '--color-secondary-content',
    'main-color-accent-bg': '--color-accent',
    'main-color-accent-content': '--color-accent-content',
    'main-color-neutral-neutral': '--color-neutral',
    'main-color-neutral-content': '--color-neutral-content',
    'main-color-base-100': '--color-base-100',
    'main-color-base-200': '--color-base-200',
    'main-color-base-300': '--color-base-300',
    'main-color-base-content': '--color-base-content',
    'main-color-info-info': '--color-info',
    'main-color-info-content': '--color-info-content',
    'main-color-success-success': '--color-success',
    'main-color-success-content': '--color-success-content',
    'main-color-warning-warning': '--color-warning',
    'main-color-warning-content': '--color-warning-content',
    'main-color-error-error': '--color-error',
    'main-color-error-content': '--color-error-content',
};

export const THEME_DIM_MAP = {
    'main-radius-fields': '--radius-field',
    'main-radius-selectors': '--radius-selector',
    'main-radius-boxes': '--radius-box',
    'main-border-width-border': '--border',
};

export const COMPONENT_COLLECTIONS = [
    'list', 'navbar', 'footer', 'modal', 'stat', 'card',
    'fieldset-labels', 'utilities', 'device', 'component-font-size',
];

export const SKIPPED_COLLECTIONS = new Set([
    'themes-alias', 'border', 'radius',
    'join', 'join-direction', 'square-apply',
]);