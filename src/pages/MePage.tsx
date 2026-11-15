import { useEffect, useMemo, useState } from 'react';
import type { Draw, GameKey } from '../core/types';
import { RULES, levelsFor } from '../core/rules';
import { BallRow } from '../components/Ball';
import { getTickets, removeTicket, type SavedTicket } from '../lib/store';
import { DATA_META, loadDraws } from '../lib/data';
import { computeAmount, countHits, expandComplexHits } from '../core/money';

/** 与最近一期开奖核对 */
function checkWin(t: SavedTicket, last: Draw) {
  const rule = RULES[t.game];
  const lv = levelsFor(rule, last.code);
  const { mainHit, specialHit } = countHits(t, last);
  const isComplex = t.main.length > rule.mainCount || t.special.length > rule.specialCount;
  if (!isComplex) {
    const hit = lv.find((x) => x.combos.some((c) => c.main === mainHit && c.special === specialHit));
    return {
      mainHit, specialHit, isComplex,
      level: hit?.level ?? null,
      name: hit?.name ?? null,
      total: hit?.fixed != null ? hit.fixed * t.multiple : null,
      detail: null as null | ReturnType<typeof expandComplexHits>,
    };
  }
  const detail = expandComplexHits(t.game, t.main.length, t.special.length, mainHit, specialHit, lv);
  const total = detail.reduce((s, d) => s + (d.total ?? 0), 0) * t.multiple;
  return {
    mainHit, specialHit, isComplex,
    level: detail[0]?.level ?? null,
    name: detail[0]?.name ?? null,
    total,
    detail,
  };
}

