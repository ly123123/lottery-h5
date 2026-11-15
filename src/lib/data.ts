import raw from '../data/draws.json';
import type { Draw, GameKey } from '../core/types';

type Row = [string, string, number[], number[], number, number];
const DB = raw as unknown as { ssq: Row[]; dlt: Row[] };

export function loadDraws(key: GameKey): Draw[] {
  const rows = key === 'ssq' ? DB.ssq : DB.dlt;
  return rows.map((r) => ({
    code: r[0], date: r[1], main: r[2], special: r[3], sales: r[4], pool: r[5],
  }));
}

export const DATA_META = {
  ssq: { count: DB.ssq.length, first: DB.ssq[0][1], last: DB.ssq[DB.ssq.length - 1][1] },
  dlt: { count: DB.dlt.length, first: DB.dlt[0][1], last: DB.dlt[DB.dlt.length - 1][1] },
  generatedAt: '2026-11-15',
};
