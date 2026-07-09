import {
  parseYaml,
  detectMode,
  generateCSS,
} from "./core";

const BASECOAT_VERSION = "1.0.1";

// ── Cache ──────────────────────────────────────────────────────────
import { readdir } from "node:fs/promises";
import { join } from "node:path";

const SCHEMES_DIR = join(import.meta.dirname, "..", "schemes", "base24");
const schemeCache = new Map<string, string>(); // name -> file path
let schemeListReady = false;

async function ensureSchemeCache(): Promise<void> {
  if (schemeListReady) return;
  const entries = await readdir(SCHEMES_DIR);
  for (const entry of entries) {
    if (entry.endsWith('.yaml')) {
      schemeCache.set(entry.replace('.yaml', ''), join(SCHEMES_DIR, entry));
    }
  }
  schemeListReady = true;
}

function getSchemeList() {
  return Array.from(schemeCache.entries()).map(([name, path]) => ({ name, url: `/schemes/${name}.yaml` }));
}

const cssCache = new Map<string, { css: string; mode: string }>();
async function getSchemeCSS(name: string, primarySlot: string, stylePack: string) {
  const key = name + '|' + (primarySlot || 'base0D') + '|' + (stylePack || 'vega');
  if (cssCache.has(key)) return cssCache.get(key)!;
  const filePath = schemeCache.get(name);
  if (!filePath) return null;
  const yaml = await Bun.file(filePath).text();
  const scheme = parseYaml(yaml);
  const result = generateCSS(scheme, primarySlot || "base0D", "0.625rem", true, stylePack || "vega", filePath);
  cssCache.set(key, result);
  return result;
}

