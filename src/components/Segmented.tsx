interface Option { value: string; label: string }
export default function Segmented({ value, onChange, options, size }: {
  value: string; onChange: (v: string) => void; options: Option[]; size?: 'sm';
}) {
  return (
    <div className={size === 'sm' ? 'segmented sm' : 'segmented'}>
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
