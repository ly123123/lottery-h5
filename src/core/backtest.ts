import type { Draw, GameKey } from './types';
import { RULES, levelsFor } from './rules';
import { scoreZone, uniformProbs, DEFAULT_WEIGHTS, type ModelWeights, type ModelId } from './models';
import { comboStats } from './stats';
import { deriveFilters, generateSingleBets } from './generator';
import { RNG } from './rng';
import { countHits, judgeBet } from './money';

export interface BacktestOptions {
  /** 回测起点（已积累的训练期数） */
  start?: number;
  /** 探针注数（每期生成几注参与判定） */
  betsPerDraw?: number;
  model?: ModelId | 'ensemble' | 'random';
  weights?: ModelWeights;
  seed?: number;
}

export interface BacktestResult {
  model: string;
  label: string;
  windows: number;
  /** 单注平均命中主区个数 */
  avgMainHit: number;
  /** 附加区命中率（单注完全命中概率） */
  specialRate: number;
  /** 中奖注次 / 总注次 */
  winRate: number;
  /** 各奖级中奖次数 */
  levels: Record<string, number>;
  /** 每 100 元投入的回报（元），仅按固定奖计算，浮动奖不计 */
  roiFixed: number;
  mainHitDist: number[];
  specialHitDist: number[];
  /** 与"当期开奖号固定、随机选号"基线的对比 */
  baselineAvgMainHit: number;
  baselineSpecialRate: number;
  /** 理论期望命中（超几何分布） */
  theoreticalMean: number;
  /** 平均命中的标准误 */
  standardError: number;
  /** z 分数：(实际 - 理论) / 标准误。|z| < 1.96 表示与随机无显著差异 */
  zScore: number;
  /** 参与统计的总注数 */
  totalBets: number;
}

const MODEL_NAME: Record<string, string> = {
  ensemble: '集成模型（5 模型加权）',
  ewma: '近期热度',
  bayes: '贝叶斯后验',
  gap: '遗漏回归',
  markov: '马尔可夫转移',
  ridge: '岭回归多因子',
  random: '完全随机（基线）',
};

export function runBacktest(draws: Draw[], key: GameKey, opts: BacktestOptions = {}): BacktestResult {
  const rule = RULES[key];
  const start = opts.start ?? Math.max(100, draws.length - 200);
  const betsPerDraw = opts.betsPerDraw ?? 1;
  const model = opts.model ?? 'ensemble';
  const weights = opts.weights ?? DEFAULT_WEIGHTS;
  const rng = new RNG(opts.seed ?? 20261115);

  let mainHitSum = 0, specialHitSum = 0, totalBets = 0, wins = 0;
  let fixedReturn = 0, cost = 0;
  const mainHitDist = new Array(rule.mainCount + 1).fill(0);
  const specialHitDist = new Array(rule.specialCount + 1).fill(0);
  const levels: Record<string, number> = {};
  let windows = 0;

  // 随机基线：每期用同样期数的历史随机选号（蒙特卡洛 120 次）
  let baseMain = 0, baseSpecial = 0, baseN = 0;

  for (let t = start; t < draws.length; t++) {
    const train = draws.slice(0, t);
    const actual = draws[t];
    const cs = comboStats(train, key);
    const filters = deriveFilters(key, cs);
    windows++;

    let probsMain: number[], probsSpecial: number[];
    if (model === 'random') {
      probsMain = uniformProbs(key, 'main');
      probsSpecial = uniformProbs(key, 'special');
    } else if (model === 'ensemble') {
      const sm = scoreZone(train, key, 'main', { weights });
      const ss = scoreZone(train, key, 'special', { weights });
      probsMain = sm.probs; probsSpecial = ss.probs;
    } else {
      const w: ModelWeights = { ewma: 0, bayes: 0, gap: 0, markov: 0, ridge: 0 };
      w[model] = 1;
      probsMain = scoreZone(train, key, 'main', { weights: w }).probs;
      probsSpecial = scoreZone(train, key, 'special', { weights: w }).probs;
    }

    const bets = generateSingleBets({
      key, probsMain, probsSpecial, filters,
      count: betsPerDraw, rng, candidates: 600,
    });

    for (const b of bets) {
      totalBets++;
      cost += rule.price;
      const { mainHit, specialHit } = countHits(b, actual);
      mainHitSum += mainHit;
      specialHitSum += specialHit;
      mainHitDist[mainHit]++;
      specialHitDist[specialHit]++;
      const lv = levelsFor(rule, actual.code);
      const hit = judgeBet(lv, mainHit, specialHit, false);
      if (hit.level) {
        wins++;
        levels[hit.levelName ?? String(hit.level)] = (levels[hit.levelName ?? String(hit.level)] ?? 0) + 1;
        if (hit.unitMoney != null) fixedReturn += hit.unitMoney;
      }
    }

    // 基线：同一期开奖号，用均匀随机生成同样注数
    const rp = uniformProbs(key, 'main');
    const rs = uniformProbs(key, 'special');
    const rb = generateSingleBets({
      key, probsMain: rp, probsSpecial: rs, filters, count: betsPerDraw, rng: new RNG(t * 7919 + 13), candidates: 300,
    });
    for (const b of rb) {
      const { mainHit, specialHit } = countHits(b, actual);
      baseMain += mainHit;
      baseSpecial += specialHit;
      baseN++;
    }
  }

  const N = rule.mainMax, K = rule.mainCount;
  const theoreticalMean = (K * K) / N;
  const variance = K * (K / N) * (1 - K / N) * ((N - K) / (N - 1));
  const standardError = totalBets > 0 ? Math.sqrt(variance / totalBets) : 0;
  const avgMainHit = totalBets ? mainHitSum / totalBets : 0;
  const zScore = standardError > 0 ? (avgMainHit - theoreticalMean) / standardError : 0;

  return {
    model,
    label: MODEL_NAME[model] ?? model,
    windows,
    totalBets, theoreticalMean, standardError, zScore,
    avgMainHit,
    specialRate: totalBets ? specialHitSum / totalBets / rule.specialCount : 0,
    winRate: totalBets ? wins / totalBets : 0,
    levels,
    roiFixed: cost ? (fixedReturn / cost) * 100 : 0,
    mainHitDist,
    specialHitDist,
    baselineAvgMainHit: baseN ? baseMain / baseN : 0,
    baselineSpecialRate: baseN ? baseSpecial / baseN / rule.specialCount : 0,
  };
}

/** 理论基线：单注随机选号的平均命中（超几何期望） */
export function theoreticalBaseline(key: GameKey) {
  const rule = RULES[key];
  return {
    avgMainHit: rule.mainCount * rule.mainCount / rule.mainMax,
    specialRate: 1 / rule.specialMax,
  };
}
