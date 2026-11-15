const PREFIX = 'lottery.v1.';

export function load<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(PREFIX + key);
    return s ? (JSON.parse(s) as T) : fallback;
  } catch { return fallback; }
}

export function save<T>(key: string, value: T) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* 忽略配额错误 */ }
}

export interface SavedTicket {
  id: string;
  game: 'ssq' | 'dlt';
  main: number[];
  special: number[];
  multiple: number;
  append: boolean;
  createdAt: number;
  label?: string;
  source?: 'manual' | 'predict' | 'complex';
  bets?: number;
  amount?: number;
}

export function getTickets(): SavedTicket[] { return load<SavedTicket[]>('tickets', []); }
export function addTicket(t: SavedTicket) {
  const list = getTickets();
  list.unshift(t);
  save('tickets', list.slice(0, 200));
}
export function removeTicket(id: string) {
  save('tickets', getTickets().filter((t) => t.id !== id));
}
