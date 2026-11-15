import { RULES } from './rules';
import { numberStats, type NumberStat } from './stats';
import type { Draw, GameKey } from './types';

export type ModelId = 'ewma' | 'bayes' | 'gap' | 'markov' | 'ridge';

export const MODEL_LABEL: Record<ModelId, string> = {
  ewma: '近期热度（指数加权）',
  bayes: '贝叶斯后验频率',
  gap: '遗漏回归',
  markov: '马尔可夫转移',
  ridge: '岭回归多因子',
};

export interface ModelWeights { ewma: number; bayes: number; gap: number; markov: number; ridge: number }

export const DEFAULT_WEIGHTS: ModelWeights = { ewma: 0.3, bayes: 0.26, gap: 0.16, markov: 0.1, ridge: 0.18 };

const EPS = 1e-9;

function normalize(arr: number[]): number[] {
  const sum = arr.reduce((a, b) => a + b, 0) || 1;
  return arr.map((x) => x / sum);
}

/** 5×5 线性方程组求解（高斯消元），用于岭回归闭式解 */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-12) continue;
    [M[c], M[piv]] = [M[piv], M[c]];
    const d = M[c][c];
    for (let j = c; j <= n; j++) M[c][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c];
      if (f === 0) continue;
      for (let j = c; j <= n; j++) M[r][j] -= f * M[c][j];
    }
  }
  return M.map((row) => row[n]);
}

/**
 * 岭回归多因子模型（增量特征构造，O(n × 号码数)）：
 * 对每个号码在每一期开奖前构造 [近期热度, 遗漏比, 趋势, 30期频率, 遗漏程度] 五项特征，
 * 标签为该期是否开出；岭回归闭式解得到权重，再对"当前状态"打分。
 */
function ridgeScores(draws: Draw[], key: GameKey, zone: 'main' | 'special', maxOmission: number, lookback = 100): number[] {
  const rule = RULES[key];
  const max = zone === 'main' ? rule.mainMax : rule.specialMax;
  const per = zone === 'main' ? rule.mainCount : rule.specialCount;
  const n = draws.length;
  const avgFreq = per / max;
  const alpha = 1 - Math.exp(-Math.LN2 / 25);
  const from = Math.max(1, n - lookback);

  const ewma = new Array(max + 1).fill(0);
  const omission = new Array(max + 1).fill(0);
  const counts = new Array(max + 1).fill(0);
  const window30: Set<number>[] = [];
  const feats: number[][] = [];
  const labels: number[] = [];

  const pushSample = (t: number) => {
    if (t < from) return;
    const span = Math.min(30, t) || 1;
    for (let num = 1; num <= max; num++) {
      const avgGap = counts[num] > 0 ? t / counts[num] : t || 1;
      const gapRatio = Math.min(4, omission[num] / Math.max(1, avgGap));
      let c30 = 0;
      for (const s of window30) if (s.has(num)) c30++;
      feats.push([
        ewma[num] / avgFreq,
        gapRatio,
        Math.min(3, Math.max(-3, (c30 / span - avgFreq) / avgFreq)),
        c30 / span / avgFreq,
        Math.min(1, omission[num] / Math.max(10, maxOmission)),
      ]);
      labels.push(draws[t][zone].includes(num) ? 1 : 0);
    }
  };

  for (let t = 0; t < n; t++) {
    pushSample(t);
    const present = new Set(draws[t][zone]);
    for (let num = 1; num <= max; num++) {
      if (present.has(num)) { ewma[num] = ewma[num] * (1 - alpha) + alpha; omission[num] = 0; counts[num]++; }
      else { ewma[num] *= (1 - alpha); omission[num]++; }
    }
    window30.push(present);
    if (window30.length > 30) window30.shift();
  }
  // 当前状态（下一期开奖前）
  pushSample(n);

  const m = labels.length;
  if (m === 0) return new Array(max).fill(avgFreq);

  const d = 5;
  const XtX = Array.from({ length: d }, () => new Array(d).fill(0));
  const Xty = new Array(d).fill(0);
  for (let r = 0; r < m; r++) {
    const x = feats[r]; const y = labels[r];
    for (let a = 0; a < d; a++) {
      Xty[a] += x[a] * y;
      for (let b = 0; b < d; b++) XtX[a][b] += x[a] * x[b];
    }
  }
  const lambda = 20;
  for (let a = 0; a < d; a++) XtX[a][a] += lambda;
  const w = solve(XtX, Xty);

  const last = feats.slice(-max);
  return last.map((x) => {
    let z = 0;
    for (let a = 0; a < d; a++) z += x[a] * w[a];
    return 1 / (1 + Math.exp(-z));
  });
}

