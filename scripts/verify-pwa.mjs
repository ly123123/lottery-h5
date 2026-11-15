import puppeteer from 'puppeteer-core';
const URL = 'https://claire-seminars-marked-discount.trycloudflare.com/';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('requestfailed', (r) => errors.push('FAIL ' + r.url()));
await page.goto(URL, { waitUntil: 'networkidle0', timeout: 45000 });
await new Promise((r) => setTimeout(r, 3000));

const info = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  const link = document.querySelector('link[rel=manifest]');
  let manifest = null;
  if (link) { try { manifest = await (await fetch(link.href)).json(); } catch {} }
  return {
    https: location.protocol === 'https:',
    title: document.title,
    sw: reg ? (reg.active ? 'active' : 'installing') : 'none',
    manifestName: manifest?.name,
    display: manifest?.display,
    icons: manifest?.icons?.length,
    appleIcon: !!document.querySelector('link[rel=apple-touch-icon]'),
    standalone: !!document.querySelector('meta[name="apple-mobile-web-app-capable"]'),
    viewport: window.innerWidth + 'x' + window.innerHeight,
  };
});
console.log(JSON.stringify(info, null, 2));
console.log('页面错误:', errors.length ? errors.slice(0, 3) : '无');
await page.screenshot({ path: '/tmp/pwa-live.png' });
await browser.close();
