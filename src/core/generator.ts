import { RULES } from './rules';
import type { GameKey } from './types';
import { RNG, weightedSample } from './rng';
import { comb } from './rules';
import type { ComboStats } from './stats';

export interface FilterConfig {
  sumMin: number;
  sumMax: number;
  oddMin: number;
  oddMax: number;
  bigMin: number;
  bigMax: number;
  maxConsecutive: number;
  minSpan: number;
}

/** 由历史真实分布推导结构过滤区间（取 10%-90% 分位，避免过窄或过宽） */
export function deriveFilters(key: GameKey, cs: ComboStats): FilterConfig {
  const rule = RULES[key];
  const mc = rule.mainCount;
  const oddSorted = [...cs.oddCount].sort((a, b) => a - b);
  const bigSorted = [...cs.bigCount].sort((a, b) => a - b);
  const q = (arr: number[], p: number) => arr[Math.min(arr.length - 1, Math.floor(p * arr.length))] ?? 0;
  return {
    sumMin: Math.floor(cs.sum.p10),
    sumMax: Math.ceil(cs.sum.p90),
    oddMin: Math.max(0, q(oddSorted, 0.1)),
    oddMax: Math.min(mc, q(oddSorted, 0.95)),
    bigMin: Math.max(0, q(bigSorted, 0.1)),
    bigMax: Math.min(mc, q(bigSorted, 0.95)),
    maxConsecutive: 2,
    minSpan: Math.round(cs.span.mean * 0.55),
  };
}

export interface GeneratedBet {
  main: number[];
  special: number[];
  /** 综合评分（越大越好） */
  score: number;
  tags: string[];
}

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

function maxRun(a: number[]): number {
  let best = 1, cur = 1;
  for (let i = 1; i < a.length; i++) {
    if (a[i] - a[i - 1] === 1) { cur++; best = Math.max(best, cur); } else cur = 1;
  }
  return best;
}

/** 大众化程度：越接近生日号 / 顺序号 / 全小，越容易被多人选择，独中时被摊薄 */
function popularityPenalty(main: number[]): number {
  let pen = 0;
  if (main.every((x) => x <= 31)) pen += 0.35;           // 生日号组合
  if (main.every((x) => x <= 16)) pen += 0.6;            // 全小号
  if (maxRun(main) >= 3) pen += 0.25 * (maxRun(main) - 2);
  const diffs = new Set<number>();
  for (let i = 1; i < main.length; i++) diffs.add(main[i] - main[i - 1]);
  if (diffs.size === 1) pen += 0.8;                      // 等差数列
  if (main[main.length - 1] - main[0] < 8) pen += 0.4;   // 过度集中
  return pen;
}

export interface GenerateParams {
  key: GameKey;
  probsMain: number[];
  probsSpecial: number[];
  filters: FilterConfig;
  count: number;
  rng: RNG;
  avoidPopular?: boolean;
  /** 每个号码的最小/最大入选概率控制，避免结果过度集中在少数号码 */
  candidates?: number;
}

/**
 * 生成单式推荐：
 * 1) 按概率加权的无放回采样生成候选池
 * 2) 结构过滤（和值 / 奇偶 / 大小 / 连号 / 跨度，区间取自真实历史分布）
 * 3) 按"对数概率 + 结构契合度 - 大众化惩罚"统一打分
 * 4) 贪心去重，保证多注之间号码多样性
 */
