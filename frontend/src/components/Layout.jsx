import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import LiveTicker from './LiveTicker';
import PersistentCapture from './PersistentCapture';
import StateContextualFloat from './StateContextualFloat';

// V2 honesty pass: SignupToast + PushNotificationToast removed.
// Both manufactured "John from Helsinki just subscribed" / fake push notifications
// with no real backing data. Per V2 brief: empty surfaces ok, lying surfaces not.

export const Layout = () => {
  return (
    <div className="min-h-screen flex flex-col relative" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
      <LiveTicker />
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
