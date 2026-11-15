import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--proxy-server=http://127.0.0.1:7897'],
});
const page = await browser.newPage();
page.on('console', m => { if (m.text().startsWith('CORS')) console.log(m.text()); });
await page.goto('https://ly123123.github.io/lottery-h5/', { waitUntil: 'domcontentloaded', timeout: 60000 });
const r = await page.evaluate(async () => {
  const out = [];
  const tryFetch = async (label, url, opts) => {
    try {
      const res = await fetch(url, opts);
      const t = await res.text();
      out.push(`${label}: HTTP ${res.status} len=${t.length} ${t.slice(0, 90)}`);
    } catch (e) { out.push(`${label}: ✗ ${e.message}`); }
  };
  await tryFetch('dlt-omit', 'https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry?gameNo=85&provinceId=0&pageSize=1&isVerify=1&pageNo=1', { credentials: 'omit' });
  await tryFetch('dlt-nores', 'https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry?gameNo=85&provinceId=0&pageSize=1&isVerify=1&pageNo=1', { credentials: 'omit', mode: 'no-cors' });
  await tryFetch('ssq-omit', 'https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice?name=ssq&issueCount=1', { credentials: 'omit' });
  return out;
});
console.log(r.join('\n'));
await browser.close();
