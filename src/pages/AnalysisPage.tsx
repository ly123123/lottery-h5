import { useMemo } from 'react';
import type { Draw, GameKey } from '../core/types';
import { RULES } from '../core/rules';
import { analyze, ZONE_LABEL } from '../core/analyze';
import { BallRow } from '../components/Ball';
import { BarChart, RatioBars } from '../components/Chart';
import { DATA_META } from '../lib/data';

export default function AnalysisPage({ draws, game }: { draws: Draw[]; game: GameKey }) {
  const rule = RULES[game];
  const a = useMemo(() => analyze(draws, game), [draws, game]);
  const zoneLabels = ZONE_LABEL(game);

  const maxCount30 = Math.max(1, ...a.mainStats.map((s) => s.count30));
  const minCount30 = Math.min(...a.mainStats.map((s) => s.count30));

  const heatColor = (c: number) => {
    const t = maxCount30 === minCount30 ? 0.5 : (c - minCount30) / (maxCount30 - minCount30);
    // 冷 -> 蓝紫，热 -> 红
    const r = Math.round(40 + t * (232 - 40));
    const g = Math.round(70 + (1 - t) * 90);
    const b = Math.round(200 - t * 120);
    return `rgba(${r}, ${g}, ${b}, ${0.18 + t * 0.55})`;
  };

  const oddData = a.oddDist.map((d) => ({ label: `${d.value}奇`, value: d.count }));
  const bigData = a.bigDist.map((d) => ({ label: `${d.value}大`, value: d.count }));
  const consecData = a.consecDist.map((d) => ({ label: `${d.value}连`, value: d.count }));

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card">
        <div className="card-hd">
          <div className="card-title"><span className="dot" />数据概览</div>
          <span className="card-sub">{rule.name}</span>
        </div>
        <div className="stat-grid">
          <div className="stat"><div className="v">{a.total}</div><div className="k">已纳期数</div></div>
          <div className="stat"><div className="v gold">{a.sum.median}</div><div className="k">和值中位</div></div>
          <div className="stat"><div className="v blue">{a.recent[0]?.code ?? '-'}</div><div className="k">最新期号</div></div>
        </div>
        <div className="divider" />
        <div className="row"><span className="tiny">统计区间</span><span className="tiny">{a.firstDate} ~ {a.lastDate}</span></div>
        <div className="row"><span className="tiny">数据来源</span><span className="tiny">{game === 'ssq' ? '中国福彩官方开奖公告' : '中国体彩官方开奖公告'}</span></div>
        <div className="row"><span className="tiny">更新时间</span><span className="tiny">{DATA_META.generatedAt}</span></div>
      </div>

      <div className="card">
        <div className="card-hd">
          <div className="card-title"><span className="dot" />最近开奖</div>
          <span className="card-sub">近 {Math.min(6, a.recent.length)} 期</span>
        </div>
        {a.recent.slice(0, 6).map((d) => (
          <div className="draw-item" key={d.code}>
            <div className="draw-meta">
              <span>第 {d.code} 期</span>
              <span>{d.date}</span>
            </div>
            <BallRow main={d.main} special={d.special} size="sm" />
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-hd">
          <div className="card-title"><span className="dot" />号码热度分布</div>
          <span className="card-sub">近 30 期出现次数</span>
        </div>
        <div className="heat-grid">
          {a.mainStats.map((s) => (
            <div className="heat-cell" key={s.num} style={{ background: heatColor(s.count30), border: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="n">{String(s.num).padStart(2, '0')}</span>
              <span className="c">{s.count30}</span>
            </div>
          ))}
        </div>
        <div className="divider" />
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <span className="tiny" style={{ flex: 'none', paddingTop: 3 }}>热号</span>
          <div className="ball-row" style={{ justifyContent: 'flex-end' }}>
            {a.hot.slice(0, 8).map((n) => (
              <span key={n} className="chip red">{String(n).padStart(2, '0')}</span>
            ))}
          </div>
        </div>
        <div className="row" style={{ alignItems: 'flex-start', marginTop: 8 }}>
          <span className="tiny" style={{ flex: 'none', paddingTop: 3 }}>冷号</span>
          <div className="ball-row" style={{ justifyContent: 'flex-end' }}>
            {a.cold.slice(0, 8).map((n) => (
              <span key={n} className="chip blue">{String(n).padStart(2, '0')}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-hd">
          <div className="card-title"><span className="dot" />和值走势分布</div>
          <span className="card-sub">均值 {a.sum.mean.toFixed(1)} · 区间 {a.sum.min}~{a.sum.max}</span>
        </div>
        <BarChart data={a.sumHist.map((d) => ({ label: String(d.bucket), value: d.count }))} color="#3d7bff" />
        <div className="divider" />
        <div className="row"><span className="tiny">80% 号码和值落在</span><span className="tiny" style={{ color: '#f6c453' }}>{Math.round(a.sum.p10)} ~ {Math.round(a.sum.p90)}</span></div>
        <div className="row"><span className="tiny">平均跨度</span><span className="tiny">{a.span.mean.toFixed(1)}</span></div>
        <div className="row"><span className="tiny">平均 AC 值</span><span className="tiny">{a.acMean.toFixed(1)}</span></div>
      </div>

      <div className="card">
        <div className="card-hd">
          <div className="card-title"><span className="dot" />结构特征归类</div>
          <span className="card-sub">历史形态占比</span>
        </div>
        <div className="card-sub" style={{ marginBottom: 6 }}>奇偶比（奇数个数）</div>
        <RatioBars data={oddData} />
        <div className="divider" />
        <div className="card-sub" style={{ marginBottom: 6 }}>大小比（大于 {Math.floor(rule.mainMax / 2)} 的个数）</div>
        <RatioBars data={bigData} colors={['#3d7bff', '#22d3ee', '#2fd18b', '#f6c453', '#e8405a', '#a855f7']} />
        <div className="divider" />
        <div className="card-sub" style={{ marginBottom: 6 }}>三区分布均值</div>
        {a.zoneDist.map((z, i) => (
          <div className="row" key={z.zone}>
            <span className="tiny">第 {z.zone} 区 <span style={{ color: '#5c6a8c' }}>{zoneLabels[i]}</span></span>
            <span className="tiny" style={{ color: '#f6c453' }}>{z.avg.toFixed(2)} 个</span>
          </div>
        ))}
        <div className="divider" />
        <div className="card-sub" style={{ marginBottom: 6 }}>连号个数占比</div>
        <BarChart data={consecData} color="#f6c453" height={70} />
      </div>

      <div className="card">
        <div className="card-hd">
          <div className="card-title"><span className="dot" />奖级与中奖概率</div>
          <span className="card-sub">按现行规则</span>
        </div>
        <table className="tbl">
          <thead>
            <tr><th>奖级</th><th>中奖条件</th><th className="num">概率</th><th className="num">单注奖金</th></tr>
          </thead>
          <tbody>
            {a.prizeProb.map((p) => {
              const lv = rule.levels.find((x) => x.level === p.level)!;
              const cond = lv.combos.map((c) => `${c.main}+${c.special}`).join(' / ');
              return (
                <tr key={p.level}>
                  <td>{p.name}</td>
                  <td style={{ color: '#97a3c4', fontSize: 11 }}>{cond}</td>
                  <td className="num" style={{ color: '#f6c453' }}>1/{Math.round(p.oneIn).toLocaleString('zh-CN')}</td>
                  <td className="num">{p.fixed == null ? '浮动' : `${p.fixed.toLocaleString('zh-CN')} 元`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {game === 'dlt' && (
          <div className="tiny" style={{ marginTop: 8 }}>
            注：2026 年 2 月 2 日起大乐透由 9 个奖级合并为 7 个奖级；当奖池 ≥ 8 亿元时，三～七等奖固定奖金额上浮（5000→6666、300→380、150→200、15→18、5→7）。
          </div>
        )}
      </div>
    </div>
  );
}
