import type { Draw, GameKey, GameRule, PrizeLevel, RawDLT, RawSSQ } from './types';

/** 双色球 6 个奖级，2015 年至今未变 */
const SSQ_LEVELS: PrizeLevel[] = [
  { level: 1, name: '一等奖', combos: [{ main: 6, special: 1 }], fixed: null, note: '浮动奖（奖池分配，单注上限 500 万元）' },
  { level: 2, name: '二等奖', combos: [{ main: 6, special: 0 }], fixed: null, note: '浮动奖' },
  { level: 3, name: '三等奖', combos: [{ main: 5, special: 1 }], fixed: 3000 },
  { level: 4, name: '四等奖', combos: [{ main: 5, special: 0 }, { main: 4, special: 1 }], fixed: 200 },
  { level: 5, name: '五等奖', combos: [{ main: 4, special: 0 }, { main: 3, special: 1 }], fixed: 10 },
  { level: 6, name: '六等奖', combos: [{ main: 2, special: 1 }, { main: 1, special: 1 }, { main: 0, special: 1 }], fixed: 5 },
];

/**
 * 超级大乐透现行规则（2026-02-02 第 26014 期起）：
 * 13 个中奖条件保持不变，9 个奖级合并为 7 个。
 * 三等奖 = 5+0 与 4+2；五等奖 = 4+0 与 3+2。
 * 本映射已用 117 期真实开奖数据的各奖级中奖注数反解校验：
 * 各级中奖概率与理论值的相对误差在 6% 以内；七等奖中奖率 1/16.8，与官方公布的 1/16.6 吻合。
 */
const DLT_LEVELS_NEW: PrizeLevel[] = [
  { level: 1, name: '一等奖', combos: [{ main: 5, special: 2 }], fixed: null, note: '浮动奖，单注上限 1000 万元（追加 1800 万元）' },
  { level: 2, name: '二等奖', combos: [{ main: 5, special: 1 }], fixed: null, note: '浮动奖' },
  { level: 3, name: '三等奖', combos: [{ main: 5, special: 0 }, { main: 4, special: 2 }], fixed: 5000, boosted: 6666 },
  { level: 4, name: '四等奖', combos: [{ main: 4, special: 1 }], fixed: 300, boosted: 380 },
  { level: 5, name: '五等奖', combos: [{ main: 4, special: 0 }, { main: 3, special: 2 }], fixed: 150, boosted: 200 },
  { level: 6, name: '六等奖', combos: [{ main: 1, special: 2 }], fixed: 15, boosted: 18 },
  {
    level: 7, name: '七等奖',
    combos: [{ main: 3, special: 1 }, { main: 3, special: 0 }, { main: 2, special: 2 }, { main: 2, special: 1 }, { main: 0, special: 2 }],
    fixed: 5, boosted: 7,
  },
];

/** 大乐透历史规则（9 奖级），用于 2026-02-02 之前的历史回测校验 */
const DLT_LEVELS_LEGACY: PrizeLevel[] = [
  { level: 1, name: '一等奖', combos: [{ main: 5, special: 2 }], fixed: null },
  { level: 2, name: '二等奖', combos: [{ main: 5, special: 1 }], fixed: null },
  { level: 3, name: '三等奖', combos: [{ main: 5, special: 0 }], fixed: 10000 },
  { level: 4, name: '四等奖', combos: [{ main: 4, special: 2 }], fixed: 3000 },
  { level: 5, name: '五等奖', combos: [{ main: 4, special: 1 }], fixed: 300 },
  { level: 6, name: '六等奖', combos: [{ main: 3, special: 2 }], fixed: 200 },
  { level: 7, name: '七等奖', combos: [{ main: 4, special: 0 }], fixed: 100 },
  { level: 8, name: '八等奖', combos: [{ main: 3, special: 1 }, { main: 2, special: 2 }], fixed: 15 },
  { level: 9, name: '九等奖', combos: [{ main: 3, special: 0 }, { main: 1, special: 2 }, { main: 2, special: 1 }, { main: 0, special: 2 }], fixed: 5 },
];

export const RULES: Record<GameKey, GameRule> = {
  ssq: {
    key: 'ssq', name: '双色球', shortName: '双色球',
    mainCount: 6, mainMax: 33, specialCount: 1, specialMax: 16,
    price: 2, extraPrice: 0, maxAmount: 20000, maxMultiple: 99, maxBets: 10000,
    maxMainPick: 20, maxSpecialPick: 16,
    levels: SSQ_LEVELS,
  },
  dlt: {
    key: 'dlt', name: '超级大乐透', shortName: '大乐透',
    mainCount: 5, mainMax: 35, specialCount: 2, specialMax: 12,
    price: 2, extraPrice: 1, maxAmount: 20000, maxMultiple: 99, maxBets: 10000,
    maxMainPick: 18, maxSpecialPick: 12,
    levels: DLT_LEVELS_NEW,
    legacyLevels: DLT_LEVELS_LEGACY,
    ruleChangeCode: '26014',
  },
};

/** 组合数 C(n, k)，n ≤ 35 时结果完全落在 Number 安全整数范围内 */
export function comb(n: number, k: number): number {
  if (k < 0 || k > n || n < 0) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
}

export function normalizeSSQ(raw: RawSSQ[]): Draw[] {
  return raw.map((d) => ({
    code: d.code, date: d.date,
    main: [...d.red].sort((a, b) => a - b),
    special: [d.blue],
    sales: d.sales, pool: d.pool,
  })).sort((a, b) => (a.code < b.code ? -1 : 1));
}

export function normalizeDLT(raw: RawDLT[]): Draw[] {
  return raw.map((d) => ({
    code: d.code, date: d.date,
    main: [...d.front].sort((a, b) => a - b),
    special: [...d.back].sort((a, b) => a - b),
    sales: d.sales, pool: d.pool,
  })).sort((a, b) => (a.code < b.code ? -1 : 1));
}

/** 历史某期适用的奖级表 */
export function levelsFor(rule: GameRule, code: string): PrizeLevel[] {
  if (rule.legacyLevels && rule.ruleChangeCode && Number(code) < Number(rule.ruleChangeCode)) {
    return rule.legacyLevels;
  }
  return rule.levels;
}
