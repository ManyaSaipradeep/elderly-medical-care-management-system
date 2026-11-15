'use client';
import { usePathname } from 'next/navigation';
import { Icon } from './ui';

export type NavItem = { href: string; label: string; icon: string };

export function NavLinks({ items, variant }: { items: NavItem[]; variant: 'side' | 'bottom' }) {
  const path = usePathname();
  const isOn = (href: string) => (href === '/app' ? path === '/app' : path.startsWith(href));
  if (variant === 'side') {
    return <>{items.map((i) => (
      <a key={i.href} href={i.href} className={isOn(i.href) ? 'on' : ''} aria-current={isOn(i.href) ? 'page' : undefined}>
        <Icon name={i.icon} size={24} color={isOn(i.href) ? '#1A1A1A' : '#4A4A4A'} />{i.label}
      </a>))}</>;
  }
  return (
    <nav className="nav shell-nav" aria-label="Main" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((i) => (
        <a key={i.href} href={i.href} className={isOn(i.href) ? 'on' : ''} aria-current={isOn(i.href) ? 'page' : undefined}>
          <Icon name={i.icon} size={24} color={isOn(i.href) ? '#1A1A1A' : '#4A4A4A'} />{i.label}
        </a>))}
    </nav>
  );
}
