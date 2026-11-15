'use client';
import { useEffect, useRef, useState } from 'react';
import { Icon } from './ui';

/** File input with an immediate preview, so the chosen photo shows before saving. */
export function PhotoPicker({ name, kind, label, current }: { name: string; kind: 'pill' | 'strip'; label: string; current: React.ReactNode }) {
  const [url, setUrl] = useState<string | null>(null);
  const [file, setFile] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="pp-box">{url ? <img src={url} alt={`New ${kind} photo, not saved yet`} /> : current}</div>
      <label className="btn out sm" htmlFor={name} style={{ cursor: 'pointer' }}><Icon name="cam" size={20} />{url ? `Change ${kind} photo` : label}</label>
      <input ref={ref} id={name} name={name} type="file" accept="image/jpeg,image/png,image/webp" className="pp-file"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (url) URL.revokeObjectURL(url);
          setUrl(f ? URL.createObjectURL(f) : null);
          setFile(f ? f.name : '');
        }} />
      <p className="small pp-name" aria-live="polite">{file ? `${file} (saves with the medicine)` : ''}</p>
    </div>
  );
}
