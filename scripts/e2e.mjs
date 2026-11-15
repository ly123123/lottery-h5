// 端到端交互验证：选号 → 金额 → 回测 → 收藏
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 800));

const tabs = await page.$$('.tabbar .tab');

// --- 自选页：点 6 红 1 蓝，验证金额 ---
await tabs[2].click();
await new Promise((r) => setTimeout(r, 600));
const grids = await page.$$('.pick-grid');
const mainCells = await grids[0].$$('.pick-cell');
const specCells = await grids[1].$$('.pick-cell');
for (let i = 0; i < 6; i++) await mainCells[i].click();
await specCells[0].click();
await new Promise((r) => setTimeout(r, 400));
let amount = await page.$$eval('.row', (rows) => {
  const r = rows.find((x) => x.textContent.includes('应付金额'));
  return r ? r.textContent : '';
});
console.log('单式金额显示:', amount.replace(/\s+/g, ' '));

// 加入 2 个红球 → 复式 8 红 1 蓝 = 28 注 = 56 元
await mainCells[6].click();
await mainCells[7].click();
await new Promise((r) => setTimeout(r, 400));
amount = await page.$$eval('.row', (rows) => {
  const r = rows.find((x) => x.textContent.includes('应付金额'));
  return r ? r.textContent : '';
});
console.log('8+1 复式金额显示:', amount.replace(/\s+/g, ' '));

// 收藏
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('收藏这注号码'));
  b?.click();
});
await new Promise((r) => setTimeout(r, 500));

// --- 我的页：确认已收藏 ---
await tabs[3].click();
await new Promise((r) => setTimeout(r, 700));
const ticketCount = await page.$$eval('.card:nth-of-type(1) .chip.red', (els) => els.length);
const hasBall = await page.$$eval('.ball', (els) => els.length);
console.log('我的页面球数:', hasBall, '（说明收藏页渲染）');

// --- 预测页：跑回测 ---
await tabs[1].click();
await new Promise((r) => setTimeout(r, 1200));
const t0 = Date.now();
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '开始回测');
  b?.click();
});
let done = false;
for (let i = 0; i < 120; i++) {
  await new Promise((r) => setTimeout(r, 500));
  const txt = await page.evaluate(() => document.body.innerText);
  if (txt.includes('显著性检验')) { done = true; break; }
}
console.log('回测完成:', done, '耗时', ((Date.now() - t0) / 1000).toFixed(1), '秒');
await page.screenshot({ path: '/tmp/backtest.png', fullPage: false });
console.log('页面错误:', errors.length ? errors.slice(0, 5) : '无');
await browser.close();
