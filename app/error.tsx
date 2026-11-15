'use client';
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="main" style={{ maxWidth: 640, margin: '60px auto', padding: 20 }} className="card">
      <h1 className="h1">Something went wrong on our side</h1>
      <p className="body">Nothing you entered was lost. Try again in a minute.</p>
      <button className="btn go" onClick={() => reset()}>Try again</button>
    </main>
  );
}
