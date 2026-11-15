import { ICONS } from './icons';

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 24, color = 'currentColor', stroke = 2.2 }: { name: string; size?: number; color?: string; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[name] || '' }} />
  );
}

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <span className="mark" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size / 2} height={size / 2} viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth={3}><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" /></svg>
    </span>
  );
}

export function Brand() {
  return <a href="/" className="row" style={{ textDecoration: 'none' }}><Logo /><b style={{ fontSize: 20 }}>CareCircle</b></a>;
}

/** A medicine photo, or a drawn placeholder when none was added. Never a broken image. */
export function Photo({ id, kind, alt }: { id: string | null; kind: 'pill' | 'strip'; alt: string }) {
  if (id) return <img className="photo" src={`/photo/${id}`} alt={alt} />;
  return (
    <div className="img-ph" style={{ borderRadius: 12, height: '100%' }}>
      <Icon name={kind === 'pill' ? 'pill' : 'list'} size={28} color="#4A4A4A" stroke={1.8} />
      <span>{kind === 'pill' ? 'No pill photo yet' : 'No strip photo yet'}</span>
    </div>
  );
}

export function Thumb({ id, alt }: { id: string | null; alt: string }) {
  return (
    <div className="thumb" style={{ overflow: 'hidden' }}>
      {id ? <img className="photo" style={{ borderRadius: 0 }} src={`/photo/${id}`} alt={alt} /> :
        <div className="img-ph" style={{ height: '100%' }}><Icon name="pill" size={22} color="#4A4A4A" stroke={1.8} /></div>}
    </div>
  );
}

export function Chip({ tone, children }: { tone: 'ok' | 'wait' | 'skip' | 'later' | 'imp' | 'reg' | 'sup'; children: React.ReactNode }) {
  return <span className={`chip c-${tone}`}>{children}</span>;
}

export const importanceChip = (i: string) =>
  i === 'important' ? <Chip tone="imp">! Important</Chip> : i === 'regular' ? <Chip tone="reg">Regular</Chip> : <Chip tone="sup">Supplement</Chip>;

export function Field({ label, name, type = 'text', defaultValue, placeholder, note, required, code, inputMode, maxLength, autoComplete }: {
  label: string; name: string; type?: string; defaultValue?: string | number; placeholder?: string; note?: string; required?: boolean;
  code?: boolean; inputMode?: 'numeric' | 'email' | 'text'; maxLength?: number; autoComplete?: string;
}) {
  const id = `f-${name}`;
  return (
    <>
      <label className="lbl" htmlFor={id}>{label}</label>
      <input id={id} name={name} type={type} className={`in${code ? ' code' : ''}`} defaultValue={defaultValue} placeholder={placeholder}
        required={required} inputMode={inputMode} maxLength={maxLength} autoComplete={autoComplete} />
      {note && <p className="small">{note}</p>}
    </>
  );
}

export function ErrorLine({ text }: { text?: string | null }) {
  if (!text) return null;
  return <p role="alert" className="err"><Icon name="warn" size={20} color="#B3261E" />{text}</p>;
}

export function Steps({ labels, current }: { labels: string[]; current: number }) {
  return (
    <div className="vsteps" aria-label={`Step ${current + 1} of ${labels.length}`}>
      {labels.map((l, i) => (
        <div key={l} className={i < current ? 'done' : i === current ? 'cur' : ''}><b>{i < current ? '✓' : i + 1}</b>{l}</div>
      ))}
    </div>
  );
}
