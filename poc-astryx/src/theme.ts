/**
 * Custom Astryx themes via defineTheme.
 *
 * Each base24 scheme becomes a theme by:
 *   1. Extending the Neutral theme (typography, motion, radius, shadows, component styles)
 *   2. Driving the accent scale from base0D via color.accent
 *   3. Overriding structural tokens from the base24 palette
 *
 * This matches the idiomatic defineTheme usage shown at:
 *   https://astryx.atmeta.com/docs/theme
 */
import { defineTheme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral';
import {
  paletteToThemeInput,
  type Palette,
  type Mode,
  detectMode,
} from './mapper';

export function createTheme(palette: Palette, name: string, variant?: Mode) {
  const mode = detectMode(palette, variant);
  const { accent, neutralStyle, tokens } = paletteToThemeInput(palette, mode);

  return defineTheme({
    name,

    // Inherit typography, motion, radius, shadows, component styles
    extends: neutralTheme,

    // Drive the accent scale from base0D — Astryx handles:
    //   --color-accent, --color-accent-muted, --color-on-accent,
    //   --color-icon-accent, --color-text-accent,
    //   blue categoricals, ring, chart-1, focus-visible outlines
    color: {
      accent,
      neutralStyle,
    },

    // Structural overrides from base24 that accent alone can't derive:
    // backgrounds, text, borders, status/sentiment, non-blue categoricals
    tokens,
  });
}