export interface ZoneScore {
  /** 每个号码的最终概率（Σ = 该分区应出现个数） */
  probs: number[];
  /** 各模型独立给出的归一化概率，用于展示 */
  parts: Record<ModelId, number[]>;
  stats: NumberStat[];
}

export interface ScoreOptions {
  weights?: ModelWeights;
  /** 温度：1 为默认，越大越集中 */
  temperature?: number;
}

/**
 * 集成打分：输出每个号码"下期出现"的相对概率。
 * 说明：彩票每期独立随机，任何模型都无法真正提高命中率；
 * 此处输出的是统计意义上的相对倾向，用于选号排序与组合构造。
 */
export function scoreZone(
  draws: Draw[],
  key: GameKey,
  zone: 'main' | 'special',
  opts: ScoreOptions = {},
): ZoneScore {
  const rule = RULES[key];
  const max = zone === 'main' ? rule.mainMax : rule.specialMax;
  const per = zone === 'main' ? rule.mainCount : rule.specialCount;
  const weights = opts.weights ?? DEFAULT_WEIGHTS;
  const T = opts.temperature ?? 1;

  const stats = numberStats(draws, key, zone);
  const n = draws.length || 1;

  // M1 指数加权热度
  const m1 = stats.map((s) => s.ewma + 1e-4);

  // M2 贝叶斯后验（Beta(1,1) 平滑）
  const m2 = stats.map((s) => (s.count + 1.2) / (n + 1.2 * max));

  // M3 遗漏回归：遗漏比大于 1 的给予温和加成，避免过度自信
  const m3 = stats.map((s) => {
    const g = Math.min(2.2, Math.max(-0.7, s.gapRatio - 1));
    return Math.exp(0.25 * g);
  });

  // M4 一阶马尔可夫：用全历史估计 P(出现|上期出现) 与 P(出现|上期未出现)
  let hitHit = 0, hitAll = 0, missHit = 0, missAll = 0;
  for (let t = 1; t < n; t++) {
    for (let num = 1; num <= max; num++) {
      const prev = draws[t - 1][zone].includes(num);
      const cur = draws[t][zone].includes(num);
      if (prev) { hitAll++; if (cur) hitHit++; } else { missAll++; if (cur) missHit++; }
    }
  }
  const pHit = hitAll ? hitHit / hitAll : per / max;
  const pMiss = missAll ? missHit / missAll : per / max;
  const m4 = stats.map((s) => (s.lastSeen === 0 ? pHit : pMiss) + 1e-4);

  // M5 岭回归多因子
  const maxOmission = Math.max(10, ...stats.map((s) => s.omission));
  let m5raw: number[];
  try { m5raw = ridgeScores(draws, key, zone, maxOmission); } catch { m5raw = stats.map(() => 0.5); }
  const m5 = m5raw.map((x) => x + 1e-4);

  const partsArr: Record<ModelId, number[]> = { ewma: m1, bayes: m2, gap: m3, markov: m4, ridge: m5 };
  const parts = {} as Record<ModelId, number[]>;
  for (const k of Object.keys(partsArr) as ModelId[]) parts[k] = normalize(partsArr[k]).map((x) => x * per);

  // 集成：先各自归一化到"每号平均概率"，再加权几何平均，最后还原总量
  const target = per / max;
  const logScores = new Array(max).fill(0);
  const wsum = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  for (const k of Object.keys(partsArr) as ModelId[]) {
    const arr = partsArr[k];
    const sum = arr.reduce((a, b) => a + b, 0) || 1;
    const w = weights[k] / wsum;
    for (let i = 0; i < max; i++) {
      const p = Math.max(1e-9, (arr[i] / sum) / target);
      logScores[i] += w * Math.log(p) * T;
    }
  }
  const raw = logScores.map((x) => Math.exp(x));
  const s = raw.reduce((a, b) => a + b, 0) || 1;
  const probs = raw.map((x) => (x / s) * per);

  return { probs, parts, stats };
}

/** 均匀随机基线概率（作为对照） */
export function uniformProbs(key: GameKey, zone: 'main' | 'special'): number[] {
  const rule = RULES[key];
  const max = zone === 'main' ? rule.mainMax : rule.specialMax;
  const per = zone === 'main' ? rule.mainCount : rule.specialCount;
  return new Array(max).fill(per / max);
}