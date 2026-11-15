import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--proxy-server=http://127.0.0.1:7897'],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

const domains = new Map();
page.on('request', (r) => {
  const u = new URL(r.url());
  if (!u.protocol.startsWith('http')) return;
  domains.set(u.host, (domains.get(u.host) ?? 0) + 1);
});
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));

await page.goto('https://ly123123.github.io/lottery-h5/?v=' + Date.now(), { waitUntil: 'networkidle0', timeout: 60000 });
await new Promise((r) => setTimeout(r, 2500));
// 遍历所有 tab，触发全部请求
const tabs = await page.$$('.tabbar .tab');
for (let i = 0; i < tabs.length; i++) { await tabs[i].click(); await new Promise((r) => setTimeout(r, 800)); }
await new Promise((r) => setTimeout(r, 1500));

console.log('=== 请求域名统计（应只有自身域名）===');
for (const [host, n] of domains) console.log(`  ${host}  ${n} 次`);

const thirdParty = [...domains.keys()].filter((h) => !h.endsWith('ly123123.github.io'));
console.log('第三方域名:', thirdParty.length ? thirdParty : '无 ✅');

const audit = await page.evaluate(() => ({
  cookiesKeys: document.cookie,
  lsKeys: Object.keys(localStorage),
  externalScripts: [...document.querySelectorAll('script[src]')].map((s) => s.src).filter((s) => !s.includes(location.host)),
  externalLinks: [...document.querySelectorAll('link[href]')].map((l) => l.href).filter((h) => !h.includes(location.host)),
  compliance: document.body.innerText.includes('不销售') && document.body.innerText.includes('不构成任何投注建议'),
}));
console.log('\n=== 存储与外部资源 ===');
console.log(JSON.stringify(audit, null, 1));
console.log('页面错误:', errs.length ? errs.slice(0, 3) : '无');
await browser.close();
