// Route CDN + Google Fonts requests through a local on-disk cache so QA runs
// are deterministic in sandboxes with flaky egress. Files are fetched once
// with curl (which honours HTTPS_PROXY and the CA bundle).
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const TYPES = { js: 'application/javascript', mjs: 'application/javascript', css: 'text/css', woff2: 'font/woff2', woff: 'font/woff' };

export function makeCache(dir) {
  mkdirSync(dir, { recursive: true });
  const fetchToCache = (url) => {
    const key = createHash('sha1').update(url).digest('hex');
    const file = join(dir, key);
    if (!existsSync(file)) {
      execFileSync('curl', ['-sSL', '--retry', '4', '--retry-all-errors', '--max-time', '60', '-o', file, '-A', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36', url], { stdio: 'pipe' });
    }
    return readFileSync(file);
  };
  return {
    async install(page) {
      await page.route((u) => HOSTS.includes(u.hostname), async (route) => {
        const url = route.request().url();
        try {
          const body = fetchToCache(url);
          const ext = (url.split('?')[0].split('.').pop() || '').toLowerCase();
          const contentType = url.includes('fonts.googleapis.com/css') ? 'text/css' : (TYPES[ext] || 'application/octet-stream');
          await route.fulfill({ status: 200, body, headers: { 'content-type': contentType, 'access-control-allow-origin': '*' } });
        } catch (err) {
          await route.abort();
        }
      });
    },
  };
}
