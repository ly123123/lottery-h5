import { useEffect, useRef, useState } from 'react';
import type { Draw, GameKey } from '../core/types';
import type { BacktestResult } from '../core/backtest';
import { RULES } from '../core/rules';

const MODELS = ['ensemble', 'ewma', 'bayes', 'gap', 'ridge', 'random'];

export default function BacktestPanel({ draws, game }: { draws: Draw[]; game: GameKey }) {
  const rule = RULES[game];
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<BacktestResult[] | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    return () => { workerRef.current?.terminate(); };
  }, []);

  const run = () => {
    setRunning(true);
    setProgress(0);
    setResults(null);
    const w = new Worker(new URL('../workers/backtest.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = w;
    w.onmessage = (e) => {
      const d = e.data;
      if (d.type === 'progress') setProgress(d.value);
      else if (d.type === 'done') {
        setResults(d.results);
        setProgress(1);
        setRunning(false);
        w.terminate();
      }
    };
    const start = Math.max(100, draws.length - 200);
    w.postMessage({ draws, game, models: MODELS, start });
  };

  const sorted = results ? [...results].sort((a, b) => b.avgMainHit - a.avgMainHit) : [];

  return (
    <div className="card">
      <div className="card-hd">
        <div className="card-title"><span className="dot" />算法回测验证</div>
        {!running && <button className="btn sm" onClick={run}>{results ? '重新回测' : '开始回测'}</button>}
      </div>

      {!results && !running && (
        <div className="tiny">
          用历史数据做滚动回测（walk-forward）：对每个开奖窗口，只用该窗口之前的数据训练，预测下一期，
          再与真实开奖号比对。这是判断"算法是否真的更强"的唯一诚实方法。
          共回测最近 {Math.max(0, draws.length - Math.max(100, draws.length - 200))} 期。
        </div>
      )}

      {running && (
        <div>
          <div className="row"><span className="tiny">正在回测…</span><span className="tiny">{Math.round(progress * 100)}%</span></div>
          <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', marginTop: 8, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress * 100}%`, background: 'linear-gradient(90deg,#e8405a,#3d7bff)', transition: 'width .2s' }} />
          </div>
        </div>
      )}

      {results && (
        <>
          <table className="tbl">
            <thead>
              <tr>
                <th>模型</th>
                <th className="num">平均命中</th>
                <th className="num">附加区命中</th>
                <th className="num">中奖率</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.model}>
                  <td style={{ fontSize: 11, lineHeight: 1.35 }}>
                    {r.model === 'ensemble' ? (
                      <>集成模型<span className="chip gold" style={{ marginLeft: 4, padding: '1px 4px' }}>采用</span></>
                    ) : r.label}
                  </td>
                  <td className="num" style={{ color: r.avgMainHit > r.baselineAvgMainHit ? '#2fd18b' : '#97a3c4' }}>
                    {r.avgMainHit.toFixed(3)}
                  </td>
                  <td className="num">{(r.specialRate * 100).toFixed(1)}%</td>
                  <td className="num">{(r.winRate * 100).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="divider" />
          {(() => {
            const ens = results.find((r) => r.model === 'ensemble');
            const base = results.find((r) => r.model === 'random');
            if (!ens) return null;
            const diff = ens.avgMainHit - (base?.avgMainHit ?? 0);
            const pct = base && base.avgMainHit > 0 ? (diff / base.avgMainHit) * 100 : 0;
            const z = ens.zScore;
            const significant = Math.abs(z) >= 1.96;
            return (
              <div className={`alert ${significant && z > 0 ? 'ok' : ''}`}>
                集成模型单注平均命中主区 <b>{ens.avgMainHit.toFixed(3)}</b> 个，
                理论期望 <b>{ens.theoreticalMean.toFixed(3)}</b> 个（超几何分布），
                经验随机基线 <b>{(base?.avgMainHit ?? 0).toFixed(3)}</b> 个。
                <br />
                较随机基线 <b>{diff >= 0 ? '+' : ''}{diff.toFixed(3)}</b>（{pct >= 0 ? '+' : ''}{pct.toFixed(1)}%），
                显著性检验 <b>z = {z.toFixed(2)}</b>
                {Math.abs(z) < 1.96
                  ? '（|z| < 1.96，与随机无统计显著差异）'
                  : z > 0
                    ? '（z ≥ 1.96，本次回测高于随机）'
                    : '（z ≤ -1.96，本次回测低于随机）'}。
                <br />
                {Math.abs(z) < 1.96
                  ? '结论：算法无法改变彩票的随机性，差异完全落在统计噪声范围内。本应用的价值在于数据归类、组合结构优化与金额精确核算，而不是"预测中奖号"。'
                  : z > 0
                    ? '注意：本次回测高于随机，但在 200 注样本、多重比较条件下，这更可能是运气而非规律，不能据此认为下期更容易中。'
                    : '注意：低于随机同样属于统计波动——理论上任何选号方式的期望命中都完全相同（K²/N），不存在"反向预测"。'}
              </div>
            );
          })()}

          <div className="tiny" style={{ marginTop: 8 }}>
            回测口径：{sorted[0]?.windows ?? 0} 个窗口、共 {sorted[0]?.totalBets ?? 0} 注，每期 1 注，单价 {rule.price} 元；
            浮动奖（一、二等奖）不计入回报率，仅统计固定奖。z 值越大越说明偏离随机，但样本量有限时，
            |z| 在 2 以内都应视为「与随机无异」。
          </div>
        </>
      )}
    </div>
  );
}
