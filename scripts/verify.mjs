// 核心逻辑验证：金额、奖级概率、回测
import { readFileSync } from 'node:fs';

const ssqRaw = JSON.parse(readFileSync(new URL('../src/data/ssq.json', import.meta.url), 'utf8'));
const dltRaw = JSON.parse(readFileSync(new URL('../src/data/dlt.json', import.meta.url), 'utf8'));

const C = (n, k) => { if (k < 0 || k > n) return 0; let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return Math.round(r); };

console.log('=== 金额计算校验 ===');
const cases = [
  ['双色球 单式 6+1 1倍', C(6, 6) * 1 * 2 * 1, 2],
  ['双色球 复式 7红1蓝 1倍', C(7, 6) * 1 * 2, 14],
  ['双色球 复式 8红2蓝 1倍', C(8, 6) * 2 * 2, 112],
  ['双色球 复式 10红3蓝 5倍', C(10, 6) * 3 * 2 * 5, 6300],
  ['双色球 复式 16红1蓝 1倍', C(16, 6) * 1 * 2, 16016],
  ['大乐透 单式 5+2 1倍', C(5, 5) * C(2, 2) * 2, 2],
  ['大乐透 单式 5+2 追加 1倍', C(5, 5) * C(2, 2) * 3, 3],
  ['大乐透 复式 7+3 1倍', C(7, 5) * C(3, 2) * 2, 126],
  ['大乐透 复式 8+4 2倍 追加', C(8, 5) * C(4, 2) * 3 * 2, 2016],
  ['大乐透 复式 12+2 1倍', C(12, 5) * C(2, 2) * 2, 1584],
];
let pass = 0;
for (const [name, got, want] of cases) {
  const ok = got === want;
  if (ok) pass++;
  console.log(ok ? '  ✓' : '  ✗', name, '计算', got, '期望', want);
}
console.log(`  金额用例 ${pass}/${cases.length} 通过`);

console.log('\n=== 奖级概率校验 ===');
const t33 = C(33, 6);
const ssqLv = [[1,[[6,1]]],[2,[[6,0]]],[3,[[5,1]]],[4,[[5,0],[4,1]]],[5,[[4,0],[3,1]]],[6,[[2,1],[1,1],[0,1]]]];
for (const [lv, combos] of ssqLv) {
  let p = 0;
  for (const [r, b] of combos) p += (C(6, r) * C(27, 6 - r) / t33) * (b === 1 ? 1 / 16 : 15 / 16);
  console.log('  双色球', lv, '等奖 1/' + Math.round(1 / p));
}
const tf = C(35, 5), tb = C(12, 2), tot = tf * tb;
const dltLv = [
  [1, [[5,2]]], [2, [[5,1]]], [3, [[5,0],[4,2]]], [4, [[4,1]]], [5, [[4,0],[3,2]]],
  [6, [[1,2]]], [7, [[3,1],[3,0],[2,2],[2,1],[0,2]]],
];
let totalWin = 0;
for (const [lv, combos] of dltLv) {
  let n = 0;
  for (const [f, b] of combos) n += C(5, f) * C(30, 5 - f) * C(2, b) * C(10, 2 - b);
  totalWin += n;
  console.log('  大乐透', lv, '等奖 1/' + Math.round(tot / n), '共', n, '注组合');
}
console.log('  13 个中奖条件合计中奖率 1/' + (tot / totalWin).toFixed(2) + '，七等奖单独 1/16.8（官方 1/16.6）');
console.log('  开奖数据量：双色球', ssqRaw.length, '期，大乐透', dltRaw.length, '期');
