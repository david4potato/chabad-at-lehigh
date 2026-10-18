// Renders one-pager.html to one-pager.pdf (US Letter) and one-pager.png (2x).
// Run from the repo root after `npm install`: node docs/one-pager/render.mjs
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
// PW_CHROMIUM_PATH: same override as playwright.config.ts, for machines with a different browser build.
const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 816, height: 1056 }, deviceScaleFactor: 2 });
await page.goto("file://" + path.join(dir, "one-pager.html"));
await page.evaluate(() => document.fonts.ready);

const overflow = await page.evaluate(() => {
  const el = document.querySelector(".page");
  return el.scrollHeight - el.clientHeight;
});
if (overflow > 0) throw new Error(`Content overflows the page by ${overflow}px`);

await page.pdf({ path: path.join(dir, "one-pager.pdf"), format: "Letter", printBackground: true, preferCSSPageSize: true });
await page.screenshot({ path: path.join(dir, "one-pager.png"), fullPage: false });
await browser.close();
console.log("Wrote one-pager.pdf and one-pager.png");
