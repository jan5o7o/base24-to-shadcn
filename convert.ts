#!/usr/bin/env bun

/**
 * base24-to-shadcn — Convert a tinted-theming base24 color scheme
 * into a shadcn/ui / Basecoat UI CSS theme.
 *
 * Usage:
 *   bun convert.ts <scheme.yaml> [--output theme.css] [--primary base0D] [--radius 0.625rem] [--preview]
 */

// ── Constants ──────────────────────────────────────────────────────────────

const BASECOAT_VERSION = "1.0.1";
const BASECOAT_CDN = "https://unpkg.com/basecoat-css"; // unpkg when jsDelivr has issues; swap to https://cdn.jsdelivr.net/npm/basecoat-css

// ── Types ──────────────────────────────────────────────────────────────────

interface Scheme {
  system: string;
  name: string;
  author: string;
  variant?: "dark" | "light";
  palette: Record<string, string>;
}

interface Oklch {
  l: number;
  c: number;
  h: number;
}

// ── YAML Parsing ───────────────────────────────────────────────────────────

function parseYaml(raw: string): Scheme {
  const scheme: Scheme = {
    system: "",
    name: "Unknown",
    author: "Unknown",
    palette: {},
  };

  const lines = raw.split("\n");
  let inPalette = false;

  for (const rawLine of lines) {
    // Strip inline comment (YAML # comment after value)
    const commentIdx = rawLine.search(/(?:\s|")#(?:\s|$)/);
    const line = commentIdx >= 0 ? rawLine.substring(0, commentIdx).trimEnd() : rawLine;
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    // Handle palette block
    if (trimmed === "palette:") {
      inPalette = true;
      continue;
    }

    if (inPalette) {
      // Match: "  base00: \"#171D23\"" or "  base00: '#171D23'" or "  base00: #171D23"
      const palMatch = trimmed.match(
        /^(base[0-9A-Fa-f]{2}):\s*(?:["'])?#?([0-9a-fA-F]{6})(?:["'])?\s*$/,
      );
      if (palMatch) {
        scheme.palette[palMatch[1]] = palMatch[2];
        continue;
      }
      // If we hit a non-palette key at root level, exit palette
      if (!trimmed.startsWith(" ")) {
        inPalette = false;
      } else {
        continue; // skip comments/unknown inside palette
      }
    }

    // Top-level scalar: "key: \"value\"" or "key: 'value'" or "key: value"
    const kvMatch = trimmed.match(
      /^([a-zA-Z_]\w*):\s*(?:["'])?(.+?)(?:["'])?\s*$/,
    );
    if (!kvMatch) continue;

    const [, key, value] = kvMatch;
    switch (key) {
      case "system":
        scheme.system = value;
        break;
      case "name":
        scheme.name = value;
        break;
      case "author":
        scheme.author = value;
        break;
      case "variant":
        scheme.variant = value as "dark" | "light";
        break;
    }
  }

  // Validate palette
  const paletteKeys = Object.keys(scheme.palette);
  const hasAll16 = ["base00","base01","base02","base03","base04","base05","base06","base07",
                    "base08","base09","base0A","base0B","base0C","base0D","base0E","base0F"]
    .every(k => k in scheme.palette);

  if (!hasAll16) {
    const present = paletteKeys.length;
    throw new Error(
      `Scheme "${scheme.name}" has only ${present} color slots (need at least base00–base0F). ` +
      `Found: ${paletteKeys.sort().join(", ")}`,
    );
  }

  return scheme;
}

// ── Hex Helpers ────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  return [r, g, b];
}

// ── Hex → oklch conversion (Björn Ottosson) ────────────────────────────────

function hexToOklch(hex: string): Oklch {
  // Step 1: hex → sRGB (0–1)
  const [r, g, b] = hexToRgb(hex);

  // Step 2: sRGB → linear sRGB
  const linearize = (c: number): number =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

  const lr = linearize(r);
  const lg_ = linearize(g);
  const lb = linearize(b);

  // Step 3: linear sRGB → XYZ (D65)
  const x = 0.4124564 * lr + 0.3575761 * lg_ + 0.1804375 * lb;
  const y = 0.2126729 * lr + 0.7151522 * lg_ + 0.0721750 * lb;
  const z = 0.0193339 * lr + 0.1191920 * lg_ + 0.9503041 * lb;

  // Step 4: XYZ → LMS
  const l = 0.8189330101 * x + 0.3618667424 * y - 0.1288597137 * z;
  const m = 0.0329845436 * x + 0.9293118715 * y + 0.0361456387 * z;
  const s = 0.0482003018 * x + 0.2643662691 * y + 0.6338517070 * z;

  // Step 5: LMS → nonlinear L'M'S' (cube root)
  const cbrt = (v: number): number => Math.cbrt(v);

  const l_ = cbrt(l);
  const m_ = cbrt(m);
  const s_ = cbrt(s);

  // Step 6: L'M'S' → oklch
  const okL = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const okA = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const okB = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

  const C = Math.sqrt(okA * okA + okB * okB);
  const H = (Math.atan2(okB, okA) * 180) / Math.PI;
  const Hnorm = H < 0 ? H + 360 : H;

  return { l: okL, c: C, h: Hnorm };
}

function oklchToString({ l, c, h }: Oklch, decimals?: number): string {
  const dl = decimals ?? 3;
  const dc = decimals ?? 3;
  return `oklch(${l.toFixed(dl)} ${c.toFixed(dc)} ${Math.round(h)})`;
}

// ── Mode Detection ─────────────────────────────────────────────────────────

function detectMode(scheme: Scheme): "dark" | "light" {
  if (scheme.variant === "dark") return "dark";
  if (scheme.variant === "light") return "light";

  // Relative luminance (sRGB coefficients)
  const luminance = (hex: string): number => {
    const [r, g, b] = hexToRgb(hex);
    const linearize = (c: number): number =>
      c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
  };

  const l00 = luminance(scheme.palette.base00);
  const l07 = luminance(scheme.palette.base07);
  // If background (base00) is darker than foreground (base07) → dark scheme
  return l00 < l07 ? "dark" : "light";
}

// ── Token Mapping ──────────────────────────────────────────────────────────

interface TokenDef {
  token: string;
  slot: string;
  fallback?: string;
}

function getTokenMap(primarySlot: string): TokenDef[] {
  return [
    // Core surfaces (color-only — radius/spacing belong to the style pack)
    { token: "background",   slot: "base00" },
    { token: "foreground",   slot: "base05" },
    { token: "card",         slot: "base01" },
    { token: "card-foreground",      slot: "base05" },
    { token: "popover",      slot: "base01" },
    { token: "popover-foreground",   slot: "base05" },
    { token: "primary",      slot: primarySlot },
    { token: "primary-foreground",   slot: "base00" },
    { token: "secondary",    slot: "base02" },
    { token: "secondary-foreground", slot: "base05" },
    { token: "muted",        slot: "base01" },
    { token: "muted-foreground",     slot: "base04" },
    { token: "accent",       slot: "base02" },
    { token: "accent-foreground",    slot: "base05" },
    { token: "destructive",  slot: "base08" },
    { token: "destructive-foreground", slot: "base05" },
    { token: "border",       slot: "base03" },
    { token: "input",        slot: "base03" },
    { token: "ring",         slot: primarySlot },
    // Charts
    { token: "chart-1",      slot: primarySlot },
    { token: "chart-2",      slot: "base0B" },
    { token: "chart-3",      slot: "base0A" },
    { token: "chart-4",      slot: "base0E" },
    { token: "chart-5",      slot: "base08" },
    // Sidebar
    { token: "sidebar",                   slot: "base10", fallback: "base11" },
    { token: "sidebar-foreground",        slot: "base05" },
    { token: "sidebar-primary",           slot: primarySlot },
    { token: "sidebar-primary-foreground", slot: "base00" },
    { token: "sidebar-accent",            slot: "base01" },
    { token: "sidebar-accent-foreground", slot: "base05" },
    { token: "sidebar-border",            slot: "base02" },
    { token: "sidebar-ring",              slot: primarySlot },
  ];
}

// ── Opposite Variant Generation ────────────────────────────────────────────

function generateOppositeVariant(
  scheme: Scheme,
  mode: "dark" | "light",
  primarySlot: string,
): Record<string, string> {
  const pal = scheme.palette;
  const opposite: Record<string, string> = {};

  // 1. Neutral axis swap: base00↔base07, base01↔base06, base02↔base05, base03↔base04
  const neutralSwaps: [string, string][] = [
    ["base00", "base07"],
    ["base01", "base06"],
    ["base02", "base05"],
    ["base03", "base04"],
  ];

  // Build a lookup: slot → swapped color (as oklch string)
  const swapped: Record<string, string> = {};
  for (const [a, b] of neutralSwaps) {
    swapped[a] = oklchToString(hexToOklch(pal[b]));
    swapped[b] = oklchToString(hexToOklch(pal[a]));
  }

  // 2. Extra-dark backgrounds (base10/base11) → light equivalents
  for (const slot of ["base10", "base11"]) {
    if (pal[slot]) {
      const c = hexToOklch(pal[slot]);
      const targetL = slot === "base11" ? 0.95 : 0.90;
      swapped[slot] = oklchToString({ l: targetL, c: 0.02, h: c.h });
    }
  }

  // 3. Accent colors (base08–base0F): keep hue, cap C, adjust L
  const accentSlots = ["base08","base09","base0A","base0B","base0C","base0D","base0E","base0F"];
  for (const slot of accentSlots) {
    if (pal[slot]) {
      const c = hexToOklch(pal[slot]);
      const targetL = c.l < 0.5 ? 0.60 : 0.55;
      const cappedC = Math.min(c.c, 0.15);
      // Interpolate if close: blend between the two targets based on distance
      // For 0.5 threshold we just use the direct mapping
      swapped[slot] = oklchToString({ l: targetL, c: cappedC, h: c.h });
    }
  }

  // 4. Bright colors (base12–base17): keep hue, cap C, adjust L
  const brightSlots = ["base12","base13","base14","base15","base16","base17"];
  for (const slot of brightSlots) {
    if (pal[slot]) {
      const c = hexToOklch(pal[slot]);
      // Target L in 0.50–0.65 range
      const targetL = c.l < 0.5 ? Math.max(c.l + 0.10, 0.50) : Math.min(c.l - 0.05, 0.65);
      const cappedC = Math.min(c.c, 0.18);
      swapped[slot] = oklchToString({ l: targetL, c: cappedC, h: c.h });
    }
  }

  // 5. Remaining non-neutral, non-accent, non-bright slots — copy as-is
  // (only base05/base0C etc. that weren't covered above)
  // base05 is already in neutral swaps, base0C is in accentSlots.
  // base0D is handled... actually let's check: accentSlots covers base08-0F.
  // The swapped map now has everything we need.

  return swapped;
}

// ── CSS Generation ─────────────────────────────────────────────────────────

function resolveSlot(
  palette: Record<string, string>,
  oppositePalette: Record<string, string> | null,
  def: TokenDef,
  useOpposite: boolean,
  isOklch: boolean,
): string {
  if (useOpposite && oppositePalette) {
    const slot = def.slot;
    if (slot && oppositePalette[slot]) {
      return oppositePalette[slot];
    }
    // Fallback chain for sidebar
    if (def.fallback && oppositePalette[def.fallback]) {
      return oppositePalette[def.fallback];
    }
    // Second fallback: if sidebar fallback also missing, try base00 in opposite
    if (def.token === "sidebar" && oppositePalette["base00"]) {
      return oppositePalette["base00"];
    }
    // Fall through to original
  }

  if (!def.slot) return ""; // radius handled separately

  const hex = palette[def.slot];
  if (!hex) {
    // Try fallback
    if (def.fallback && palette[def.fallback]) {
      return isOklch
        ? oklchToString(hexToOklch(palette[def.fallback]))
        : palette[def.fallback];
    }
    // Last resort: base00
    if (palette.base00) {
      return isOklch
        ? oklchToString(hexToOklch(palette.base00))
        : palette.base00;
    }
    return "oklch(1 0 0)";
  }
  return oklchToString(hexToOklch(hex));
}

function generateCSS(
  scheme: Scheme,
  primarySlot: string,
  radius: string,
): string {
  const mode = detectMode(scheme);
  const oppositePalette = generateOppositeVariant(scheme, mode, primarySlot);
  const tokenMap = getTokenMap(primarySlot);

  const oppositeLabel =
    mode === "dark" ? "light" : "dark";

  // Determine which selector gets the real scheme and which gets the opposite
  const realSelector = mode === "dark" ? ".dark" : ":root";
  const oppositeSelector = mode === "dark" ? ":root" : ".dark";

  const lines: string[] = [];

  lines.push("/*");
  lines.push(` * base24 theme: ${scheme.name}`);
  lines.push(` * Author: ${scheme.author || "Unknown"}`);
  lines.push(` * Source: https://github.com/tinted-theming/schemes/tree/spec-0.11/base24`);
  lines.push(" * Generated by base24-to-shadcn");
  lines.push(" * Only color tokens — radius, spacing, shadows belong to the style pack.");
  lines.push(" */");
  lines.push("");

  // Helper to emit a block
  function emitBlock(
    selector: string,
    comment: string | null,
    useOpposite: boolean,
  ) {
    if (comment) {
      lines.push(`/* ${comment} */`);
    }
    lines.push(`${selector} {`);

    for (const def of tokenMap) {
      const value = resolveSlot(
        scheme.palette,
        oppositePalette,
        def,
        useOpposite,
        true,
      );
      lines.push(`  --${def.token}: ${value};`);
    }

    lines.push("}");
    lines.push("");
  }

  // Emit the two blocks in logical order: :root first, then .dark
  if (realSelector === ":root") {
    emitBlock(":root", null, false);
    emitBlock(".dark", `Auto-generated ${oppositeLabel} variant — tweak the .dark block to taste`, true);
  } else {
    emitBlock(":root", `Auto-generated ${oppositeLabel} variant — tweak the :root block to taste`, true);
    emitBlock(".dark", null, false);
  }

  // Tailwind v4 @theme block as comment
  lines.push("/* Tailwind v4: uncomment to expose tokens as utilities (bg-background, text-foreground, etc.)");
  lines.push("@theme inline {");
  lines.push("  --color-background: var(--background);");
  lines.push("  --color-foreground: var(--foreground);");
  lines.push("  --color-card: var(--card);");
  lines.push("  --color-card-foreground: var(--card-foreground);");
  lines.push("  --color-popover: var(--popover);");
  lines.push("  --color-popover-foreground: var(--popover-foreground);");
  lines.push("  --color-primary: var(--primary);");
  lines.push("  --color-primary-foreground: var(--primary-foreground);");
  lines.push("  --color-secondary: var(--secondary);");
  lines.push("  --color-secondary-foreground: var(--secondary-foreground);");
  lines.push("  --color-muted: var(--muted);");
  lines.push("  --color-muted-foreground: var(--muted-foreground);");
  lines.push("  --color-accent: var(--accent);");
  lines.push("  --color-accent-foreground: var(--accent-foreground);");
  lines.push("  --color-destructive: var(--destructive);");
  lines.push("  --color-border: var(--border);");
  lines.push("  --color-input: var(--input);");
  lines.push("  --color-ring: var(--ring);");
  lines.push("  --color-chart-1: var(--chart-1);");
  lines.push("  --color-chart-2: var(--chart-2);");
  lines.push("  --color-chart-3: var(--chart-3);");
  lines.push("  --color-chart-4: var(--chart-4);");
  lines.push("  --color-chart-5: var(--chart-5);");
  lines.push("  --color-sidebar: var(--sidebar);");
  lines.push("  --color-sidebar-foreground: var(--sidebar-foreground);");
  lines.push("  --color-sidebar-primary: var(--sidebar-primary);");
  lines.push("  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);");
  lines.push("  --color-sidebar-accent: var(--sidebar-accent);");
  lines.push("  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);");
  lines.push("  --color-sidebar-border: var(--sidebar-border);");
  lines.push("  --color-sidebar-ring: var(--sidebar-ring);");
  lines.push("  --radius-sm: calc(var(--radius) * 0.6);");
  lines.push("  --radius-md: calc(var(--radius) * 0.8);");
  lines.push("  --radius-lg: var(--radius);");
  lines.push("  --radius-xl: calc(var(--radius) * 1.4);");
  lines.push("  --radius-2xl: calc(var(--radius) * 1.8);");
  lines.push("  --radius-3xl: calc(var(--radius) * 2.2);");
  lines.push("  --radius-4xl: calc(var(--radius) * 2.6);");
  lines.push("}");
  lines.push("*/");

  return lines.join("\n") + "\n";
}

// ── Preview HTML Generation ────────────────────────────────────────────────

function generatePreviewHTML(
  scheme: Scheme,
  cssContent: string,
): string {
  const mode = detectMode(scheme);
  const defaultClass = mode === "dark" ? ' class="dark"' : "";

  // Generate color swatches for all 24 slots
  const paletteSlots: string[] = [];
  for (let i = 0; i <= 7; i++) {
    paletteSlots.push(`base0${i}`);
  }
  for (let i = 8; i <= 15; i++) {
    paletteSlots.push(`base${i.toString(16).toUpperCase()}`);
  }
  // base16, base17
  for (let i = 10; i <= 17; i++) {
    paletteSlots.push(`base${i}`);
  }

  const swatches = paletteSlots
    .filter(s => scheme.palette[s])
    .map(s => {
      const hex = scheme.palette[s];
      const oklch = oklchToString(hexToOklch(hex));
      return `<div class="flex items-center gap-2 p-2 rounded border border-border bg-card">
        <div class="w-8 h-8 rounded" style="background:#${hex}"></div>
        <div><span class="text-xs font-mono text-muted-foreground">${s}</span><br><span class="text-xs font-mono">#${hex}</span></div>
      </div>`;
    })
    .join("\n            ");

  // Chart color bar
  const chartColors = getTokenMap("base0D")
    .filter(d => d.token.startsWith("chart-"))
    .map(d => scheme.palette[d.slot])
    .filter(Boolean);

  const chartBars = chartColors
    .map((hex, i) => {
      const oklch = oklchToString(hexToOklch(hex!));
      return `<div class="flex-1 h-8 rounded" style="background:${oklch}" title="chart-${i + 1}: #${hex}"></div>`;
    })
    .join("\n              ");

  return `<!DOCTYPE html>
<html lang="en"${defaultClass}>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${scheme.name} — Base24 → shadcn/ui Theme Preview</title>

  <!-- Tailwind CSS v3 Play CDN -->
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            background: 'var(--background)',
            foreground: 'var(--foreground)',
            card: 'var(--card)',
            'card-foreground': 'var(--card-foreground)',
            popover: 'var(--popover)',
            'popover-foreground': 'var(--popover-foreground)',
            primary: 'var(--primary)',
            'primary-foreground': 'var(--primary-foreground)',
            secondary: 'var(--secondary)',
            'secondary-foreground': 'var(--secondary-foreground)',
            muted: 'var(--muted)',
            'muted-foreground': 'var(--muted-foreground)',
            accent: 'var(--accent)',
            'accent-foreground': 'var(--accent-foreground)',
            destructive: 'var(--destructive)',
            border: 'var(--border)',
            input: 'var(--input)',
            ring: 'var(--ring)',
            'chart-1': 'var(--chart-1)',
            'chart-2': 'var(--chart-2)',
            'chart-3': 'var(--chart-3)',
            'chart-4': 'var(--chart-4)',
            'chart-5': 'var(--chart-5)',
          },
        },
      },
    };
  </script>
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- Basecoat CSS (load before theme to allow overrides) -->
  <link rel="stylesheet" href="${BASECOAT_CDN}@${BASECOAT_VERSION}/dist/basecoat.cdn.min.css" />

  <!-- Generated Theme CSS -->
  <style>
${cssContent.split("\n").map(l => "    " + l).join("\n")}
  </style>

  <!-- Map shadcn tokens to Tailwind v4 --color-* vars (needed for Basecoat CDN build) -->
  <style>
    :root, .dark {
      --color-background: var(--background);
      --color-foreground: var(--foreground);
      --color-card: var(--card);
      --color-card-foreground: var(--card-foreground);
      --color-popover: var(--popover);
      --color-popover-foreground: var(--popover-foreground);
      --color-primary: var(--primary);
      --color-primary-foreground: var(--primary-foreground);
      --color-secondary: var(--secondary);
      --color-secondary-foreground: var(--secondary-foreground);
      --color-muted: var(--muted);
      --color-muted-foreground: var(--muted-foreground);
      --color-accent: var(--accent);
      --color-accent-foreground: var(--accent-foreground);
      --color-destructive: var(--destructive);
      --color-border: var(--border);
      --color-input: var(--input);
      --color-ring: var(--ring);
      --color-sidebar: var(--sidebar);
      --color-sidebar-foreground: var(--sidebar-foreground);
      --color-sidebar-primary: var(--sidebar-primary);
      --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
      --color-sidebar-accent: var(--sidebar-accent);
      --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
      --color-sidebar-border: var(--sidebar-border);
      --color-sidebar-ring: var(--sidebar-ring);
    }

    /* Preflight patches: only border-width + padding.
       Colors flow through Basecoat's own style pack via --color-* vars. */
    .btn, .badge, .card, .input, .select, .alert { border-width: 1px; border-style: solid; }
    .btn, .input, .select { padding-inline: 0.625rem; }
  </style>
</head>
<body class="min-h-screen bg-background text-foreground">
  <div class="max-w-5xl mx-auto px-4 py-8">
    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-2xl font-bold">${escapeHtml(scheme.name)}</h1>
        <p class="text-muted-foreground mt-1">by ${escapeHtml(scheme.author)}</p>
        <span class="inline-block mt-2 px-2 py-0.5 text-xs rounded bg-secondary text-secondary-foreground font-mono">
          Base24 → shadcn/ui
        </span>
      </div>

      <!-- Dark/light toggle -->
      <button id="theme-toggle"
              class="btn" data-variant="outline"
              onclick="document.documentElement.classList.toggle('dark')">
        Toggle ${mode === "dark" ? "Light" : "Dark"}
      </button>
    </div>

    <!-- Buttons -->
    <section class="mb-8">
      <h2 class="section-title">Buttons</h2>
      <div class="flex flex-wrap gap-2 mb-3">
        <button class="btn" data-variant="primary">Primary</button>
        <button class="btn" data-variant="secondary">Secondary</button>
        <button class="btn" data-variant="destructive">Destructive</button>
        <button class="btn" data-variant="outline">Outline</button>
        <button class="btn" data-variant="ghost">Ghost</button>
      </div>
      <div class="flex flex-wrap items-end gap-2">
        <button class="btn" data-variant="primary" data-size="sm">Small</button>
        <button class="btn" data-variant="primary">Default</button>
        <button class="btn" data-variant="primary" data-size="lg">Large</button>
      </div>
    </section>

    <!-- Card -->
    <section class="mb-8">
      <h2 class="section-title">Card</h2>
      <div class="card max-w-md">
        <header>
          <h3 class="text-lg font-semibold">Card Title</h3>
          <p class="text-sm text-muted-foreground">Card subtitle or metadata</p>
        </header>
        <section>
          <p>This is the card content area. Cards elevate content above the background and group related information.</p>
        </section>
        <footer class="flex gap-2">
          <button class="btn" data-variant="primary" data-size="sm">Action</button>
          <button class="btn" data-variant="ghost" data-size="sm">Cancel</button>
        </footer>
      </div>
    </section>

    <!-- Inputs -->
    <section class="mb-8">
      <h2 class="section-title">Inputs</h2>
      <div class="flex flex-wrap gap-4 items-end max-w-lg">
        <div class="flex-1 min-w-[200px]">
          <label class="block text-sm mb-1 text-muted-foreground">Text Input</label>
          <input class="input" type="text" placeholder="Type something…" />
        </div>
        <div class="flex-1 min-w-[200px]">
          <label class="block text-sm mb-1 text-muted-foreground">Select</label>
          <select class="select">
            <option>Option One</option>
            <option>Option Two</option>
            <option>Option Three</option>
          </select>
        </div>
      </div>
    </section>

    <!-- Badges -->
    <section class="mb-8">
      <h2 class="section-title">Badges</h2>
      <div class="flex flex-wrap gap-2">
        <span class="badge" data-variant="primary">Primary</span>
        <span class="badge" data-variant="secondary">Secondary</span>
        <span class="badge" data-variant="destructive">Destructive</span>
        <span class="badge" data-variant="outline">Outline</span>
      </div>
    </section>

    <!-- Alerts -->
    <section class="mb-8">
      <h2 class="section-title">Alerts</h2>
      <div class="flex flex-col gap-2 max-w-lg">
        <div class="alert" data-variant="info">
          <strong>Info:</strong> This is an informational alert.
        </div>
        <div class="alert" data-variant="success">
          <strong>Success:</strong> Operation completed successfully.
        </div>
        <div class="alert" data-variant="warning">
          <strong>Warning:</strong> Proceed with caution.
        </div>
        <div class="alert" data-variant="error">
          <strong>Error:</strong> Something went wrong.
        </div>
      </div>
    </section>

    <!-- Color Palette Swatches -->
    <section class="mb-8">
      <h2 class="section-title">Color Palette</h2>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
        ${swatches}
      </div>
    </section>

    <!-- Chart Colors -->
    <section class="mb-8">
      <h2 class="section-title">Chart Colors</h2>
      <div class="flex gap-1 rounded overflow-hidden border border-border max-w-md">
        ${chartBars}
      </div>
    </section>
  </div>

  <!-- Basecoat JS runtime -->
  <script src="${BASECOAT_CDN}@${BASECOAT_VERSION}/dist/js/all.min.js" defer></script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── CLI ────────────────────────────────────────────────────────────────────

function printUsage() {
  console.error(`Usage: bun convert.ts <scheme.yaml> [options]

Arguments:
  <scheme.yaml>   Path or URL to a base24 scheme YAML file (required)

Options:
  -o, --output <path>   Output path for theme.css (default: ./theme.css)
  -p, --primary <slot>  Base24 slot for primary color (default: base0D)
  -r, --radius <value>  Border radius value (default: 0.625rem)
  --preview             Also generate preview.html alongside theme.css
  -h, --help            Show this help message`);
  process.exit(0);
}

interface CliOptions {
  input: string;
  output: string;
  primary: string;
  radius: string;
  preview: boolean;
}

function parseArgs(args: string[]): CliOptions {
  const opts: CliOptions = {
    input: "",
    output: "./theme.css",
    primary: "base0D",
    radius: "0.625rem",
    preview: false,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    switch (arg) {
      case "-h":
      case "--help":
        printUsage();
        break;
      case "-o":
      case "--output":
        opts.output = args[++i];
        break;
      case "-p":
      case "--primary":
        opts.primary = args[++i];
        break;
      case "-r":
      case "--radius":
        opts.radius = args[++i];
        break;
      case "--preview":
        opts.preview = true;
        break;
      default:
        if (!arg.startsWith("-") && !opts.input) {
          opts.input = arg;
        } else if (!arg.startsWith("-")) {
          console.error(`Error: Unexpected positional argument: ${arg}`);
          process.exit(1);
        } else {
          console.error(`Error: Unknown flag: ${arg}`);
          process.exit(1);
        }
    }
    i++;
  }

  if (!opts.input) {
    console.error("Error: <scheme.yaml> is required.");
    console.error("Run with --help for usage.");
    process.exit(1);
  }

  // Validate primary slot
  const validSlots = [
    "base00","base01","base02","base03","base04","base05","base06","base07",
    "base08","base09","base0A","base0B","base0C","base0D","base0E","base0F",
    "base10","base11","base12","base13","base14","base15","base16","base17",
  ];
  if (!validSlots.includes(opts.primary)) {
    console.error(`Error: Invalid --primary slot "${opts.primary}". Must be one of base00–base17.`);
    process.exit(1);
  }

  return opts;
}

async function fetchScheme(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(Bun.argv.slice(2));

  // Read scheme input
  let raw: string;
  if (opts.input.startsWith("http://") || opts.input.startsWith("https://")) {
    console.error(`Fetching scheme from ${opts.input}...`);
    raw = await fetchScheme(opts.input);
  } else {
    raw = await Bun.file(opts.input).text();
  }

  const scheme = parseYaml(raw);
  const mode = detectMode(scheme);
  console.error(
    `Scheme: ${scheme.name} (${scheme.system}) — detected ${mode} mode` +
      (scheme.variant ? ` (explicit "${scheme.variant}")` : ""),
  );

  // Validate primary slot exists in scheme
  if (!scheme.palette[opts.primary]) {
    console.error(
      `Warning: primary slot "${opts.primary}" not found in scheme palette. ` +
      `Available: ${Object.keys(scheme.palette).sort().join(", ")}`,
    );
    // Continue — will fall back to base0D or oklch(1 0 0)
  }

  const css = generateCSS(scheme, opts.primary, opts.radius);
  await Bun.write(opts.output, css);
  console.error(`Wrote theme CSS to ${opts.output}`);

  if (opts.preview) {
    const previewPath = opts.output.replace(/\.css$/, "") + ".html";
    // If output is just "theme.css", we use "preview.html" in the same dir
    const finalPreviewPath = previewPath === "theme.html" && !opts.output.includes("/")
      ? "./preview.html"
      : previewPath === ".html"
        ? "./preview.html"
        : previewPath;
    const html = generatePreviewHTML(scheme, css);
    await Bun.write(finalPreviewPath, html);
    console.error(`Wrote preview HTML to ${finalPreviewPath}`);
    console.log(finalPreviewPath);
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