export function generateSingleBets(p: GenerateParams): GeneratedBet[] {
  const { key, probsMain, probsSpecial, filters, count, rng, avoidPopular = true, candidates = 4000 } = p;
  const rule = RULES[key];
  const mc = rule.mainCount;
  const mainNums = probsMain.map((_, i) => i + 1);
  const specNums = probsSpecial.map((_, i) => i + 1);
  const mainW = probsMain.map((x) => Math.pow(x, 2.2));
  const specW = probsSpecial.map((x) => Math.pow(x, 2.2));
  const avgMain = probsMain.reduce((a, b) => a + b, 0) / probsMain.length;
  const avgSpec = probsSpecial.reduce((a, b) => a + b, 0) / probsSpecial.length;

  const scored: GeneratedBet[] = [];
  const seen = new Set<string>();

  for (let iter = 0; iter < candidates; iter++) {
    const main = weightedSample(mainNums, mainW, mc, rng);
    if (main.length !== mc) continue;
    const key0 = main.join(',');
    if (seen.has(key0)) continue;
    seen.add(key0);

    const s = sum(main);
    if (s < filters.sumMin || s > filters.sumMax) continue;
    const odd = main.filter((x) => x % 2 === 1).length;
    if (odd < filters.oddMin || odd > filters.oddMax) continue;
    const mid = rule.mainMax / 2;
    const big = main.filter((x) => x > mid).length;
    if (big < filters.bigMin || big > filters.bigMax) continue;
    if (maxRun(main) > filters.maxConsecutive + 1) continue;
    if (main[main.length - 1] - main[0] < filters.minSpan) continue;

    let ll = 0;
    for (const n of main) ll += Math.log(probsMain[n - 1] / avgMain);
    // 结构契合度：和值越靠近历史中位、奇偶越均衡越好
    const odds = (odd / mc) - 0.5;
    const struct = Math.exp(-Math.pow((s - (filters.sumMin + filters.sumMax) / 2) / ((filters.sumMax - filters.sumMin) / 2 || 1), 2)) * 0.3
      - Math.abs(odds) * 0.6;

    const penalty = avoidPopular ? popularityPenalty(main) : 0;
    scored.push({ main, special: [], score: ll + struct - penalty, tags: [] });
  }

  scored.sort((a, b) => b.score - a.score);

  // 多样性选择
  const picked: GeneratedBet[] = [];
  for (const c of scored) {
    if (picked.length >= count) break;
    let overlapped = false;
    for (const q of picked) {
      const inter = c.main.filter((x) => q.main.includes(x)).length;
      if (inter > Math.max(2, mc - 3)) { overlapped = true; break; }
    }
    if (overlapped) continue;
    picked.push({ ...c });
  }
  // 候选不足时放宽多样性
  for (const c of scored) {
    if (picked.length >= count) break;
    if (!picked.some((q) => q.main.join() === c.main.join())) picked.push({ ...c });
  }

  // 后区 / 蓝球：优先取概率最高的组合，同时保证多注之间有变化
  for (let i = 0; i < picked.length; i++) {
    const spec = weightedSample(specNums, specW, rule.specialCount, rng);
    picked[i].special = spec.sort((a, b) => a - b);
  }
  void avgSpec;
  return picked;
}

export interface ComplexPick {
  main: number[];
  special: number[];
  bets: number;
  amount: number;
  mainSize: number;
  specialSize: number;
}

/** 复式推荐：取综合得分最高的号码组成号码池 */
export function recommendComplex(
  key: GameKey,
  probsMain: number[],
  probsSpecial: number[],
  mainSize: number,
  specialSize: number,
  append = false,
): ComplexPick {
  const rule = RULES[key];
  const main = probsMain
    .map((p, i) => ({ n: i + 1, p }))
    .sort((a, b) => b.p - a.p)
    .slice(0, mainSize)
    .map((x) => x.n)
    .sort((a, b) => a - b);
  const special = probsSpecial
    .map((p, i) => ({ n: i + 1, p }))
    .sort((a, b) => b.p - a.p)
    .slice(0, specialSize)
    .map((x) => x.n)
    .sort((a, b) => a - b);
  const bets = comb(mainSize, rule.mainCount) * comb(specialSize, rule.specialCount);
  const unit = rule.price + (append ? rule.extraPrice : 0);
  return { main, special, bets, amount: bets * unit, mainSize, specialSize };
}