// ── Server ─────────────────────────────────────────────────────────
const server = Bun.serve({
  port: 3001,
  async fetch(req) {
    const url = new URL(req.url);
    
    // Proxy basecoatui.com with injected theme — any path under /browse (dev only)
    if (url.pathname.startsWith('/browse')) {
      const schemeName = url.searchParams.get('scheme') || '';
      const primarySlot = url.searchParams.get('primary') || 'base0D';
      
      // Build target URL on basecoatui.com
      const bcPath = url.pathname.replace(/^\/browse/, '') || '/';
      // Strip our custom params, keep any basecoat-native ones
      const bcParams = new URLSearchParams(url.searchParams);
      bcParams.delete('scheme');
      bcParams.delete('primary');
      const qs = bcParams.toString();
      const cleanBcUrl = 'https://basecoatui.com' + bcPath + (qs ? '?' + qs : '');
      const bcRes = await fetch(cleanBcUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      let html = await bcRes.text();
      
      // Only inject theme/picker on HTML pages (not assets)
      const ct = bcRes.headers.get('content-type') || '';
      if (!ct.includes('text/html')) {
        return new Response(html, { headers: { 'content-type': ct } });
      }
      
      await getSchemeList();
      const currentStyle = url.searchParams.get('style') || 'vega';
      const hasTheme = schemeName && schemeName !== 'default';
      let css = '', mode = '';
      if (hasTheme) {
        const result = await getSchemeCSS(schemeName, primarySlot, currentStyle);
        css = result.css; mode = result.mode;
      }
      
      const schemes = await getSchemeList();
      const currentPath = bcPath === '/' ? '' : bcPath;
      const dropdownOpts = '<option value=""' + (!hasTheme ? ' selected' : '') + '>— Default (no theme) —</option>' +
        schemes
        .sort((a,b) => a.name.localeCompare(b.name))
        .map(s => '<option value="' + s.name + '"' + (s.name === schemeName ? ' selected' : '') + '>' + s.name.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase()) + '</option>')
        .join('');
      
      // Base tag for resources; remove hx-boost so we control navigation
      html = html.replace('<head>', '<head><base href="https://basecoatui.com">');
      html = html.replace(/ hx-(?:boost|target|select|swap|push-url|replace-url)(?:="[^"]*")?/g, '');
      
      // Inject theme CSS (skip if no theme selected)
      if (hasTheme) {
        html = html.replace('</head>', '<style id="base24-theme">\n' + css + '\n</style>\n</head>');
      }
      // Always inject checkbox contrast fix (even without a theme)
      html = html.replace('</head>', '<style>:is(.field>input[type=checkbox],.input[type=checkbox]):checked{color:var(--background)!important}</style>\n</head>');
      const schemeUrl = hasTheme ? (schemeCache.get(schemeName) || '') : '';
      const ghUrl = schemeUrl ? schemeUrl.replace('raw.githubusercontent.com', 'github.com').replace('/spec-0.11/', '/blob/spec-0.11/') : '';
      const host = req.headers.get('host') || 'localhost:3001';
      // Only allow /browse on localhost (dev mode)
      if (!host.includes('localhost') && !host.includes('127.0.0.1')) {
        return new Response('Not Found', { status: 404 });
      }

      const cssUrl = hasTheme ? ('http://' + host + '/theme.css?scheme=' + schemeName + (primarySlot !== 'base0D' ? '&primary=' + primarySlot : '')) : '';
      const stylePacks = ['vega','nova','maia','lyra','mira','luma','sera','rhea'];
      const styleOpts = stylePacks.map(s => '<option value="' + s + '"' + (s === currentStyle ? ' selected' : '') + '>' + s[0].toUpperCase() + s.slice(1) + '</option>').join('');
      
      const picker = '<div id="base24-picker" style="display:flex;align-items:center;gap:6px;font-family:system-ui,sans-serif;">' +
        '<span style="opacity:.7;">Style:</span>' +
        '<select onchange="window._base24SwitchStyle(this.value)" style="background:transparent;color:inherit;border:1px solid;border-radius:4px;padding:1px 4px;font-size:11px;max-width:72px;">' + styleOpts + '</select>' +
        '<span style="opacity:.7;">Color:</span>' +
        '<select onchange="window._base24Navigate(this.value)" style="background:transparent;color:inherit;border:1px solid;border-radius:4px;padding:1px 4px;font-size:11px;max-width:100px;">' + dropdownOpts + '</select>' +
        (hasTheme ? '<a href="' + cssUrl + '" target="_blank" style="color:inherit;border:1px solid;border-radius:4px;padding:1px 6px;text-decoration:none;font-size:11px;opacity:.9;" title="Download theme.css">CSS</a>' : '') +
        (ghUrl ? '<a href="' + ghUrl + '" target="_blank" style="color:inherit;opacity:.7;text-decoration:none;font-size:11px;" title="View source on GitHub">↗</a>' : '') +
        '</div>';
      const script = '<script>' +
        'window._base24Path="' + currentPath + '";' +
        'window._base24Scheme="' + schemeName + '";' +
        'window._base24Primary="' + primarySlot + '";' +
        'window._base24Style="' + currentStyle + '";' +
        'window._base24Navigate=function(s){' +
          'var q="?scheme="+(s||"")+"&style="+window._base24Style;' +
          'if(!s)q="?style="+window._base24Style;' +
          'location.href=location.origin+"/browse"+window._base24Path+q+(window._base24Primary!=="base0D"&&s?"&primary="+window._base24Primary:"");' +
        '};' +
        'window._base24SwitchStyle=function(s){' +
          'window._base24Style=s;' +
          'var q="?scheme="+window._base24Scheme+"&style="+s;' +
          'if(!window._base24Scheme)q="?style="+s;' +
          'location.href=location.origin+"/browse"+window._base24Path+q+(window._base24Primary!=="base0D"&&window._base24Scheme?"&primary="+window._base24Primary:"");' +
        '};' +
        'window._base24ApplyStyle=function(s){' +
          'var sel=document.getElementById("style-variant-select");' +
          'if(sel&&sel.value!==s){sel.value=s;sel.dispatchEvent(new Event("change",{bubbles:true}));}' +
          'try{localStorage.setItem("styleVariant",s)}catch(_){}' +
        '};' +
        'window._base24ReapplyTheme=function(){' +
          'var s=document.getElementById("base24-theme");' +
          'if(s){var p=s.parentNode;s.remove();document.head.appendChild(s);}' +
        '};' +
        'document.addEventListener("click",function(e){' +
          'var a=e.target.closest("a");if(!a||a.target)return;' +
          'var raw=a.getAttribute("href");' +
          'if(!raw||!raw.startsWith("/")||raw.startsWith("//")||raw.startsWith("/browse")||raw.startsWith("/_")||raw.startsWith("/theme.css")||raw.startsWith("/schemes"))return;' +
          'e.preventDefault();e.stopPropagation();' +
          'var q="?scheme="+window._base24Scheme+"&style="+window._base24Style;' +
          'if(!window._base24Scheme)q="?style="+window._base24Style;' +
          'location.href=location.origin+"/browse"+raw+q+(window._base24Primary!=="base0D"&&window._base24Scheme?"&primary="+window._base24Primary:"");' +
        '},true);' +
        'document.addEventListener("basecoat:stylechange",function(){setTimeout(window._base24ReapplyTheme,50)});' +
        'setTimeout(function(){window._base24ApplyStyle(window._base24Style);if(window._base24Scheme)setTimeout(window._base24ReapplyTheme,200)},100);' +
        '</script>';
      
      if (hasTheme && mode === 'dark') {
        html = html.replace('<html lang="en">', '<html lang="en" class="dark">');
      }
      // Inject preview banner + picker into header, script after body
      var banner = '<div style="background:var(--color-primary);color:var(--color-primary-foreground);display:flex;align-items:center;justify-content:center;gap:10px;padding:5px 12px;font-size:12px;font-family:system-ui,sans-serif;flex-wrap:wrap;">' +
        '<a href="/gallery" style="color:inherit;font-weight:600;text-decoration:none;">← Gallery</a>' +
        '<span style="opacity:.5;">·</span>' +
        '<span>🎨 Theme preview</span>' +
        '<span style="opacity:.5;">·</span>' +
        picker +
        '<span style="opacity:.5;">·</span>' +
        '<a href="https://basecoatui.com" target="_blank" style="color:inherit;opacity:.7;font-size:11px;">original site ↗</a></div>';
      html = html.replace(/<body[^>]*>/, '$&' + banner + script);
      
      return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }
    // API: list schemes
    if (url.pathname === '/schemes') {
      await ensureSchemeCache();
      return Response.json(getSchemeList());
    }

    // Serve raw YAML files from schemes/base24/
    if (url.pathname.startsWith('/schemes/') && url.pathname.endsWith('.yaml')) {
      await ensureSchemeCache();
      const name = url.pathname.replace('/schemes/', '').replace('.yaml', '');
      const filePath = schemeCache.get(name);
      if (filePath) return new Response(Bun.file(filePath));
      return new Response('not found', { status: 404 });
    }

    // API: get CSS for a scheme
    if (url.pathname === '/theme.css') {
      const schemeName = url.searchParams.get('scheme') || 'one-dark';
      const primarySlot = url.searchParams.get('primary') || 'base0D';
      const stylePack = url.searchParams.get('style') || 'vega';
      await ensureSchemeCache();
      const result = await getSchemeCSS(schemeName, primarySlot, stylePack);
      if (!result) return new Response('scheme not found', { status: 404 });
      return new Response(result.css, {
        headers: { 'Content-Type': 'text/css' }
      });
    }
    
    // Astryx POC — SPA served from docs/astryx/
    if (url.pathname.startsWith('/astryx')) {
      const file = Bun.file("./docs" + url.pathname);
      if (await file.exists()) return new Response(file);
      // SPA fallback: all /astryx/* routes serve index.html
      return new Response(Bun.file("./docs/astryx/index.html"));
    }

    // Static files (from public/)
    let path = url.pathname;
    if (path === "/") path = "/index.html";
    if (path === "/gallery") path = "/gallery.html";
    const file = Bun.file("./docs" + path);
    if (await file.exists()) {
      return new Response(file);
    }
    
    return new Response('404', { status: 404 });
  },
});

await ensureSchemeCache();
console.log('Serving at http://localhost:3001');
console.log('Browse: http://localhost:3001/browse?scheme=one-dark');
