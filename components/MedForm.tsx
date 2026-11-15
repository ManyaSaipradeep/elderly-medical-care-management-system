import { saveMedicine } from '@/app/app/actions';
import { ErrorLine, Photo, Icon } from './ui';
import type { Med } from '@/lib/domain';
import { SubmitButton } from './SubmitButton';
import { PhotoPicker } from './PhotoPicker';

const hhmm = (t?: string) => (t ? t.slice(0, 5) : undefined);

export function MedForm({ med, error, personName }: { med?: Med; error: string | null; personName: string }) {
  const slot = (key: 'morning' | 'afternoon' | 'night', label: string, defN: number, defT: string) => (
    <div className="card slotpick">
      <p className="slotpick-h">{label}</p>
      <label className="lbl" htmlFor={`n_${key}`} style={{ margin: 0 }}>Tablets</label>
      <select id={`n_${key}`} name={`n_${key}`} className="in" defaultValue={String(med ? (med as any)[`n_${key}`] : defN)}>
        {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n === 0 ? 'None' : n}</option>)}
      </select>
      <label className="lbl" htmlFor={`t_${key}`} style={{ margin: 0 }}>Time</label>
      <input id={`t_${key}`} name={`t_${key}`} type="time" className="in" defaultValue={hhmm(med ? (med as any)[`t_${key}`] : defT)} required />
    </div>
  );
  return (
    <form action={saveMedicine} encType="multipart/form-data">
      {med && <input type="hidden" name="id" value={med.id} />}
      <ErrorLine text={error} />
      <div className="cols three">
        <div className="card">
          <label className="lbl" htmlFor="name">Name on the strip</label>
          <input id="name" name="name" className="in" required maxLength={80} defaultValue={med?.name} placeholder="Medicine name and strength" />
          <label className="lbl" htmlFor="purpose">What it is for, in {personName}&apos;s words</label>
          <input id="purpose" name="purpose" className="in" maxLength={80} defaultValue={med?.purpose ?? ''} placeholder="For example, for blood pressure" />
          <p className="lbl">How many, and when (like 1-0-1 on the prescription)</p>
          <div className="grid3">{slot('morning', 'Morning', 1, '08:00')}{slot('afternoon', 'Afternoon', 0, '13:00')}{slot('night', 'Night', 1, '21:00')}</div>
          <p className="lbl">Food</p>
          <div className="seg four">
            {([['before', 'Before food'], ['after', 'After food'], ['with', 'With food'], ['any', 'Any time']] as const).map(([v, l]) => (
              <label key={v}><input type="radio" name="food" value={v} defaultChecked={(med?.food ?? 'after') === v} />{l}</label>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card">
            <p className="lbl" style={{ margin: 0 }}>Photos ({personName} sees these first)</p>
            <div className="grid2">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <PhotoPicker name="pill" kind="pill" label={med?.pill_photo_id ? 'Replace pill photo' : 'Add pill photo'} current={<Photo id={med?.pill_photo_id ?? null} kind="pill" alt="Current pill photo" />} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <PhotoPicker name="strip" kind="strip" label={med?.strip_photo_id ? 'Replace strip photo' : 'Add strip photo'} current={<Photo id={med?.strip_photo_id ?? null} kind="strip" alt="Current strip photo" />} />
              </div>
            </div>
            <p className="small">JPG, PNG or WebP up to 5 MB. Photos are resized and their location data removed. Only this circle can see them.</p>
          </div>
          <div className="card">
            <p className="lbl" style={{ margin: 0 }}>How important</p>
            <div className="pick">
              {([['important', 'Important', 'BP, sugar, heart, blood thinners. Whole circle emailed after 1 hour.'], ['regular', 'Regular', 'Caretaker emailed after 30 minutes.'], ['supplement', 'Supplement', 'Reminder only. No alerts.']] as const).map(([v, l, d]) => (
                <label key={v}><input type="radio" name="importance" value={v} defaultChecked={(med?.importance ?? 'regular') === v} /><span><b>{l}</b><span>{d}</span></span></label>
              ))}
            </div>
            <label className="lbl" htmlFor="stock">Tablets at home now</label>
            <input id="stock" name="stock" type="number" min={0} max={10000} className="in" defaultValue={med?.stock ?? 30} required />
          </div>
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8, flexWrap: 'wrap' }}>
        <a className="btn out" href={med ? `/app/medicines/${med.id}` : '/app/medicines'}>Cancel</a>
        <SubmitButton style={{ minWidth: 200 }}>Save medicine</SubmitButton>
      </div>
      <p className="small" style={{ textAlign: 'right' }}>{personName} is shown a notice about every change, with OK and I have a question.</p>
    </form>
  );
}
