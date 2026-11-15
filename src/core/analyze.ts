import type { Draw, GameKey } from './types';
import { RULES, comb } from './rules';
import { comboStats, distribution, hotCold, numberStats, type NumberStat } from './stats';

export interface Analysis {
  key: GameKey;
  total: number;
  firstCode: string;
  lastCode: string;
  firstDate: string;
  lastDate: string;
  mainStats: NumberStat[];
  specialStats: NumberStat[];
  hot: number[];
  cold: number[];
  sum: ReturnType<typeof comboStats>['sum'];
  span: ReturnType<typeof comboStats>['span'];
  acMean: number;
  oddDist: { value: number; count: number; ratio: number }[];
  bigDist: { value: number; count: number; ratio: number }[];
  zoneDist: { zone: number; avg: number; values: number[] }[];
  consecDist: { value: number; count: number; ratio: number }[];
  repeatDist: { value: number; count: number; ratio: number }[];
  tailDist: { value: number; count: number; ratio: number }[];
  sumHist: { bucket: number; count: number }[];
  recent: Draw[];
  /** 各奖级理论中奖概率（基于规则严格计算） */
  prizeProb: { level: number; name: string; prob: number; oneIn: number; fixed: number | null }[];
}

function tail(x: number) { return x % 10; }

export function analyze(draws: Draw[], key: GameKey): Analysis {
  const rule = RULES[key];
  const cs = comboStats(draws, key);
  const mainStats = numberStats(draws, key, 'main');
  const specialStats = numberStats(draws, key, 'special');
  const hc = hotCold(mainStats, 30);

  const tails: number[] = [];
  for (const d of draws) for (const n of d.main) tails.push(tail(n));

  const zoneSize = Math.ceil(rule.mainMax / 3);
  const zoneDist = [0, 1, 2].map((z) => ({
    zone: z + 1,
    avg: cs.zoneRatio[z].reduce((a, b) => a + b, 0) / draws.length,
    values: cs.zoneRatio[z],
  }));

  // 各奖级理论概率
  const totalAll = comb(rule.mainMax, rule.mainCount) * comb(rule.specialMax, rule.specialCount);
  const prizeProb = rule.levels.map((lv) => {
    let hits = 0;
    for (const c of lv.combos) {
      hits += comb(rule.mainCount, c.main) * comb(rule.mainMax - rule.mainCount, rule.mainCount - c.main)
        * comb(rule.specialCount, c.special) * comb(rule.specialMax - rule.specialCount, rule.specialCount - c.special);
    }
    return { level: lv.level, name: lv.name, prob: hits / totalAll, oneIn: totalAll / hits, fixed: lv.fixed };
  });

  return {
    key,
    total: draws.length,
    firstCode: draws[0].code, lastCode: draws[draws.length - 1].code,
    firstDate: draws[0].date, lastDate: draws[draws.length - 1].date,
    mainStats, specialStats, hot: hc.hot, cold: hc.cold,
    sum: cs.sum, span: cs.span, acMean: cs.ac.mean,
    oddDist: distribution(cs.oddCount),
    bigDist: distribution(cs.bigCount),
    zoneDist,
    consecDist: distribution(cs.consecutive),
    repeatDist: distribution(cs.repeatWithPrev),
    tailDist: distribution(tails),
    sumHist: cs.sumDistribution,
    recent: draws.slice(-12).reverse(),
    prizeProb,
  };
}

export const ZONE_LABEL = (key: GameKey) => {
  const rule = RULES[key];
  const size = Math.ceil(rule.mainMax / 3);
  return [
    `${1}-${size}`,
    `${size + 1}-${size * 2}`,
    `${size * 2 + 1}-${rule.mainMax}`,
  ];
};
