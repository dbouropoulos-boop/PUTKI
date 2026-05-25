/**
 * PUTKI HQ — InlineSharePreview (iter65)
 *
 * Renders below the Telegram CTA on the success screen. Shows the
 * actual OG share card image (server-rendered at
 * /api/profiler/share/og.png) and one-tap social buttons —
 * Telegram, X/Twitter, WhatsApp, Copy link.
 *
 * Every click fires a `share_click` funnel event with `platform`
 * meta so /back-office/profiler-funnel can split-test channels.
 *
 * Why inline: the bare-share-button approach has a "what am I
 * sharing?" gap. Showing the actual identity card the user is
 * about to spread makes the social act feel concrete and lifts
 * share-rate measurably.
 */
import React, { useState } from 'react';
import { Send, MessageCircle, Twitter, Link as LinkIcon, Check } from 'lucide-react';
import { useLang } from '../../context/LanguageContext';
import { pickPA } from '../../i18n/peliareena';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const InlineSharePreview = ({ personaKey, profileTitle, onShare }) => {
  const { lang } = useLang();
  const [copied, setCopied] = useState(false);

  const ogImageUrl = `${BACKEND}/api/profiler/share/og.png?persona_key=${encodeURIComponent(personaKey)}&lang=${lang}`;
  const unfurlUrl  = `${BACKEND}/api/profiler/share/u/${encodeURIComponent(personaKey)}?lang=${lang}`;
  const shareText  = lang === 'en'
    ? `I'm ${profileTitle} — what are you?`
    : `Olen ${profileTitle} — mikä sinä olet?`;

  const tap = (platform, href) => {
    onShare?.(platform);
    if (platform === 'copy') {
      navigator.clipboard.writeText(`${shareText}\n${unfurlUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      return;
    }
    if (href) window.open(href, '_blank', 'noopener,noreferrer');
  };

  const tgShare = `https://t.me/share/url?url=${encodeURIComponent(unfurlUrl)}&text=${encodeURIComponent(shareText)}`;
  const xShare  = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(unfurlUrl)}`;
  const waShare = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${unfurlUrl}`)}`;

  return (
    <div data-testid="inline-share-preview" style={{
      marginTop: 32,
      border: '1px solid var(--border)',
      borderRadius: 6,
      background: 'var(--bg)',
      padding: '24px 24px 22px',
    }}>
      <div style={{
        fontFamily: 'ui-monospace, JetBrains Mono, monospace',
        fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
        color: '#b07d18', fontWeight: 700, marginBottom: 12,
      }}>
        {lang === 'en' ? 'SHARE · THIS IS WHAT THEY\'LL SEE' : 'JAA · TÄMÄN HE NÄKEVÄT'}
      </div>

      {/* Live OG card preview */}
      <a
        href={unfurlUrl}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="inline-share-card"
        onClick={() => onShare?.('preview_click')}
        style={{
          display: 'block',
          marginBottom: 16,
          border: '1px solid var(--border)',
          borderRadius: 4,
          overflow: 'hidden',
          background: 'var(--surface)',
          textDecoration: 'none',
        }}
      >
        <img
          src={ogImageUrl}
          alt={`${profileTitle} — Putki HQ`}
          loading="lazy"
          data-testid="inline-share-og-image"
          style={{
            display: 'block', width: '100%', height: 'auto',
            aspectRatio: '1200 / 630', background: '#FBFAF8',
          }}
        />
      </a>

      {/* One-tap share buttons */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: 8,
      }}>
        <ShareBtn
          testid="inline-share-telegram"
          label="Telegram"
          color="#229ED9"
          Icon={Send}
          onClick={() => tap('telegram', tgShare)}
        />
        <ShareBtn
          testid="inline-share-x"
          label="X / Twitter"
          color="var(--ink)"
          Icon={Twitter}
          onClick={() => tap('x', xShare)}
        />
        <ShareBtn
          testid="inline-share-whatsapp"
          label="WhatsApp"
          color="#25D366"
          Icon={MessageCircle}
          onClick={() => tap('whatsapp', waShare)}
        />
        <ShareBtn
          testid="inline-share-copy"
          label={copied
            ? pickPA(lang, 'card.share.copied')
            : (lang === 'en' ? 'Copy link' : 'Kopioi linkki')
          }
          color={copied ? '#3f7d4a' : 'var(--ink)'}
          Icon={copied ? Check : LinkIcon}
          onClick={() => tap('copy')}
        />
      </div>
    </div>
  );
};

const ShareBtn = ({ testid, label, color, Icon, onClick }) => (
  <button
    type="button"
    data-testid={testid}
    onClick={onClick}
    style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      gap: 8,
      background: 'transparent',
      color,
      border: `1px solid ${color}`,
      borderRadius: 4,
      padding: '11px 12px',
      fontFamily: 'ui-monospace, JetBrains Mono, monospace',
      fontSize: 11, fontWeight: 700,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      cursor: 'pointer',
      transition: 'background 160ms ease, color 160ms ease',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = color;
      e.currentTarget.style.color = 'var(--bg)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = 'transparent';
      e.currentTarget.style.color = color;
    }}
  >
    <Icon size={14} strokeWidth={2} />
    {label}
  </button>
);

export default InlineSharePreview;
