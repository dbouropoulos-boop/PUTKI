/**
 * RedirectWithQuery - preserves query params when 301-redirecting legacy
 * routes to their new homes. React Router renders a Navigate which the
 * browser History API treats as a client-side redirect (effectively 301
 * for SPA crawl-equivalence).
 *
 * Usage:
 *   <Route path="vihjeet"
 *     element={<RedirectWithQuery to="/pelisignaalit" />} />
 */
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const RedirectWithQuery = ({ to }) => {
  const { search, hash } = useLocation();
  return <Navigate to={`${to}${search || ''}${hash || ''}`} replace />;
};

export default RedirectWithQuery;
