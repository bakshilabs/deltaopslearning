// Renders tools/social/power-run.html frame by frame on a virtual clock.
// Serve the repo root first:  python3 -m http.server 8765
// Stills:  node tools/social/render.mjs stills 3,9.5,20 out/
// Video:   node tools/social/render.mjs frames 56 out/frames/   then ffmpeg (see README in this folder)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs')); }

const [mode, arg, out] = process.argv.slice(2);
const FPS = 30, URL = process.env.FILM_URL || 'http://localhost:8765/tools/social/power-run.html';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 540, height: 540 }, deviceScaleFactor: 2 });
page.on('pageerror', e => console.error('page error:', e.message));

// one clock for everything: rAF, performance.now, Date, timers and CSS animations
await page.addInitScript(() => {
  window.__rec = true;
  let now = 1000, raf = [], timers = [], id = 1;
  const D = Date, start = D.now();
  performance.now = () => now;
  window.Date = class extends D { constructor(...a) { a.length ? super(...a) : super(start + now); } static now() { return start + now; } };
  window.requestAnimationFrame = cb => { raf.push(cb); return id++; };
  window.cancelAnimationFrame = () => {};
  window.setTimeout = (fn, ms = 0, ...a) => { const k = id++; timers.push({ k, at: now + ms, fn: () => fn(...a) }); return k; };
  window.clearTimeout = k => { timers = timers.filter(x => x.k !== k); };
  window.__step = dt => {
    for (const a of document.getAnimations()) {
      if (a.playState === 'finished') continue;
      const t = a.__t ?? (a.currentTime || 0); a.pause(); a.__t = t + dt; a.currentTime = a.__t;
    }
    now += dt;
    const due = timers.filter(x => x.at <= now); timers = timers.filter(x => x.at > now); due.forEach(x => x.fn());
    const c = raf; raf = []; c.forEach(f => f(now));
  };
});

await page.goto(URL);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
for (let i = 0; i < 6; i++) await page.evaluate(() => window.__step(1000 / 30));
await page.evaluate(() => { window.__go = true; });

const step = () => page.evaluate(() => window.__step(1000 / 30));
const pad = n => String(n).padStart(5, '0');
if (mode === 'stills') {
  const times = arg.split(',').map(Number).sort((a, b) => a - b);
  let f = 0;
  for (const t of times) {
    while (f < Math.round(t * FPS)) { await step(); f++; }
    await page.screenshot({ path: `${out}/t${t.toFixed(1)}.png` });
  }
} else {
  const n = Math.round(Number(arg) * FPS);
  for (let f = 0; f < n; f++) {
    await step();
    await page.screenshot({ path: `${out}/f${pad(f)}.png` });
    if (f % 150 === 0) console.log(`frame ${f}/${n}`);
  }
}
await browser.close();
