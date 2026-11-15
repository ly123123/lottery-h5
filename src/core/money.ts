import { comb, RULES } from './rules';
import type { GameKey, GameRule, HitResult, PrizeLevel } from './types';

/**
 * 投注金额计算 —— 全部按官方投注规则整数运算，不经过浮点累加，保证分毫不差。
 *
 * 双色球：注数 = C(红球个数, 6) × 蓝球个数；金额 = 注数 × 2 元 × 倍数
 * 大乐透：注数 = C(前区个数, 5) × C(后区个数, 2)；金额 = 注数 × (2 + 追加1) 元 × 倍数
 */
export interface AmountResult {
  bets: number;
  /** 单注价格（含追加） */
  unitPrice: number;
  /** 总金额（元），整数 */
  amount: number;
  multiple: number;
  append: boolean;
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function computeAmount(
  key: GameKey,
  mainPicks: number,
  specialPicks: number,
  multiple = 1,
  append = false,
): AmountResult {
  const rule = RULES[key];
  const errors: string[] = [];
  const warnings: string[] = [];

  if (mainPicks < rule.mainCount || mainPicks > rule.maxMainPick) {
    errors.push(`前区/红球个数需在 ${rule.mainCount}-${rule.maxMainPick} 个之间`);
  }
  if (specialPicks < rule.specialCount || specialPicks > rule.maxSpecialPick) {
    errors.push(rule.specialCount === 1 ? '蓝球需选 1 个' : `后区需选 ${rule.specialCount}-${rule.maxSpecialPick} 个`);
  }
  if (!Number.isInteger(multiple) || multiple < 1 || multiple > rule.maxMultiple) {
    errors.push(`倍数需为 1-${rule.maxMultiple} 的整数`);
  }
  if (append && rule.extraPrice === 0) {
    errors.push('双色球不支持追加投注');
  }

  const bets = comb(mainPicks, rule.mainCount) * comb(specialPicks, rule.specialCount);
  const unitPrice = rule.price + (append ? rule.extraPrice : 0);
  const amount = bets * unitPrice * multiple;

  if (bets > rule.maxBets) {
    errors.push(`注数 ${bets.toLocaleString('zh-CN')} 超过单票上限 ${rule.maxBets.toLocaleString('zh-CN')} 注`);
  }
  if (amount > rule.maxAmount) {
    const needTickets = Math.ceil(amount / rule.maxAmount);
    errors.push(
      `单票金额 ${amount.toLocaleString('zh-CN')} 元超过官方上限 ${rule.maxAmount.toLocaleString('zh-CN')} 元，需拆分为 ${needTickets} 张彩票`,
    );
  }
  if (amount <= rule.maxAmount && amount > rule.maxAmount * 0.8) {
    warnings.push('接近单票 20000 元上限，请注意理性投注');
  }

  return { bets, unitPrice, amount, multiple, append, ok: errors.length === 0, errors, warnings };
}

/** 拆分方案：把超限投注按单票上限拆成多张 */
export function splitTickets(key: GameKey, totalAmount: number): number[] {
  const max = RULES[key].maxAmount;
  const tickets: number[] = [];
  let left = totalAmount;
  while (left > 0) {
    const t = Math.min(left, max);
    tickets.push(t);
    left -= t;
  }
  return tickets;
}

/** 判定单注中奖 */
export function judgeBet(
  levels: PrizeLevel[],
  mainHit: number,
  specialHit: number,
  boost = false,
): HitResult {
  for (const lv of levels) {
    for (const c of lv.combos) {
      if (c.main === mainHit && c.special === specialHit) {
        const fixed = lv.fixed;
        const unit = fixed == null ? null : (boost && lv.boosted ? lv.boosted : fixed);
        return {
          mainHit, specialHit, level: lv.level, levelName: lv.name,
          unitMoney: unit, fixed: fixed != null,
        };
      }
    }
  }
  return { mainHit, specialHit, level: null, levelName: null, unitMoney: null, fixed: false };
}

/** 计算命中个数 */
export function countHits(bet: { main: number[]; special: number[] }, draw: { main: number[]; special: number[] }) {
  const ms = new Set(draw.main);
  const ss = new Set(draw.special);
  let mainHit = 0, specialHit = 0;
  for (const n of bet.main) if (ms.has(n)) mainHit++;
  for (const n of bet.special) if (ss.has(n)) specialHit++;
  return { mainHit, specialHit };
}

/**
 * 复式票中奖注数展开：给定命中数，精确计算各奖级中奖注数。
 * 复式票 = 从选中的红/蓝号码池中任取规则个数组合，等价于超几何展开。
 */
export function expandComplexHits(
  key: GameKey,
  mainPicks: number,
  specialPicks: number,
  mainHit: number,
  specialHit: number,
  levels: PrizeLevel[],
  boost = false,
): { level: number; name: string; count: number; unit: number | null; total: number | null }[] {
  const rule = RULES[key];
  const out: { level: number; name: string; count: number; unit: number | null; total: number | null }[] = [];
  const mainMiss = mainPicks - mainHit;
  const specialMiss = specialPicks - specialHit;

  for (const lv of levels) {
    let count = 0;
    for (const c of lv.combos) {
      const needMainHit = c.main, needSpecialHit = c.special;
      if (needMainHit > mainHit || needSpecialHit > specialHit) continue;
      // 从命中号码中选 needMainHit 个，从落选号码中补足 mainCount - needMainHit 个
      const restMain = rule.mainCount - needMainHit;
      if (restMain > mainMiss) continue;
      const m = comb(mainHit, needMainHit) * comb(mainMiss, restMain);
      if (m === 0) continue;
      let s = 0;
      if (rule.specialCount === 1) {
        s = 1;
      } else {
        const restSpecial = rule.specialCount - needSpecialHit;
        if (restSpecial > specialMiss) continue;
        s = comb(specialHit, needSpecialHit) * comb(specialMiss, restSpecial);
      }
      count += m * s;
    }
    if (count > 0) {
      const unit = lv.fixed == null ? null : (boost && lv.boosted ? lv.boosted : lv.fixed);
      out.push({
        level: lv.level, name: lv.name, count, unit,
        total: unit == null ? null : unit * count,
      });
    }
  }
  return out;
}
