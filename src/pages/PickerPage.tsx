import { useMemo, useState } from 'react';
import type { Draw, GameKey } from '../core/types';
import { RULES } from '../core/rules';
import { computeAmount, splitTickets } from '../core/money';
import Segmented from '../components/Segmented';
import { addTicket } from '../lib/store';
import { RNG } from '../core/rng';

export default function PickerPage({ draws, game }: { draws: Draw[]; game: GameKey }) {
  const rule = RULES[game];
  const [main, setMain] = useState<number[]>([]);
  const [special, setSpecial] = useState<number[]>([]);
  const [multiple, setMultiple] = useState(1);
  const [append, setAppend] = useState(false);
  const [toast, setToast] = useState('');

  const toggleMain = (n: number) => {
    setMain((prev) => {
      if (prev.includes(n)) return prev.filter((x) => x !== n);
      if (prev.length >= rule.maxMainPick) return prev;
      return [...prev, n].sort((a, b) => a - b);
    });
  };
  const toggleSpecial = (n: number) => {
    setSpecial((prev) => {
      if (prev.includes(n)) return prev.filter((x) => x !== n);
      if (prev.length >= rule.maxSpecialPick) return prev;
      if (rule.specialCount === 1) return [n];
      return [...prev, n].sort((a, b) => a - b);
    });
  };

  const check = useMemo(
    () => computeAmount(game, main.length, special.length, multiple, append),
    [game, main.length, special.length, multiple, append],
  );

  const enough = main.length >= rule.mainCount && special.length >= rule.specialCount;

  const randomPick = () => {
    const rng = new RNG(Date.now() % 100000);
    const pool = Array.from({ length: rule.mainMax }, (_, i) => i + 1);
    const spool = Array.from({ length: rule.specialMax }, (_, i) => i + 1);
    const m: number[] = [];
    while (m.length < rule.mainCount) {
      const idx = rng.int(pool.length);
      m.push(pool.splice(idx, 1)[0]);
    }
    const s: number[] = [];
    while (s.length < rule.specialCount) {
      const idx = rng.int(spool.length);
      s.push(spool.splice(idx, 1)[0]);
    }
    setMain(m.sort((a, b) => a - b));
    setSpecial(s.sort((a, b) => a - b));
  };

  const clear = () => { setMain([]); setSpecial([]); };

  const save = () => {
    if (!enough) return;
    addTicket({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      game, main, special, multiple, append, createdAt: Date.now(),
      source: main.length > rule.mainCount || special.length > rule.specialCount ? 'complex' : 'manual',
      bets: check.bets, amount: check.amount,
    });
    setToast('已收藏到「我的」');
    setTimeout(() => setToast(''), 1800);
  };

  const rest = useMemo(() => {
    if (!enough || check.errors.length === 0) return null;
    if (check.amount > rule.maxAmount) {
      const tickets = splitTickets(game, check.amount);
      return { tickets };
    }
    return null;
  }, [enough, check, game, rule]);

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card">
        <div className="card-hd">
          <div className="card-title"><span className="dot" />自选号码</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn sm" onClick={randomPick}>机选</button>
            <button className="btn sm" onClick={clear}>清空</button>
          </div>
        </div>

        <div className="row">
          <span className="tiny">{rule.mainCount === 6 ? '红球' : '前区'} · 已选 <span style={{ color: '#ff8a9a' }}>{main.length}</span> / {rule.mainCount}-{rule.maxMainPick}</span>
          <span className="tiny">点选切换</span>
        </div>
        <div className="pick-grid" style={{ marginTop: 8 }}>
          {Array.from({ length: rule.mainMax }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              className={`pick-cell ${main.includes(n) ? 'on main' : ''}`}
              onClick={() => toggleMain(n)}
            >
              {String(n).padStart(2, '0')}
            </button>
          ))}
        </div>

        <div className="row" style={{ marginTop: 14 }}>
          <span className="tiny">
            {rule.specialCount === 1 ? '蓝球' : '后区'} · 已选 <span style={{ color: '#8db4ff' }}>{special.length}</span> / {rule.specialCount}
            {rule.specialMax > 2 ? `-${rule.maxSpecialPick}` : ''}
          </span>
        </div>
        <div className="pick-grid" style={{ marginTop: 8 }}>
          {Array.from({ length: rule.specialMax }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              className={`pick-cell ${special.includes(n) ? 'on special' : ''}`}
              onClick={() => toggleSpecial(n)}
            >
              {String(n).padStart(2, '0')}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-hd">
          <div className="card-title"><span className="dot" />投注设置</div>
          <span className="card-sub">{enough ? `${check.bets} 注` : '请继续选号'}</span>
        </div>
        <div className="row">
          <span className="tiny">倍数</span>
          <Segmented
            size="sm"
            value={String(multiple)}
            onChange={(v) => setMultiple(Number(v))}
            options={[{ value: '1', label: '1倍' }, { value: '2', label: '2倍' }, { value: '5', label: '5倍' }, { value: '10', label: '10倍' }, { value: '20', label: '20倍' }, { value: '50', label: '50倍' }]}
          />
        </div>
        {game === 'dlt' && (
          <div className="row" style={{ marginTop: 12 }}>
            <span className="tiny">追加投注（每注 +1 元，最高多得 80% 奖金）</span>
            <button className={append ? 'chip green' : 'chip'} style={{ border: 'none' }} onClick={() => setAppend(!append)}>
              {append ? '已开启' : '关闭'}
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-hd">
          <div className="card-title"><span className="dot" />金额明细</div>
          <span className="card-sub">按官方规则计算</span>
        </div>
        <div className="row"><span className="tiny">{rule.mainCount === 6 ? '红球' : '前区'}个数 × {rule.specialCount === 1 ? '蓝球' : '后区'}个数</span><span className="tiny">{main.length} × {special.length}</span></div>
        <div className="row"><span className="tiny">组合数（注数）</span><span className="tiny" style={{ color: '#f6c453' }}>{check.bets.toLocaleString('zh-CN')} 注</span></div>
        <div className="row"><span className="tiny">单注单价</span><span className="tiny">{check.unitPrice}.00 元</span></div>
        <div className="row"><span className="tiny">倍数</span><span className="tiny">× {multiple}</span></div>
        <div className="divider" />
        <div className="row">
          <span style={{ fontSize: 13, fontWeight: 650 }}>应付金额</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: check.ok ? '#f6c453' : '#ff8a9a', fontVariantNumeric: 'tabular-nums' }}>
            ¥ {check.amount.toLocaleString('zh-CN')}.00
          </span>
        </div>
        {!enough && <div className="alert" style={{ marginTop: 10 }}>至少需要选满 {rule.mainCount} 个{rule.mainCount === 6 ? '红球' : '前区'} + {rule.specialCount} 个{rule.specialCount === 1 ? '蓝球' : '后区'}才能生成有效投注。</div>}
        {(main.length > 0 || special.length > 0) && check.errors.map((e, i) => (
          <div key={i} className="alert danger" style={{ marginTop: 8 }}>{e}</div>
        ))}
        {check.warnings.map((e, i) => <div key={i} className="alert" style={{ marginTop: 8 }}>{e}</div>)}
        {rest && (
          <div className="alert" style={{ marginTop: 8 }}>
            拆分方案：需分 {rest.tickets.length} 张彩票出票，金额分别为 {rest.tickets.map((t) => t.toLocaleString('zh-CN')).join(' + ')} 元。
          </div>
        )}
      </div>

      <button className="btn primary block" disabled={!enough || !check.ok} onClick={save}>
        {toast || '收藏这注号码'}
      </button>
      <div className="tiny" style={{ textAlign: 'center' }}>
        金额由 C(n,k) 组合数严格计算，与彩票终端一致；如与实际出票金额有差异，请以终端为准。
      </div>
    </div>
  );
}
