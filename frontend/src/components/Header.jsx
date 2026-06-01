/**
 * Header - thin re-export wrapper around <SiteMasthead/> (iter97).
 *
 * Kept as a separate file so the rest of the codebase (Layout etc.)
 * can keep importing `Header` while the canonical implementation
 * lives in /components/SiteMasthead.jsx.
 */
import React from 'react';
import SiteMasthead from './SiteMasthead';

export const Header = (props) => <SiteMasthead {...props} />;

export default Header;
