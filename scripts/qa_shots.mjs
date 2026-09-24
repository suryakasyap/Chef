// Visual QA: full-page screenshots + console/network error capture.
// usage: node scripts/qa_shots.mjs <baseUrl> <outDir>   (uses local or global playwright)
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
let pw; try { pw = req('playwright'); } catch { pw = createRequire(process.env.PW_GLOBAL || '/opt/node22/lib/node_modules/')('playwright'); }
const { chromium } = pw;
import { makeCache } from './qa_cdn_cache.mjs';
const cache = makeCache(process.env.QA_CACHE || '.qa-cache');
const [base = 'http://127.0.0.1:4173/Chef/', out = '.'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const report = [];
async function shoot(name, { width, height, url, scrollThrough }) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, ignoreHTTPSErrors: !!process.env.QA_IGNORE_TLS });
  const page = await ctx.newPage();
  await cache.install(page);
  const errors = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`); });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  if (scrollThrough) {
    const total = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < total; y += Math.round(height * 0.6)) {
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
      await page.waitForTimeout(140);
    }
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(800);
  }
  const state = await page.evaluate(() => ({
    html: document.documentElement.className,
    lines: document.querySelectorAll('.headline .line').length,
    masks: document.querySelectorAll('.headline .line-mask, .headline [class*="mask"]').length,
    maskSample: document.querySelector('.headline')?.innerHTML.slice(0, 260),
    orbFallback: document.querySelector('[data-cover-orb]')?.className,
    hiddenReveals: Array.from(document.querySelectorAll('[data-reveal],[data-reveal-img] .figure__frame,[data-cover-fade]')).filter((el) => getComputedStyle(el).opacity === '0' || getComputedStyle(el).clipPath.includes('100%')).length,
    docW: document.documentElement.scrollWidth, winW: window.innerWidth,
    overflowers: Array.from(document.querySelectorAll('body *')).filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1).slice(0, 8).map((el) => el.tagName + '.' + el.className),
  }));
  // chunked capture: scroll, wait for in-viewport images, shoot the viewport
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  const chunks = [];
  for (let y = 0; y < total; y += height) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(scrollThrough ? 900 : 350);
    await page.evaluate(() => Promise.all(Array.from(document.images).filter((i) => { const r = i.getBoundingClientRect(); return r.bottom > -200 && r.top < innerHeight + 200 && !i.complete; }).map((i) => new Promise((res) => { i.onload = i.onerror = res; }))));
    const buf = await page.screenshot({ type: 'png' });
    chunks.push({ y, buf, h: Math.min(height, total - y) });
  }
  const fs = await import('node:fs');
  fs.mkdirSync(`${out}/${name}.chunks`, { recursive: true });
  chunks.forEach((c, i) => fs.writeFileSync(`${out}/${name}.chunks/${String(i).padStart(3, '0')}.png`, c.buf));
  fs.writeFileSync(`${out}/${name}.chunks/meta.json`, JSON.stringify({ width, height, total, chunks: chunks.map((c) => ({ y: c.y, h: c.h })) }));
  report.push({ name, errors, state });
  await ctx.close();
}
await shoot('desktop-motion', { width: 1440, height: 900, url: base, scrollThrough: true });
await shoot('desktop-static', { width: 1440, height: 900, url: base + '?static=1' });
await shoot('mobile-motion', { width: 390, height: 844, url: base, scrollThrough: true });
await shoot('mobile-static', { width: 390, height: 844, url: base + '?static=1' });
await browser.close();
console.log(JSON.stringify(report, null, 1));
