import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import NewsTicker from './NewsTicker';

// Phase 1 Final Restructure (Chunk A):
// - PersistentCapture removed — site-wide duplicate subscription surface.
//   ProgressiveOptIn lives on landing pages only (Chunk B).
// - StateContextualFloat removed — homepage now hints at /mittari via the
//   compact ExploreBlocks grid, no need for a floating contextual CTA.
// - NewsTicker replaced LiveTicker in Sprint 3.

export const Layout = () => {
  return (
    <div className="min-h-screen flex flex-col relative" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
      <NewsTicker />
      <Header />
      <main className="flex-1 relative">
        <Outlet />
      </main>
      <Footer />
      <div className="grain-overlay" aria-hidden="true" />
    </div>
  );
};

export default Layout;
