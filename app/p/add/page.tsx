import { currentPerson } from '@/lib/session';
import { redirect } from 'next/navigation';
import { msg } from '@/lib/errors';
import { ErrorLine } from '@/components/ui';
import { PhotoPicker } from '@/components/PhotoPicker';
import { SubmitButton } from '@/components/SubmitButton';
import { addOwnMedicine } from '../actions';

export const dynamic = 'force-dynamic';

const SLOTS = [['n_morning', 'Morning', 1], ['n_afternoon', 'Afternoon', 0], ['n_night', 'Night', 1]] as const;
const FOOD = [['before', 'Before food'], ['after', 'After food'], ['with', 'With food'], ['any', 'Any time']] as const;

/** A short, large-text form for the care recipient to add their own medicine. */
export default async function AddOwn({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const c = await currentPerson();
  if (!c) redirect('/p');
  const sp = await searchParams;
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <a className="btn out" href="/p?tab=day" style={{ alignSelf: 'flex-start' }}>Back to my day</a>
      <h1 className="h1" style={{ fontSize: 30, margin: 0 }}>Add a medicine</h1>
      <p className="body" style={{ fontSize: 19, margin: 0 }}>Your family will be told, and can help set the exact times.</p>
      <ErrorLine text={msg(sp.e)} />
      <form action={addOwnMedicine} encType="multipart/form-data" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="card" style={{ gap: 8 }}>
          <label className="lbl" htmlFor="name" style={{ fontSize: 19 }}>Name on the strip</label>
          <input id="name" name="name" className="in" required maxLength={80} style={{ fontSize: 20 }} />
          <label className="lbl" htmlFor="purpose" style={{ fontSize: 19 }}>What it is for (optional)</label>
          <input id="purpose" name="purpose" className="in" maxLength={80} placeholder="For example, for sugar" style={{ fontSize: 20 }} />
        </div>
        <div className="card" style={{ gap: 8 }}>
          <p className="lbl" style={{ fontSize: 19, margin: 0 }}>How many tablets, and when</p>
          <div className="grid3">
            {SLOTS.map(([k, l, d]) => (
              <div key={k} className="card slotpick" style={{ padding: 8 }}>
                <label className="slotpick-h" htmlFor={k} style={{ fontSize: 17 }}>{l}</label>
                <select id={k} name={k} className="in" defaultValue={String(d)} style={{ fontSize: 20 }}>
                  {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            ))}
          </div>
          <p className="lbl" style={{ fontSize: 19, margin: '6px 0 0' }}>Food</p>
          <div className="seg four">
            {FOOD.map(([v, l]) => <label key={v}><input type="radio" name="food" value={v} defaultChecked={v === 'after'} />{l}</label>)}
          </div>
        </div>
        <div className="card" style={{ gap: 8 }}>
          <p className="lbl" style={{ fontSize: 19, margin: 0 }}>Photos (optional, helps you find the right tablet)</p>
          <div className="grid2">
            <PhotoPicker name="pill" kind="pill" label="Add pill photo" current={null} />
            <PhotoPicker name="strip" kind="strip" label="Add strip photo" current={null} />
          </div>
          <label className="lbl" htmlFor="stock" style={{ fontSize: 19 }}>Tablets at home now</label>
          <input id="stock" name="stock" type="number" inputMode="numeric" min={0} max={10000} defaultValue={30} required className="in" style={{ fontSize: 20 }} />
        </div>
        <SubmitButton className="btn go big" style={{ width: '100%' }}>Add this medicine</SubmitButton>
      </form>
    </main>
  );
}
