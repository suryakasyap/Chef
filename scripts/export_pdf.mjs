// Export the built site as the downloadable magazine PDF (A4, print stylesheet).
// usage: node scripts/export_pdf.mjs <baseUrl> <outFile>
//   e.g. node scripts/export_pdf.mjs http://127.0.0.1:4173/Chef/ assets/pdf/Plates_and_Psyche_Magazine.pdf
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
let pw; try { pw = req('playwright'); } catch { pw = createRequire(process.env.PW_GLOBAL || '/opt/node22/lib/node_modules/')('playwright'); }
const { chromium } = pw;
import { makeCache } from './qa_cdn_cache.mjs';

const [base = 'http://127.0.0.1:4173/Chef/', outFile = 'assets/pdf/Plates_and_Psyche_Magazine.pdf'] = process.argv.slice(2);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1000, height: 1400 }, deviceScaleFactor: 1, ignoreHTTPSErrors: !!process.env.QA_IGNORE_TLS });
const page = await ctx.newPage();
if (process.env.QA_CACHE) await makeCache(process.env.QA_CACHE).install(page);
page.on('pageerror', (e) => console.error('pageerror', e.message));
await page.goto(base + '?static=1', { waitUntil: 'networkidle' });
await page.evaluate(async () => {
  // Chromium re-encodes WebP as lossless PNG inside PDFs (25 MB); drop the WebP sources so the JPEGs embed as-is.
  document.querySelectorAll('picture source[type="image/webp"]').forEach((s) => s.remove());
  document.querySelectorAll('img[loading="lazy"]').forEach((i) => { i.loading = 'eager'; i.removeAttribute('srcset'); i.sizes = ''; });
  await Promise.all(Array.from(document.images).filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; })));
  if (document.fonts) await document.fonts.ready;
});
await page.emulateMedia({ media: 'print' });
await page.waitForTimeout(500);
await page.pdf({ path: outFile, format: 'A4', printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 }, displayHeaderFooter: false });
await browser.close();
console.log('wrote', outFile);
