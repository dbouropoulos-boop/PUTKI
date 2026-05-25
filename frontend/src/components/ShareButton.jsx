import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { Share2, Download, X, Check } from 'lucide-react';
import { useLang } from '../context/LanguageContext';

// Generates a shareable PNG card from a hidden DOM template.
// Variants: 'moment' | 'dial' | 'operator'

const STATE_COLORS = {
  KYLMA: '#2C5F8D', HAALEA: '#7A7E83', KUUMA: '#E8924A',
  MYRSKY: '#C8423C', KIIRASTULI: '#8B1E1A',
};

const Template = React.forwardRef(({ variant, payload, lang }, ref) => {
  const stateColor = payload.intensity ? STATE_COLORS[payload.intensity] : (payload.color || '#E8924A');

  return (
    <div
      ref={ref}
      style={{
        width: 1080, height: 1080, position: 'fixed', left: -9999, top: 0,
        background: '#0A0A0A', color: '#F5F3EE',
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: 80, boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        backgroundImage: `radial-gradient(circle at 30% 20%, ${stateColor}33 0%, transparent 60%)`,
      }}
      data-testid={`shareable-template-${variant}`}
    >
      {/* Top bar - brand */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 999, background: stateColor,
            boxShadow: `0 0 20px ${stateColor}99`,
          }} />
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>
            putkihq.fi
          </div>
        </div>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: 14,
          letterSpacing: '0.22em', color: '#8E8B85', fontWeight: 600,
        }}>
          {variant === 'moment' && (lang === 'en' ? 'MOMENT · YESTERDAY' : 'HETKI · EILEN')}
          {variant === 'dial' && (lang === 'en' ? 'DIAL STATE' : 'MITTARIN TILA')}
          {variant === 'operator' && (lang === 'en' ? 'OPERATOR REVIEW' : 'OPERAATTORI')}
        </div>
      </div>

      {/* Center content */}
      <div>
        {variant === 'moment' && (
          <>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, letterSpacing: '0.22em', color: '#8E8B85', fontWeight: 700, marginBottom: 16 }}>
              {payload.intensity || 'KUUMA'} · {(payload.streamer || 'Streamer').toUpperCase()}
            </div>
            <div style={{ fontSize: 64, fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.03em', marginBottom: 28, maxWidth: '100%' }}>
              {payload.headline || 'Mittari noticed this'}
            </div>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 132, fontWeight: 500,
              color: stateColor, letterSpacing: '-0.04em', lineHeight: 1,
            }}>
              {payload.win || '-'}
            </div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 18, letterSpacing: '0.16em', color: '#8E8B85', fontWeight: 600, marginTop: 16 }}>
              {(payload.game || '').toUpperCase()}
            </div>
          </>
        )}
        {variant === 'dial' && (
          <>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, letterSpacing: '0.22em', color: '#8E8B85', fontWeight: 700, marginBottom: 16 }}>
              P*RKELE-MITTARI
            </div>
            <div style={{
              fontSize: 220, fontWeight: 900, lineHeight: 0.95,
              color: stateColor, letterSpacing: '-0.04em',
              textShadow: `0 0 60px ${stateColor}88`,
            }}>
              {payload.label || 'KUUMA'}
            </div>
            <div style={{ fontSize: 36, fontWeight: 600, lineHeight: 1.2, marginTop: 28, maxWidth: 880 }}>
              {payload.headline || 'The dial measures the slot scene.'}
            </div>
          </>
        )}
        {variant === 'operator' && (
          <>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, letterSpacing: '0.22em', color: '#8E8B85', fontWeight: 700, marginBottom: 16 }}>
              MITTARI-PISTE
            </div>
            <div style={{ fontSize: 96, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.03em', marginBottom: 24 }}>
              {payload.name}
            </div>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 200, fontWeight: 500,
              color: stateColor, letterSpacing: '-0.04em', lineHeight: 1,
            }}>
              {payload.score}
              <span style={{ fontSize: 60, color: '#8E8B85', marginLeft: 12 }}>/100</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 500, lineHeight: 1.3, marginTop: 28, color: '#C8C5BE', maxWidth: 880 }}>
              {payload.oneLiner}
            </div>
          </>
        )}
      </div>

      {/* Bottom bar - meta + watermark */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        borderTop: '1px solid #2A2A2A', paddingTop: 28,
      }}>
        <div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, letterSpacing: '0.18em', color: '#8E8B85', fontWeight: 600 }}>
            {lang === 'en' ? 'MITTARI MEASURES · YOU DECIDE' : 'MITTARI MITTAA · SINÄ PÄÄTÄT'}
          </div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, letterSpacing: '0.22em', color: '#5A5A5A', fontWeight: 600, marginTop: 6 }}>
            {lang === 'en' ? 'FOR ENTERTAINMENT ONLY · NO BETTING' : 'VAIN VIIHTEEKSI · EI VEDONLYÖNTIÄ'}
          </div>
        </div>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: 24, fontWeight: 700,
          letterSpacing: '0.04em', color: '#F5F3EE',
        }}>
          putkihq.fi →
        </div>
      </div>
    </div>
  );
});

