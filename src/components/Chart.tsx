interface BarProps { data: { label: string; value: number }[]; color?: string; height?: number; suffix?: string }

/** 轻量 SVG 柱状图，避免引入图表库 */
export function BarChart({ data, color = '#e8405a', height = 96, suffix }: BarProps) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = data.length;
  const gap = 3;
  const w = 100 / n;
  return (
    <div style={{ width: '100%' }}>
      <svg viewBox={`0 0 ${100} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height, display: 'block', overflow: 'visible' }}>
        {data.map((d, i) => {
          const h = (d.value / max) * (height - 16);
          return (
            <g key={i}>
              <rect
                x={i * w + gap / 2} y={height - 14 - h} width={Math.max(0.6, w - gap)} height={Math.max(0.8, h)}
                rx="0.8" fill={color} opacity={0.35 + 0.65 * (d.value / max)}
              />
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'flex', marginTop: 2 }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 8, color: '#5c6a8c', whiteSpace: 'nowrap', overflow: 'hidden' }}>
            {n <= 12 ? d.label : (i % Math.ceil(n / 10) === 0 ? d.label : '')}
          </div>
        ))}
      </div>
      {suffix && <div className="tiny" style={{ textAlign: 'right', marginTop: 2 }}>{suffix}</div>}
    </div>
  );
}

/** 水平占比条 */
export function RatioBars({ data, colors }: { data: { label: string; value: number }[]; colors?: string[] }) {
  const total = data.reduce((a, b) => a + b.value, 0) || 1;
  const palette = colors ?? ['#e8405a', '#f6c453', '#3d7bff', '#2fd18b', '#a855f7', '#fb923c', '#22d3ee'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {data.map((d, i) => {
        const pct = (d.value / total) * 100;
        return (
          <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 52, fontSize: 11, color: '#97a3c4', flex: 'none' }}>{d.label}</span>
            <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(1.5, pct)}%`, height: '100%', borderRadius: 4, background: palette[i % palette.length] }} />
            </div>
            <span style={{ width: 38, textAlign: 'right', fontSize: 10.5, color: '#97a3c4', fontVariantNumeric: 'tabular-nums' }}>
              {pct.toFixed(1)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
