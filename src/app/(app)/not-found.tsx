import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ maxWidth: 640 }}>
      <h1>Not found</h1>
      <p className="lede">That page or record does not exist, or your account cannot open it.</p>
      <Link className="btn" href="/">Go to your home page</Link>
    </div>
  );
}
