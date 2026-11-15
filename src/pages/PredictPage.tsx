import { useMemo, useState } from 'react';
import type { Draw, GameKey } from '../core/types';
import { RULES } from '../core/rules';
import { scoreZone, DEFAULT_WEIGHTS, MODEL_LABEL, type ModelId } from '../core/models';
import { comboStats } from '../core/stats';
import { deriveFilters, generateSingleBets, recommendComplex } from '../core/generator';
import { RNG } from '../core/rng';
import { computeAmount } from '../core/money';
import Ball, { BallRow } from '../components/Ball';
import Segmented from '../components/Segmented';
import { nextIssue } from '../lib/nextIssue';
import { addTicket } from '../lib/store';
import BacktestPanel from '../components/BacktestPanel';

const PRESETS: Record<GameKey, { main: number; special: number; label: string }[]> = {
  ssq: [
    { main: 8, special: 2, label: '8+2' },
    { main: 9, special: 3, label: '9+3' },
    { main: 10, special: 3, label: '10+3' },
  ],
  dlt: [
    { main: 7, special: 3, label: '7+3' },
    { main: 8, special: 3, label: '8+3' },
    { main: 9, special: 3, label: '9+3' },
  ],
};

export default function PredictPage({ draws, game }: { draws: Draw[]; game: GameKey }) {
  const rule = RULES[game];
  const [multiple, setMultiple] = useState(1);
  const [append, setAppend] = useState(false);
  const [count, setCount] = useState(5);
  const [seed, setSeed] = useState(1);
  const [toast, setToast] = useState('');

  const model = useMemo(() => {
    const main = scoreZone(draws, game, 'main', { weights: DEFAULT_WEIGHTS });
    const special = scoreZone(draws, game, 'special', { weights: DEFAULT_WEIGHTS });
    const cs = comboStats(draws, game);
    const filters = deriveFilters(game, cs);
    return { main, special, cs, filters };
  }, [draws, game]);

  const bets = useMemo(() => {
    return generateSingleBets({
      key: game,
      probsMain: model.main.probs,
      probsSpecial: model.special.probs,
      filters: model.filters,
      count,
      rng: new RNG(seed * 7919 + 31),
      avoidPopular: true,
      candidates: 6000,
    });
  }, [model, count, seed, game]);

  const complex = useMemo(() => {
    return PRESETS[game].map((p) => {
      const pick = recommendComplex(game, model.main.probs, model.special.probs, p.main, p.special, append);
      const amt = computeAmount(game, p.main, p.special, multiple, append);
      return { ...pick, label: p.label, check: amt };
    });
  }, [game, model, multiple, append]);

  const unitPrice = rule.price + (append ? rule.extraPrice : 0);
  const singleTotal = bets.length * unitPrice * multiple;
  const complexTotal = complex.reduce((s, c) => s + c.amount * multiple, 0);
  const grandTotal = singleTotal + complexTotal;
  const singleCheck = computeAmount(game, rule.mainCount, rule.specialCount, multiple, append);

  const next = nextIssue(game, draws[draws.length - 1].code, draws[draws.length - 1].date);
  const lastPool = draws[draws.length - 1].pool;
  const boosted = game === 'dlt' && lastPool >= 8e8;

  const refresh = () => setSeed((s) => s + 1);

  const saveAll = () => {
    for (const b of bets) {
      addTicket({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        game, main: b.main, special: b.special, multiple, append,
        createdAt: Date.now(), source: 'predict',
        bets: 1, amount: unitPrice * multiple,
        label: '预测推荐',
      });
    }
    setToast(`已收藏 ${bets.length} 注`);
    setTimeout(() => setToast(''), 1800);
  };

  const topMain = model.main.probs
    .map((p, i) => ({ n: i + 1, p }))
    .sort((a, b) => b.p - a.p)
    .slice(0, 10);
  const topSpecial = model.special.probs
    .map((p, i) => ({ n: i + 1, p }))
    .sort((a, b) => b.p - a.p)
    .slice(0, 5);

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(232,64,90,0.16), rgba(61,123,255,0.12))' }}>
        <div className="row">
          <div>
            <div className="card-sub">下一期</div>
            <div style={{ fontSize: 19, fontWeight: 800, marginTop: 2 }}>
              第 {next.code} 期
            </div>
            <div className="tiny" style={{ marginTop: 3 }}>{next.date} {next.weekday} 开奖</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="card-sub">奖池滚存</div>
            <div style={{ fontSize: 17, fontWeight: 750, color: '#f6c453', marginTop: 2 }}>
              {(lastPool / 1e8).toFixed(2)} 亿
            </div>
            {game === 'dlt' && (
              <div className="tiny" style={{ marginTop: 3, color: boosted ? '#2fd18b' : '#64708f' }}>
                {boosted ? '已触发固定奖上浮' : '未达 8 亿上浮线'}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-hd">
          <div className="card-title"><span className="dot" />投注参数</div>
          <span className="card-sub">金额实时核算</span>
        </div>
        <div className="row">
          <span className="tiny">单式注数</span>
          <Segmented
            size="sm"
            value={String(count)}
            onChange={(v) => setCount(Number(v))}
            options={[{ value: '3', label: '3 注' }, { value: '5', label: '5 注' }, { value: '8', label: '8 注' }, { value: '10', label: '10 注' }]}
          />
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <span className="tiny">倍数</span>
          <Segmented
            size="sm"
            value={String(multiple)}
            onChange={(v) => setMultiple(Number(v))}
            options={[{ value: '1', label: '1倍' }, { value: '2', label: '2倍' }, { value: '5', label: '5倍' }, { value: '10', label: '10倍' }, { value: '20', label: '20倍' }]}
          />
        </div>
        {game === 'dlt' && (
          <div className="row" style={{ marginTop: 12 }}>
            <span className="tiny">追加投注（每注 +1 元）</span>
            <button className={append ? 'chip green' : 'chip'} onClick={() => setAppend(!append)} style={{ border: 'none' }}>
              {append ? '已开启' : '关闭'}
            </button>
          </div>
        )}
        <div className="divider" />
        <div className="row">
          <span className="tiny">单注单价</span>
          <span className="tiny" style={{ color: '#f6c453' }}>{unitPrice}.00 元 / 注</span>
        </div>
        <div className="row">
          <span className="tiny">单式合计</span>
          <span className="tiny" style={{ color: '#f6c453' }}>{bets.length} 注 × {unitPrice} 元 × {multiple} 倍 = {singleTotal.toLocaleString('zh-CN')}.00 元</span>
        </div>
      </div>

      <div className="card">
        <div className="card-hd">
          <div className="card-title"><span className="dot" />单注推荐</div>
          <button className="btn sm" onClick={refresh}>换一批</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {bets.map((b, i) => (
            <div key={i} className="bet-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 12, background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: 10, color: '#5c6a8c', width: 18, flex: 'none' }}>{i + 1}</span>
              <div style={{ flex: 1 }}>
                <BallRow main={b.main} special={b.special} size="sm" />
              </div>
              <div style={{ textAlign: 'right', flex: 'none' }}>
                <div style={{ fontSize: 11.5, color: '#f6c453', fontWeight: 700 }}>{unitPrice * multiple}.00 元</div>
                <div style={{ fontSize: 9, color: '#5c6a8c' }}>1 注 × {multiple} 倍</div>
              </div>
            </div>
          ))}
        </div>
        <button className="btn block sm" style={{ marginTop: 10 }} onClick={saveAll}>收藏这 {bets.length} 注</button>
        {toast && <div className="alert ok" style={{ marginTop: 8 }}>{toast}</div>}
      </div>

      <div className="card">
        <div className="card-hd">
          <div className="card-title"><span className="dot" />复式推荐</div>
          <span className="card-sub">覆盖更大，注数×倍数</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {complex.map((c) => (
            <div key={c.label} style={{ padding: 11, borderRadius: 12, background: 'rgba(255,255,255,0.035)', border: c.check.ok ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(232,64,90,0.4)' }}>
              <div className="row">
                <span className="chip gold">{c.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: c.check.ok ? '#f6c453' : '#ff8a9a' }}>
                  {(c.amount * multiple).toLocaleString('zh-CN')}.00 元
                </span>
              </div>
              <div style={{ marginTop: 8 }}>
                <BallRow main={c.main} special={c.special} size="sm" />
              </div>
              <div className="row" style={{ marginTop: 7 }}>
                <span className="tiny">{c.bets.toLocaleString('zh-CN')} 注 × {unitPrice} 元 × {multiple} 倍</span>
                <span className="tiny">{c.check.errors.length > 0 ? '超出单票限额' : '可单票出票'}</span>
              </div>
              {c.check.errors.map((e, k) => (
                <div key={k} className="alert danger" style={{ marginTop: 6 }}>{e}</div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-hd">
          <div className="card-title"><span className="dot" />合计（若全部购买）</div>
          <span className="card-sub">单式 + 三档复式</span>
        </div>
        <div style={{ fontSize: 30, fontWeight: 800, color: '#f6c453', letterSpacing: '-1px', fontVariantNumeric: 'tabular-nums' }}>
          ¥ {grandTotal.toLocaleString('zh-CN')}.00
        </div>
        <div className="divider" />
        <div className="row"><span className="tiny">单式 {bets.length} 注</span><span className="tiny">{singleTotal.toLocaleString('zh-CN')}.00 元</span></div>
        {complex.map((c) => (
          <div className="row" key={c.label}>
            <span className="tiny">复式 {c.label} · {c.bets.toLocaleString('zh-CN')} 注</span>
            <span className="tiny">{(c.amount * multiple).toLocaleString('zh-CN')}.00 元</span>
          </div>
        ))}
        <div className="divider" />
        <div className="alert">
          上表为把「单式 5 注 + 三档复式」全部买下的总支出。实际购买时请按需选择，单式与复式是相互独立的投注方式，金额可直接对上表分项。
        </div>
        {singleCheck.errors.length > 0 && (
          <div className="alert danger" style={{ marginTop: 8 }}>{singleCheck.errors[0]}</div>
        )}
      </div>

      <div className="card">
        <div className="card-hd">
          <div className="card-title"><span className="dot" />号码置信排序</div>
          <span className="card-sub">五模型集成</span>
        </div>
        <div className="card-sub" style={{ marginBottom: 7 }}>前区 / 红球 Top 10</div>
        <div className="ball-row">
          {topMain.map((x) => <Ball key={x.n} n={x.n} />)}
        </div>
        <div className="card-sub" style={{ margin: '12px 0 7px' }}>{rule.specialCount === 1 ? '蓝球' : '后区'} Top 5</div>
        <div className="ball-row">
          {topSpecial.map((x) => <Ball key={x.n} n={x.n} type="special" />)}
        </div>
        <div className="divider" />
        <div className="tiny">
          集成权重：
          {(Object.keys(DEFAULT_WEIGHTS) as ModelId[]).map((k) => (
            <span key={k} style={{ marginRight: 8 }}>{MODEL_LABEL[k].replace(/（.*?）/, '')} {(DEFAULT_WEIGHTS[k] * 100).toFixed(0)}%</span>
          ))}
        </div>
      </div>

      <BacktestPanel draws={draws} game={game} />

      <div className="alert">
        ⚠️ 重要提示：彩票每期开奖相互独立，任何算法都无法改变中奖概率。本应用提供的是基于近两年真实开奖数据的统计归类与组合优化，
        用于帮助你更理性地选号、看清真实概率、控制预算。请量力而行，理性购彩，未满 18 周岁不得购买彩票。
      </div>
    </div>
  );
}
