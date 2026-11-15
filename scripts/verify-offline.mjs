import puppeteer from 'puppeteer-core';
const URL = 'http://127.0.0.1:8099/lottery-h5/';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(URL, { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 2500));

const swState = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? (reg.active ? 'active' : reg.installing ? 'installing' : 'waiting') : 'none';
});
console.log('Service Worker:', swState);

// 切到分析页跑一遍，确保缓存已装
await new Promise((r) => setTimeout(r, 1000));

await page.setOfflineMode(true);
await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch((e) => console.log('reload 失败:', e.message));
await new Promise((r) => setTimeout(r, 2500));

const off = await page.evaluate(() => ({
  title: document.title,
  brand: document.querySelector('.brand h1')?.textContent ?? null,
  balls: document.querySelectorAll('.ball').length,
  cards: document.querySelectorAll('.card').length,
}));
console.log('离线后渲染:', JSON.stringify(off));
await page.setOfflineMode(false);
await page.screenshot({ path: '/tmp/offline.png', fullPage: false });
await browser.close();
