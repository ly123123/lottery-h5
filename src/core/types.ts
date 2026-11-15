export type GameKey = 'ssq' | 'dlt';

/** 统一后的开奖记录：main = 双色球红球 / 大乐透前区，special = 蓝球 / 后区 */
export interface Draw {
  code: string;
  date: string;
  main: number[];
  special: number[];
  sales: number;
  pool: number;
}

export interface RawSSQ {
  code: string; date: string; red: number[]; blue: number;
  sales: number; pool: number;
  prizes: { level: number; count: number; money: number }[];
}

export interface RawDLT {
  code: string; date: string; front: number[]; back: number[];
  sales: number; pool: number;
  prizes: { name: string; count: number; money: number }[];
}

export interface GameRule {
  key: GameKey;
  name: string;
  shortName: string;
  mainCount: number;
  mainMax: number;
  specialCount: number;
  specialMax: number;
  /** 单注基本投注金额（元） */
  price: number;
  /** 追加投注每注加价（元），0 表示不支持追加 */
  extraPrice: number;
  /** 单张彩票最大金额（元） */
  maxAmount: number;
  /** 单张彩票最大倍数 */
  maxMultiple: number;
  /** 单张彩票最大注数 */
  maxBets: number;
  /** 复式允许的最大号码个数 */
  maxMainPick: number;
  maxSpecialPick: number;
  /** 奖级定义（新/现行规则） */
  levels: PrizeLevel[];
  /** 历史规则（大乐透 2026-02-02 前为 9 奖级） */
  legacyLevels?: PrizeLevel[];
  /** 现行规则生效起点（期号），早于该期号的历史用 legacyLevels */
  ruleChangeCode?: string;
}

export interface PrizeLevel {
  level: number;
  name: string;
  /** 中奖条件：main 命中数 -> special 命中数集合 */
  combos: { main: number; special: number }[];
  /** 单注固定奖金（元）。null 表示浮动奖 */
  fixed: number | null;
  /** 奖池达到 8 亿元及以上时的固定奖金升级值 */
  boosted?: number;
  note?: string;
}

/** 一注投注（单式）：main 已按规则个数选取 */
export interface Bet {
  main: number[];
  special: number[];
}

export interface HitResult {
  mainHit: number;
  specialHit: number;
  level: number | null;
  levelName: string | null;
  unitMoney: number | null;
  fixed: boolean;
}
