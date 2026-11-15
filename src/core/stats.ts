import type { Draw, GameKey } from './types';
import { RULES } from './rules';

/** 单个号码的统计特征 */
export interface NumberStat {
  num: number;
  count: number;
  freq: number;
  count30: number;
  count60: number;
  count120: number;
  /** 指数加权频率（半衰期 25 期），反映近期热度 */
  ewma: number;
  /** 当前遗漏：最新一期为 0 */
  omission: number;
  avgGap: number;
  maxGap: number;
  /** 遗漏/平均遗漏，>1 表示"该出未出" */
  gapRatio: number;
  /** 近 12 期频率 - 近 60 期频率，趋势动量 */
  trend: number;
  /** 是否在最近一期出现 */
  lastSeen: number;
}

export interface ZoneStat { label: string; range: string; count: number; ratio: number }

const HALF_LIFE = 25;

export function numberStats(draws: Draw[], key: GameKey, zone: 'main' | 'special'): NumberStat[] {
  const rule = RULES[key];
  const max = zone === 'main' ? rule.mainMax : rule.specialMax;
  const per = zone === 'main' ? rule.mainCount : rule.specialCount;
  const n = draws.length;

  const stats: NumberStat[] = [];
  const alpha = 1 - Math.exp(-Math.LN2 / HALF_LIFE);

  for (let num = 1; num <= max; num++) {
    let count = 0, count30 = 0, count60 = 0, count120 = 0;
    let ewma = 0;
    let lastIdx = -1;
    const gaps: number[] = [];
    let prevIdx = -1;

    for (let i = 0; i < n; i++) {
      const hit = draws[i][zone].includes(num);
      const weight = Math.exp(-(n - 1 - i) * Math.LN2 / HALF_LIFE);
      if (hit) {
        count++;
        ewma = ewma * (1 - alpha) + 1 * alpha;
        if (i >= n - 30) count30++;
        if (i >= n - 60) count60++;
        if (i >= n - 120) count120++;
        if (lastIdx >= 0) gaps.push(i - lastIdx);
        else if (prevIdx === -1) prevIdx = i;
        lastIdx = i;
      } else {
        ewma = ewma * (1 - alpha);
      }
    }
    // 当前遗漏：从最新一期往回数
    let omission = 0;
    for (let i = n - 1; i >= 0; i--) {
      if (draws[i][zone].includes(num)) break;
      omission++;
    }
    const avgGap = count > 0 ? n / count : n;
    const maxGap = gaps.length ? Math.max(...gaps) : n;
    const recent12 = draws.slice(Math.max(0, n - 12)).filter((d) => d[zone].includes(num)).length;
    const recent60 = draws.slice(Math.max(0, n - 60)).filter((d) => d[zone].includes(num)).length;

    stats.push({
      num,
      count,
      freq: count / n,
      count30, count60, count120,
      ewma,
      omission,
      avgGap,
      maxGap,
      gapRatio: avgGap > 0 ? omission / avgGap : 1,
      trend: recent12 / Math.min(12, n) - recent60 / Math.min(60, n),
      lastSeen: lastIdx < 0 ? -1 : n - 1 - lastIdx,
    });
  }
  void per;
  return stats;
}

export interface ComboStats {
  sum: { min: number; max: number; mean: number; median: number; p10: number; p90: number };
  oddCount: number[];
  bigCount: number[];
  span: { mean: number; min: number; max: number };
  zoneRatio: number[][];
  ac: { mean: number };
  consecutive: number[];
  repeatWithPrev: number[];
  sumDistribution: { bucket: number; count: number }[];
}

export function comboStats(draws: Draw[], key: GameKey): ComboStats {
  const rule = RULES[key];
  const mainMax = rule.mainMax;
  const zoneCount = 3;
  const zoneSize = Math.ceil(mainMax / zoneCount);
  const sums: number[] = [];
  const odd: number[] = [];
  const big: number[] = [];
  const spans: number[] = [];
  const zones: number[][] = [[], [], []];
  const acs: number[] = [];
  const consec: number[] = [];
  const repeats: number[] = [];

  const mid = mainMax / 2;
  const q = (arr: number[], p: number) => {
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0;
  };

  for (let i = 0; i < draws.length; i++) {
    const d = draws[i];
    sums.push(d.main.reduce((a, b) => a + b, 0));
    odd.push(d.main.filter((x) => x % 2 === 1).length);
    big.push(d.main.filter((x) => x > mid).length);
    spans.push(d.main[d.main.length - 1] - d.main[0]);
    const zc = [0, 0, 0];
    for (const x of d.main) zc[Math.min(2, Math.floor((x - 1) / zoneSize))]++;
    zc.forEach((c, k) => zones[k].push(c));
    // AC 值 = 不同差值个数 - (号码个数 - 1)
    const diffs = new Set<number>();
    for (let a = 0; a < d.main.length; a++) for (let b = a + 1; b < d.main.length; b++) diffs.add(d.main[b] - d.main[a]);
    acs.push(diffs.size - (d.main.length - 1));
    let run = 0;
    for (let a = 1; a < d.main.length; a++) if (d.main[a] - d.main[a - 1] === 1) run++;
    consec.push(run);
    if (i > 0) {
      const prev = new Set(draws[i - 1].main);
      repeats.push(d.main.filter((x) => prev.has(x)).length);
    }
  }

  const buckets = new Map<number, number>();
  for (const s of sums) {
    const b = Math.floor(s / 10) * 10;
    buckets.set(b, (buckets.get(b) ?? 0) + 1);
  }

  return {
    sum: {
      min: Math.min(...sums), max: Math.max(...sums),
      mean: sums.reduce((a, b) => a + b, 0) / sums.length,
      median: q(sums, 0.5), p10: q(sums, 0.1), p90: q(sums, 0.9),
    },
    oddCount: odd, bigCount: big,
    span: { mean: spans.reduce((a, b) => a + b, 0) / spans.length, min: Math.min(...spans), max: Math.max(...spans) },
    zoneRatio: zones,
    ac: { mean: acs.reduce((a, b) => a + b, 0) / acs.length },
    consecutive: consec,
    repeatWithPrev: repeats,
    sumDistribution: [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([bucket, count]) => ({ bucket, count })),
  };
}

export function distribution(arr: number[]): { value: number; count: number; ratio: number }[] {
  const m = new Map<number, number>();
  for (const x of arr) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([value, count]) => ({ value, count, ratio: count / arr.length }));
}

/** 号码热度分级：近 30 期出现次数 */
export function hotCold(stats: NumberStat[], n = 30): { hot: number[]; cold: number[]; warm: number[] } {
  const sorted = [...stats].sort((a, b) => (b.count30 - a.count30) || (a.omission - b.omission));
  const k = Math.max(3, Math.round(stats.length * 0.25));
  return {
    hot: sorted.slice(0, k).map((s) => s.num).sort((a, b) => a - b),
    cold: sorted.slice(-k).map((s) => s.num).sort((a, b) => a - b),
    warm: sorted.slice(k, -k).map((s) => s.num).sort((a, b) => a - b),
  };
}
