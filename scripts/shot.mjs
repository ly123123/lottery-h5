// 移动端截图：精确模拟 iPhone 视口
import puppeteer from 'puppeteer-core';

const URL = process.argv[2] || 'http://127.0.0.1:4173/';
const OUT = process.argv[3] || '/tmp/shot.png';
const TABS = ['analysis', 'predict', 'picker', 'me'];
const FULL = process.argv[4] === 'full';

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
});

const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
await new Promise((r) => setTimeout(r, 1200));

const tabIndex = Number(process.argv[5] ?? 0);
if (tabIndex > 0) {
  const btns = await page.$$('.tabbar .tab');
  await btns[tabIndex].click();
  await new Promise((r) => setTimeout(r, 1500));
}

const metrics = await page.evaluate(() => ({
  innerWidth: window.innerWidth,
  innerHeight: window.innerHeight,
  scrollWidth: document.documentElement.scrollWidth,
  bodyScrollWidth: document.body.scrollWidth,
  dpr: window.devicePixelRatio,
}));
console.log('viewport:', JSON.stringify(metrics));

await page.screenshot({ path: OUT, fullPage: FULL });
console.log('saved', OUT);
await browser.close();
