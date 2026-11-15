import 'server-only';
import nodemailer from 'nodemailer';
import { q, log } from './db';

export const APP_URL = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');

/** HTML-escape anything user-supplied before it goes into an email. */
export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const transporter =
  process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD
    ? nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } })
    : null;

type Btn = { label: string; href: string; tone?: 'go' | 'ink' | 'out' | 'alert' };
const TONES = { go: ['#1B6B35', '#FFFFFF'], ink: ['#1A1A1A', '#FFFFFF'], out: ['#FFFFFF', '#1A1A1A'], alert: ['#B3261E', '#FFFFFF'] };

/** Builds the shared email layout. title/lines must already be escaped by the caller. */
export function layout(opts: { circleLabel: string; title: string; lines: string[]; buttons?: Btn[]; urgent?: boolean; footer?: string }) {
  const band = opts.urgent ? '#B3261E' : '#F2A900';
  const bandInk = opts.urgent ? '#FFFFFF' : '#1A1A1A';
  const btns = (opts.buttons || [])
    .map((b) => {
      const [bg, fg] = TONES[b.tone || 'go'];
      return `<a href="${esc(b.href)}" style="display:inline-block;background:${bg};color:${fg};border:2px solid ${b.tone === 'out' ? '#5C6058' : bg};font-weight:bold;padding:13px 20px;border-radius:10px;text-decoration:none;margin:6px 8px 0 0">${esc(b.label)}</a>`;
    })
    .join('');
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;color:#1A1A1A;font-size:17px;line-height:1.5">
<div style="background:${band};color:${bandInk};padding:10px 18px;font-weight:bold">CareCircle · ${opts.circleLabel}</div>
<div style="padding:18px;border:1px solid #C9CCC4;border-top:0">
<p style="margin:0 0 10px;font-size:21px;font-weight:bold;line-height:1.25">${opts.title}</p>
${opts.lines.map((l) => `<p style="margin:0 0 10px">${l}</p>`).join('')}
<div>${btns}</div>
<p style="margin:16px 0 0;font-size:13px;color:#4A4A4A">${opts.footer ?? 'You get this because you are in this care circle. Choose which emails you get in Account.'}</p>
</div></div>`;
}

/** Writes to the outbox, then tries to send. Never throws: a failed email must not break a request. */
/** Strips one-time secrets from the stored copy (the sent email keeps them). */
const redactStored = (html: string, secret?: string) =>
  (secret ? html.split(secret).join('••••••') : html).replace(/\/(a|setup)\/[A-Za-z0-9_-]{20,}/g, '/$1/[link hidden]');

export async function sendMail(circleId: string | null, to: (string | null | undefined)[], subject: string, html: string, opts: { redact?: string } = {}) {
  const list = [...new Set(to.filter((x): x is string => !!x).map((x) => x.trim().toLowerCase()))];
  if (!list.length) return false;
  const [row] = await q<{ id: string }>('insert into outbox (circle_id, to_addrs, subject, html) values ($1,$2,$3,$4) returning id', [circleId, list, subject, redactStored(html, opts.redact)]);
  if (!transporter) {
    log('mail.outbox_only', { id: row.id, subject });
    return true;
  }
  try {
    await transporter.sendMail({ from: `CareCircle <${process.env.GMAIL_USER}>`, to: list.join(','), subject, html });
    await q('update outbox set sent_at = now() where id = $1', [row.id]);
    log('mail.sent', { id: row.id, subject, to: list.length });
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await q('update outbox set error = $2 where id = $1', [row.id, msg.slice(0, 300)]);
    log('mail.failed', { id: row.id, error: msg });
    return false;
  }
}
