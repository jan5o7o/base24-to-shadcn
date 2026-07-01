#!/usr/bin/env bun

/**
 * base24-to-shadcn CLI — Convert a tinted-theming base24 color scheme
 * into a shadcn/ui / Basecoat UI CSS theme.
 *
 * Usage:
 *   bun src/cli.ts <scheme.yaml> [--output theme.css] [--primary base0D] [--radius 0.625rem] [--preview]
 */

import {
  parseYaml,
  detectMode,
  generateCSS,
} from "./core";

// ── Constants ────────────────────────────────────────────────────────────

const BASECOAT_VERSION = "1.0.1";
const BASECOAT_CDN = "https://unpkg.com/basecoat-css";

// ── CLI ──────────────────────────────────────────────────────────────────

function printUsage() {
  console.error(`Usage: bun src/cli.ts <scheme.yaml> [options]

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

// ── Preview HTML ────────────────────────────────────────────────────────

function generatePreviewHTML(
  scheme: ReturnType<typeof parseYaml>,
  cssContent: string,
): string {
  const mode = detectMode(scheme);
  const defaultClass = mode === "dark" ? ' class="dark"' : "";

  const paletteSlots: string[] = [];
  for (let i = 0; i <= 7; i++) paletteSlots.push(`base0${i}`);
  const hexDigits = ["8","9","A","B","C","D","E","F"];
  for (const d of hexDigits) paletteSlots.push(`base0${d}`);
  for (let i = 10; i <= 17; i++) paletteSlots.push(`base${i}`);

  const swatches = paletteSlots
    .filter(s => scheme.palette[s])
    .map(s => {
      const hex = scheme.palette[s];
      return `<div class="flex items-center gap-2 p-2 rounded border border-border bg-card">
        <div class="w-8 h-8 rounded" style="background:#${hex}"></div>
        <div><span class="text-xs font-mono text-muted-foreground">${s}</span><br><span class="text-xs font-mono">#${hex}</span></div>
      </div>`;
    })
    .join("\n            ");

  const chartColors = ["base0D", "base0B", "base0A", "base0E", "base08"]
    .map(s => scheme.palette[s])
    .filter(Boolean);

  const chartBars = chartColors
    .map(hex => `<div class="flex-1 h-8 rounded" style="background:${hex}" title="#${hex}"></div>`)
    .join("\n              ");

  return `<!DOCTYPE html>
<html lang="en"${defaultClass}>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(scheme.name)} — Base24 → shadcn/ui Theme Preview</title>

  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: { extend: { colors: {
        background: 'var(--background)', foreground: 'var(--foreground)',
        card: 'var(--card)', 'card-foreground': 'var(--card-foreground)',
        popover: 'var(--popover)', 'popover-foreground': 'var(--popover-foreground)',
        primary: 'var(--primary)', 'primary-foreground': 'var(--primary-foreground)',
        secondary: 'var(--secondary)', 'secondary-foreground': 'var(--secondary-foreground)',
        muted: 'var(--muted)', 'muted-foreground': 'var(--muted-foreground)',
        accent: 'var(--accent)', 'accent-foreground': 'var(--accent-foreground)',
        destructive: 'var(--destructive)', border: 'var(--border)',
        input: 'var(--input)', ring: 'var(--ring)',
        'chart-1': 'var(--chart-1)', 'chart-2': 'var(--chart-2)',
        'chart-3': 'var(--chart-3)', 'chart-4': 'var(--chart-4)', 'chart-5': 'var(--chart-5)',
      }}},
    };
  </script>
  <script src="https://cdn.tailwindcss.com"></script>

  <link rel="stylesheet" href="${BASECOAT_CDN}@${BASECOAT_VERSION}/dist/basecoat.cdn.min.css" />

  <style>
