'use client';

export default function Error({ reset }: { reset: () => void }) {
  return (
    <main id="main" style={{ maxWidth: 640 }}>
      <h1>Something went wrong</h1>
      <p className="lede">The page could not load. Try again; if it keeps happening, tell the admin and say what you were doing.</p>
      <button className="btn" type="button" onClick={reset}>Try again</button>
    </main>
  );
}
