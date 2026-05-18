/**
 * PUTKI HQ — Home (Phase 1 Final Restructure · Chunk A).
 *
 * News portal first. Streamers second. Explore blocks third.
 *
 * Architecture
 * ------------
 * The homepage is now a focused, high-tech editorial news portal.
 * Mittari dial, Pelisignaalit picks, Voita raffle, and Peli Voyager
 * each have their own dedicated landing page (Chunk B). The homepage
 * only "hints" at them via compact preview blocks at the bottom.
 *
 * Layout
 * ------
 *   Zone 1 · UTM banner (unchanged)
 *   Zone 2 · Main 2-col grid:
 *             LEFT — NewsPortal (2 featured + 12 chronological)
 *             RIGHT — StreamersRail (Twitch · Kick · YouTube grouped)
 *   Zone 3 · ExploreBlocks (2×2 compact preview grid)
 *   Zone 4 · EditorialFooter (accountability stamp)
 *
 * Removed
 * -------
 * The previous Zone 1 (DialCockpit + NewsCarousel hero), Zone 2 (HubMosaic),
 * Zone 3 (ZonePublicationDepth), Zone 4 (Games strip), Zone 5 (CaptureSection),
 * LiveActivityFeed, WinnersCorner, SocialProofBar, MostReadRail,
 * PaivaVitoset, StreamerLiveGrid, GamesSection, "What is PUTKI HQ" pillars,
 * and PhaseOneDiscoveryRow are all GONE from the homepage. Each lives on
 * its dedicated landing page (Chunk B): /mittari · /pelisignaalit · /voita
 * · /peli · /tietoa-meista (where the "What is PUTKI HQ" cards belong).
 */
import React from 'react';
import NewsPortal from '../components/NewsPortal';
import StreamersRail from '../components/StreamersRail';
import ExploreBlocks from '../components/ExploreBlocks';
import EditorialFooter from '../components/EditorialFooter';
import UTMBanner from '../components/UTMBanner';

const Home = () => {
  return (
    <div data-testid="home-page">
      <UTMBanner />

      {/* Zone 2 — main 2-col grid. News dominant; streamers as a quieter rail. */}
      <section
        data-testid="home-main-grid"
        style={{
          padding: '32px 0 24px',
          maxWidth: 1380,
          margin: '0 auto',
          paddingLeft: 32,
          paddingRight: 32,
          width: '100%',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 260px',
            gap: 56,
            alignItems: 'start',
          }}
          className="home-main-grid"
        >
          <NewsPortal />
          <StreamersRail />
        </div>
      </section>

      {/* Zone 3 — Explore preview blocks (Mittari · Pelisignaalit · Voita · Peli) */}
      <section
        style={{
          maxWidth: 1380, margin: '0 auto',
          paddingLeft: 32, paddingRight: 32, width: '100%',
        }}
      >
        <ExploreBlocks />
      </section>

      {/* Zone 4 — Accountability footer */}
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

      {/* Mobile collapse — single column at < 900px */}
      <style>{`
        @media (max-width: 900px) {
          .home-main-grid {
            grid-template-columns: 1fr !important;
            gap: 32px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Home;