export default function MePage({ game }: { game: GameKey }) {
  const [tickets, setTickets] = useState<SavedTicket[]>([]);
  const [filter, setFilter] = useState<'all' | 'ssq' | 'dlt'>('all');

  const lastDraws = useMemo(() => {
    const ssq = loadDraws('ssq');
    const dlt = loadDraws('dlt');
    return { ssq: ssq[ssq.length - 1], dlt: dlt[dlt.length - 1] };
  }, []);

  useEffect(() => { setTickets(getTickets()); }, []);

  const del = (id: string) => {
    removeTicket(id);
    setTickets(getTickets());
  };

  const shown = tickets.filter((t) => filter === 'all' || t.game === filter);

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card">
        <div className="card-hd">
          <div className="card-title"><span className="dot" />我的号码</div>
          <span className="card-sub">{shown.length} 注</span>
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {(['all', 'ssq', 'dlt'] as const).map((f) => (
            <button key={f} className={filter === f ? 'chip red' : 'chip'} style={{ border: 'none' }} onClick={() => setFilter(f)}>
              {f === 'all' ? '全部' : f === 'ssq' ? '双色球' : '大乐透'}
            </button>
          ))}
        </div>

        {shown.length === 0 && <div className="empty">还没有收藏号码<br />去「智能预测」或「自选选号」挑一注吧</div>}

        {shown.map((t) => {
          const rule = RULES[t.game];
          const chk = computeAmount(t.game, t.main.length, t.special.length, t.multiple, t.append);
          return (
            <div key={t.id} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="row" style={{ marginBottom: 7 }}>
                <span className="chip">{t.game === 'ssq' ? '双色球' : '大乐透'}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="tiny" style={{ color: '#f6c453' }}>{chk.bets} 注 · ¥{chk.amount}.00</span>
                  <button className="chip" style={{ border: 'none', color: '#ff8a9a' }} onClick={() => del(t.id)}>删除</button>
                </div>
              </div>
              <BallRow main={t.main} special={t.special} size="sm" />
              <div className="tiny" style={{ marginTop: 6 }}>
                {t.multiple} 倍{t.append ? ' · 追加' : ''} · 单价 {rule.price + (t.append ? rule.extraPrice : 0)} 元
                {t.label ? ` · ${t.label}` : ''}
                · {new Date(t.createdAt).toLocaleDateString('zh-CN')}
              </div>
              {(() => {
                const last = t.game === 'ssq' ? lastDraws.ssq : lastDraws.dlt;
                const w = checkWin(t, last);
                const win = w.total != null && w.total > 0;
                return (
                  <div className="tiny" style={{ marginTop: 5, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="chip" style={{ padding: '1px 6px' }}>第 {last.code} 期核对</span>
                    <span style={{ color: win ? '#2fd18b' : '#64708f' }}>
                      命中 {w.mainHit}+{w.specialHit}
                      {w.isComplex && `（复式展开）`}
                      {win ? ` → ${w.name}，约 ${w.total!.toLocaleString('zh-CN')} 元` : ' → 未中奖'}
                    </span>
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="card-hd">
          <div className="card-title"><span className="dot" />数据与算法</div>
        </div>
        <div className="row"><span className="tiny">双色球数据</span><span className="tiny">{DATA_META.ssq.count} 期 · {DATA_META.ssq.first} ~ {DATA_META.ssq.last}</span></div>
        <div className="row"><span className="tiny">大乐透数据</span><span className="tiny">{DATA_META.dlt.count} 期 · {DATA_META.dlt.first} ~ {DATA_META.dlt.last}</span></div>
        <div className="row"><span className="tiny">数据来源</span><span className="tiny">中国福彩 / 中国体彩官方公告</span></div>
        <div className="row"><span className="tiny">数据更新</span><span className="tiny">{DATA_META.generatedAt}</span></div>
        <div className="divider" />
        <div className="tiny" style={{ lineHeight: 1.8 }}>
          集成模型由 5 个子模型加权构成：近期热度（指数加权半衰期 25 期）、贝叶斯后验频率、遗漏回归、一阶马尔可夫转移、岭回归多因子。
          号码排序后再做组合约束过滤：和值落在历史 10%~90% 分位、奇偶与大小比例贴近历史分布、限制连号与跨度，
          并对生日号、递增数列、全小号等"大众化组合"降权，降低与他人重复导致的奖金摊薄。
        </div>
      </div>

      <div className="card">
        <div className="card-hd">
          <div className="card-title"><span className="dot" />安装到 iPhone</div>
          <span className="card-sub">像 App 一样使用</span>
        </div>
        <div className="step"><span className="step-n">1</span>用 <b>Safari</b> 打开本页（微信/QQ 内置浏览器不支持安装）</div>
        <div className="step"><span className="step-n">2</span>点击底部「分享」按钮 <span className="tiny">（方框 + 向上箭头）</span></div>
        <div className="step"><span className="step-n">3</span>选择「添加到主屏幕」→ 右上角「添加」</div>
        <div className="step"><span className="step-n">4</span>主屏幕出现「智选号码」图标，全屏运行、断网可用</div>
        <div className="alert ok" style={{ marginTop: 10 }}>已支持离线：所有开奖数据与算法都打包在本地，无网络也能分析选号。</div>
      </div>

      <div className="card">
        <div className="card-hd">
          <div className="card-title"><span className="dot" />合规与风险提示</div>
        </div>
        <div className="alert danger">
          <b>合规声明</b><br />
          本应用不销售、不代购、不代理任何彩票业务，不提供任何形式的投注、资金或兑奖通道。<br />
          开奖数据来自官方公开发布的信息；号码与分析结果仅供娱乐与学习参考，<b>不构成任何投注建议</b>。
        </div>
        <div className="alert" style={{ marginTop: 8 }}>
          <b>风险提示</b><br />
          彩票属于射幸游戏，中奖结果完全随机，<b>任何算法都无法提高中奖概率</b>。
          凡是宣称"必中""稳赚""内部消息"的，都是虚假宣传。请理性购彩，切勿沉迷。
        </div>
        <div className="alert ok" style={{ marginTop: 8 }}>
          <b>隐私保护</b><br />
          本应用不收集、不上传任何个人数据。收藏号码与录入记录只保存在本机浏览器，
          无统计脚本、无广告、无第三方请求。清除浏览器数据即可彻底删除。
        </div>
        <div className="tiny" style={{ marginTop: 10, lineHeight: 1.8 }}>
          · 双色球单注 2 元，红球 6 个（1-33）+ 蓝球 1 个（1-16）<br />
          · 超级大乐透单注 2 元，前区 5 个（1-35）+ 后区 2 个（1-12），追加每注 +1 元<br />
          · 单张彩票金额上限 20,000 元，单注倍数上限 99 倍<br />
          · 未满 18 周岁不得购买彩票或兑奖<br />
          · 请根据自身经济状况理性投注，切勿沉迷
        </div>
      </div>

      <div className="tiny" style={{ textAlign: 'center', padding: '4px 0 8px' }}>
        智选号码 v1.0.0 · 纯前端离线运行
      </div>
      <span hidden>{game}</span>
    </div>
  );
}