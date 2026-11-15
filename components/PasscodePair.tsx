'use client';
import { useEffect, useRef, useState } from 'react';

/** Two 6-digit passcode fields that say straight away whether they match. */
export function PasscodePair({ label = '6-digit passcode' }: { label?: string }) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 6);
  const shortA = a.length > 0 && a.length < 6;
  const mismatch = b.length > 0 && (b.length === 6 || b.length >= a.length) && a !== b && !a.startsWith(b);
  const match = a.length === 6 && a === b;
  const second = useRef<HTMLInputElement>(null);
  // The form cannot be sent while the two differ.
  useEffect(() => { second.current?.setCustomValidity(b && a !== b ? 'Passcodes do not match' : ''); }, [a, b]);
  return (
    <div className="grid2">
      <div>
        <label className="lbl" htmlFor="passcode">{label}</label>
        <input id="passcode" name="passcode" type="password" inputMode="numeric" pattern="\d{6}" maxLength={6} className="in code" required autoComplete="new-password"
          value={a} onChange={(e) => setA(digits(e.target.value))} aria-describedby="pc-a" />
        <p id="pc-a" className="small" aria-live="polite" style={{ color: shortA ? '#6B4300' : undefined, minHeight: 22 }}>{shortA ? `${6 - a.length} more digit${6 - a.length > 1 ? 's' : ''}` : 'Numbers only'}</p>
      </div>
      <div>
        <label className="lbl" htmlFor="passcode2">Type it again</label>
        <input ref={second} id="passcode2" name="passcode2" type="password" inputMode="numeric" pattern="\d{6}" maxLength={6} className="in code" required autoComplete="new-password"
          value={b} onChange={(e) => setB(digits(e.target.value))} aria-invalid={mismatch} aria-describedby="pc-b"
          style={mismatch ? { borderColor: '#B3261E', borderWidth: 3 } : match ? { borderColor: '#1B6B35', borderWidth: 3 } : undefined} />
        <p id="pc-b" className="small" aria-live="polite" style={{ minHeight: 22, fontWeight: 700, color: mismatch ? '#B3261E' : match ? '#1B6B35' : undefined }}>
          {mismatch ? '✕ Passcodes do not match' : match ? '✓ Passcodes match' : ''}
        </p>
      </div>
    </div>
  );
}

