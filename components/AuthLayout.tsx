import { Brand } from './ui';

export function AuthLayout({ side, children, topRight }: { side: React.ReactNode; children: React.ReactNode; topRight?: React.ReactNode }) {
  return (
    <div className="page-auth">
      <header className="shell-top"><Brand />{topRight}</header>
      <main id="main" className="auth-wrap">
        <div className="auth-card">
          <div className="auth-side">{side}</div>
          <div className="auth-form">{children}</div>
        </div>
      </main>
    </div>
  );
}
export function Centered({ children, topRight }: { children: React.ReactNode; topRight?: React.ReactNode }) {
  return (
    <div className="page-auth">
      <header className="shell-top"><Brand />{topRight}</header>
      <main id="main" className="auth-wrap"><div className="card" style={{ maxWidth: 640, width: '100%', padding: 28, gap: 14 }}>{children}</div></main>
    </div>
  );
}
