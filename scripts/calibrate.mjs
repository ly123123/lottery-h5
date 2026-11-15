// 用真实开奖数据校准大乐透奖级 ↔ 中奖条件映射
import fs from 'node:fs/promises';

const C = (n, k) => { if (k < 0 || k > n) return 0; let r = 1; for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1); return Math.round(r); };
const totalFront = C(35, 5);
const totalBack = C(12, 2);

// 13 个中奖条件概率：p[前区中][后区中]
function condProb(f, b) {
  const front = C(5, f) * C(30, 5 - f) / totalFront;
  const back = C(2, b) * C(10, 2 - b) / totalBack;
  return front * back;
}
const CFG = {};
for (let f = 0; f <= 5; f++) for (let b = 0; b <= 2; b++) {
  if ((f === 5 && b === 2) || (f === 5 && b === 1) || (f >= 3 && b >= 1) || (f >= 3 && b === 2) || (f >= 3) || (b === 2)) {
    if (f + b >= 2) CFG[`${f}+${b}`] = { f, b, p: condProb(f, b) };
  }
}
// 只保留 13 个正式中奖条件
const WIN = ['5+2', '5+1', '5+0', '4+2', '4+1', '3+2', '4+0', '3+1', '2+2', '3+0', '1+2', '2+1', '0+2'];
const CP = Object.fromEntries(WIN.map((k) => [k, condProb(...k.split('+').map(Number))]));

const dlt = JSON.parse(await fs.readFile(new URL('../src/data/dlt.json', import.meta.url), 'utf8'));

// 新规则期（26014 起）：按奖级名取注数
const NEW = dlt.filter((d) => Number(d.code) >= 26014);
console.log('新规则期数:', NEW.length);

const levelNames = ['一等奖', '二等奖', '三等奖', '四等奖', '五等奖', '六等奖', '七等奖'];
const ratios = levelNames.map(() => []);
for (const d of NEW) {
  const sales = d.sales; if (!sales) continue;
  for (let i = 0; i < 7; i++) {
    const p = d.prizes.find((x) => x.name === levelNames[i]);
    if (p && p.count > 0) ratios[i].push(p.count / sales);
  }
}
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
console.log('\n各奖级 注数/销售额 中位数:');
const R = ratios.map(median);
levelNames.forEach((n, i) => console.log(' ', n, (R[i] * 1e6).toFixed(4), 'e-6', '样本', ratios[i].length));

// 设 P_k / P_3 = R_k / R_3，且 P_3 已知 (5+0)+(4+2)
const P3 = CP['5+0'] + CP['4+2'];
console.log('\nP(三等奖)=5+0+4+2 =', P3.toExponential(4));
console.log('推算 P_k (以三等奖为锚):');
const Pk = R.map((r) => r / R[2] * P3);
levelNames.forEach((n, i) => console.log(' ', n, Pk[i].toExponential(4), '≈1/' + Math.round(1 / Pk[i])));

console.log('\n理论组合候选（固定奖级匹配）：');
console.log('  L4 = 4+1      ->', CP['4+1'].toExponential(4), '推算', Pk[3].toExponential(4));
console.log('  L5 = 4+0+3+2  ->', (CP['4+0'] + CP['3+2']).toExponential(4), '推算', Pk[4].toExponential(4));

// L6 / L7 搜索最优划分：从剩余 6 个条件中分成两组
const rest = ['3+1', '2+2', '3+0', '1+2', '2+1', '0+2'];
const subsets = [];
for (let mask = 1; mask < 63; mask++) {
  const g = rest.filter((_, i) => mask & (1 << i));
  subsets.push(g);
}
let best = null;
for (const g6 of subsets) {
  const g7 = rest.filter((x) => !g6.includes(x));
  if (!g7.length) continue;
  const p6 = g6.reduce((s, k) => s + CP[k], 0);
  const p7 = g7.reduce((s, k) => s + CP[k], 0);
  const err = Math.abs(p6 / Pk[5] - 1) + Math.abs(p7 / Pk[6] - 1);
  if (!best || err < best.err) best = { g6, g7, p6, p7, err };
}
console.log('\n最优 L6/L7 划分:', best.g6.join(','), '|', best.g7.join(','));
console.log('  L6 概率', best.p6.toExponential(4), '推算', Pk[5].toExponential(4));
console.log('  L7 概率', best.p7.toExponential(4), '推算', Pk[6].toExponential(4));
console.log('  相对误差和', best.err.toFixed(3));

// 双色球奖级校验
const ssq = JSON.parse(await fs.readFile(new URL('../src/data/ssq.json', import.meta.url), 'utf8'));
const S = (n, k) => C(n, k);
const t33 = S(33, 6);
const ssqProb = {
  1: [ [6,1] ], 2: [ [6,0] ], 3: [ [5,1] ], 4: [ [5,0],[4,1] ], 5: [ [4,0],[3,1] ], 6: [ [2,1],[1,1],[0,1] ],
};
function ssqCond(r, b) {
  const red = S(6, r) * S(27, 6 - r) / t33;
  const blue = b === 1 ? 1 / 16 : 15 / 16;
  return red * blue;
}
console.log('\n双色球奖级概率校验 (理论 vs 实测注数/销售额中位数):');
const ssqR = {};
for (const d of ssq) {
  if (!d.sales) continue;
  for (const p of d.prizes) {
    (ssqR[p.level] ||= []).push(p.count / d.sales);
  }
}
for (let lv = 1; lv <= 6; lv++) {
  const theory = ssqProb[lv].reduce((s, [r, b]) => s + ssqCond(r, b), 0);
  const meas = median(ssqR[lv] || [0]);
  console.log(`  第${lv}等 理论${theory.toExponential(3)} 1/${Math.round(1/theory)} | 实测 ${meas.toExponential(3)} 1/${Math.round(1/meas)}`);
}
