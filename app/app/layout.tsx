import { requireMember } from '@/lib/session';
import { Brand, Icon } from '@/components/ui';
import { NavLinks, type NavItem } from '@/components/NavLinks';
import { q } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { member, circle } = await requireMember();
  const fam = member.role === 'family';
  const [{ n }] = fam ? await q<{ n: number }>(`select count(*)::int as n from members where circle_id = $1 and status = 'pending' and created_at > now() - interval '7 days'`, [circle.id]) : [{ n: 0 }];
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
        <main id="main" className="shell-main">{children}</main>
      </div>
      <NavLinks items={bottom} variant="bottom" />
    </div>
  );
}
