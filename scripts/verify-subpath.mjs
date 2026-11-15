import puppeteer from 'puppeteer-core';
const URL = 'http://127.0.0.1:8099/lottery-h5/';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const failed = [];
const ok = [];
page.on('response', (r) => {
  const u = r.url();
  if (/assets\/|icons\/|manifest|sw\.js/.test(u)) (r.status() < 400 ? ok : failed).push(r.status() + ' ' + u);
});
page.on('requestfailed', (r) => failed.push('FAIL ' + r.url()));
page.on('pageerror', (e) => failed.push('JS ' + e.message));
await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
await new Promise((r) => setTimeout(r, 1500));
const info = await page.evaluate(() => ({
  title: document.title,
  h1: document.querySelector('.brand h1')?.textContent,
  balls: document.querySelectorAll('.ball').length,
  sw: !!navigator.serviceWorker,
  manifest: !!document.querySelector('link[rel=manifest]'),
}));
console.log('标题:', info.title);
console.log('品牌:', info.h1);
console.log('号码球数:', info.balls);
console.log('SW 支持:', info.sw, '| manifest:', info.manifest);
console.log('资源成功:', ok.length, '| 失败:', failed.length);
if (failed.length) console.log(failed.slice(0, 8));
// 切到预测页确认交互与资源
const tabs = await page.$$('.tabbar .tab');
await tabs[1].click();
await new Promise((r) => setTimeout(r, 1800));
const txt = await page.evaluate(() => document.body.innerText);
console.log('预测页渲染:', txt.includes('单注推荐') && txt.includes('复式推荐') && txt.includes('合计'));
console.log('期号:', (txt.match(/第 (\d+) 期/) || [])[1]);
await page.screenshot({ path: '/tmp/subpath.png' });
await browser.close();
