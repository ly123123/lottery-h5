import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 1500));

// 1) tabbar 是否 fixed
const tabInfo = await page.evaluate(() => {
  const t = document.querySelector('.tabbar');
  const cs = getComputedStyle(t);
  return { position: cs.position, bottom: cs.bottom, height: t.getBoundingClientRect().height };
});
console.log('tabbar:', JSON.stringify(tabInfo));

// 2) 滚到底，最后一个 card 是否被遮挡
const overlap = await page.evaluate(() => {
  window.scrollTo(0, document.body.scrollHeight);
  const cards = document.querySelectorAll('.content .card');
  const last = cards[cards.length - 1].getBoundingClientRect();
  const tab = document.querySelector('.tabbar').getBoundingClientRect();
  return { lastBottom: Math.round(last.bottom), tabTop: Math.round(tab.top), covered: last.bottom > tab.top };
});
console.log('底部遮挡检查:', JSON.stringify(overlap));

// 3) 可视化元素是否存在
const viz = await page.evaluate(() => ({
  matrixCells: document.querySelectorAll('.matrix-cell').length,
  lines: document.querySelectorAll('svg path').length,
  probRows: document.querySelectorAll('.prob-row').length,
}));
console.log('可视化:', JSON.stringify(viz));

// 4) 打开录入面板并输入
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('录入最新开奖'));
  b?.click();
});
await new Promise((r) => setTimeout(r, 500));
await page.type('.update-input', '05 08 12 19 24 31 07');
await new Promise((r) => setTimeout(r, 600));
const preview = await page.evaluate(() => document.querySelector('.update-preview')?.textContent ?? '(无)');
console.log('解析预览:', preview.replace(/\s+/g, ' '));

const before = await page.evaluate(() => document.querySelector('.stat .v')?.textContent);
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('保存并重新预测'));
  b?.click();
});
await new Promise((r) => setTimeout(r, 1500));
const after = await page.evaluate(() => ({
  total: [...document.querySelectorAll('.stat')].find((s) => s.textContent.includes('已纳期数'))?.querySelector('.v')?.textContent,
  latest: [...document.querySelectorAll('.stat')].find((s) => s.textContent.includes('最新期号'))?.querySelector('.v')?.textContent,
  firstDraw: document.querySelector('.draw-item .draw-meta span')?.textContent,
}));
console.log('保存前已纳期数:', before);
console.log('保存后:', JSON.stringify(after));
console.log('页面错误:', errs.length ? errs.slice(0, 3) : '无');

await page.evaluate(() => window.scrollTo(0, 0));
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: '/tmp/home-new.png', fullPage: true });
await browser.close();
