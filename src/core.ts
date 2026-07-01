// ═══════════════════════════════════════════════════════════════════════
// Core: base24 scheme parsing, hex→oklch conversion, CSS generation
// Shared by cli.ts and server.ts
// ═══════════════════════════════════════════════════════════════════════

// ── Types ──────────────────────────────────────────────────────────────

export interface Scheme {
  system: string;
  name: string;
  author: string;
  variant?: "dark" | "light";
  palette: Record<string, string>;
}

export interface Oklch {
  l: number;
  c: number;
  h: number;
}

export interface TokenDef {
  token: string;
  slot: string;
  fallback?: string;
}

export interface GeneratedCSS {
  css: string;
  mode: "dark" | "light";
}

// ── YAML Parser ─────────────────────────────────────────────────────────

export function parseYaml(raw: string): Scheme {
  const scheme: Scheme = {
    system: "",
    name: "Unknown",
    author: "Unknown",
    palette: {},
  };

  const lines = raw.split("\n");
  let inPalette = false;

  for (const rawLine of lines) {
    const commentIdx = rawLine.search(/(?:\s|")#(?:\s|$)/);
    const line = commentIdx >= 0 ? rawLine.substring(0, commentIdx).trimEnd() : rawLine;
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    if (trimmed === "palette:") {
      inPalette = true;
      continue;
    }

    if (inPalette) {
      const palMatch = trimmed.match(
        /^(base[0-9A-Fa-f]{2}):\s*(?:["'])?#?([0-9a-fA-F]{6})(?:["'])?\s*$/,
      );
      if (palMatch) {
        scheme.palette[palMatch[1]] = palMatch[2];
        continue;
      }
      if (!trimmed.startsWith(" ")) {
        inPalette = false;
      } else {
        continue;
      }
    }

    const kvMatch = trimmed.match(
      /^([a-zA-Z_]\w*):\s*(?:["'])?(.+?)(?:["'])?\s*$/,
    );
    if (!kvMatch) continue;

    const [, key, value] = kvMatch;
    switch (key) {
      case "system": scheme.system = value; break;
      case "name": scheme.name = value; break;
      case "author": scheme.author = value; break;
      case "variant": scheme.variant = value as "dark" | "light"; break;
    }
  }

  const required16 = [
    "base00","base01","base02","base03","base04","base05","base06","base07",
    "base08","base09","base0A","base0B","base0C","base0D","base0E","base0F",
  ];
  if (!required16.every(k => k in scheme.palette)) {
    const present = Object.keys(scheme.palette).length;
    throw new Error(
      `Scheme "${scheme.name}" has only ${present} color slots (need at least base00–base0F). ` +
      `Found: ${Object.keys(scheme.palette).sort().join(", ")}`,
    );
  }

  return scheme;
}

// ── Hex Helpers ──────────────────────────────────────────────────────────

export function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.substring(0, 2), 16) / 255,
    parseInt(hex.substring(2, 4), 16) / 255,
    parseInt(hex.substring(4, 6), 16) / 255,
  ];
}

export function linearize(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

// ── Hex → oklch (Björn Ottosson) ────────────────────────────────────────

export function hexToOklch(hex: string): Oklch {
  const [r, g, b] = hexToRgb(hex);
  const lr = linearize(r);
  const lg = linearize(g);
  const lb = linearize(b);

  const x = 0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb;
  const y = 0.2126729 * lr + 0.7151522 * lg + 0.0721750 * lb;
  const z = 0.0193339 * lr + 0.1191920 * lg + 0.9503041 * lb;

  const l1 = 0.8189330101 * x + 0.3618667424 * y - 0.1288597137 * z;
  const m = 0.0329845436 * x + 0.9293118715 * y + 0.0361456387 * z;
  const s = 0.0482003018 * x + 0.2643662691 * y + 0.6338517070 * z;

  const l_ = Math.cbrt(l1);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

  const C = Math.sqrt(A * A + B * B);
  let H = (Math.atan2(B, A) * 180) / Math.PI;
  if (H < 0) H += 360;

  return { l: L, c: C, h: H };
}

export function oklchToString({ l, c, h }: Oklch, decimals = 3): string {
  return `oklch(${l.toFixed(decimals)} ${c.toFixed(decimals)} ${Math.round(h)})`;
}

// ── Mode Detection ──────────────────────────────────────────────────────

export function detectMode(scheme: Scheme): "dark" | "light" {
  if (scheme.variant === "dark") return "dark";
  if (scheme.variant === "light") return "light";

  const luminance = (hex: string): number => {
    const [r, g, b] = hexToRgb(hex);
    return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
  };

  return luminance(scheme.palette.base00) < luminance(scheme.palette.base07)
    ? "dark"
    : "light";
}

// ── Token Map ───────────────────────────────────────────────────────────

export function getTokenMap(primarySlot: string): TokenDef[] {
  return [
    { token: "background", slot: "base00" },
    { token: "foreground", slot: "base05" },
    { token: "card", slot: "base01" },
    { token: "card-foreground", slot: "base05" },
    { token: "popover", slot: "base01" },
    { token: "popover-foreground", slot: "base05" },
    { token: "primary", slot: primarySlot },
    { token: "primary-foreground", slot: "base00" },
    { token: "secondary", slot: "base02" },
    { token: "secondary-foreground", slot: "base05" },
    { token: "muted", slot: "base01" },
    { token: "muted-foreground", slot: "base04" },
    { token: "accent", slot: "base02" },
    { token: "accent-foreground", slot: "base05" },
    { token: "destructive", slot: "base08" },
    { token: "destructive-foreground", slot: "base05" },
    { token: "border", slot: "base03" },
    { token: "input", slot: "base03" },
    { token: "ring", slot: primarySlot },
    { token: "chart-1", slot: primarySlot },
    { token: "chart-2", slot: "base0B" },
    { token: "chart-3", slot: "base0A" },
    { token: "chart-4", slot: "base0E" },
    { token: "chart-5", slot: "base08" },
    { token: "sidebar", slot: "base10", fallback: "base11" },
    { token: "sidebar-foreground", slot: "base05" },
    { token: "sidebar-primary", slot: primarySlot },
    { token: "sidebar-primary-foreground", slot: "base00" },
    { token: "sidebar-accent", slot: "base01" },
    { token: "sidebar-accent-foreground", slot: "base05" },
    { token: "sidebar-border", slot: "base02" },
    { token: "sidebar-ring", slot: primarySlot },
  ];
}

// ── Opposite Variant ────────────────────────────────────────────────────

export function generateOpposite(
  palette: Record<string, string>,
): Record<string, string> {
  const opp: Record<string, string> = {};

  // Neutral axis swap
  const neutralSwaps: [string, string][] = [
    ["base00", "base07"],
    ["base01", "base06"],
    ["base02", "base05"],
    ["base03", "base04"],
  ];
  for (const [a, b] of neutralSwaps) {
    opp[a] = oklchToString(hexToOklch(palette[b]));
    opp[b] = oklchToString(hexToOklch(palette[a]));
  }

  // Extra-dark backgrounds → light
  for (const [slot, targetL] of [["base10", 0.90], ["base11", 0.95]] as [string, number][]) {
    if (palette[slot]) {
      const c = hexToOklch(palette[slot]);
      opp[slot] = oklchToString({ l: targetL, c: 0.02, h: c.h });
    }
  }

  // Accent colors
  const accents = ["base08","base09","base0A","base0B","base0C","base0D","base0E","base0F"];
  for (const slot of accents) {
    if (palette[slot]) {
      const c = hexToOklch(palette[slot]);
      opp[slot] = oklchToString({ l: c.l < 0.5 ? 0.60 : 0.55, c: Math.min(c.c, 0.15), h: c.h });
    }
  }

  // Bright colors
  const brights = ["base12","base13","base14","base15","base16","base17"];
  for (const slot of brights) {
    if (palette[slot]) {
      const c = hexToOklch(palette[slot]);
      opp[slot] = oklchToString({
        l: c.l < 0.5 ? Math.max(c.l + 0.10, 0.50) : Math.min(c.l - 0.05, 0.65),
        c: Math.min(c.c, 0.18),
        h: c.h,
      });
    }
  }

  return opp;
}

// ── Slot Resolution ─────────────────────────────────────────────────────

export function resolveSlot(
  palette: Record<string, string>,
  oppositePalette: Record<string, string>,
  def: TokenDef,
  useOpposite: boolean,
): string {
  if (useOpposite && oppositePalette) {
    if (def.slot && oppositePalette[def.slot]) return oppositePalette[def.slot];
    if (def.fallback && oppositePalette[def.fallback]) return oppositePalette[def.fallback];
    if (def.token === "sidebar" && oppositePalette["base00"]) return oppositePalette["base00"];
  }
  if (!def.slot) return "";
  const hex = palette[def.slot];
  if (hex) return oklchToString(hexToOklch(hex));
  if (def.fallback && palette[def.fallback]) return oklchToString(hexToOklch(palette[def.fallback]));
  if (palette.base00) return oklchToString(hexToOklch(palette.base00));
  return "oklch(1 0 0)";
}

// ── CSS Generation ──────────────────────────────────────────────────────

export function generateCSS(
  scheme: Scheme,
  primarySlot = "base0D",
  radius = "0.625rem",
  proxyMode = false,
  stylePack = "vega",
  schemeUrl = "",
): GeneratedCSS {
  const mode = detectMode(scheme);
  const oppositePalette = generateOpposite(scheme.palette);
  const tokenMap = getTokenMap(primarySlot);

  // proxyMode: for dark schemes in the browse proxy, put dark in :root
  // so basecoatui.com's JS (which resets html.class) doesn't revert to light.
  const realSelector = (mode === "dark" && !proxyMode) ? ".dark" : ":root";
  const oppSelector = (mode === "dark" && !proxyMode) ? ":root" : ".dark";

  const lines: string[] = [
    "/*",
    ` * base24 theme: ${scheme.name}`,
    ` * Author: ${scheme.author || "Unknown"}`,
    ` * Source: ${schemeUrl || "https://github.com/tinted-theming/schemes/tree/spec-0.11/base24"}`,
    ` * Basecoat style pack: ${stylePack} (https://basecoatui.com)`,
    " * Generated by base24-to-shadcn",
    " * Only color tokens — radius, spacing, shadows belong to the style pack.",
    " */",
  ];

  // Auto-generated opposite variant
  lines.push(`${oppSelector} {`);
  for (const def of tokenMap) {
    if (def.slot) lines.push(`  --${def.token}: ${resolveSlot(scheme.palette, oppositePalette, def, true)};`);
  }
  lines.push("}");

  // Real scheme colors
  lines.push(`${realSelector} {`);
  for (const def of tokenMap) {
    if (def.slot) lines.push(`  --${def.token}: ${resolveSlot(scheme.palette, oppositePalette, def, false)};`);
  }
  lines.push("}");

  // --color-* mappings for Basecoat v4 compiled CSS
  lines.push(":root, .dark {");
  for (const def of tokenMap) {
    if (def.slot) lines.push(`  --color-${def.token}: var(--${def.token});`);
  }
  lines.push("}");

  // Cascade fixes for Tailwind v3 Preflight (border-width/padding only)
  lines.push(".btn,.badge,.card,.input,.select,.alert{border-width:1px;border-style:solid}");
  lines.push(".btn,.input,.select{padding-inline:calc(var(--spacing,.25rem)*2.5)}");
  lines.push(":is(.field>input[type=checkbox],.input[type=checkbox]):checked{color:var(--background)!important}");

  return { css: lines.join("\n"), mode };
}
