import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import LiveTicker from './LiveTicker';
import PersistentCapture from './PersistentCapture';
import StateContextualFloat from './StateContextualFloat';
import SignupToast from './SignupToast';
import PushNotificationToast from './PushNotificationToast';

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
      <SignupToast />
      <PushNotificationToast />
      <div className="grain-overlay" aria-hidden="true" />
    </div>
  );
};

export default Layout;
