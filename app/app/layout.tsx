import { requireMember } from '@/lib/session';
import { Brand, Icon } from '@/components/ui';
import { NavLinks, type NavItem } from '@/components/NavLinks';
import { q } from '@/lib/db';
import { handleHelp } from './actions';
import { AutoRefresh } from '@/components/AutoRefresh';
import { fmtTime } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { member, circle } = await requireMember();
  const fam = member.role === 'family';
  const [{ n }] = fam ? await q<{ n: number }>(`select count(*)::int as n from members where circle_id = $1 and status = 'pending' and created_at > now() - interval '7 days'`, [circle.id]) : [{ n: 0 }];
  const help = await q<{ id: string; created_at: string }>(`select id, created_at from help_requests where circle_id = $1 and handled_at is null order by created_at`, [circle.id]);
  const items: NavItem[] = [
    { href: '/app', label: 'Today', icon: 'home' },
    { href: '/app/medicines', label: 'Medicines', icon: 'pill' },
    { href: '/app/visits', label: 'Visits', icon: 'cal' },
    ...(fam ? [{ href: '/app/people', label: n ? `People (${n})` : 'People', icon: 'people' }] : []),
  ];
  const side: NavItem[] = [...items, ...(member.is_organiser ? [{ href: '/app/settings', label: 'Settings', icon: 'gear' }] : []), { href: '/app/account', label: 'Account', icon: 'user' }];
  const bottom: NavItem[] = fam ? items : [...items, { href: '/app/account', label: 'Account', icon: 'user' }];
  const who = circle.call_name || circle.person_name;
  return (
    <div className="shell">
      <header className="shell-top">
        <div className="row"><Brand /><span className="small" style={{ fontSize: 16 }}>{who}&apos;s circle · {fam ? (member.is_organiser ? 'Family, organiser' : 'Family') : 'Caretaker'}</span></div>
        <a href="/app/account" className="btn out sm" aria-label="Account"><Icon name="user" size={20} /><span>{member.name}</span></a>
      </header>
      <div className="shell-body">
        <nav className="shell-side" aria-label="Main"><NavLinks items={side} variant="side" /></nav>
        <main id="main" className="shell-main">
          <AutoRefresh seconds={30} />
          {help.map((h) => (
            <div key={h.id} className="note n-alert" role="alert" style={{ borderWidth: 3, fontSize: 18 }}>
              <div className="between" style={{ flexWrap: 'wrap', gap: 10 }}>
                <span><b>{who} pressed Help at {fmtTime(h.created_at)}.</b> Please call them now. In an emergency, call 112.</span>
                <form action={handleHelp}><input type="hidden" name="id" value={h.id} /><button className="btn alert sm">I&apos;m calling now</button></form>
              </div>
            </div>
          ))}
          {children}
        </main>
      </div>
      <NavLinks items={bottom} variant="bottom" />
    </div>
  );
}
