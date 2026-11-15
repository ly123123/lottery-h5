import { useMemo } from 'react';
import type { Draw } from '../core/types';

/** 号码走势矩阵：行 = 期次，列 = 号码，点亮 = 当期开出 */
export function TrendMatrix({ draws, max, rows = 18 }: { draws: Draw[]; max: number; rows?: number }) {
  const recent = useMemo(() => draws.slice(-rows), [draws, rows]);
  const cols = max;
  return (
    <div className="matrix-wrap">
      <div className="matrix" style={{ gridTemplateColumns: `26px repeat(${cols}, 1fr)` }}>
        <div />
        {Array.from({ length: cols }, (_, i) => (
          <div key={'h' + i} className="matrix-head">{i + 1}</div>
        ))}
        {recent.map((d, ri) => (
          <Row key={d.code} draw={d} ri={ri} cols={cols} max={max} />
        ))}
      </div>
    </div>
  );
}

function Row({ draw, ri, cols, max }: { draw: Draw; ri: number; cols: number; max: number }) {
  const set = new Set(draw.main);
  return (
    <>
      <div className="matrix-row-label" style={{ opacity: ri === 0 ? 1 : 0.6 }}>
        {draw.code.slice(-3)}
      </div>
      {Array.from({ length: cols }, (_, i) => {
        const n = i + 1;
        const hit = set.has(n);
        return (
          <div
            key={n}
            className="matrix-cell"
            title={`${draw.code} 期 · ${n} 号`}
            style={{
              background: hit ? '#e8405a' : 'rgba(255,255,255,0.045)',
              boxShadow: hit ? '0 0 6px rgba(232,64,90,0.55)' : 'none',
            }}
          />
        );
      })}
    </>
  );
}

/** 折线图（和值走势等） */
export function LineChart({ data, height = 110, color = '#f6c453', band }: {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  band?: [number, number];
}) {
  if (!data.length) return null;
  const values = data.map((d) => d.value);
  const min = Math.min(...values, band ? band[0] : Infinity);
  const max = Math.max(...values, band ? band[1] : -Infinity);
  const span = max - min || 1;
  const W = 100;
  const H = height;
  const pad = 6;
  const x = (i: number) => (i / Math.max(1, data.length - 1)) * (W - pad * 2) + pad;
  const y = (v: number) => H - pad - ((v - min) / span) * (H - pad * 2);
  const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(d.value).toFixed(2)}`).join(' ');
  const area = `${path} L${x(data.length - 1).toFixed(2)},${H - pad} L${x(0).toFixed(2)},${H - pad} Z`;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }}>
        <defs>
          <linearGradient id={`lg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.35" />
            <stop offset="1" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {band && (
          <rect
            x={pad} y={y(band[1])} width={W - pad * 2} height={Math.max(1, y(band[0]) - y(band[1]))}
            fill="rgba(246,196,83,0.08)"
          />
        )}
        <path d={area} fill={`url(#lg-${color.replace('#', '')})`} />
        <path d={path} fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {data.map((d, i) => (
          <circle key={i} cx={x(i)} cy={y(d.value)} r="1.1" fill={color} />
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#5c6a8c', marginTop: 2 }}>
        <span>{data[0].label}</span>
        <span>{data[data.length - 1].label}</span>
      </div>
    </div>
  );
}

/** 概率条列表 */
export function ProbBars({ items, max, color = '#e8405a' }: {
  items: { n: number; p: number; tag?: string }[];
  max: number;
  color?: string;
}) {
  const peak = Math.max(...items.map((x) => x.p), 1e-6);
  return (
    <div>
      {items.map((it) => (
        <div className="prob-row" key={it.n}>
          <span className="prob-num" style={{ color }}>{String(it.n).padStart(2, '0')}</span>
          <div className="prob-track">
            <div
              className="prob-fill"
              style={{
                width: `${Math.max(4, (it.p / peak) * 100)}%`,
                background: `linear-gradient(90deg, ${color}, ${color}aa)`,
              }}
            />
          </div>
          <span className="prob-val" style={it.tag ? { color, fontWeight: 700 } : undefined}>
            {it.tag || (it.p * 100).toFixed(1) + '%'}
          </span>
        </div>
      ))}
      <div className="tiny" style={{ marginTop: 6 }}>
        相对强度（最高号 = 100%），单号理论期望 {(max).toFixed(3)}
      </div>
    </div>
  );
}
