import { requireMember, getTicket } from '@/lib/session';
import { one } from '@/lib/db';
import { APP_URL } from '@/lib/mail';
import { fmtDateTime } from '@/lib/time';
import { createSetupLink, emailSetupLink, stopPersonDevices } from '../actions';
import { sha256 } from '@/lib/crypto';

export default async function Setup({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { circle } = await requireMember({ organiser: true });
  const sp = await searchParams;
  const t = await getTicket<{ token: string }>('setup');
  const link = t ? await one<{ expires_at: string; used_at: string | null }>('select expires_at, used_at from setup_links where token_hash = $1 and circle_id = $2', [sha256(t.token), circle.id]) : null;
  const live = link && !link.used_at && new Date(link.expires_at).getTime() > Date.now();
  const device = await one<{ created_at: string }>('select created_at from person_devices where circle_id = $1 and revoked_at is null order by created_at desc limit 1', [circle.id]);
  const url = live && t ? `${APP_URL}/setup/${t.token}` : null;
  return (
    <>
      <a className="back" href="/app/people">People</a>
      <h1 className="h1">Set up {circle.person_name}&apos;s phone</h1>
      {sp.sent && <div className="note n-ok" role="status">Emailed to {circle.person_email}.</div>}
      {sp.stopped && <div className="note n-ok" role="status">The phone is signed out. Make a new link to set it up again.</div>}
      <div className="cols wide">
        <div className="card">
          {device ? <div className="note n-ok"><b>Phone connected {fmtDateTime(device.created_at)}.</b> {circle.consent_at ? `${circle.person_name} agreed to share with this circle.` : ''}</div>
            : <div className="note n-info">Not set up yet.</div>}
          {url ? (
            <>
              <p className="h2">Open this link on {circle.person_name}&apos;s phone</p>
              <p className="body" style={{ wordBreak: 'break-all', background: '#ECEDE9', padding: 12, borderRadius: 12, fontWeight: 700 }}>{url}</p>
              <p className="small">Works once, until {fmtDateTime(link!.expires_at)}. Send it by message, or email it if they have an email. Do this with them so they can agree on the next screen.</p>
              {circle.person_email && <form action={emailSetupLink}><button className="btn out sm">Email it to {circle.person_email}</button></form>}
            </>
          ) : (
            <>
              <p className="body">A setup link works once, for 24 hours. When {circle.person_name} opens it, they see who is in the circle and agree. The phone then stays signed in. A new link replaces any older phone.</p>
              <form action={createSetupLink}><button className="btn go">{device ? 'Make a new setup link' : 'Make a setup link'}</button></form>
            </>
          )}
        </div>
        <div className="card">
          <p className="h2">On their phone</p>
          <p className="body">After it opens: in Chrome tap the three dots, then <b>Add to Home screen</b>. On an iPhone: Share, then <b>Add to Home Screen</b>.</p>
          {device && <form action={stopPersonDevices}><button className="btn danger sm">Sign out their current phone</button></form>}
        </div>
      </div>
    </>
  );
}
