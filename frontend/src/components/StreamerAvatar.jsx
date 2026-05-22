/**
 * PUTKI HQ — StreamerAvatar (iter54)
 *
 * Renders the streamer's REAL profile picture (pulled from Twitch / Kick /
 * YouTube and persisted on the streamer doc as `avatar_url`). Falls back
 * to initials on a neutral block when no image is available — no stock
 * photos, ever.
 *
 * Props:
 *   streamer  — streamer doc with `name`, `slug`, `avatar_url?`, `photo?`
 *               (legacy stock URL is INTENTIONALLY ignored — see iter54)
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

const initialsOf = (name = '') => {
  const trimmed = String(name).trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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

  // Fallback: initials on a neutral block, with a tiny platform-tinted
  // bottom strip so the block doesn't feel anonymous.
  return (
    <div
      className={className}
      style={baseStyle}
      data-testid={testId || `streamer-avatar-${streamer?.slug || 'unknown'}`}
      data-fallback="initials"
    >
      <span style={{
        fontFamily: 'Georgia, serif',
        fontWeight: 700,
        fontSize: Math.round(size * 0.4),
        letterSpacing: '-0.02em',
        color: 'var(--ink, #ECE6D8)',
        lineHeight: 1,
      }}>{initialsOf(name)}</span>
      <span aria-hidden style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        height: 2, background: tint, opacity: 0.7,
      }} />
    </div>
  );
};

export default StreamerAvatar;
