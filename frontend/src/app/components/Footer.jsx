import Link from 'next/link';

export default function Footer() {
  return (
    <footer style={{
      borderTop: '1px solid var(--line)',
      padding: 'var(--space-6) 0',
    }}>
      <div className="container" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <Link href="/" className="logo" style={{ fontSize: '0.8125rem' }}>
          <div className="logo-mark" style={{ width: 22, height: 22 }}>
            BF
          </div>
          BreakFlow
        </Link>

        <span className="text-small" style={{ fontSize: '0.6875rem' }}>
          &copy; {new Date().getFullYear()} BreakFlow
        </span>
      </div>
    </footer>
  );
}
