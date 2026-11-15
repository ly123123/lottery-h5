import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--proxy-server=http://127.0.0.1:7897'],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto('https://ly123123.github.io/lottery-h5/?v=' + Date.now(), { waitUntil: 'networkidle0', timeout: 60000 });
await new Promise((r) => setTimeout(r, 2500));

const info = await page.evaluate(() => {
  const t = document.querySelector('.tabbar');
  const cs = t ? getComputedStyle(t) : null;
  return {
    title: document.title,
    tabPosition: cs?.position,
    tabFixedBottom: cs?.bottom,
    hasUpdateBtn: !![...document.querySelectorAll('button')].find((b) => b.textContent.includes('录入最新开奖')),
    matrixCells: document.querySelectorAll('.matrix-cell').length,
    lineCharts: document.querySelectorAll('svg path').length,
    probRows: document.querySelectorAll('.prob-row').length,
    sw: 'pending',
  };
});
console.log(JSON.stringify(info, null, 1));

// 滚到底部检查遮挡
const cover = await page.evaluate(() => {
  window.scrollTo(0, document.body.scrollHeight);
  const cards = document.querySelectorAll('.content .card');
  const last = cards[cards.length - 1].getBoundingClientRect();
  const tab = document.querySelector('.tabbar').getBoundingClientRect();
  return { lastBottom: Math.round(last.bottom), tabTop: Math.round(tab.top), covered: last.bottom > tab.top };
});
console.log('遮挡检查:', JSON.stringify(cover));

// 测试录入功能（真实线上）
await page.evaluate(() => window.scrollTo(0, 0));
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('录入最新开奖'));
  b?.click();
});
await new Promise((r) => setTimeout(r, 500));
await page.type('.update-input', '03 11 17 22 29 33 09');
await new Promise((r) => setTimeout(r, 700));
const preview = await page.evaluate(() => document.querySelector('.update-preview')?.textContent?.replace(/\s+/g, ' '));
console.log('录入解析:', preview);
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('保存并重新预测'));
  b?.click();
});
await new Promise((r) => setTimeout(r, 1500));
const latest = await page.evaluate(() =>
  [...document.querySelectorAll('.stat')].find((s) => s.textContent.includes('最新期号'))?.querySelector('.v')?.textContent);
console.log('保存后最新期号:', latest);
console.log('页面错误:', errs.length ? errs.slice(0, 3) : '无');
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: '/tmp/live-v11.png' });
await browser.close();