export const ShareButton = ({ variant = 'moment', payload, label, className, dataTestId }) => {
  const { lang } = useLang();
  const tplRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [open, setOpen] = useState(false);

  const generate = async () => {
    if (!tplRef.current) return null;
    setBusy(true);
    try {
      const canvas = await html2canvas(tplRef.current, {
        scale: 1, backgroundColor: '#0A0A0A', useCORS: true, logging: false,
      });
      const url = canvas.toDataURL('image/png');
      setPreviewUrl(url);
      setOpen(true);
      return url;
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!previewUrl) return;
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = `mittari-${variant}-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setDone(true);
    setTimeout(() => setDone(false), 1800);
  };

  const handleShareClick = async () => {
    const url = await generate();
    if (!url) return;
    // If Web Share API supports files, offer native share
    if (navigator.share && navigator.canShare) {
      try {
        const blob = await (await fetch(url)).blob();
        const file = new File([blob], `mittari-${variant}.png`, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'PUTKI HQ',
            text: lang === 'en' ? 'Spotted on PUTKI HQ' : 'PUTKI HQ havaitsi tämän',
          });
          return;
        }
      } catch {}
    }
    // Fallback: open preview modal with download
  };

  return (
    <>
      <button
        onClick={handleShareClick}
        disabled={busy}
        className={className || 'btn-ghost'}
        data-testid={dataTestId || `share-btn-${variant}`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
      >
        <Share2 strokeWidth={1.6} size={13} />
        {busy
          ? (lang === 'en' ? 'GENERATING…' : 'LUODAAN…')
          : (label || (lang === 'en' ? 'SHARE' : 'JAA'))}
      </button>

      {/* Hidden template that html2canvas captures */}
      <Template ref={tplRef} variant={variant} payload={payload} lang={lang} />

      {/* Preview modal */}
      {open && previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(8px)' }}
          onClick={() => setOpen(false)}
          data-testid="share-preview-modal"
        >
          <div
            className="panel"
            style={{ background: 'var(--bg)', maxWidth: 540, width: '100%', padding: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="eyebrow mb-1">{lang === 'en' ? 'SHARE CARD' : 'JAA-KORTTI'}</div>
                <div className="font-display font-bold text-xl" style={{ color: 'var(--ink)' }}>
                  {lang === 'en' ? 'Ready to share' : 'Valmis jaettavaksi'}
                </div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" style={{ color: 'var(--muted)' }} data-testid="share-preview-close">
                <X strokeWidth={1.5} size={20} />
              </button>
            </div>
            <img
              src={previewUrl}
              alt="Share preview"
              style={{ width: '100%', borderRadius: 4, border: '1px solid var(--border)' }}
            />
            <div className="flex gap-3 mt-4">
              <button onClick={download} className="btn-primary flex-1" data-testid="share-download">
                {done ? (
                  <span className="inline-flex items-center gap-2"><Check strokeWidth={1.8} size={14} /> {lang === 'en' ? 'DOWNLOADED' : 'LADATTU'}</span>
                ) : (
                  <span className="inline-flex items-center gap-2"><Download strokeWidth={1.6} size={14} /> {lang === 'en' ? 'DOWNLOAD' : 'LATAA'}</span>
                )}
              </button>
              <button onClick={() => setOpen(false)} className="btn-secondary flex-1" data-testid="share-close-btn">
                {lang === 'en' ? 'CLOSE' : 'SULJE'}
              </button>
            </div>
            <div className="mono mt-3" style={{ fontSize: 9.5, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600 }}>
              {lang === 'en' ? '1080×1080 · INSTAGRAM / X / TELEGRAM-READY' : '1080×1080 · INSTAGRAM / X / TELEGRAM'}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ShareButton;
