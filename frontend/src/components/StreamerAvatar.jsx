/**
 * PUTKI HQ — StreamerAvatar (iter54, iter62 no-initials policy)
 *
 * Renders the streamer's REAL profile picture (pulled from Twitch / Kick /
 * YouTube → channel OG → DDG image search → Wikipedia and persisted on
 * the streamer doc as `avatar_url`). When ALL stages fail we render a
 * platform-tinted gradient block with a platform glyph — explicitly NOT
 * letter initials (operator preference, iter62).
 *
 * Props:
 *   streamer  — streamer doc with `name`, `slug`, `avatar_url?`, `platform?`
 *   size      — pixel size of the avatar (square)
 *   shape     — 'circle' (default) | 'square'
 *   className — extra classes
 *   style     — extra inline styles
 */
import React, { useState } from 'react';

const PLATFORM_TINT = {
  twitch:  '#9146FF',
  kick:    '#53FC18',
  youtube: '#FF0033',
};

const PLATFORM_GLYPH = {
  twitch:  'tw',
  kick:    'kk',
  youtube: 'yt',
};

export const StreamerAvatar = ({
  streamer,
  size = 56,
  shape = 'circle',
  className = '',
  style,
  testId,
}) => {
  const [errored, setErrored] = useState(false);
  const name = streamer?.name || streamer?.slug || '';
  const url = streamer?.avatar_url;
  const showImage = !!url && !errored;
  const platform = (streamer?.platform || '').toLowerCase();
  const tint = PLATFORM_TINT[platform] || '#9C9587';
  const glyph = PLATFORM_GLYPH[platform] || '··';

  const radius = shape === 'circle' ? '999px' : '4px';
  const baseStyle = {
    width: size, height: size,
    borderRadius: radius,
    background: 'var(--surface-2, #1A1814)',
    color: 'var(--ink, #ECE6D8)',
    overflow: 'hidden',
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    ...style,
  };

  if (showImage) {
    return (
      <div
        className={className}
        style={baseStyle}
        data-testid={testId || `streamer-avatar-${streamer?.slug || 'unknown'}`}
      >
        <img
          src={url}
          alt={name}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setErrored(true)}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
          }}
        />
      </div>
    );
  }

  // No-initials fallback (iter62): platform-tinted gradient + tiny platform
  // glyph. Editors should refresh the avatar via the back-office to fetch
  // a real image — initials are intentionally never rendered.
  return (
    <div
      className={className}
      style={{
        ...baseStyle,
        background: `radial-gradient(circle at 30% 30%, ${tint}55, var(--surface-2, #1A1814) 70%)`,
      }}
      data-testid={testId || `streamer-avatar-${streamer?.slug || 'unknown'}`}
      data-fallback="platform-gradient"
      title={name}
    >
      <span style={{
        fontFamily: 'ui-monospace, monospace',
        fontWeight: 700,
        fontSize: Math.round(size * 0.26),
        letterSpacing: '0.08em',
        color: tint,
        lineHeight: 1,
        textTransform: 'uppercase',
      }}>{glyph}</span>
      <span aria-hidden style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        height: 2, background: tint, opacity: 0.85,
      }} />
    </div>
  );
};

export default StreamerAvatar;
