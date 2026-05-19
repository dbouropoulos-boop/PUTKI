/**
 * PUTKI HQ — Home (Phase 1 Final · sprint follow-up restructure).
 *
 * New page structure (per sprint spec, Section 2):
 *   1. UTM banner
 *   2. OrientationStrip — what PUTKI HQ is in one line
 *   3. NewsroomLiveStrip — newsroom metrics, refresh 30s
 *   4. NewsPortal — full-width single column (featured row + chronological list)
 *   5. StreamersBand — full-width horizontal card band, replaces sidebar rail
 *   6. NowPlayingTicker — slot ticker, slot-click filters band above
 *   7. ExploreBlocks — 2×2 grid (Mittari · Pelisignaalit · Voita · Peli)
 *   8. AboutStrip — manifesto block
 *   9. EditorialFooter — accountability stamp
 */
import React, { useState } from 'react';
import NewsPortal from '../components/NewsPortal';
import StreamersBand from '../components/StreamersBand';
import NowPlayingTicker from '../components/NowPlayingTicker';
import ExploreBlocks from '../components/ExploreBlocks';
import AboutStrip from '../components/AboutStrip';
import EditorialFooter from '../components/EditorialFooter';
import UTMBanner from '../components/UTMBanner';
import { OrientationStrip, NewsroomLiveStrip } from '../components/InfoStrips';

const Home = () => {
  const [slotFilter, setSlotFilter] = useState(null);
  return (
    <div data-testid="home-page">
      {/* Zone 1 — orientation strips (under the rolling news ticker rendered by Layout) */}
      <OrientationStrip />
      <NewsroomLiveStrip />
      <UTMBanner />

      {/* Zone 2 — News portal full-width */}
      <section
        data-testid="home-news-section"
        style={{
          padding: '32px 0 8px',
          maxWidth: 1180, margin: '0 auto',
          paddingLeft: 32, paddingRight: 32, width: '100%',
        }}
      >
        <NewsPortal />
      </section>

      {/* Zone 3 — Streamers band */}
      <section
        style={{
          maxWidth: 1380, margin: '0 auto',
          paddingLeft: 32, paddingRight: 32, width: '100%',
        }}
      >
        <StreamersBand
          slotFilter={slotFilter}
          onClearSlotFilter={() => setSlotFilter(null)}
        />
      </section>

      {/* Zone 4 — Now-playing slot ticker */}
      <NowPlayingTicker
        activeSlot={slotFilter}
        onSlotClick={(name) => setSlotFilter((cur) => cur === name ? null : name)}
      />

      {/* Zone 5 — Explore preview blocks (Mittari · Pelisignaalit · Voita · Peli) */}
      <section
        style={{
          maxWidth: 1380, margin: '32px auto 0',
          paddingLeft: 32, paddingRight: 32, width: '100%',
        }}
      >
        <ExploreBlocks />
      </section>

      {/* Zone 6 — Manifesto block ("Who we are") */}
      <section
        data-testid="home-about-section"
        style={{
          maxWidth: 1380, margin: '32px auto 0',
          paddingLeft: 32, paddingRight: 32, width: '100%',
        }}
      >
        <AboutStrip />
      </section>

      {/* Zone 7 — Accountability footer */}
      <section
        data-testid="home-accountability-section"
        style={{
          borderTop: '1px solid var(--hairline, #221E1B)',
          background: 'var(--surface, #141210)',
          padding: '40px 0',
          marginTop: 40,
        }}
      >
        <div style={{
          maxWidth: 1380, margin: '0 auto',
          paddingLeft: 32, paddingRight: 32, width: '100%',
        }}>
          <EditorialFooter byline="PUTKI HQ" readMinutes={2} />
        </div>
      </section>
    </div>
  );
};

export default Home;
