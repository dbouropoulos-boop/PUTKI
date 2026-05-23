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

// Removed iter62.1: PLATFORM_GLYPH was rendering "kk"/"tw"/"yt" letters
// in giant Mono font on the fallback, which looked too much like initials
// of the streamer's actual name. Replaced with a silent diagonal weave.

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

  // iter62.1: TRUE no-initials fallback — when all 4 stages fail we render
  // a soft platform-tinted block with a faint diagonal weave pattern. NO
  // letters of any kind. Editors should click ⟳ in the back-office to
  // run the fallback cascade again.
  return (
    <div
      className={className}
      style={{
        ...baseStyle,
        background: `
          linear-gradient(135deg, ${tint}22 0%, transparent 60%),
          radial-gradient(circle at 70% 30%, ${tint}14, transparent 70%),
          var(--surface-2, #1A1814)
        `,
      }}
      data-testid={testId || `streamer-avatar-${streamer?.slug || 'unknown'}`}
      data-fallback="silent"
      title={name}
    >
      {/* Faint diagonal weave so the block isn't dead-flat */}
      <svg
        aria-hidden
        width={size}
        height={size}
        style={{ position: 'absolute', inset: 0, opacity: 0.18 }}
      >
        <defs>
          <pattern id={`avwv-${size}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke={tint} strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width={size} height={size} fill={`url(#avwv-${size})`} />
      </svg>
      {/* Tiny platform tint line at the bottom — the ONLY identifier */}
      <span aria-hidden style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        height: 2, background: tint, opacity: 0.55,
      }} />
    </div>
  );
};

export default StreamerAvatar;
