/**
 * base24 → Astryx defineTheme adapter.
 *
 * Takes a base24 palette (24 hex slots) and produces a
 * DefineThemeInput partial: accent scale config + explicit token
 * overrides for the structural colors that `color.accent` can't derive.
 *
 * Strategy:
 *   - color.accent = base0D  → Astryx handles: --color-accent, --color-accent-muted,
 *     --color-on-accent, --color-icon-accent, --color-text-accent,
 *     all blue categoricals, ring, chart-1, focus-visible outlines.
 *   - color.neutralStyle  → guessed from neutral axis temperature.
 *   - tokens              → only structural overrides: backgrounds, text,
 *     borders, status, categorical non-blue.
 *
 * Typography, radius, motion, shadows, component styles all inherited
 * from the base Neutral theme.
 */

// ── Types ──────────────────────────────────────────────────────────────

export type Palette = Record<string, string>;
type RGB = [number, number, number];

// ── Hex helpers ─────────────────────────────────────────────────────────

function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function rgbToHex([r, g, b]: RGB): string {
  return [r, g, b]
    .map(c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0'))
    .join('');
}

// ── Relative luminance ─────────────────────────────────────────────────

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(c => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function lerpColor(a: RGB, b: RGB, t: number): RGB {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

// ── Opposite variant ───────────────────────────────────────────────────

function generateOpposite(palette: Palette): Palette {
  const opp: Palette = {};
  const base00 = palette.base00;
  const base07 = palette.base07;

  opp.base00 = base07;
  opp.base07 = base00;

  const darkRgb = hexToRgb(base00);
  const lightRgb = hexToRgb(base07);
  const base00Lum = relativeLuminance(base00);
  const base07Lum = relativeLuminance(base07);
  const lumRange = base07Lum - base00Lum;
  const safeRange = Math.abs(lumRange) < 0.001 ? 1 : lumRange;

  for (const slot of ['base01', 'base02', 'base03', 'base04', 'base05', 'base06']) {
    const orig = palette[slot];
    if (!orig) continue;
    const t = (relativeLuminance(orig) - base00Lum) / safeRange;
    opp[slot] = rgbToHex(lerpColor(lightRgb, darkRgb, 1 - Math.max(0, Math.min(1, t))));
  }

  for (const slot of ['base08', 'base09', 'base0A', 'base0B', 'base0C', 'base0D', 'base0E', 'base0F',
                        'base10', 'base11', 'base12', 'base13', 'base14', 'base15', 'base16', 'base17']) {
    const orig = palette[slot];
    if (!orig) continue;
    const [r, g, b] = hexToRgb(orig);
    const lum = relativeLuminance(orig);
    const gray = Math.round(255 * lum);
    opp[slot] = rgbToHex([r * 0.7 + gray * 0.3, g * 0.7 + gray * 0.3, b * 0.7 + gray * 0.3]);
  }

  return opp;
}

// ── Mode detection ─────────────────────────────────────────────────────

export type Mode = 'dark' | 'light';

export function detectMode(palette: Palette, explicitVariant?: Mode): Mode {
  if (explicitVariant) return explicitVariant;
  return relativeLuminance(palette.base00) < relativeLuminance(palette.base07) ? 'dark' : 'light';
}

// ── Neutral style detection ────────────────────────────────────────────

function detectNeutralStyle(palette: Palette): 'warm' | 'cool' | 'neutral' {
  // Check if base00/base01 have a color cast by comparing RGB channels
  const bg = hexToRgb(palette.base00);
  const dr = bg[0] - bg[1];
  const db = bg[2] - bg[1];
  if (dr > 6) return 'warm';
  if (db > 6) return 'cool';
  return 'neutral';
}


// ── Public API ─────────────────────────────────────────────────────────

export interface Base24ThemeInput {
  /** Accent color (hex, no #) from base0D */
  accent: string;
  /** Neutral style hint */
  neutralStyle?: 'warm' | 'cool' | 'neutral';
  /**
   * Token overrides from base24.
   * Each entry is [lightHex, darkHex] (raw hex, no #).
   * Single-string values are mode-independent.
   */
  tokens: Record<string, [string, string] | string>;
}

/**
 * Convert a base24 palette into a defineTheme input.
 *
 * `color.accent` drives the entire accent scale (Astryx handles tones).
 * `tokens` provides structural colors that `accent` alone can't derive:
 * backgrounds, text, borders, status, non-blue categoricals.
 */
export function paletteToThemeInput(palette: Palette, variant?: Mode): Base24ThemeInput {
  const mode = detectMode(palette, variant);
  const opp = generateOpposite(palette);
  const light = mode === 'dark' ? opp : palette;
  const dark  = mode === 'dark' ? palette : opp;

  // Single-value (mode-independent): use real palette directly
  const s = (slot: string) => `#${palette[slot]}`;

  // Tuple [light, dark]
  const t = (lightSlot: string, darkSlot: string): [string, string] => [
    `#${light[lightSlot]}`,
    `#${dark[darkSlot]}`,
  ];

  // Tuple [light, dark] with alpha overlay — for color badge backgrounds.
  // Astryx expects ~20% opacity tinted surfaces, not full-opacity colors.
  const ta = (lightSlot: string, darkSlot: string, alphaLight = '33', alphaDark = '3D'): [string, string] => [
    `#${light[lightSlot]}${alphaLight}`,
    `#${dark[darkSlot]}${alphaDark}`,
  ];

  return {
    accent: `#${palette.base0D}`,
    neutralStyle: detectNeutralStyle(palette),

    tokens: {
      // ── Accent & Neutral (non-accent — accent handled by color.accent) ─
      '--color-neutral': t('base01', 'base01'),
      '--color-brand': t('base0D', 'base0D'),

      // ── Backgrounds ──────────────────────────────────────────────
      '--color-background-body':      t('base00', 'base00'),
      '--color-background-surface':   t('base01', 'base01'),
      '--color-background-card':      t('base01', 'base01'),
      '--color-background-popover':   t('base01', 'base01'),
      '--color-background-muted':     t('base01', 'base01'),
      '--color-background-inverted':  t('base05', 'base05'),
      '--color-background-error-inverted': t('base08', 'base08'),

      // ── Overlays ─────────────────────────────────────────────────
      '--color-overlay':         ['#00000080', '#000000CC'],
      '--color-overlay-hover':   ['#0000000D', '#FFFFFF0D'],
      '--color-overlay-pressed': ['#0000001A', '#FFFFFF1A'],

      // ── Text ─────────────────────────────────────────────────────
      '--color-text-primary':   t('base05', 'base05'),
      '--color-text-secondary': t('base04', 'base04'),
      '--color-text-disabled':  t('base03', 'base03'),
      '--color-on-dark':        s('base05'),
      '--color-on-light':       s('base00'),

      // ── Icon ─────────────────────────────────────────────────────
      '--color-icon-primary':   t('base05', 'base05'),
      '--color-icon-secondary': t('base04', 'base04'),
      '--color-icon-disabled':  t('base03', 'base03'),

      // ── Borders ──────────────────────────────────────────────────
      '--color-border':            t('base03', 'base03'),
      '--color-border-emphasized': t('base02', 'base02'),

      // ── Status / Sentiment ───────────────────────────────────────
      '--color-success':       t('base0B', 'base0B'),
      '--color-success-muted': t('base0B', 'base0B'),
      '--color-on-success':    ['#FFFFFF', '#171717'],
      '--color-error':         t('base08', 'base08'),
      '--color-error-muted':   t('base08', 'base08'),
      '--color-on-error':      ['#FFFFFF', '#171717'],
      '--color-warning':       t('base0A', 'base0A'),
      '--color-warning-muted': t('base0A', 'base0A'),
      '--color-on-warning':    '#171717',

      // ── Effects ──────────────────────────────────────────────────
      '--color-skeleton':   t('base02', 'base02'),
      '--color-track':      t('base02', 'base02'),
      '--color-shadow':     ['#0000001A', '#0000004D'],
      '--color-tint-hover': ['black', 'white'],

      // ── Categorical: all 10 colors, backgrounds use alpha overlay
      '--color-background-blue':   ta('base0D', 'base0D'),
      '--color-border-blue':       t('base0D', 'base0D'),
      '--color-icon-blue':         t('base0D', 'base0D'),
      '--color-text-blue':         t('base0D', 'base0D'),

      '--color-background-red':    ta('base0F', 'base0F'),
      '--color-border-red':        t('base0F', 'base0F'),
      '--color-icon-red':          t('base0F', 'base0F'),
      '--color-text-red':          t('base0F', 'base0F'),

      '--color-background-orange': ta('base09', 'base09'),
      '--color-border-orange':     t('base09', 'base09'),
      '--color-icon-orange':       t('base09', 'base09'),
      '--color-text-orange':       t('base09', 'base09'),

      '--color-background-yellow': ta('base0A', 'base0A'),
      '--color-border-yellow':     t('base0A', 'base0A'),
      '--color-icon-yellow':       t('base0A', 'base0A'),
      '--color-text-yellow':       t('base0A', 'base0A'),

      '--color-background-green':  ta('base0B', 'base0B'),
      '--color-border-green':      t('base0B', 'base0B'),
      '--color-icon-green':        t('base0B', 'base0B'),
      '--color-text-green':        t('base0B', 'base0B'),

      '--color-background-teal':   ta('base0C', 'base0C'),
      '--color-border-teal':       t('base0C', 'base0C'),
      '--color-icon-teal':         t('base0C', 'base0C'),
      '--color-text-teal':         t('base0C', 'base0C'),

      '--color-background-cyan':   ta('base0C', 'base0C'),
      '--color-border-cyan':       t('base0C', 'base0C'),
      '--color-icon-cyan':         t('base0C', 'base0C'),
      '--color-text-cyan':         t('base0C', 'base0C'),

      '--color-background-purple': ta('base0E', 'base0E'),
      '--color-border-purple':     t('base0E', 'base0E'),
      '--color-icon-purple':       t('base0E', 'base0E'),
      '--color-text-purple':       t('base0E', 'base0E'),

      '--color-background-pink':   ta('base0F', 'base0F'),
      '--color-border-pink':       t('base0F', 'base0F'),
      '--color-icon-pink':         t('base0F', 'base0F'),
      '--color-text-pink':         t('base0F', 'base0F'),

      '--color-background-gray':   ta('base02', 'base02'),
      '--color-border-gray':       t('base03', 'base03'),
      '--color-icon-gray':         t('base04', 'base04'),
      '--color-text-gray':         t('base06', 'base06'),
    },
  };
}

// ── Built-in base24 schemes (fetched from tinted-theming/schemes) ─────────

export const ONE_DARK_PALETTE: Palette = {
  base00: '282c34', base01: '3f4451', base02: '4f5666', base03: '545862',
  base04: '9196a1', base05: 'abb2bf', base06: 'e6e6e6', base07: 'ffffff',
  base08: 'e05561', base09: 'd18f52', base0A: 'e6b965', base0B: '8cc265',
  base0C: '42b3c2', base0D: '4aa5f0', base0E: 'c162de', base0F: 'bf4034',
  base10: '21252b', base11: '181a1f', base12: 'ff616e', base13: 'f0a45d',
  base14: 'a5e075', base15: '4cd1e0', base16: '4dc4ff', base17: 'de73ff'
};

export const DRACULA_PALETTE: Palette = {
  base00: '282a36', base01: '21222c', base02: '44475A', base03: '6272a4',
  base04: '9ea8c7', base05: 'f8f8f2', base06: 'f8f8f2', base07: 'ffffff',
  base08: 'ff5555', base09: 'FFB86C', base0A: 'f1fa8c', base0B: '50fa7b',
  base0C: '8be9fd', base0D: 'bd93f9', base0E: 'ff79c6', base0F: '993333',
  base10: '1e2029', base11: '16171d', base12: 'ff6e6e', base13: 'ffffa5',
  base14: '69ff94', base15: 'a4ffff', base16: 'd6acff', base17: 'ff92df'
};

export const GRUVBOX_DARK_PALETTE: Palette = {
  base00: '282828', base01: '3c3836', base02: '504945', base03: '665c54',
  base04: '928374', base05: 'ebdbb2', base06: 'fbf1c7', base07: 'f9f5d7',
  base08: 'cc241d', base09: 'd65d0e', base0A: 'd79921', base0B: '98971a',
  base0C: '689d6a', base0D: '458588', base0E: 'b16286', base0F: '9d0006',
  base10: '2a2520', base11: '1d1d1d', base12: 'fb4934', base13: 'fabd2f',
  base14: 'b8bb26', base15: '8ec07c', base16: '83a598', base17: 'd3869b'
};

export const TOKYO_NIGHT_DARK_PALETTE: Palette = {
  base00: '1a1b26', base01: '16161e', base02: '2f3549', base03: '444b6a',
  base04: '787c99', base05: 'a9b1d6', base06: 'cbccd1', base07: 'd5d6db',
  base08: 'c0caf5', base09: 'a9b1d6', base0A: '0db9d7', base0B: '9ece6a',
  base0C: 'b4f9f8', base0D: '2ac3de', base0E: 'bb9af7', base0F: 'f7768e',
  base10: '16161e', base11: '0f0f14', base12: 'ff7a93', base13: 'ff9e64',
  base14: '73daca', base15: '7dcfff', base16: '89ddff', base17: 'bb9af7'
};

export const CATPPUCCIN_MOCHA_PALETTE: Palette = {
  base00: '1e1e2e', base01: '181825', base02: '313244', base03: '45475a',
  base04: '585b70', base05: 'cdd6f4', base06: 'f5e0dc', base07: 'b4befe',
  base08: 'f38ba8', base09: 'fab387', base0A: 'f9e2af', base0B: 'a6e3a1',
  base0C: '94e2d5', base0D: '89b4fa', base0E: 'cba6f7', base0F: 'f2cdcd',
  base10: '181825', base11: '11111b', base12: 'eba0ac', base13: 'f5e0dc',
  base14: 'a6e3a1', base15: '89dceb', base16: '74c7ec', base17: 'f5c2e7'
};

export const AYU_DARK_PALETTE: Palette = {
  base00: '0b0e14', base01: '131721', base02: '202229', base03: '3e4b59',
  base04: 'bfbdb6', base05: 'e6e1cf', base06: 'ece8db', base07: 'f2f0e7',
  base08: 'f07178', base09: 'ff8f40', base0A: 'ffb454', base0B: 'aad94c',
  base0C: '95e6cb', base0D: '59c2ff', base0E: 'd2a6ff', base0F: 'e6b450',
  base10: '0a0d13', base11: '06070A', base12: 'f26d78', base13: 'e6b673',
  base14: '7fd962', base15: '39bae6', base16: '73b8ff', base17: 'ddbcff'
};

export const GITHUB_DARK_PALETTE: Palette = {
  base00: '0d1117', base01: '161b22', base02: '484f58', base03: '6e7681',
  base04: '8b949e', base05: 'c9d1d9', base06: 'f0f6fc', base07: 'ffffff',
  base08: 'ffa657', base09: '79c0ff', base0A: 'bb8009', base0B: 'a5d6ff',
  base0C: '7ee787', base0D: 'd2a8ff', base0E: 'ff7b72', base0F: 'ffa198',
  base10: '010409', base11: '000000', base12: 'ff7b72', base13: 'd29922',
  base14: '3fb950', base15: '33B3AE', base16: '58a6ff', base17: 'bc8cff'
};

export const SHADES_OF_PURPLE_PALETTE: Palette = {
  base00: '1e1d40', base01: '000000', base02: '676767', base03: '7f7f7f',
  base04: '979797', base05: 'afafaf', base06: 'c7c7c7', base07: 'feffff',
  base08: 'd90429', base09: 'ffe700', base0A: '6871ff', base0B: '3ad900',
  base0C: '00c5c7', base0D: '6943ff', base0E: 'ff2b70', base0F: '6c0214',
  base10: '444444', base11: '222222', base12: 'f9291b', base13: 'f1d000',
  base14: '42d425', base15: '79e7fa', base16: '6871ff', base17: 'ff76ff'
};

export const TWILIGHT_PALETTE: Palette = {
  base00: '141414', base01: '141414', base02: '262626', base03: '5c5c51',
  base04: '92927c', base05: 'c8c8a7', base06: 'feffd3', base07: 'feffd3',
  base08: 'c06c43', base09: 'c2a86c', base0A: '5a5d61', base0B: 'afb979',
  base0C: '778284', base0D: '444649', base0E: 'b4be7b', base0F: '603621',
  base10: '191919', base11: '0c0c0c', base12: 'dd7c4c', base13: 'e1c47d',
  base14: 'cbd88c', base15: '8a989a', base16: '5a5d61', base17: 'd0db8e'
};

export const SOLARIZED_LIGHT_PALETTE: Palette = {
  base00: 'fdf6e3', base01: '073642', base02: '002b36', base03: '3b5a5d',
  base04: '778985', base05: 'b2b8ad', base06: 'eee8d5', base07: 'fdf6e3',
  base08: 'dc322f', base09: 'b58900', base0A: '839496', base0B: '859900',
  base0C: '2aa198', base0D: '268bd2', base0E: 'd33682', base0F: '6e1917',
  base10: '001c24', base11: '000e12', base12: 'cb4b16', base13: '657b83',
  base14: '586e75', base15: '93a1a1', base16: '839496', base17: '6c71c4'
};

export const ONE_LIGHT_PALETTE: Palette = {
  base00: 'e7e7e9', base01: 'dfdfe1', base02: 'cacace', base03: 'a0a1a7',
  base04: '696c77', base05: '383a42', base06: '202227', base07: '090a0b',
  base08: 'ca1243', base09: 'c18401', base0A: 'febb2a', base0B: '50a14f',
  base0C: '0184bc', base0D: '4078f2', base0E: 'a626a4', base0F: '986801',
  base10: 'f0f0f1', base11: 'fafafa', base12: 'ec2258', base13: 'f4a701',
  base14: '6db76c', base15: '01a7ef', base16: '709af5', base17: 'd02fcd'
};

export const GITHUB_LIGHT_COLORBLIND_PALETTE: Palette = {
  base00: 'ffffff', base01: 'f6f8fa', base02: 'afb8c1', base03: '8c959f',
  base04: '6e7781', base05: '424a53', base06: '32383f', base07: '24292f',
  base08: '8a4600', base09: '0550ae', base0A: 'bf8700', base0B: '0a3069',
  base0C: '0550ae', base0D: '8250df', base0E: 'b35900', base0F: '6f3800',
  base10: '24292f', base11: '000000', base12: 'f79939', base13: 'd4a72c',
  base14: '54aeff', base15: '49bcb7', base16: '54aeff', base17: 'c297ff'
};

export const SCHEMES: Record<string, { name: string; palette: Palette; variant?: Mode }> = {
  // ── Dark schemes ──────────────────────────────────────────────────────
  'one-dark':           { name: 'One Dark',           palette: ONE_DARK_PALETTE,           variant: 'dark' },
  'dracula':            { name: 'Dracula',             palette: DRACULA_PALETTE,            variant: 'dark' },
  'gruvbox-dark':       { name: 'Gruvbox Dark',        palette: GRUVBOX_DARK_PALETTE,       variant: 'dark' },
  'tokyo-night-dark':   { name: 'Tokyo Night Dark',    palette: TOKYO_NIGHT_DARK_PALETTE,   variant: 'dark' },
  'catppuccin-mocha':   { name: 'Catppuccin Mocha',    palette: CATPPUCCIN_MOCHA_PALETTE,   variant: 'dark' },
  'ayu-dark':           { name: 'Ayu Dark',            palette: AYU_DARK_PALETTE,           variant: 'dark' },
  'github-dark':        { name: 'GitHub Dark',         palette: GITHUB_DARK_PALETTE,        variant: 'dark' },
  'shades-of-purple':   { name: 'Shades of Purple',    palette: SHADES_OF_PURPLE_PALETTE,   variant: 'dark' },
  'twilight':           { name: 'Twilight',            palette: TWILIGHT_PALETTE,           variant: 'dark' },
  // ── Light schemes ─────────────────────────────────────────────────────
  'solarized-light':    { name: 'Solarized Light',     palette: SOLARIZED_LIGHT_PALETTE,    variant: 'light' },
  'one-light':          { name: 'One Light',           palette: ONE_LIGHT_PALETTE,          variant: 'light' },
  'github-light':       { name: 'GitHub Light',        palette: GITHUB_LIGHT_COLORBLIND_PALETTE, variant: 'light' },
};
