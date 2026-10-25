// Geliştirme aracı: headless Chromium ile oyunun ekran görüntülerini alır.
// Kullanım: node tools/screenshot.mjs [hedef-klasör]
import { chromium as pw } from 'playwright-core';

const out = process.argv[2] || 'shots';
const VIEW = { width: 1152, height: 720 };
const browser = await pw.launch({
  executablePath: '/tmp/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
    '--font-render-hinting=none', '--hide-scrollbars', '--mute-audio'],
  headless: true,
  env: { ...process.env, LD_LIBRARY_PATH: '/tmp/nssstub:/tmp/kaleido/ext/kaleido/executable/lib' },
});
const page = await browser.newPage({ viewport: VIEW, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => { if (!m.text().startsWith('[vite]')) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

const shot = async (name) => {
  await page.screenshot({ path: `${out}/${name}.png`, timeout: 180000 });
  console.log('kaydedildi:', name);
};

await page.goto('http://localhost:4173/', { waitUntil: 'load' });
await page.waitForTimeout(3500);
await shot('01-start');

await page.click('#startBtn');
await page.waitForTimeout(2500);
await page.evaluate(() => window.__likesims.skipIntro());
await page.waitForTimeout(1500);
await shot('02-game');

for (const [name, pos, target] of [
  ['03-salon', [2.2, 4.6, 7.6], [2.0, 0.6, 2.0]],
  ['04-mutfak', [0.4, 4.2, 3.6], [-3.0, 0.6, -1.2]],
  ['05-yatak-odasi', [0.6, 4.4, -0.6], [-4.2, 0.6, -4.0]],
  ['06-calisma', [7.4, 4.0, 2.4], [4.4, 0.6, -1.4]],
]) {
  await page.evaluate(([p, t]) => window.__likesims.resetView(p, t), [pos, target]);
  await page.waitForTimeout(1200);
  await shot(name);
}

console.log(JSON.stringify(await page.evaluate(() => ({
  sims: window.__likesims.sims.map((s) => ({ id: s.id, mood: Math.round(s.mood) })),
  money: window.__likesims.state.money,
  cizimCagrisi: window.__likesims.renderer.info.render.calls,
}))));
console.log(logs.length ? logs.join('\n') : 'konsol hatası yok');
await browser.close();
