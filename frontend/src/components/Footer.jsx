import React from 'react';
import { Link } from 'react-router-dom';
import { Settings } from 'lucide-react';
import Dial from './Dial';
import { useLang } from '../context/LanguageContext';

export const Footer = () => {
  const { t } = useLang();
  return (
    <footer className="border-t mt-24 sm:mt-32" style={{ borderColor: 'var(--border)' }} data-testid="site-footer">
      <div className="container-wide pt-14 sm:pt-20 pb-10 flex flex-col items-center text-center">
        <div className="cockpit-divider w-32 mb-10" />
        <div className="opacity-90 mb-5">
          <Dial size="small" state="KUUMA" showLabel={false} />
        </div>
        <p
          className="display"
          style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--muted)', maxWidth: 520 }}
          data-testid="footer-tagline"
        >
          {t('footer.tagline')}
        </p>
        <div className="cockpit-divider w-32 mt-10" />
      </div>

      <div className="container-wide pb-12">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-8 sm:gap-12">
          <div>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="font-display font-black text-xl tracking-tighter" style={{ color: 'var(--ink)' }}>PUTKI</span>
              <span className="mono text-[10px] tracking-[0.22em] uppercase" style={{ color: 'var(--muted)' }}>HQ</span>
            </div>
            <p className="font-serif text-[13px] leading-relaxed" style={{ color: 'var(--muted)' }}>{t('footer.lede')}</p>
          </div>
          <div>
            <div className="eyebrow mb-3">{t('footer.col_pages')}</div>
            <ul className="space-y-2 mono text-[12px]" style={{ letterSpacing: '0.08em' }}>
              <li><Link to="/uutiset" style={{ color: 'var(--ink)' }} className="hover:opacity-70">{t('nav.news').toUpperCase()}</Link></li>
              <li><Link to="/striimaajat" style={{ color: 'var(--ink)' }} className="hover:opacity-70">{t('nav.streamers').toUpperCase()}</Link></li>
              <li><Link to="/viikon-kortti" style={{ color: 'var(--ink)' }} className="hover:opacity-70">{t('nav.weekly').toUpperCase()}</Link></li>
              <li><Link to="/peli" style={{ color: 'var(--ink)' }} className="hover:opacity-70">{t('nav.game_prize').toUpperCase()}</Link></li>
              <li><Link to="/tietoa-meista" style={{ color: 'var(--ink)' }} className="hover:opacity-70">{t('nav.about').toUpperCase()}</Link></li>
              <li><Link to="/menetelma" style={{ color: 'var(--ink)' }} className="hover:opacity-70">{t('nav.methodology').toUpperCase()}</Link></li>
            </ul>
          </div>
          <div>
            <div className="eyebrow mb-3">{t('footer.col_contact')}</div>
            <ul className="space-y-2 mono text-[12px]" style={{ letterSpacing: '0.08em' }}>
              <li><Link to="/tietoa-meista" style={{ color: 'var(--ink)' }} className="hover:opacity-70" data-testid="footer-about-link">{t('nav.about').toUpperCase()}</Link></li>
              <li><a href="mailto:toimitus@putkihq.fi" style={{ color: 'var(--ink)' }} className="hover:opacity-70" data-testid="footer-editorial-mail">{t('footer.editorial_mail')}</a></li>
              <li><a href="mailto:press@putkihq.fi" style={{ color: 'var(--ink)' }} className="hover:opacity-70" data-testid="footer-press-mail">{t('footer.press_mail')}</a></li>
              <li><Link to="/lehdisto" style={{ color: 'var(--ink)' }} className="hover:opacity-70" data-testid="footer-press-link">{t('footer.press_kit')}</Link></li>
            </ul>
          </div>
          <div>
            <div className="eyebrow mb-3">{t('footer.col_editorial')}</div>
            <ul className="space-y-2 mono text-[12px]" style={{ letterSpacing: '0.08em' }}>
              <li><Link to="/menetelma" style={{ color: 'var(--ink)' }} className="hover:opacity-70">{t('footer.method')}</Link></li>
              <li><span style={{ color: 'var(--muted)' }}>{t('footer.privacy')}</span></li>
              <li><span style={{ color: 'var(--muted)' }}>{t('footer.terms')}</span></li>
              <li><span style={{ color: 'var(--muted)' }}>{t('footer.affiliate')}</span></li>
              <li>
                <Link
                  to="/back-office"
                  style={{ color: 'var(--ink)' }}
                  className="hover:opacity-70 inline-flex items-center gap-1.5"
                  data-testid="footer-admin-link"
                >
                  <Settings strokeWidth={1.6} size={12} />
                  ADMIN
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="section-rule mt-10 pt-6 flex flex-col sm:flex-row justify-between gap-3 mono text-[10.5px]" style={{ letterSpacing: '0.12em', color: 'var(--muted)' }}>
          <span>© {new Date().getFullYear()} PUTKIHQ.FI · {t('footer.indep')}</span>
          <span className="inline-flex items-center gap-3">
            {t('footer.warning')}
            <Link
              to="/back-office"
              aria-label={t('footer.admin_gear')}
              data-testid="footer-admin-gear"
              className="hover:opacity-100 transition-opacity"
              style={{ color: 'var(--muted)', opacity: 0.35, display: 'inline-flex' }}
            >
              <Settings strokeWidth={1.4} size={13} />
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
