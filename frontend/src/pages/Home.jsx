/**
 * PUTKI HQ - Home page (router root).
 *
 * Layout zones, top → bottom:
 *   1. Newsroom info strips (orientation + live counters)
 *   2. News portal (full-width grid + chronological list)
 *   3. Streamers band ("kuka striimaa nyt")
 *   4. NowPlayingTicker (live slot status, fixed-bottom)
 *   5. Explore blocks (Mittari · Mestari · Voita · Peli - 2x2 on desktop, 1-col on mobile)
 *   6. Manifesto strip (who we are)
 *   7. Editorial footer (byline + read time)
 */
import React, { useState } from "react";
import { OrientationStrip, NewsroomLiveStrip } from "../components/InfoStrips";
import NewsPortal from "../components/NewsPortal";
import StreamersBand from "../components/StreamersBand";
import NowPlayingTicker from "../components/NowPlayingTicker";
import ExploreBlocks from "../components/ExploreBlocks";
import WeeklyChampionsBanner from "../components/WeeklyChampionsBanner";
import VoyagerHomeStrip from "../components/VoyagerHomeStrip";
import AboutStrip from "../components/AboutStrip";
import EditorialFooter from "../components/EditorialFooter";
import UTMBanner from "../components/UTMBanner";
import "../styles/home.css";

const Home = () => {
  // Slot filter is hoisted here so the StreamersBand and NowPlayingTicker
  // can stay in sync - clicking a slot pill in the ticker drives band
  // filtering, and the band's clear button resets ticker state.
  const [slotFilter, setSlotFilter] = useState(null);

  return (
    <div className="putki-home" data-testid="home-shell">
      {/* Zone 1 - Newsroom strips */}
      <OrientationStrip />
      <NewsroomLiveStrip />
      <UTMBanner />

      {/* Zone 2 - News portal full-width */}
      <section
        data-testid="home-news-section"
        className="home-zone home-zone--news"
      >
        <NewsPortal />
      </section>

      {/* Zone 3 - Streamers band */}
      <section className="home-zone home-zone--band">
        <StreamersBand
          slotFilter={slotFilter}
          onClearSlotFilter={() => setSlotFilter(null)}
        />
      </section>

      {/* Zone 4 - Now-playing slot ticker */}
      <NowPlayingTicker
        activeSlot={slotFilter}
        onSlotClick={(name) => setSlotFilter((cur) => cur === name ? null : name)}
      />

      {/* Zone 5 - Voyager weekly pick strip → /game */}
      <section className="home-zone home-zone--voyager">
        <VoyagerHomeStrip />
      </section>

      {/* Zone 5.5 - Weekly champions banner (mini-game tournament) */}
      <section className="home-zone home-zone--champions">
        <WeeklyChampionsBanner />
      </section>

      {/* Zone 6 - Explore preview blocks (Mittari · Mestari · Voita · Peli) */}
      <section className="home-zone home-zone--explore">
        <ExploreBlocks />
      </section>

      {/* Zone 6 - Manifesto block ("Who we are") */}
      <section
        data-testid="home-about-section"
        className="home-zone home-zone--about"
      >
        <AboutStrip />
      </section>

      {/* Zone 7 - Accountability footer */}
      <section
        data-testid="home-accountability-section"
        className="home-zone home-zone--accountability"
      >
        <div className="home-accountability-inner">
          <EditorialFooter byline="PUTKI HQ" readMinutes={2} />
        </div>
      </section>
    </div>
  );
};

export default Home;
