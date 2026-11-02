/**
 * Keystone app icons, splash, notification icon and in-app logo PNGs, rendered from the master
 * SVGs in assets/brand/ (copied unchanged from the owner's brand folder — never redraw them here).
 * Rendering uses Playwright's Chromium, which is not an app dependency: point PLAYWRIGHT_DIR at a
 * folder whose node_modules has playwright (the web app has it), e.g.
 *
 *   PLAYWRIGHT_DIR=../construction_frontend node scripts/generate-icons.mjs
 *
 * Outputs (keep the names; app.config.ts and components/BrandLogo.tsx point at them):
 *   assets/icon.png                     1024, charcoal square (no rounded corners: iOS masks it), dark mark
 *   assets/android-icon-background.png  1024, charcoal
 *   assets/android-icon-foreground.png  1024, transparent, dark mark inside the 66 dp safe circle
 *   assets/android-icon-monochrome.png  1024, white mark (Android 13 themed icons)
 *   assets/notification-icon.png        96, white small mark on transparent (expo-notifications `icon`)
 *   assets/splash-icon.png              1024, transparent, dark mark
 *   assets/favicon.png                  48, as icon.png
 *   assets/brand/keystone-mark-dark.png       72 pt @1x/@2x/@3x (login, on charcoal)
 *   assets/brand/keystone-mark-small.png      28 pt @1x/@2x/@3x (settings header, on light)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const ASSETS = join(ROOT, 'assets');
const BRAND = join(ASSETS, 'brand');
const CHARCOAL = '#201F1E';

function loadPlaywright() {
  const bases = [import.meta.url, process.env.PLAYWRIGHT_DIR && join(resolve(process.env.PLAYWRIGHT_DIR), 'x.js')].filter(Boolean);
  for (const base of bases) {
    try {
      return createRequire(base)('playwright');
    } catch {
      /* try the next place */
    }
  }
  console.error('Playwright not found: set PLAYWRIGHT_DIR to a folder with node_modules/playwright');
  process.exit(1);
}

const svgText = (name) => readFileSync(join(BRAND, name), 'utf8').trim();
const dataUri = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

/**
 * White-on-transparent silhouette of a master SVG: the SVG itself becomes a luminance mask with
 * every fill → white and every stroke → black (cut out, so the keystone keeps its gap from the
 * arch). Same paths, only recoloured.
 */
function monochrome(svg) {
  const viewBox = svg.match(/viewBox="([^"]+)"/)[1];
  const [x, y, w, h] = viewBox.split(/\s+/);
  const inner = svg
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>$/, '')
    .replace(/fill="#[0-9A-F]{6}"/gi, 'fill="#FFFFFF"')
    .replace(/stroke="#[0-9A-F]{6}"/gi, 'stroke="#000000"');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><defs><mask id="m" maskUnits="userSpaceOnUse" x="${x}" y="${y}" width="${w}" height="${h}">${inner}</mask></defs><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#FFFFFF" mask="url(#m)"/></svg>`;
}

const { chromium } = loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

/** Renders `svg` at `mark` px, centred on a `size` px canvas (background colour or transparent). */
async function png(file, svg, { size, mark = size, bg = null }) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:${bg ?? 'transparent'}">` +
      `<img src="${dataUri(svg)}" style="width:${mark}px;height:${mark}px;display:block"></body></html>`,
  );
  await page.waitForFunction(() => document.images[0]?.complete);
  const data = await page.screenshot({ omitBackground: !bg, clip: { x: 0, y: 0, width: size, height: size } });
  writeFileSync(file, data);
  console.log(`${file.slice(ROOT.length + 1)} (${size}px, ${data.length} bytes)`);
}

const dark = svgText('keystone-mark-dark.svg');
const small = svgText('keystone-mark-small.svg');

// The 64-unit mark draws within x 9–55, y 4.5–59.2. Android crops adaptive icons to a 66/108 circle
// (≈ 626 px of 1024): at 540 px the mark's corners stay inside it.
await png(join(ASSETS, 'icon.png'), dark, { size: 1024, mark: 760, bg: CHARCOAL });
await png(join(ASSETS, 'favicon.png'), dark, { size: 48, mark: 36, bg: CHARCOAL });
await png(join(ASSETS, 'android-icon-background.png'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>', { size: 1024, bg: CHARCOAL });
await png(join(ASSETS, 'android-icon-foreground.png'), dark, { size: 1024, mark: 540 });
await png(join(ASSETS, 'android-icon-monochrome.png'), monochrome(dark), { size: 1024, mark: 540 });
await png(join(ASSETS, 'notification-icon.png'), monochrome(small), { size: 96, mark: 80 });
await png(join(ASSETS, 'splash-icon.png'), dark, { size: 1024 });

for (const [name, svg, pt] of [
  ['keystone-mark-dark', dark, 72],
  ['keystone-mark-small', small, 28],
]) {
  for (const scale of [1, 2, 3]) {
    await png(join(BRAND, `${name}${scale === 1 ? '' : `@${scale}x`}.png`), svg, { size: pt * scale });
  }
}

await browser.close();
