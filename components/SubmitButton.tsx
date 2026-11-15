'use client';
import { useFormStatus } from 'react-dom';

/** A submit button that disables itself while saving, so one tap makes one record. */
export function SubmitButton({ children, busy = 'Saving…', className = 'btn go', style }: { children: React.ReactNode; busy?: string; className?: string; style?: React.CSSProperties }) {
  const { pending } = useFormStatus();
  return <button className={className} style={style} disabled={pending} aria-busy={pending}>{pending ? busy : children}</button>;
}
