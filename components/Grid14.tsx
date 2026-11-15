import type { Med } from '@/lib/domain';
const MARK: Record<string, string> = { t: '✓', s: '–', m: '×', p: '', n: '' };
const LABEL: Record<string, string> = { t: 'taken', s: 'skipped', m: 'missed', p: 'waiting', n: 'nothing due' };
export function Grid14({ data }: { data: { days: string[]; meds: { med: Med; cells: string[] }[] } }) {
  if (!data.meds.length) return <p className="small">No medicines yet.</p>;
  return (
    <div className="scrollx">
      <div className="grid14" style={{ minWidth: 420, gridTemplateColumns: '120px repeat(14, minmax(0, 1fr))' }} role="table" aria-label="Doses over the last 14 days">
        <span />
        {data.days.map((d) => <span key={d} className="small" style={{ fontSize: 11, textAlign: 'center' }}>{Number(d.slice(8))}</span>)}
        {data.meds.map(({ med, cells }) => (
          <div key={med.id} style={{ display: 'contents' }} role="row">
            <span style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{med.name}</span>
            {cells.map((c, i) => <i key={i} className={`g-${c}`} title={`${data.days[i]}: ${LABEL[c]}`} aria-label={`${data.days[i]}: ${LABEL[c]}`}>{MARK[c]}</i>)}
          </div>
        ))}
      </div>
      <p className="small" style={{ marginTop: 6 }}>✓ taken · – skipped · × missed · dashed: waiting now</p>
    </div>
  );
}
