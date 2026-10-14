/**
 * Placeholder app icons and splash from the brand tokens (charcoal / sun / sand), drawn as SVG and
 * rendered to PNG with @resvg/resvg-js (not an app dependency). Replace with designed artwork
 * before the store listing; keep the file names and sizes.
 *
 *   npm i --no-save @resvg/resvg-js && node scripts/generate-icons.mjs
 *   # or, with resvg installed elsewhere:  RESVG_DIR=/path/to/dir node scripts/generate-icons.mjs
 */
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const BRAND = { charcoal: '#201F1E', sun: '#FFCF68', sand: '#B5A18B', white: '#FFFFFF' };
const OUT = join(import.meta.dirname, '..', 'assets');

function loadResvg() {
  for (const base of [import.meta.url, process.env.RESVG_DIR && join(process.env.RESVG_DIR, 'x.js')].filter(Boolean)) {
    try {
      return createRequire(base)('@resvg/resvg-js').Resvg;
    } catch {
      /* try the next place */
    }
  }
  console.error('Install @resvg/resvg-js first: npm i --no-save @resvg/resvg-js');
  process.exit(1);
}
const Resvg = loadResvg();

/** "M" roofline over a ground bar, centred on (512, 542) in a 1024 box; `scale` shrinks it for the adaptive-icon safe zone. */
function glyph({ stroke, ground, scale = 1 }) {
  return `<g transform="translate(512 542) scale(${scale}) translate(-512 -542)">
    <path d="M300 700 V340 L512 570 L724 340 V700" fill="none" stroke="${stroke}" stroke-width="110" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="270" y="790" width="484" height="44" rx="22" fill="${ground}"/>
  </g>`;
}

const svg = (body, size = 1024, bg = null) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">${bg ? `<rect width="1024" height="1024" fill="${bg}"/>` : ''}${body}</svg>`;

function png(name, markup, width = 1024) {
  const data = new Resvg(markup, { fitTo: { mode: 'width', value: width }, background: 'rgba(0,0,0,0)' }).render().asPng();
  writeFileSync(join(OUT, name), data);
  console.log(`assets/${name} (${width}px, ${data.length} bytes)`);
}

const full = glyph({ stroke: BRAND.sun, ground: BRAND.sand });
// Android adaptive icons crop to the inner ~66 %: keep the glyph well inside it.
const safe = glyph({ stroke: BRAND.sun, ground: BRAND.sand, scale: 0.62 });

png('icon.png', svg(full, 1024, BRAND.charcoal));
png('android-icon-background.png', svg('', 1024, BRAND.charcoal));
png('android-icon-foreground.png', svg(safe));
png('android-icon-monochrome.png', svg(glyph({ stroke: BRAND.white, ground: BRAND.white, scale: 0.62 })));
png('splash-icon.png', svg(full), 512);
png('favicon.png', svg(full, 1024, BRAND.charcoal), 48);
