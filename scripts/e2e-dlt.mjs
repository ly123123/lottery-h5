import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 800));

// 切到大乐透
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.topbar .segmented button')].find((x) => x.textContent.includes('大乐透'));
  b?.click();
});
await new Promise((r) => setTimeout(r, 1500));

// 分析页截全图
await page.screenshot({ path: '/tmp/dlt-analysis.png', fullPage: true });

// 预测页
const tabs = await page.$$('.tabbar .tab');
await tabs[1].click();
await new Promise((r) => setTimeout(r, 2000));
await page.screenshot({ path: '/tmp/dlt-predict.png', fullPage: true });

// 校验复式金额文本
const txt = await page.evaluate(() => document.body.innerText);
const checks = [
  ['7+3 金额 126', txt.includes('126.00 元')],
  ['8+3 金额 336', txt.includes('336.00 元')],
  ['9+3 金额 756', txt.includes('756.00 元')],
  ['追加开关', txt.includes('追加投注')],
  ['期号 26131', txt.includes('第 26131 期')],
];
for (const [k, v] of checks) console.log(v ? '  ✓' : '  ✗', k);

// 开追加，验证单价变 3 元
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '关闭');
  b?.click();
});
await new Promise((r) => setTimeout(r, 600));
const txt2 = await page.evaluate(() => document.body.innerText);
console.log(txt2.includes('3.00 元 / 注') ? '  ✓ 追加后单价 3.00 元' : '  ✗ 追加后单价未变');
console.log(txt2.includes('追加') && txt2.includes('已开启') ? '  ✓ 追加已开启' : '  ? 追加状态');
const m = txt2.match(/复式 7\+3[^\n]*/g);
console.log('  动态金额行:', m);

console.log('页面错误:', errors.length ? errors : '无');
await browser.close();
