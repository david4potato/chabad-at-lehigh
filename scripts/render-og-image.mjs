// Renders the link-preview image (public/og-image.png, 1200×630) shown when someone shares
// the site or an event in a chat. Run from the repo root after `npm install`:
//   node scripts/render-og-image.mjs
// PW_CHROMIUM_PATH: same override as playwright.config.ts, for machines with a different browser build.
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const icon = readFileSync(path.join(root, "public/icon-512.png")).toString("base64");

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; background: #1b3a82; color: #fff; font-family: "Inter", "DejaVu Sans", sans-serif;
         display: flex; align-items: center; gap: 64px; padding: 0 96px; }
  img { width: 260px; height: 260px; flex: none; }
  h1 { font-family: "Inter Display", "Inter", sans-serif; font-size: 84px; line-height: 1.05; font-weight: 700; letter-spacing: -0.01em; }
  p { margin-top: 22px; font-size: 38px; line-height: 1.3; color: #dbe6fe; }
  .bar { position: absolute; left: 0; right: 0; bottom: 0; height: 14px; background: #f6b23b; }
</style></head><body>
  <img src="data:image/png;base64,${icon}" alt="">
  <div><h1>Chabad at Lehigh</h1><p>Shabbat dinners, events, menus and helping out</p></div>
  <div class="bar"></div>
</body></html>`;

const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: path.join(root, "public/og-image.png") });
await browser.close();
console.log("Wrote public/og-image.png");
