// The plate: half vegetables, a quarter protein and pulses, a quarter grains and millets, and two
// small circles for fruit and dairy. Untagged segments stay pale.
type Tags = Partial<Record<'veg' | 'protein' | 'grain' | 'fruit' | 'dairy', boolean>>;
const COLOURS = { veg: '#7DB06B', protein: '#E3A03A', grain: '#E9DDC3', fruit: '#D8553F', dairy: '#CFE0F0' } as const;
const PALE = '#E9EEE9';
const NAMES = { veg: 'vegetables', protein: 'protein and pulses', grain: 'grains and millets', fruit: 'fruit', dairy: 'dairy' } as const;

export function plateLabel(tags: Tags, prefix = 'Plate') {
  const on = (Object.keys(NAMES) as (keyof typeof NAMES)[]).filter(k => tags[k]).map(k => NAMES[k]);
  return `${prefix}: ${on.length ? on.join(', ') : 'nothing tagged yet'}`;
}

export function PlateGraphic({ tags, size = 120, label }: { tags: Tags; size?: number; label?: string }) {
  const c = size / 2, r = size * 0.42, ri = r * 0.86;
  const fill = (k: keyof Tags) => (tags[k] ? COLOURS[k] : PALE);
  const arc = (a0: number, a1: number) => {
    const p = (a: number) => [c + ri * Math.cos((a * Math.PI) / 180), c + ri * Math.sin((a * Math.PI) / 180)] as const;
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    return `M${c} ${c} L${x0.toFixed(1)} ${y0.toFixed(1)} A${ri} ${ri} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z`;
  };
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label ?? plateLabel(tags)}>
      <circle cx={c} cy={c} r={r} fill="#fff" stroke="#D9D3C4" strokeWidth={size * 0.02} />
      <path d={arc(90, 270)} fill={fill('veg')} stroke="#fff" strokeWidth="2" />
      <path d={arc(270, 360)} fill={fill('protein')} stroke="#fff" strokeWidth="2" />
      <path d={arc(0, 90)} fill={fill('grain')} stroke="#fff" strokeWidth="2" />
      <circle cx={size * 0.84} cy={size * 0.13} r={size * 0.07} fill={fill('fruit')} stroke="#fff" strokeWidth="2" />
      <circle cx={size * 0.95} cy={size * 0.13} r={size * 0.07} fill={fill('dairy')} stroke="#fff" strokeWidth="2" />
    </svg>
  );
}
