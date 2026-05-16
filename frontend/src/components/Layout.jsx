import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import LiveTicker from './LiveTicker';

export const Layout = () => {
  return (
    <div className="min-h-screen flex flex-col relative" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
      <LiveTicker />
      <Header />
      <main className="flex-1 relative">
        <Outlet />
      </main>
      <Footer />
      {/* Site-wide grain texture (fixed; non-interactive) */}
      <div className="grain-overlay" aria-hidden="true" />
    </div>
  );
};

export default Layout;
