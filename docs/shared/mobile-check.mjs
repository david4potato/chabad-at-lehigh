#!/usr/bin/env node
// Shared mobile and spacing check. See docs/shared/MOBILE_AND_SPACING.md.
// Usage: node docs/shared/mobile-check.mjs <base-url> [path ...]
// Needs Playwright (`playwright` or `@playwright/test`) in the project. Set PW_CHROMIUM_PATH to use
// an installed Chromium instead of Playwright's download.
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const WIDTHS = [320, 375, 390, 768, 1280];
const MIN_TAP = 44;
const MIN_TEXT = 14;
const MIN_INPUT_TEXT = 16;
const OUT_DIR = "mobile-check";

const [base, ...rawPaths] = process.argv.slice(2);
if (!base) {
  console.error("Usage: node docs/shared/mobile-check.mjs <base-url> [path ...]");
  process.exit(2);
}
const paths = rawPaths.length ? rawPaths : ["/"];

async function loadChromium() {
  for (const name of ["playwright", "@playwright/test"]) {
    try {
      const mod = await import(name);
      if (mod.chromium) return mod.chromium;
    } catch {
      // Try the next package name.
    }
  }
  console.error("Playwright isn't installed here. Run: npm i -D playwright");
  process.exit(2);
}

// Runs inside the page. Returns the problems found at the current width.
function inspect({ minTap, minText, minInputText }) {
  const vw = window.innerWidth;
  const label = (el) => {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : "";
    const cls =
      typeof el.className === "string" && el.className.trim()
        ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
        : "";
    const text = (el.innerText || el.getAttribute("aria-label") || el.getAttribute("alt") || "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 40);
    return `${tag}${id}${cls}${text ? ` "${text}"` : ""}`;
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0;
  };
  // Content inside a box that scrolls or clips sideways is allowed to be wider than the screen.
  const clipped = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === "auto" || ox === "scroll" || ox === "hidden" || ox === "clip") return true;
    }
    return false;
  };
  const isSrOnly = (el) => {
    const r = el.getBoundingClientRect();
    return r.width <= 1 && r.height <= 1;
  };

  const problems = [];
  const scrollWidth = document.documentElement.scrollWidth;
  if (scrollWidth > vw + 1) {
    problems.push({ kind: "sideways scroll", detail: `page is ${scrollWidth}px wide on a ${vw}px screen` });
  }

  const wide = [];
  for (const el of document.body.querySelectorAll("*")) {
    if (!visible(el) || clipped(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1 || r.left < -1) wide.push(`${label(el)} (${Math.round(r.left)}–${Math.round(r.right)}px)`);
    if (wide.length >= 5) break;
  }
  for (const w of wide) problems.push({ kind: "wider than the screen", detail: w });

  const controls = document.querySelectorAll(
    'button, [role="button"], select, textarea, input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), nav a, header a, [role="menuitem"], [role="tab"]',
  );
  for (const el of controls) {
    if (!visible(el) || isSrOnly(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < minTap || r.height < minTap) {
      problems.push({ kind: "tap target under 44px", detail: `${label(el)} is ${Math.round(r.width)}×${Math.round(r.height)}` });
    }
  }

  const small = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement;
    if (!el || !visible(el) || isSrOnly(el)) continue;
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (size < minText) small.add(`${label(el)} at ${size}px`);
    if (small.size >= 5) break;
  }
  for (const s of small) problems.push({ kind: "text under 14px", detail: s });

  if (vw < 768) {
    for (const el of document.querySelectorAll("input:not([type=hidden]), select, textarea")) {
      if (!visible(el)) continue;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < minInputText) problems.push({ kind: "input text under 16px (phones zoom in)", detail: `${label(el)} at ${size}px` });
    }
  }

  for (const img of document.querySelectorAll("img:not([alt])")) {
    problems.push({ kind: "image without alt", detail: img.getAttribute("src")?.slice(0, 80) ?? "img" });
  }
  return problems;
}

const chromium = await loadChromium();
const executablePath =
  process.env.PW_CHROMIUM_PATH || (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const browser = await chromium.launch(executablePath ? { executablePath } : {});
mkdirSync(OUT_DIR, { recursive: true });

let total = 0;
try {
  for (const path of paths) {
    const url = new URL(path, base).toString();
    for (const width of WIDTHS) {
      const page = await browser.newPage({ viewport: { width, height: 800 }, deviceScaleFactor: 1 });
      try {
        const res = await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 }).catch(() => page.goto(url, { waitUntil: "load" }));
        if (res && res.status() >= 400) {
          console.log(`✗ ${path} @${width}px: HTTP ${res.status()}`);
          total++;
          continue;
        }
        const problems = await page.evaluate(inspect, { minTap: MIN_TAP, minText: MIN_TEXT, minInputText: MIN_INPUT_TEXT });
        const slug = path.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home";
        await page.screenshot({ path: join(OUT_DIR, `${slug}-${width}.png`), fullPage: true });
        if (problems.length === 0) {
          console.log(`✓ ${path} @${width}px`);
        } else {
          console.log(`✗ ${path} @${width}px: ${problems.length} problem(s)`);
          for (const p of problems.slice(0, 15)) console.log(`    - ${p.kind}: ${p.detail}`);
          if (problems.length > 15) console.log(`    - and ${problems.length - 15} more`);
          total += problems.length;
        }
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
}

console.log(total === 0 ? `\nAll clear. Screenshots are in ${OUT_DIR}/.` : `\n${total} problem(s). Screenshots are in ${OUT_DIR}/.`);
process.exit(total === 0 ? 0 : 1);
