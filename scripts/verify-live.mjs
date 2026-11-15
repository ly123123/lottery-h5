import puppeteer from 'puppeteer-core';
const URL = 'https://ly123123.github.io/lottery-h5/';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--proxy-server=http://127.0.0.1:7897'],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const failed = [];
page.on('requestfailed', (r) => failed.push(r.url()));
page.on('pageerror', (e) => failed.push('JS: ' + e.message));
await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });
await new Promise((r) => setTimeout(r, 3000));

const info = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  const link = document.querySelector('link[rel=manifest]');
  let mf = null;
  if (link) { try { mf = await (await fetch(link.href)).json(); } catch (e) { mf = { error: String(e) }; } }
  return {
    https: location.protocol === 'https:',
    title: document.title,
    sw: reg ? (reg.active ? 'active' : reg.installing ? 'installing' : 'waiting') : 'none',
    manifest: mf?.name ?? mf?.error ?? null,
    display: mf?.display,
    icons: mf?.icons?.length,
    appleIcon: !!document.querySelector('link[rel=apple-touch-icon]'),
    appleCapable: !!document.querySelector('meta[name=apple-mobile-web-app-capable]'),
    balls: document.querySelectorAll('.ball').length,
  };
});
console.log(JSON.stringify(info, null, 2));
console.log('失败请求:', failed.length ? failed.slice(0, 5) : '无');

// 切到预测页验证数据与交互
const tabs = await page.$$('.tabbar .tab');
await tabs[1].click();
await new Promise((r) => setTimeout(r, 2000));
const txt = await page.evaluate(() => document.body.innerText);
console.log('预测页:', txt.includes('单注推荐') && txt.includes('复式推荐') ? '正常' : '异常');
console.log('期号:', (txt.match(/第 (\d+) 期/) || [])[1]);
await page.screenshot({ path: '/tmp/live-home.png' });
await browser.close();
