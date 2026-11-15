import { readFileSync, writeFileSync } from 'node:fs';
const dir = new URL('../src/data/', import.meta.url);
const ssq = JSON.parse(readFileSync(new URL('ssq.json', dir), 'utf8'));
const dlt = JSON.parse(readFileSync(new URL('dlt.json', dir), 'utf8'));
// 紧凑格式: [期号, 日期, 主区号码, 附加区号码, 销售额, 奖池]
const pack = (d, main, spec) => [d.code, d.date, main, spec, d.sales, d.pool];
const out = {
  ssq: ssq.map((d) => pack(d, d.red, [d.blue])).sort((a, b) => (a[0] < b[0] ? -1 : 1)),
  dlt: dlt.map((d) => pack(d, d.front, d.back)).sort((a, b) => (a[0] < b[0] ? -1 : 1)),
};
writeFileSync(new URL('draws.json', dir), JSON.stringify(out));
console.log('紧凑数据已生成', (JSON.stringify(out).length / 1024).toFixed(1), 'KB，',
  '双色球', out.ssq.length, '期，大乐透', out.dlt.length, '期');
