# base24-to-shadcn
Convert tinted-theming base24 color schemes to CSS themes for Basecoat UI, shadcn/ui, and Astryx.

## Files

| File | Purpose |
|---|---|
| `src/cli.ts` | CLI: `bun src/cli.ts <scheme.yaml> [-o theme.css] [-p base0D] [-r 0.625rem] [--preview]` |
| `src/server.ts` | Bun HTTP server on port 3001: gallery + basecoat proxy (localhost only) + CSS API + /astryx |
| `src/core.ts` | Shared: YAML parse, hex→oklch, CSS generation, opposite variant |
| `docs/gallery.html` | Self-contained browser gallery (190 schemes, live preview, CSS customizer). Served via GitHub Pages. |
| `docs/schemes/` | 190 base24 YAMLs for GitHub Pages. `docs/schemes.json` is the index. |
| `schemes/base24/` | 190 base24 YAMLs for the Bun dev server. |
| `docs/astryx/` | Built Astryx theme POC (Vite+React, 12 schemes, defineTheme adapter) |
| `poc-astryx/src/mapper.ts` | base24 → defineTheme() adapter: `paletteToThemeInput()` |
| `README.md` | Full documentation |
## Key Conventions

- **Only color tokens** in theme output — `--radius`, spacing, shadows belong to the style pack
- **Hex → oklch** via Björn Ottosson conversion (D65, gamma 2.2), 3 decimal L/C, 0 decimal H
- **Mode detection**: `variant` field first, then luminance of base00 vs base07
- **Opposite variant**: auto-generated for the other mode (neutral swap, capped chroma)
- **Primary slot**: defaults to `base0D` (blue), overridable via `-p` or `--primary`
- **Schemes hosted locally** — 190 YAMLs in `schemes/base24/` and `docs/schemes/`. No GitHub API dependency.
- **Basecoat CDN**: `unpkg.com/basecoat-css@1.0.1` (jsDelivr had 503 for this version)
- **Tailwind v3 vs v4 conflict**: gallery uses Tailwind v3 CDN which conflicts with Basecoat v4 `@layer` — fix with explicit unlayered cascade rules. Browse mode uses v4 natively so no conflict.

## Server Routes

```
/                                docs/index.html (landing page)
/gallery                         docs/gallery.html (GitHub Pages ready)
/gallery?scheme=<name>           gallery with specific scheme
/browse?scheme=<name>            basecoatui.com proxied + theme injected (localhost only)
/browse?scheme=<name>&style=<s>  same with style pack (vega/nova/…)
/theme.css?scheme=<name>         raw CSS download
/theme.css?scheme=<name>&style=<s>  CSS with style pack attribution
/schemes                         JSON list of all 190 schemes (local files)
/schemes/<name>.yaml             raw YAML file (local files)
/astryx                          Astryx theme POC (built SPA)
/astryx/*                        Astryx POC assets (SPA fallback)
```
## Common Tasks

### Add a new feature to the gallery
- Edit `docs/gallery.html` — the `renderPreview` function builds the component showcase
- `generateCSS` produces the theme CSS, `applyTheme` injects it
- `state.customMappings` holds CSS var → palette slot overrides
- Cascade fixes are in the static `<style>` block (needed for Tailwind v3 CDN)

### Fix the browse proxy
- `src/server.ts` line ~155: `if (url.pathname.startsWith('/browse'))` handler
- Base tag, hx-boost stripping, resource URL rewriting are there
- Floating picker HTML + injected script (click interceptor, style switcher, theme reapply)

### Update Basecoat version
- `src/cli.ts`: `BASECOAT_VERSION` and `BASECOAT_CDN` constants
- `src/server.ts`: `BASECOAT_VERSION` constant
- `public/gallery.html`: hardcoded CDN URLs in `<link>` and `<script>` tags

### Fix the cascade (Tailwind v3 Preflight breaking Basecoat)
- Add explicit `background-color`, `color`, `border-color` rules for `.btn`, `.badge`, `.card`, `.input`, `.select`, `.alert` variants
- Add hover rules with `color-mix(in oklab, …)`
- File locations: docs/gallery.html `<style>` block, src/server.ts `generateCSS` function

## Gotchas

- `toString(16)` on number literals like `8.toString(16)` fails — use explicit hex arrays
- The basecoatui.com page resets `html.class` via JS on load — for dark schemes, `generateCSS` with `proxyMode=true` puts dark colors in `:root`
- `sel.dispatchEvent(new Event('change'))` doesn't trigger inline `onchange` in all browsers
- `<details>` closes when clicking `<select>` inside — use `onclick="event.stopPropagation()"`
- `</script>` inside template literals breaks the HTML parser
- Gallery `applyTheme()` must be called after `selectScheme` to inject CSS
- ~~GitHub API rate limits~~ — Fixed: schemes are hosted locally in `docs/schemes/` and `schemes/base24/`. No more 429 errors.