${cssContent.split("\n").map(l => "    " + l).join("\n")}
  </style>

  <style>
    :root,.dark{--color-background:var(--background);--color-foreground:var(--foreground);--color-card:var(--card);--color-card-foreground:var(--card-foreground);--color-popover:var(--popover);--color-popover-foreground:var(--popover-foreground);--color-primary:var(--primary);--color-primary-foreground:var(--primary-foreground);--color-secondary:var(--secondary);--color-secondary-foreground:var(--secondary-foreground);--color-muted:var(--muted);--color-muted-foreground:var(--muted-foreground);--color-accent:var(--accent);--color-accent-foreground:var(--accent-foreground);--color-destructive:var(--destructive);--color-border:var(--border);--color-input:var(--input);--color-ring:var(--ring)}
    .btn,.badge,.card,.input,.select,.alert{border-width:1px;border-style:solid}
    .btn,.input,.select{padding-inline:.625rem}
    .btn:not([data-variant]),.btn[data-variant=primary]{background-color:var(--color-primary);color:var(--color-primary-foreground);border-color:transparent}
    .btn[data-variant=secondary]{background-color:var(--color-secondary);color:var(--color-secondary-foreground);border-color:transparent}
    .btn[data-variant=destructive]{background-color:var(--color-destructive);color:var(--color-primary-foreground);border-color:transparent}
    .btn[data-variant=outline]{background-color:transparent;color:var(--color-foreground);border-color:var(--color-border)}
    .btn[data-variant=ghost]{background-color:transparent;color:var(--color-foreground);border-color:transparent}
    .btn:not([data-variant]):hover,.btn[data-variant=primary]:hover{background-color:color-mix(in oklab,var(--color-primary)80%,transparent)}
    .btn[data-variant=secondary]:hover{background-color:color-mix(in oklab,var(--color-secondary)80%,var(--color-foreground)5%)}
    .btn[data-variant=outline]:hover,.btn[data-variant=ghost]:hover{background-color:var(--color-muted)}
    .btn[data-variant=destructive]:hover{background-color:color-mix(in oklab,var(--color-destructive)80%,transparent)}
    .card{background-color:var(--color-card);color:var(--color-card-foreground);border-color:var(--color-border)}
    .badge:not([data-variant]),.badge[data-variant=primary]{background-color:var(--color-primary);color:var(--color-primary-foreground);border-color:transparent}
    .badge[data-variant=secondary]{background-color:var(--color-secondary);color:var(--color-secondary-foreground);border-color:transparent}
    .badge[data-variant=destructive]{background-color:var(--color-destructive);color:var(--color-primary-foreground);border-color:transparent}
    .badge[data-variant=outline]{background-color:transparent;color:var(--color-foreground);border-color:var(--color-border)}
    .input,.select{background-color:transparent;color:var(--color-foreground);border-color:var(--color-border)}
    .alert{background-color:var(--color-card);color:var(--color-card-foreground);border-color:var(--color-border)}
    :is(.field>input[type=checkbox],.input[type=checkbox]):checked{color:var(--background)!important}
    body{font-family:system-ui,-apple-system,sans-serif}
  </style>
</head>
<body class="min-h-screen bg-background text-foreground">
  <div class="max-w-5xl mx-auto px-4 py-8">
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-2xl font-bold">${escHtml(scheme.name)}</h1>
        <p class="text-muted-foreground mt-1">by ${escHtml(scheme.author)}</p>
        <span class="inline-block mt-2 px-2 py-0.5 text-xs rounded bg-secondary text-secondary-foreground font-mono">
          Base24 → shadcn/ui
        </span>
      </div>
    </div>

    <section class="mb-8"><h2 class="text-lg font-semibold mb-3">Buttons</h2>
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

    <section class="mb-8"><h2 class="text-lg font-semibold mb-3">Card</h2>
      <div class="card max-w-md">
        <header><h3 class="text-lg font-semibold">Card Title</h3><p class="text-sm text-muted-foreground">Card subtitle</p></header>
        <section><p>Cards elevate content above the background.</p></section>
        <footer class="flex gap-2">
          <button class="btn" data-variant="primary" data-size="sm">Action</button>
          <button class="btn" data-variant="ghost" data-size="sm">Cancel</button>
        </footer>
      </div>
    </section>

    <section class="mb-8"><h2 class="text-lg font-semibold mb-3">Inputs</h2>
      <div class="flex flex-wrap gap-4 items-end max-w-lg">
        <div class="flex-1 min-w-[200px]"><label class="block text-sm mb-1 text-muted-foreground">Text</label><input class="input" type="text" placeholder="Type…"></div>
        <div class="flex-1 min-w-[200px]"><label class="block text-sm mb-1 text-muted-foreground">Select</label><select class="select"><option>One</option><option>Two</option></select></div>
      </div>
    </section>

    <section class="mb-8"><h2 class="text-lg font-semibold mb-3">Badges</h2>
      <div class="flex flex-wrap gap-2">
        <span class="badge" data-variant="primary">Primary</span>
        <span class="badge" data-variant="secondary">Secondary</span>
        <span class="badge" data-variant="destructive">Destructive</span>
        <span class="badge" data-variant="outline">Outline</span>
      </div>
    </section>

    <section class="mb-8"><h2 class="text-lg font-semibold mb-3">Alerts</h2>
      <div class="flex flex-col gap-2 max-w-lg">
        <div class="alert" data-variant="info"><strong>Info:</strong> Informational alert.</div>
        <div class="alert" data-variant="success"><strong>Success:</strong> Operation completed.</div>
        <div class="alert" data-variant="warning"><strong>Warning:</strong> Proceed with caution.</div>
        <div class="alert" data-variant="error"><strong>Error:</strong> Something went wrong.</div>
      </div>
    </section>

    <section class="mb-8"><h2 class="text-lg font-semibold mb-3">Palette</h2>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">${swatches}</div>
    </section>

    <section class="mb-8"><h2 class="text-lg font-semibold mb-3">Chart Colors</h2>
      <div class="flex gap-1 rounded overflow-hidden border border-border max-w-md">${chartBars}</div>
    </section>
  </div>
  <script src="${BASECOAT_CDN}@${BASECOAT_VERSION}/dist/js/all.min.js" defer></script>
</body>
</html>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(Bun.argv.slice(2));

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

  const { css } = generateCSS(scheme, opts.primary, opts.radius);
  await Bun.write(opts.output, css);
  console.error(`Wrote theme CSS to ${opts.output}`);

  if (opts.preview) {
    const previewPath = opts.output.replace(/\.css$/, ".html");
    const html = generatePreviewHTML(scheme, css);
    await Bun.write(previewPath, html);
    console.error(`Wrote preview HTML to ${previewPath}`);
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
