import { useMemo, useState } from 'react';
import type { Draw, GameKey } from '../core/types';
import { RULES } from '../core/rules';
import { analyze, ZONE_LABEL } from '../core/analyze';
import { scoreZone } from '../core/models';
import { BallRow } from '../components/Ball';
import { RatioBars } from '../components/Chart';
import { TrendMatrix, LineChart, ProbBars } from '../components/Viz';
import { DATA_META } from '../lib/data';
import { parseDrawText, saveDraw, getExtraDraws } from '../lib/live';

export default function AnalysisPage({ draws, game, onDataChanged }: {
  draws: Draw[];
  game: GameKey;
  onDataChanged: () => void;
}) {
  const rule = RULES[game];
  const a = useMemo(() => analyze(draws, game), [draws, game]);
  const zoneLabels = ZONE_LABEL(game);

  const pred = useMemo(() => scoreZone(draws, game, 'main'), [draws, game]);
  const predSp = useMemo(() => scoreZone(draws, game, 'special'), [draws, game]);

  const [panel, setPanel] = useState(false);
  const [text, setText] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const parsed = useMemo(() => (text.trim() ? parseDrawText(game, text) : null), [text, game]);

  const submit = () => {
    if (!parsed?.ok || !parsed.draw) {
      setMsg({ ok: false, text: parsed?.message ?? '解析失败' });
      return;
    }
    const saved = saveDraw(game, parsed.draw, a.lastCode);
    setMsg({ ok: true, text: `已记录第 ${saved.code} 期，预测已同步更新` });
    setText('');
    onDataChanged();
    setTimeout(() => { setPanel(false); setMsg(null); }, 1400);
  };

  const maxCount30 = Math.max(1, ...a.mainStats.map((s) => s.count30));
  const minCount30 = Math.min(...a.mainStats.map((s) => s.count30));
  const heatColor = (c2: number) => {
    const t = maxCount30 === minCount30 ? 0.5 : (c2 - minCount30) / (maxCount30 - minCount30);
    const r = Math.round(40 + t * 192);
    const g = Math.round(70 + (1 - t) * 90);
    const b = Math.round(200 - t * 120);
    return `rgba(${r}, ${g}, ${b}, ${0.18 + t * 0.55})`;
  };

  const topMain = pred.probs
    .map((p, i) => ({ n: i + 1, p }))
    .sort((x, y) => y.p - x.p)
    .slice(0, 12);
  const topSpecial = predSp.probs.map((p, i) => ({ n: i + 1, p })).sort((x, y) => y.p - x.p).slice(0, 5);
  const avgP = rule.mainCount / rule.mainMax;

  // 和值走势（最近 30 期）
  const sumTrend = draws.slice(-30).map((d) => ({ label: d.code.slice(-3), value: d.main.reduce((x, y) => x + y, 0) }));
  // 连号走势
  const oddTrend = draws.slice(-30).map((d) => ({ label: d.code.slice(-3), value: d.main.filter((x) => x % 2 === 1).length }));

  const extra = getExtraDraws(game).length;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card">
        <div className="card-hd">
          <div className="card-title"><span className="dot" />数据概览</div>
          <button className="btn sm primary" onClick={() => { setPanel((v) => !v); setMsg(null); }}>
            {panel ? '收起' : '＋ 录入最新开奖'}
          </button>
        </div>
        <div className="stat-grid">
          <div className="stat"><div className="v">{a.total}</div><div className="k">已纳期数</div></div>
          <div className="stat"><div className="v gold">{a.sum.median}</div><div className="k">和值中位</div></div>
          <div className="stat"><div className="v blue">{a.recent[0]?.code ?? '-'}</div><div className="k">最新期号</div></div>
        </div>

        {panel && (
          <div className="update-panel fade-in">
            <div className="tiny" style={{ marginBottom: 7 }}>
              从福彩/体彩官网复制最新一期开奖号码粘贴到这里，例如：
              <span style={{ color: '#8db4ff' }}> {game === 'ssq' ? '01 02 06 16 20 28 | 02' : '01 07 11 27 29 | 02 06'}</span>
            </div>
            <input
              className="update-input"
              placeholder={game === 'ssq' ? '01 02 06 16 20 28 02' : '01 07 11 27 29 02 06'}
              value={text}
              onChange={(e) => { setText(e.target.value); setMsg(null); }}
              inputMode="numeric"
            />
            {parsed && (
              <div className="update-preview">
                {parsed.ok && parsed.draw ? (
                  <>
                    <span className="chip green">✓ 识别成功</span>
                    <BallRow main={parsed.draw.main} special={parsed.draw.special} size="sm" />
                  </>
                ) : (
                  <span className="chip" style={{ color: '#ff8a9a' }}>{parsed.message}</span>
                )}
              </div>
            )}
            {msg && <div className={`alert ${msg.ok ? 'ok' : 'danger'}`} style={{ marginTop: 8 }}>{msg.text}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 9 }}>
              <button className="btn primary block sm" onClick={submit} disabled={!parsed?.ok}>保存并重新预测</button>
              <button className="btn sm" onClick={() => { setPanel(false); setText(''); setMsg(null); }}>取消</button>
            </div>
            <div className="tiny" style={{ marginTop: 8 }}>
              期号自动顺延上一期；数据只保存在本机浏览器，不会上传。
              {extra > 0 && ` 已额外记录 ${extra} 期。`}
            </div>
          </div>
        )}

        <div className="divider" />
        <div className="row"><span className="tiny">统计区间</span><span className="tiny">{a.firstDate} ~ {a.lastDate}</span></div>
        <div className="row"><span className="tiny">数据来源</span><span className="tiny">{game === 'ssq' ? '中国福彩官方开奖公告' : '中国体彩官方开奖公告'}</span></div>
        <div className="row"><span className="tiny">内置数据更新</span><span className="tiny">{DATA_META.generatedAt}</span></div>
      </div>

      <div className="card">
        <div className="card-hd">
          <div className="card-title"><span className="dot" />最近开奖</div>
          <span className="card-sub">近 {Math.min(6, a.recent.length)} 期</span>
        </div>
        {a.recent.slice(0, 6).map((d) => (
          <div className="draw-item" key={d.code}>
            <div className="draw-meta"><span>第 {d.code} 期</span><span>{d.date}</span></div>
            <BallRow main={d.main} special={d.special} size="sm" />
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-hd">
          <div className="card-title"><span className="dot" />号码走势图</div>
          <span className="card-sub">近 18 期 · 红点=开出</span>
        </div>
        <TrendMatrix draws={draws} max={rule.mainMax} rows={18} />
        <div className="divider" />
        <div className="mini-legend">
          <span><i style={{ background: '#e8405a' }} />开出</span>
          <span><i style={{ background: 'rgba(255,255,255,0.12)' }} />未开</span>
          <span>横轴 = 号码，纵轴 = 期号（上旧下新）</span>
        </div>
      </div>

      <div className="card">
        <div className="card-hd">
          <div className="card-title"><span className="dot" />和值走势</div>
          <span className="card-sub">近 30 期 · 黄带为 80% 常见区间</span>
        </div>
        <LineChart data={sumTrend} band={[Math.round(a.sum.p10), Math.round(a.sum.p90)]} />
        <div className="divider" />
        <div className="card-sub" style={{ marginBottom: 6 }}>奇数个数走势</div>
        <LineChart data={oddTrend} color="#3d7bff" height={72} />
        <div className="divider" />
        <div className="row"><span className="tiny">80% 和值区间</span><span className="tiny" style={{ color: '#f6c453' }}>{Math.round(a.sum.p10)} ~ {Math.round(a.sum.p90)}</span></div>
        <div className="row"><span className="tiny">平均跨度 / AC 值</span><span className="tiny">{a.span.mean.toFixed(1)} / {a.acMean.toFixed(1)}</span></div>
      </div>

      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(232,64,90,0.13), rgba(61,123,255,0.09))' }}>
        <div className="card-hd">
          <div className="card-title"><span className="dot" />算法预测分析</div>
          <span className="card-sub">五模型集成 · 相对强度</span>
        </div>
        <div className="card-sub" style={{ marginBottom: 7 }}>主区号码倾向（Top 12）</div>
        <ProbBars
          items={topMain.map((x) => ({ ...x, tag: x.p >= avgP * 1.25 ? '强' : x.p <= avgP * 0.8 ? '弱' : '' }))}
          max={avgP}
          color="#e8405a"
        />
        <div className="divider" />
        <div className="card-sub" style={{ marginBottom: 7 }}>{rule.specialCount === 1 ? '蓝球' : '后区'}倾向（Top 5）</div>
        <ProbBars items={topSpecial} max={1 / rule.specialMax} color="#3d7bff" />
        <div className="divider" />
        <div className="tiny" style={{ lineHeight: 1.7 }}>
          模型结论：近 30 期最活跃号码 <b style={{ color: '#ff8a9a' }}>{a.hot.slice(0, 5).map((n) => String(n).padStart(2, '0')).join(' ')}</b>；
          遗漏最久的号码 <b style={{ color: '#8db4ff' }}>{[...a.mainStats].sort((x, y) => y.omission - x.omission).slice(0, 5).map((s) => String(s.num).padStart(2, '0')).join(' ')}</b>。
          模型只是把统计倾向排序，<b>不改变每期独立随机的本质</b>。
        </div>
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
            {a.hot.slice(0, 8).map((n) => <span key={n} className="chip red">{String(n).padStart(2, '0')}</span>)}
          </div>
        </div>
        <div className="row" style={{ alignItems: 'flex-start', marginTop: 8 }}>
          <span className="tiny" style={{ flex: 'none', paddingTop: 3 }}>冷号</span>
          <div className="ball-row" style={{ justifyContent: 'flex-end' }}>
            {a.cold.slice(0, 8).map((n) => <span key={n} className="chip blue">{String(n).padStart(2, '0')}</span>)}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-hd">
          <div className="card-title"><span className="dot" />结构特征归类</div>
          <span className="card-sub">历史形态占比</span>
        </div>
        <div className="card-sub" style={{ marginBottom: 6 }}>奇偶比（奇数个数）</div>
        <RatioBars data={a.oddDist.map((d) => ({ label: `${d.value}奇`, value: d.count }))} />
        <div className="divider" />
        <div className="card-sub" style={{ marginBottom: 6 }}>大小比（大于 {Math.floor(rule.mainMax / 2)} 的个数）</div>
        <RatioBars data={a.bigDist.map((d) => ({ label: `${d.value}大`, value: d.count }))} colors={['#3d7bff', '#22d3ee', '#2fd18b', '#f6c453', '#e8405a', '#a855f7']} />
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
        <RatioBars data={a.consecDist.map((d) => ({ label: `${d.value}连号`, value: d.count }))} colors={['#64708f', '#f6c453', '#e8405a', '#3d7bff']} />
      </div>

      <div className="card">
        <div className="card-hd">
          <div className="card-title"><span className="dot" />奖级与中奖概率</div>
          <span className="card-sub">按现行规则</span>
        </div>
        <table className="tbl">
          <thead><tr><th>奖级</th><th>中奖条件</th><th className="num">概率</th><th className="num">单注奖金</th></tr></thead>
          <tbody>
            {a.prizeProb.map((p) => {
              const lv = rule.levels.find((x) => x.level === p.level)!;
              return (
                <tr key={p.level}>
                  <td>{p.name}</td>
                  <td style={{ color: '#97a3c4', fontSize: 11 }}>{lv.combos.map((c) => `${c.main}+${c.special}`).join(' / ')}</td>
                  <td className="num" style={{ color: '#f6c453' }}>1/{Math.round(p.oneIn).toLocaleString('zh-CN')}</td>
                  <td className="num">{p.fixed == null ? '浮动' : `${p.fixed.toLocaleString('zh-CN')} 元`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {game === 'dlt' && (
          <div className="tiny" style={{ marginTop: 8 }}>
            注：2026 年 2 月 2 日起大乐透由 9 个奖级合并为 7 个奖级；奖池 ≥ 8 亿元时固定奖上浮（5000→6666、300→380、150→200、15→18、5→7）。
          </div>
        )}
      </div>
    </div>
  );
}
