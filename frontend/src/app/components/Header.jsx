'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Header({ activePage = 'home' }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`header ${scrolled ? 'header-scrolled' : ''}`}>
      <div className="header-inner">
        <Link href="/" className="logo">
          <div className="logo-mark">
            BF
          </div>
          BreakFlow
        </Link>

        <nav className="header-nav">
          <Link href="/#features" className="nav-link">Features</Link>
          <Link href="/#how-it-works" className="nav-link">Process</Link>
          <Link href="/#personas" className="nav-link">Personas</Link>
          <Link
            href="/dashboard"
            className={`nav-link ${activePage === 'dashboard' ? 'nav-link-active' : ''}`}
          >
            Dashboard
          </Link>
          <Link href="/dashboard">
            <button className="btn btn-primary btn-sm" style={{ marginLeft: '6px' }}>
              Run check
            </button>
          </Link>
        </nav>
      </div>
    </header>
  );
}
