import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 800));
const tabs = await page.$$('.tabbar .tab');
await tabs[1].click();
await new Promise((r) => setTimeout(r, 1500));
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '开始回测');
  b?.click();
});
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 400));
  const ok = await page.evaluate(() => document.body.innerText.includes('显著性检验'));
  if (ok) break;
}
await page.evaluate(() => {
  const h = [...document.querySelectorAll('.card-title')].find((x) => x.textContent.includes('算法回测验证'));
  h?.scrollIntoView({ block: 'start' });
  window.scrollBy(0, -70);
});
await new Promise((r) => setTimeout(r, 600));
await page.screenshot({ path: '/tmp/bt2.png' });
console.log('ok');
await browser.close();
