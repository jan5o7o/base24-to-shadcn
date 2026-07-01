# Color Themes for BasecoatUI &amp; shadcn/ui

Convert any [tinted-theming base24](https://github.com/tinted-theming/base24) color scheme into a CSS theme for [shadcn/ui](https://ui.shadcn.com) and [Basecoat UI](https://basecoatui.com). 190+ schemes, zero dependencies.

**[Open Gallery →](https://jan5o7o.github.io/base24-to-shadcn/gallery)**

## Quick Start

### 🎨 Gallery (no install)

1. Visit the [Gallery](https://jan5o7o.github.io/base24-to-shadcn/gallery)
2. Choose a scheme from 190+ options
3. Click **📥 Download CSS** — a pure color theme file

### 💻 CLI

```bash
# Convert a local scheme
bun src/cli.ts ~/schemes/one-dark.yaml -o theme.css

# From URL + generate preview
bun src/cli.ts https://raw.githubusercontent.com/tinted-theming/schemes/spec-0.11/base24/one-dark.yaml -o theme.css --preview

# Custom primary and radius
bun src/cli.ts one-dark.yaml -p base0E -r 0.75rem
```

### Flags

| Flag | Default | Description |
|---|---|---|
| `-o, --output` | `./theme.css` | Output path for theme CSS |
| `-p, --primary` | `base0D` | Which base24 slot drives primary/ring/chart-1 |
| `-r, --radius` | `0.625rem` | Border radius (used in preview HTML) |
| `--preview` | off | Also generate `preview.html` with Basecoat UI components |

### 🖥 Dev server (localhost only)

```bash
bun src/server.ts   # → http://localhost:3001
```

The `/browse` proxy (Basecoat UI with injected theme) only works on localhost.

## How It Works

### Color token mapping

The 24 base24 slots map to shadcn semantic tokens:

```
base00 ──→ background, primary-foreground
base01 ──→ card, popover, muted, sidebar-accent
base02 ──→ secondary, accent, sidebar-border
base03 ──→ border, input
base04 ──→ muted-foreground
base05 ──→ foreground, card-foreground, sidebar-foreground, …
base0D ──→ primary, ring, chart-1      ← configurable via -p
base08 ──→ destructive, chart-5
base0A ──→ chart-3 (yellow)
base0B ──→ chart-2 (green)
base0E ──→ chart-4 (magenta)
base10 ──→ sidebar (falls back to base11, then base00)
base11 ──→ sidebar fallback
```

### Mode detection

- `variant: "dark"` / `variant: "light"` in YAML → used directly
- Otherwise, relative luminance of `base00` vs `base07` determines the mode
- **Dark scheme** → real colors in `.dark { }`, auto-generated light in `:root { }`
- **Light scheme** → real colors in `:root { }`, auto-generated dark in `.dark { }`

The opposite variant swaps the neutral axis (base00↔base07), caps accent chroma, and adjusts lightness.

### Output

Generated `theme.css` contains **only color tokens** — radius, spacing, shadows belong to the Basecoat style pack. Use with:

```css
@import "tailwindcss";
@import "basecoat-css/sera";
@import "./theme.css";
```

A commented-out `@theme inline` block is included for Tailwind v4 users wanting utilities like `bg-background`, `text-primary`.

## Gallery Features

- **190+ schemes** loaded from GitHub, fully searchable
- **Live preview** with Basecoat UI components (buttons, cards, inputs, badges, alerts)
- **Clickable scheme name** → links to source YAML on GitHub
- **Clickable author** → links to author's GitHub (when URL present in author field)
- **Customize CSS Variables** — remap any token to any palette slot, changes apply instantly
- **Primary slot selector** — change which slot drives `--primary`, `--ring`, `--chart-1`
- **Palette swatches** with semantic role labels
- **CSS ↓** opens the generated CSS in a new tab
- **URL sharing** — `/gallery?scheme=name`, back/forward works
- Scheme mode auto-detected (dark/light)

## Files

```
src/cli.ts         CLI: single-scheme converter → theme.css + preview.html
src/core.ts        Shared: YAML parse, hex→oklch, CSS generation, opposite variant
src/server.ts      Bun HTTP server: gallery + basecoat proxy (localhost only) + CSS API
docs/index.html    Landing page (GitHub Pages)
docs/gallery.html  Self-contained browser gallery (GitHub Pages)
```

## Architecture

- **Zero dependencies** — no npm packages. YAML parsed with regex, oklch inline, HTML from templates
- **Hex → oklch** via Björn Ottosson conversion (D65, gamma 2.2), 3 decimal L/C, 0 decimal H
- **Client-side gallery** — all conversion logic runs in the browser. Gallery works on any static host
- **GitHub Pages** — `docs/` folder deployed to `jan5o7o.github.io/base24-to-shadcn`

## Design Decisions

- **Only color tokens in output** — `--radius`, spacing, shadows belong to the style pack
- **Opposite variant auto-generated** — every scheme produces both light and dark blocks
- **Cascade fixes for Tailwind v3** — gallery uses Tailwind v3 CDN which conflicts with Basecoat v4 `@layer`; explicit unlayered rules fix this
- **Browse proxy localhost-only** — gate prevents proxying basecoatui.com from production
- **CDN via unpkg** — jsDelivr had 503 for `basecoat-css@1.0.1`

---

Built with ♥ by [JanSo7o](http://jan.so7o.dev/)
