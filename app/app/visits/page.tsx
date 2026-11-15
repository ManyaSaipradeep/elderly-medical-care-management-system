import { requireMember } from '@/lib/session';
import { q } from '@/lib/db';
import { fmtDateTime, localDate } from '@/lib/time';
import { ErrorLine, Icon } from '@/components/ui';
import { msg } from '@/lib/errors';
import { saveVisit } from '../actions';

export default async function Visits({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { circle } = await requireMember();
  const sp = await searchParams;
  const visits = await q<{ id: string; doctor: string; location: string | null; at: string; upcoming: boolean }>(
    'select id, doctor, location, at, at > now() as upcoming from appointments where circle_id = $1 order by at desc limit 30', [circle.id]);
  const upcoming = visits.filter((v) => v.upcoming).reverse(), past = visits.filter((v) => !v.upcoming);
  return (
    <>
      <h1 className="h1">Doctor visits</h1>
      <div className="cols wide">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!upcoming.length && <div className="card"><p className="body">No visits planned.</p></div>}
          {upcoming.map((v, i) => (
            <div key={v.id} className="card" style={i === 0 ? { borderColor: '#1A1A1A', borderWidth: 3 } : undefined}>
              {i === 0 && <p className="small">Next</p>}
              <p className="h2">{v.doctor}</p><p className="body">{fmtDateTime(v.at)}{v.location ? ` · ${v.location}` : ''}</p>
              <a className="btn ink sm" href={`/app/visits/${v.id}`} style={{ alignSelf: 'flex-start' }}><Icon name="doc" size={18} color="#FFFFFF" />Visit sheet</a>
            </div>
          ))}
          {past.length > 0 && <p className="sect">Past visits</p>}
          {past.map((v) => <a key={v.id} className="card" href={`/app/visits/${v.id}`} style={{ textDecoration: 'none' }}><b>{v.doctor}</b><span className="small">{fmtDateTime(v.at)}</span></a>)}
        </div>
        <form action={saveVisit} className="card">
          <p className="h2">Add a visit</p>
          <ErrorLine text={msg(sp.e)} />
          <label className="lbl" htmlFor="doctor">Doctor and speciality</label><input id="doctor" name="doctor" className="in" required maxLength={80} />
          <label className="lbl" htmlFor="location">Where</label><input id="location" name="location" className="in" maxLength={120} />
          <div className="grid2">
            <div><label className="lbl" htmlFor="date">Date</label><input id="date" name="date" type="date" className="in" required min={localDate()} /></div>
            <div><label className="lbl" htmlFor="time">Time</label><input id="time" name="time" type="time" className="in" required defaultValue="10:00" /></div>
          </div>
          <label className="lbl" htmlFor="notes">Questions for the doctor</label><textarea id="notes" name="notes" className="in" rows={4} maxLength={2000} placeholder="What has changed, side effects, questions" />
          <p className="small">Everyone gets a reminder the day before, with the visit sheet. {circle.person_name} sees it on their screen.</p>
          <button className="btn go">Save visit</button>
        </form>
      </div>
    </>
  );
}
