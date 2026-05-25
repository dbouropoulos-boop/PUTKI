import React from 'react';
import { Link } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { useLang } from '../context/LanguageContext';

export const Footer = () => {
  const { t } = useLang();
  return (
    <footer className="border-t mt-24 sm:mt-32" style={{ borderColor: 'var(--border)' }} data-testid="site-footer">
      <div className="container-wide pb-12 pt-14">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-8 sm:gap-12">
          <div>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="font-display font-black text-xl tracking-tighter" style={{ color: 'var(--ink)' }}>PUTKI</span>
              <span className="mono text-[10px] tracking-[0.22em] uppercase" style={{ color: 'var(--muted)' }}>HQ</span>
            </div>
            <p className="font-serif text-[13px] leading-relaxed" data-testid="footer-lede" style={{ color: 'var(--muted)' }}>{t('footer.lede')}</p>
          </div>
          <div>
            <div className="eyebrow mb-3">{t('footer.col_pages')}</div>
            <ul className="space-y-2 mono text-[12px]" style={{ letterSpacing: '0.08em' }}>
              <li><Link to="/uutiset" style={{ color: 'var(--ink)' }} className="hover:opacity-70">{t('nav.news').toUpperCase()}</Link></li>
              <li><Link to="/striimaajat" style={{ color: 'var(--ink)' }} className="hover:opacity-70">{t('nav.streamers').toUpperCase()}</Link></li>
              <li><Link to="/mittari" style={{ color: 'var(--ink)' }} className="hover:opacity-70" data-testid="footer-mittari-link">MITTARI</Link></li>
              <li><Link to="/pelisignaalit" style={{ color: 'var(--ink)' }} className="hover:opacity-70" data-testid="footer-pelisignaalit-link">PELISIGNAALIT</Link></li>
              <li><Link to="/peliareena" style={{ color: 'var(--ink)' }} className="hover:opacity-70" data-testid="footer-peliareena-link">PELIAREENA</Link></li>
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

        {/* ╔═ Responsible gambling / age + editorial disclaimer ═══╗
            Required compliance band. Sits above the source disclosure
            so it's the FIRST thing visible after the link columns.
            Bilingual via t() with EN/FI keys in LanguageContext. */}
        <div data-testid="footer-responsible-gambling"
          className="mt-10 p-4 sm:p-5"
          style={{
            border: '1px solid var(--border)',
            background: 'var(--surface)',
          }}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            <div className="shrink-0 inline-flex items-center justify-center"
              style={{
                width: 44, height: 44, borderRadius: 999,
                border: '2px solid #C9344E', color: '#C9344E',
                fontFamily: 'ui-monospace, monospace', fontSize: 13,
                fontWeight: 800, letterSpacing: '0.02em',
              }}>18+</div>
            <div className="font-serif text-[13.5px] leading-snug" style={{ color: 'var(--ink)' }}>
              <strong style={{ color: '#C9344E' }}>{t('footer.compliance.title')}</strong>{' '}
              {t('footer.compliance.body')}{' '}
              <a href="https://peluuri.fi" target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--ink)', textDecoration: 'underline' }}>peluuri.fi</a>
              {' · '}
              <a href="https://www.gamblingtherapy.org" target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--ink)', textDecoration: 'underline' }}>gamblingtherapy.org</a>
            </div>
          </div>
        </div>

        <div className="section-rule mt-10 pt-6 flex flex-col gap-3 mono text-[10.5px]"
             style={{ letterSpacing: '0.12em', color: 'var(--muted)' }}>
          <span data-testid="footer-source-disclosure">
            {t('footer.source_disclosure')}
          </span>
          <span data-testid="footer-editorial-disclosure">
            {t('footer.editorial_disclosure')}
          </span>
          <div className="flex flex-col sm:flex-row justify-between gap-3 pt-3"
               style={{ borderTop: '1px solid var(--border)' }}>
            <span>© {new Date().getFullYear()} PUTKIHQ.FI · {t('footer.indep')}</span>
            <Link
              to="/back-office"
              aria-label={t('footer.admin_gear')}
              data-testid="footer-admin-gear"
              className="hover:opacity-100 transition-opacity inline-flex"
              style={{ color: 'var(--muted)', opacity: 0.35 }}
            >
              <Settings strokeWidth={1.4} size={13} />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
