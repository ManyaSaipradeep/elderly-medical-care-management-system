import { requireMember } from '@/lib/session';
import { q } from '@/lib/db';
import { fmtDateTime } from '@/lib/time';
import { notFound } from 'next/navigation';

// Demo aid: shows emails this circle generated. Organisers only, and only when DEMO_OUTBOX=1.
export default async function Outbox() {
  if (process.env.DEMO_OUTBOX !== '1') notFound();
  const { circle } = await requireMember({ organiser: true });
  const rows = await q<{ id: string; to_addrs: string[]; subject: string; html: string; created_at: string; sent_at: string | null; error: string | null }>(
    'select * from outbox where circle_id = $1 order by created_at desc limit 30', [circle.id]);
  return (
    <>
      <h1 className="h1">Outbox</h1>
      <p className="lead">Every email the circle sent, newest first. {process.env.GMAIL_USER ? 'Email sending is on.' : 'Email sending is off, so emails only appear here.'}</p>
      {rows.map((r) => (
        <details key={r.id} className="card">
          <summary style={{ cursor: 'pointer' }}><b>{r.subject}</b><br /><span className="small">{fmtDateTime(r.created_at)} · to {r.to_addrs.join(', ')} · {r.sent_at ? 'sent' : r.error ? 'failed' : 'not sent'}</span></summary>
          <iframe title={r.subject} sandbox="" srcDoc={r.html} style={{ width: '100%', height: 380, border: '1px solid #C9CCC4', borderRadius: 12, background: '#fff' }} />
        </details>
      ))}
    </>
  );
}
