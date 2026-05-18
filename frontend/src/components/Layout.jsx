import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import NewsTicker from './NewsTicker';
import PersistentCapture from './PersistentCapture';
import StateContextualFloat from './StateContextualFloat';

// Phase 1: LiveTicker replaced by NewsTicker. LiveTicker still exists in
// /app/frontend/src/components/LiveTicker.jsx but is no longer rendered.
// V2 honesty pass: SignupToast + PushNotificationToast removed.

export const Layout = () => {
  return (
    <div className="min-h-screen flex flex-col relative" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
      <NewsTicker />
      <Header />
      <main className="flex-1 relative">
        <Outlet />
      </main>
      <Footer />
      <PersistentCapture />
      <StateContextualFloat />
      <div className="grain-overlay" aria-hidden="true" />
    </div>
  );
};

export default Layout;
