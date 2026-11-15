export default function Ball({ n, type = 'main', size }: { n: number; type?: 'main' | 'special'; size?: 'sm' | 'lg' }) {
  const cls = ['ball', type === 'special' ? 'blue' : '', size ?? ''].filter(Boolean).join(' ');
  return <span className={cls}>{String(n).padStart(2, '0')}</span>;
}

export function BallRow({ main, special, size }: { main: number[]; special: number[]; size?: 'sm' | 'lg' }) {
  return (
    <div className="ball-row">
      {main.map((n) => <Ball key={'m' + n} n={n} size={size} />)}
      <span className="ball-sep">|</span>
      {special.map((n) => <Ball key={'s' + n} n={n} type="special" size={size} />)}
    </div>
  );
}
