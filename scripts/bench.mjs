import { readFileSync } from 'node:fs';
const raw = JSON.parse(readFileSync(new URL('../src/data/draws.json', import.meta.url), 'utf8'));
const { runBacktest } = await import('/tmp/bt.mjs');
const { scoreZone } = await import('/tmp/models.mjs');

const toDraws = (rows) => rows.map((r) => ({ code: r[0], date: r[1], main: r[2], special: r[3], sales: r[4], pool: r[5] }));

for (const key of ['ssq', 'dlt']) {
  const draws = toDraws(key === 'ssq' ? raw.ssq : raw.dlt);
  console.log('\n=== ' + key + ' / ' + draws.length + ' 期 ===');

  let t0 = performance.now();
  const s = scoreZone(draws, key, 'main');
  console.log('  单次 scoreZone(main):', (performance.now() - t0).toFixed(0), 'ms');
  const sum = s.probs.reduce((a, b) => a + b, 0);
  console.log('  概率和 =', sum.toFixed(4), '(应等于主区个数)');

  const models = ['ensemble', 'ewma', 'bayes', 'gap', 'markov', 'ridge', 'random'];
  for (const m of models) {
    t0 = performance.now();
    const r = runBacktest(draws, key, { model: m, betsPerDraw: 1, seed: 20261115 });
    const ms = performance.now() - t0;
    console.log(`  ${m.padEnd(9)} ${ms.toFixed(0).padStart(6)}ms  窗口${String(r.windows).padStart(3)}  平均命中 ${r.avgMainHit.toFixed(3)}  z=${r.zScore.toFixed(2).padStart(6)}  中奖率 ${(r.winRate*100).toFixed(2)}%  基线 ${r.baselineAvgMainHit.toFixed(3)}`);
  }
}
