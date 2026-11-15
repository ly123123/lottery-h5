// 抓取双色球 / 大乐透近两年官方开奖数据
import fs from 'node:fs/promises';
import path from 'node:path';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const OUT = path.resolve(import.meta.dirname, '../src/data');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(url, headers = {}, retries = 4) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers } });
      const text = await res.text();
      if (res.ok && text.trim().startsWith('{')) return JSON.parse(text);
      console.error('  非 JSON 响应', res.status, text.slice(0, 80));
    } catch (e) {
      console.error('  请求失败', e.message);
    }
    await sleep(1200 * (i + 1));
  }
  throw new Error('请求多次失败: ' + url);
}

// ---------- 双色球 ----------
async function fetchSSQ() {
  const url = 'https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice'
    + '?name=ssq&dayStart=2024-11-01&dayEnd=2026-11-30&pageNo=1&pageSize=400';
  const json = await getJSON(url, { Referer: 'https://www.cwl.gov.cn/' });
  const rows = json.result || [];
  const draws = rows.map((r) => {
    const reds = r.red.split(',').map(Number).sort((a, b) => a - b);
    const blues = [Number(r.blue), r.blue2 ? Number(r.blue2) : null].filter(Boolean);
    return {
      code: r.code,
      date: r.date.slice(0, 10),
      red: reds,
      blue: blues[0],
      sales: Number(r.sales) || 0,
      pool: Number(r.poolmoney) || 0,
      prizes: (r.prizegrades || []).filter((g) => g.type <= 6).map((g) => ({
        level: g.type,
        count: Number(g.typenum) || 0,
        money: Number(g.typemoney) || 0,
      })),
    };
  }).filter((d) => d.red.length === 6 && d.blue >= 1);
  draws.sort((a, b) => (a.code < b.code ? 1 : -1));
  return draws;
}

// ---------- 大乐透 ----------
async function fetchDLT() {
  const all = [];
  for (let pageNo = 1; pageNo <= 5; pageNo++) {
    const url = 'https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry'
      + `?gameNo=85&provinceId=0&pageSize=100&isVerify=1&pageNo=${pageNo}`;
    const json = await getJSON(url, { Referer: 'https://static.sporttery.cn/' });
    const list = json.value?.list || [];
    for (const r of list) {
      const nums = r.lotteryDrawResult.trim().split(/\s+/).map(Number);
      if (nums.length !== 7) continue;
      const draw = {
        code: r.lotteryDrawNum,
        date: r.lotteryDrawTime,
        front: nums.slice(0, 5).sort((a, b) => a - b),
        back: nums.slice(5, 7).sort((a, b) => a - b),
        sales: Number(String(r.totalSaleAmount).replace(/,/g, '')) || 0,
        pool: Number(String(r.poolBalanceAfterdraw).replace(/,/g, '')) || 0,
        prizes: (r.prizeLevelList || []).map((g) => ({
          name: g.prizeLevel,
          count: Number(String(g.stakeCount).replace(/,/g, '')) || 0,
          money: Number(String(g.stakeAmount).replace(/,/g, '')) || 0,
        })),
      };
      all.push(draw);
    }
    if (list.length < 100) break;
    await sleep(300);
  }
  all.sort((a, b) => (a.code < b.code ? 1 : -1));
  return all;
}

const CUTOFF = '2024-11-01';

await fs.mkdir(OUT, { recursive: true });

const ssq = (await fetchSSQ()).filter((d) => d.date >= CUTOFF);
console.log('双色球', ssq.length, '期', ssq.at(-1)?.code, '→', ssq[0]?.code);
await fs.writeFile(path.join(OUT, 'ssq.json'), JSON.stringify(ssq));

const dlt = (await fetchDLT()).filter((d) => d.date >= CUTOFF);
console.log('大乐透', dlt.length, '期', dlt.at(-1)?.code, '→', dlt[0]?.code);
await fs.writeFile(path.join(OUT, 'dlt.json'), JSON.stringify(dlt));

// 打印最近几期奖级结构，用于校准
console.log('\n最近 3 期大乐透奖级：');
for (const d of dlt.slice(0, 3)) {
  console.log(d.code, d.date, d.sales, JSON.stringify(d.prizes.map((p) => [p.name, p.count, p.money])));
}
