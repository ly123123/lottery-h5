import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--proxy-server=http://127.0.0.1:7897'],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await page.goto('https://ly123123.github.io/lottery-h5/?v=' + Date.now(), { waitUntil: 'networkidle0', timeout: 60000 });
await new Promise((r) => setTimeout(r, 2000));
// 直接点第 4 个 tab
const tabs = await page.$$('.tabbar .tab');
await tabs[3].click();
await new Promise((r) => setTimeout(r, 1500));
const t = await page.evaluate(() => document.body.innerText);
console.log('包含「合规声明」:', t.includes('合规声明'));
console.log('包含「不销售」:', t.includes('不销售'));
console.log('包含「隐私保护」:', t.includes('隐私保护'));
console.log('包含「任何算法都无法提高中奖概率」:', t.includes('任何算法都无法提高中奖概率'));
console.log('包含「安装到 iPhone」:', t.includes('安装到 iPhone'));
console.log('--- 片段 ---');
console.log(t.slice(0, 260).replace(/\n+/g, ' | '));
await page.screenshot({ path: '/tmp/me-live.png', fullPage: true });
await browser.close();
