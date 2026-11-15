/// <reference lib="webworker" />
import { runBacktest } from '../core/backtest';
import type { Draw, GameKey } from '../core/types';

type Req = { draws: Draw[]; game: GameKey; models: string[]; start: number };

self.onmessage = (e: MessageEvent<Req>) => {
  const { draws, game, models, start } = e.data;
  const results = [];
  for (let i = 0; i < models.length; i++) {
    (self as unknown as Worker).postMessage({ type: 'progress', value: i / models.length, label: models[i] });
    const r = runBacktest(draws, game, { model: models[i] as never, start, betsPerDraw: 1, seed: 20261115 });
    results.push(r);
  }
  (self as unknown as Worker).postMessage({ type: 'done', results });
};
