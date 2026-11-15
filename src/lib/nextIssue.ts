import type { GameKey } from '../core/types';

const SSQ_WEEKDAYS = [2, 4, 0]; // 双色球：周二、周四、周日 21:15 开奖
const DLT_WEEKDAYS = [1, 3, 6]; // 大乐透：周一、周三、周六 21:25 开奖

/**
 * 推算下一期期号与开奖日期。
 * 双色球期号为 7 位（如 2026130 = 2026 年第 130 期）；
 * 大乐透期号为 5 位（如 26130 = 2026 年第 130 期）。
 */
export function nextIssue(game: GameKey, lastCode: string, lastDate: string): { code: string; date: string; weekday: string } {
  const wd = game === 'ssq' ? SSQ_WEEKDAYS : DLT_WEEKDAYS;
  const base = new Date(lastDate + 'T12:00:00+08:00');
  const prefixLen = game === 'ssq' ? 4 : 2;
  const seqDigits = lastCode.length - prefixLen;
  const seq = Number(lastCode.slice(prefixLen)) + 1;

  for (let i = 1; i <= 8; i++) {
    const d = new Date(base.getTime() + i * 86400000);
    if (wd.includes(d.getDay())) {
      const y = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const prefix = game === 'ssq' ? String(y) : String(y).slice(2);
      const code = prefix + String(seq).padStart(seqDigits, '0');
      const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      return { code, date: `${y}-${mm}-${dd}`, weekday: names[d.getDay()] };
    }
  }
  return { code: lastCode, date: '', weekday: '' };
}
