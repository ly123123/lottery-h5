import { useEffect, useMemo, useState } from 'react';
import { loadDraws } from './lib/data';
import type { GameKey } from './core/types';
import { RULES } from './core/rules';
import AnalysisPage from './pages/AnalysisPage';
import PredictPage from './pages/PredictPage';
import PickerPage from './pages/PickerPage';
import MePage from './pages/MePage';
import Segmented from './components/Segmented';

export type TabKey = 'analysis' | 'predict' | 'picker' | 'me';
const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'analysis', label: '数据分析', icon: '📊' },
  { key: 'predict', label: '智能预测', icon: '🎯' },
  { key: 'picker', label: '自选选号', icon: '✍️' },
  { key: 'me', label: '我的', icon: '👤' },
];

export default function App() {
  const [tab, setTab] = useState<TabKey>('analysis');
  const [game, setGame] = useState<GameKey>(() => {
    const saved = localStorage.getItem('lottery.v1.game');
    return saved === 'dlt' ? 'dlt' : 'ssq';
  });

  useEffect(() => { localStorage.setItem('lottery.v1.game', game); }, [game]);

  const draws = useMemo(() => loadDraws(game), [game]);
  const rule = RULES[game];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">选</span>
          <div>
            <h1>智选号码</h1>
            <p>近两年数据 · 组合优化</p>
          </div>
        </div>
        <Segmented
          value={game}
          onChange={(v) => setGame(v as GameKey)}
          options={[{ value: 'ssq', label: '双色球' }, { value: 'dlt', label: '大乐透' }]}
        />
      </header>

      <main className="content">
        {tab === 'analysis' && <AnalysisPage draws={draws} game={game} />}
        {tab === 'predict' && <PredictPage draws={draws} game={game} />}
        {tab === 'picker' && <PickerPage draws={draws} game={game} />}
        {tab === 'me' && <MePage game={game} />}
      </main>

      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'tab active' : 'tab'} onClick={() => setTab(t.key)}>
            <span className="tab-icon">{t.icon}</span>
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </nav>
      <div className="safe-bottom" />
      <span hidden>{rule.name}</span>
    </div>
  );
}
