import { RULES } from '../core/rules';
import type { Draw, GameKey } from '../core/types';
import { load, save } from './store';

const EXTRA_KEY = (g: GameKey) => `extra.${g}`;

/** 读取用户手动录入/自动抓取补充的开奖记录 */
export function getExtraDraws(game: GameKey): Draw[] {
  return load<Draw[]>(EXTRA_KEY(game), []);
}

/** 合并内置数据与补充数据（按期号去重、升序） */
export function mergeDraws(base: Draw[], extra: Draw[]): Draw[] {
  if (!extra.length) return base;
  const map = new Map<string, Draw>();
  for (const d of base) map.set(d.code, d);
  for (const d of extra) map.set(d.code, d);
  return [...map.values()].sort((a, b) => (a.code < b.code ? -1 : 1));
}

export interface ParseResult {
  ok: boolean;
  draw?: Draw;
  message: string;
}

/**
 * 解析用户粘贴的开奖号码。
 * 支持格式：
 *   01 02 06 16 20 28 | 02
 *   01,02,06,16,20,28,02
 *   第2026130期 01 02 06 16 20 28 02
 *   全角空格、中文顿号、竖线均可
 */
export function parseDrawText(game: GameKey, raw: string): ParseResult {
  const rule = RULES[game];
  const text = raw.replace(/[，、｜|]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return { ok: false, message: '请输入开奖号码' };

  const nums = (text.match(/\d+/g) ?? []).map(Number);
  const expected = rule.mainCount + rule.specialCount;

  // 若首个数字是期号（长度明显超过一个号码值），先剥离
  let code = '';
  let pool = nums;
  if (nums.length === expected + 1 && nums[0] > rule.mainMax) {
    code = String(nums[0]);
    pool = nums.slice(1);
  }
  if (pool.length !== expected) {
    return {
      ok: false,
      message: `需要 ${expected} 个号码（${rule.mainCount} 个主区 + ${rule.specialCount} 个附加区），当前识别到 ${pool.length} 个`,
    };
  }
  const main = pool.slice(0, rule.mainCount);
  const special = pool.slice(rule.mainCount);
  for (const n of main) {
    if (n < 1 || n > rule.mainMax) return { ok: false, message: `主区号码 ${n} 超出 1-${rule.mainMax}` };
  }
  for (const n of special) {
    if (n < 1 || n > rule.specialMax) return { ok: false, message: `附加区号码 ${n} 超出 1-${rule.specialMax}` };
  }
  if (new Set(main).size !== main.length) return { ok: false, message: '主区号码有重复' };
  if (new Set(special).size !== special.length) return { ok: false, message: '附加区号码有重复' };

  const src = raw.match(/第?\s*(\d{5,7})\s*期/);
  if (!code && src) code = src[1];

  return {
    ok: true,
    message: '解析成功',
    draw: {
      code,
      date: new Date().toISOString().slice(0, 10),
      main: [...main].sort((a, b) => a - b),
      special: [...special].sort((a, b) => a - b),
      sales: 0,
      pool: 0,
    },
  };
}

/** 保存一条补充开奖记录；若期号为空则自动顺延上一期 */
export function saveDraw(game: GameKey, draw: Draw, latestCode: string): Draw {
  let code = draw.code;
  if (!code) {
    const prefixLen = game === 'ssq' ? 4 : 2;
    const seq = Number(latestCode.slice(prefixLen)) + 1;
    code = latestCode.slice(0, prefixLen) + String(seq).padStart(latestCode.length - prefixLen, '0');
  }
  const record: Draw = { ...draw, code };
  const list = getExtraDraws(game).filter((d) => d.code !== code);
  list.push(record);
  save(EXTRA_KEY(game), list);
  return record;
}

export function clearExtra(game: GameKey) {
  save(EXTRA_KEY(game), []);
}

export function extraCount(game: GameKey): number {
  return getExtraDraws(game).length;
}
