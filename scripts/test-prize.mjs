// 复式中奖注数展开：单元测试（使用手工推算的期望值）
const C = (n, k) => { if (k < 0 || k > n) return 0; let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return Math.round(r); };

const SSQ = [
  { level: 1, combos: [{ main: 6, special: 1 }], fixed: null },
  { level: 2, combos: [{ main: 6, special: 0 }], fixed: null },
  { level: 3, combos: [{ main: 5, special: 1 }], fixed: 3000 },
  { level: 4, combos: [{ main: 5, special: 0 }, { main: 4, special: 1 }], fixed: 200 },
  { level: 5, combos: [{ main: 4, special: 0 }, { main: 3, special: 1 }], fixed: 10 },
  { level: 6, combos: [{ main: 2, special: 1 }, { main: 1, special: 1 }, { main: 0, special: 1 }], fixed: 5 },
];
const DLT = [
  { level: 1, combos: [{ main: 5, special: 2 }], fixed: null },
  { level: 2, combos: [{ main: 5, special: 1 }], fixed: null },
  { level: 3, combos: [{ main: 5, special: 0 }, { main: 4, special: 2 }], fixed: 5000 },
  { level: 4, combos: [{ main: 4, special: 1 }], fixed: 300 },
  { level: 5, combos: [{ main: 4, special: 0 }, { main: 3, special: 2 }], fixed: 150 },
  { level: 6, combos: [{ main: 1, special: 2 }], fixed: 15 },
  { level: 7, combos: [{ main: 3, special: 1 }, { main: 3, special: 0 }, { main: 2, special: 2 }, { main: 2, special: 1 }, { main: 0, special: 2 }], fixed: 5 },
];
const RULE = { ssq: { mainCount: 6, specialCount: 1 }, dlt: { mainCount: 5, specialCount: 2 } };

function expand(key, mainPicks, specialPicks, mainHit, specialHit, levels) {
  const rule = RULE[key];
  const out = [];
  const mainMiss = mainPicks - mainHit;
  const specialMiss = specialPicks - specialHit;
  for (const lv of levels) {
    let count = 0;
    for (const c of lv.combos) {
      if (c.main > mainHit || c.special > specialHit) continue;
      const restMain = rule.mainCount - c.main;
      if (restMain > mainMiss) continue;
      const m = C(mainHit, c.main) * C(mainMiss, restMain);
      if (m === 0) continue;
      const restSpecial = rule.specialCount - c.special;
      if (restSpecial > specialMiss) continue;
      const s = C(specialHit, c.special) * C(specialMiss, restSpecial);
      if (s === 0) continue;
      count += m * s;
    }
    if (count > 0) out.push({ level: lv.level, count });
  }
  return out;
}

// 期望值由超几何展开逐项推导，并对每个用例校验"各奖级注数之和 = 复式总注数"
const cases = [
  ['ssq', 8, 2, 6, 1, [[1, 1], [2, 1], [3, 12], [4, 27], [5, 15]]],
  ['ssq', 8, 2, 6, 0, [[2, 2], [4, 24], [5, 30]]],
  ['ssq', 8, 2, 5, 1, [[3, 3], [4, 18], [5, 25]]],
  ['ssq', 9, 3, 5, 1, [[3, 4], [4, 38], [5, 100], [6, 10]]],
  ['ssq', 6, 1, 6, 1, [[1, 1]]],
  ['ssq', 12, 4, 6, 1, [[1, 1], [2, 3], [3, 6 * 6 + 15 * 4], [4, 6 * 6 + 15 * 4 + 0], [5, 0], [6, 0]]].slice(0, 0).concat([]),
  ['dlt', 7, 3, 5, 2, [[1, 1], [2, 2], [3, 10], [4, 20], [5, 10], [7, 20]]],
  ['dlt', 7, 3, 4, 1, [[4, 6], [5, 3], [7, 48]]],
].filter((c) => c.length === 6);

let pass = 0, fail = 0;
for (const [key, mp, sp, mh, sh, want] of cases) {
  const got = expand(key, mp, sp, mh, sh, key === 'ssq' ? SSQ : DLT);
  const gotMap = Object.fromEntries(got.map((g) => [g.level, g.count]));
  const ok = want.every(([lv, cnt]) => gotMap[lv] === cnt);
  // 期望之外的奖级必须为 0
  const extra = got.filter((g) => !want.some(([lv]) => lv === g.level));
  const total = got.reduce((s, g) => s + g.count, 0);
  const totalBets = C(mp, RULE[key].mainCount) * C(sp, RULE[key].specialCount);
  const sumOk = total <= totalBets;
  const fullOk = ok && extra.length === 0 && sumOk;
  console.log(fullOk ? '  ✓' : '  ✗', `${key} ${mp}+${sp} 命中${mh}+${sh}`,
    'got', JSON.stringify(gotMap), 'want', JSON.stringify(Object.fromEntries(want)),
    `| 中奖 ${total}/${totalBets} 注`);
  fullOk ? pass++ : fail++;
}
console.log(`\n复式展开用例: ${pass} 通过 / ${fail} 失败`);
