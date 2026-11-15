import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--proxy-server=http://127.0.0.1:7897'],
});
const page = await browser.newPage();
await page.goto('https://ly123123.github.io/lottery-h5/', { waitUntil: 'domcontentloaded', timeout: 60000 });

const result = await page.evaluate(async () => {
  const out = {};
  // 体彩大乐透
  try {
    const r = await fetch('https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry?gameNo=85&provinceId=0&pageSize=1&isVerify=1&pageNo=1');
    const t = await r.text();
    out.dlt = { status: r.status, ok: r.ok, head: t.slice(0, 160) };
  } catch (e) { out.dlt = { error: String(e) }; }
  // 福彩双色球
  try {
    const r = await fetch('https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice?name=ssq&issueCount=1');
    const t = await r.text();
    out.ssq = { status: r.status, ok: r.ok, head: t.slice(0, 160) };
  } catch (e) { out.ssq = { error: String(e) }; }
  return out;
});
console.log(JSON.stringify(result, null, 2));
await browser.close();
