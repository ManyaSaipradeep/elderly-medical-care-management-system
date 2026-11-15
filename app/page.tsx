import { Brand, Icon } from '@/components/ui';
import { currentMember, currentPerson } from '@/lib/session';
import { logout } from './access-actions';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [member, person] = await Promise.all([currentMember(), currentPerson()]);
  return (
    <div>
      <header className="shell-top">
        <Brand />
        <nav className="row" style={{ flexWrap: 'wrap' }} aria-label="Account">
          {member ? <>
                <span className="small" style={{ fontSize: 15 }}>Signed in as <b>{member.member.name}</b></span>
                <a className="btn go sm" href="/app">Open {member.circle.call_name || member.circle.person_name}&apos;s circle</a>
                <form action={logout}><button className="btn out sm">Not you? Sign out</button></form>
              </>
            : person ? <a className="btn go sm" href="/p">Open my medicines</a>
            : <>
                <a className="btn out sm" href="/signin">Sign in</a>
                <a className="btn out sm" href="/join">Join with a code</a>
                <a className="btn go sm" href="/start">Start a circle</a>
              </>}
        </nav>
      </header>
      <main id="main">
        <section style={{ maxWidth: 1160, margin: '0 auto', padding: '48px 20px 40px', display: 'flex', flexWrap: 'wrap', gap: 44, alignItems: 'center' }}>
          <div style={{ flex: '999 1 440px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <h1 style={{ margin: 0, fontSize: 'clamp(34px, 5vw, 50px)', lineHeight: 1.1, maxWidth: 640 }}>One simple screen for the person taking the medicines. Everyone who cares stays in the loop.</h1>
            <p style={{ margin: 0, fontSize: 21, color: '#4A4A4A', maxWidth: 600 }}>
              The care recipient sees photos of their own tablets and what to take now. Family and caretakers manage the rest, and hear only when a dose is really missed.
            </p>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <a className="btn go" href="/start" style={{ fontSize: 20 }}>Start a care circle</a>
              <a className="btn out" href="/join" style={{ fontSize: 20 }}>I have a circle code</a>
            </div>
            <p className="small" style={{ fontSize: 16 }}>Works in any browser. Nothing to install. Nobody joins without their OK.</p>
          </div>
          <div aria-hidden="true" style={{ flex: '1 1 300px', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 320, background: '#FFFFFF', border: '3px solid #1A1A1A', borderRadius: 36, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="day" style={{ padding: 0 }}>
                <div className="done"><Icon name="check" size={18} color="#13532A" stroke={3} />Morning</div>
                <div className="now"><Icon name="noon" size={18} />Now</div>
                <div><Icon name="moon" size={18} color="#4A4A4A" />Night</div>
              </div>
              <div className="slot"><div className="slot-h"><b style={{ fontSize: 18 }}>Afternoon medicines</b></div>
                <div className="pc"><div className="ph2" style={{ height: 100 }}>
                  <div className="img-ph"><Icon name="pill" size={28} color="#4A4A4A" stroke={1.8} /><span>Pill photo</span></div>
                  <div className="img-ph"><Icon name="list" size={24} color="#4A4A4A" stroke={1.8} /><span>Strip photo</span></div>
                </div><p className="take" style={{ fontSize: 24 }}>Take 1</p><span className="food" style={{ fontSize: 16 }}><Icon name="plate" size={20} />After food</span></div>
              </div>
              <div className="btn go" style={{ minHeight: 60, fontSize: 21 }}><Icon name="check" size={26} color="#FFFFFF" stroke={3} />I took them</div>
            </div>
          </div>
        </section>
        <section style={{ background: '#FFFFFF', borderTop: '2px solid #C9CCC4', borderBottom: '2px solid #C9CCC4' }}>
          <div style={{ maxWidth: 1160, margin: '0 auto', padding: '44px 20px', display: 'flex', flexDirection: 'column', gap: 26 }}>
            <h2 style={{ margin: 0, fontSize: 30 }}>Everyone gets the view they need</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 28 }}>
              {[
                ['home', 'Care recipient', 'Their own phone, opened once with a setup link. Big photos of each pill and strip, three buttons, and Help always in reach. They approve who joins and see every change.'],
                ['pill', 'Caretakers', 'Today by morning, afternoon and night. Tap Given, add medicines with two photos, see the last 14 days and the next doctor visit.'],
                ['people', 'Family', 'The same picture from anywhere, reasons for skipped doses in their own words, refill warnings, and a visit sheet for every appointment.'],
              ].map(([i, t, d]) => (
                <div key={t} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><Icon name={i} size={32} /><h3 style={{ margin: 0, fontSize: 22 }}>{t}</h3><p style={{ margin: 0, color: '#4A4A4A' }}>{d}</p></div>
              ))}
            </div>
          </div>
        </section>
        <section style={{ maxWidth: 1160, margin: '0 auto', padding: '44px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(420px, 100%), 1fr))', gap: 36 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}><h2 style={{ margin: 0, fontSize: 28 }}>Alerts that know when to stay quiet</h2><p style={{ margin: 0, color: '#4A4A4A' }}>A reminder 15 minutes before each dose. If nobody confirms within 30 minutes, the caretaker gets an email with a Mark as given button. Only an important medicine still waiting after an hour reaches the whole family. Vitamins never raise an alarm.</p></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}><h2 style={{ margin: 0, fontSize: 28 }}>Private, and their decision</h2><p style={{ margin: 0, color: '#4A4A4A' }}>Joining needs the circle code, the passcode, an email check and approval. Photos are private with location data removed. The care recipient can remove anyone, and the circle can be deleted with every photo.</p></div>
        </section>
      </main>
      <footer style={{ borderTop: '2px solid #C9CCC4', background: '#FFFFFF' }}>
        <div className="small" style={{ maxWidth: 1160, margin: '0 auto', padding: '18px 20px', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span>CareCircle records doses confirmed at home. It is not medical advice.</span><span>Built for PromptWars x Catalyst by Makers Need More</span>
        </div>
      </footer>
    </div>
  );
}
