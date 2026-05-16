import React, { useEffect, useRef, useState } from 'react';

// Real Twitch/Kick muted-autoplay video preview.
// - Desktop: starts muted on hover (saves bandwidth; Twitch parent param required)
// - Mobile: IntersectionObserver triggers playback when tile enters viewport
// - Falls back to streamer.photo if streamer is offline or iframe fails to load
//
// Twitch embed REQUIRES `parent` URL params for each domain it's served from.
// Kick uses `https://player.kick.com/{channel}` and works without parent.
//
// Phase 2.5: when running in the preview environment, we register the current
// hostname as a parent automatically so iframes work in deployed previews too.

const TWITCH_PARENTS = ['localhost', 'pelisignaali-fi.preview.emergentagent.com'];

const buildEmbedSrc = (streamer) => {
  if (!streamer.live || !streamer.channel) return null;
  if (streamer.platform === 'Twitch') {
    const host = (typeof window !== 'undefined' && window.location?.hostname) || '';
    const parents = Array.from(new Set([...TWITCH_PARENTS, host])).filter(Boolean);
    const parentParams = parents.map((p) => `parent=${encodeURIComponent(p)}`).join('&');
    return `https://player.twitch.tv/?channel=${encodeURIComponent(streamer.channel)}&${parentParams}&muted=true&autoplay=true&controls=false`;
  }
  if (streamer.platform === 'Kick') {
    return `https://player.kick.com/${encodeURIComponent(streamer.channel)}?autoplay=true&muted=true`;
  }
  return null;
};

export const StreamerVideoPreview = ({
  streamer,
  className = '',
  style,
  // 'hover' (desktop default) | 'viewport' (mobile / lazy-mount) | 'always' (instant)
  trigger = 'auto',
  borderColor,
  testId,
}) => {
  const ref = useRef(null);
  const [active, setActive] = useState(false);
  const [errored, setErrored] = useState(false);

  const src = buildEmbedSrc(streamer);
  const canEmbed = !!src && !errored;

  // Resolve effective trigger:
  //  - auto → hover on devices with hover, viewport on touch
  const effective = trigger !== 'auto'
    ? trigger
    : (typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches
        ? 'hover' : 'viewport');

  useEffect(() => {
    if (!canEmbed) return;
    if (effective === 'always') { setActive(true); return; }
    if (effective !== 'viewport') return;
    if (!ref.current || typeof IntersectionObserver === 'undefined') {
      setActive(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      { threshold: 0.45 }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [canEmbed, effective]);

  // Iframe error handler — fall back to photo
  const onError = () => setErrored(true);

  const onMouseEnter = effective === 'hover' ? () => setActive(true) : undefined;
  const onMouseLeave = effective === 'hover' ? () => setActive(false) : undefined;

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden ${className}`}
      style={{ background: '#0A0A0A', ...style }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      data-testid={testId}
    >
      {/* Photo always rendered as the fallback layer */}
      <img
        src={streamer.photo}
        alt={streamer.name}
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          filter: streamer.live ? 'brightness(0.55) saturate(1.05)' : 'brightness(0.7) grayscale(0.2)',
          opacity: active && canEmbed ? 0 : 1,
          transition: 'opacity 220ms ease',
        }}
      />

      {canEmbed && active && (
        <iframe
          src={src}
          title={`${streamer.name} live preview`}
          allow="autoplay; fullscreen"
          allowFullScreen={false}
          frameBorder="0"
          scrolling="no"
          onError={onError}
          className="absolute inset-0 w-full h-full"
          style={{ border: 'none', pointerEvents: 'none' }}
          data-testid={testId ? `${testId}-iframe` : undefined}
        />
      )}

      {/* Subtle border glow when live preview is active */}
      {active && canEmbed && borderColor && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ boxShadow: `inset 0 0 0 1px ${borderColor}` }}
        />
      )}
    </div>
  );
};

export default StreamerVideoPreview;
