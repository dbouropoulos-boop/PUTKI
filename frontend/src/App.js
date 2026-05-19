import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import OperatorReview from "@/pages/OperatorReview";
import CasinoRanking from "@/pages/CasinoRanking";
import StreamerProfile from "@/pages/StreamerProfile";
import StreamerIndex from "@/pages/StreamerIndex";
import Methodology from "@/pages/Methodology";
import Ehdot from "@/pages/Ehdot";
import MittariPermalink from "@/pages/MittariPermalink";
import ColdEmailLanding from "@/pages/ColdEmailLanding";
import Signup from "@/pages/Signup";
import MiniGame from "@/pages/MiniGame";
import Peli from "@/pages/Peli";
import TietoaMeista from "@/pages/TietoaMeista";
import WeeklyCard from "@/pages/WeeklyCard";
import BettingTipsHub from "@/pages/BettingTipsHub";
import BackOffice from "@/pages/BackOffice";
import BackOfficeQueue from "@/pages/BackOfficeQueue";
import FoundationalResearch from "@/pages/FoundationalResearch";
import OperatorsAdmin from "@/pages/OperatorsAdmin";
import StreamersAdmin from "@/pages/StreamersAdmin";
import BackOfficeWebhooks from "@/pages/BackOfficeWebhooks";
import BackOfficeDrafts from "@/pages/BackOfficeDrafts";
import BackOfficeWeekly from "@/pages/BackOfficeWeekly";
import BackOfficePeli from "@/pages/BackOfficePeli";
import BackOfficeStreamerMeta from "@/pages/BackOfficeStreamerMeta";
import BackOfficeSlotRegistry from "@/pages/BackOfficeSlotRegistry";
import BackOfficeOptinSegments from "@/pages/BackOfficeOptinSegments";
import BackOfficeDispatchPreview from "@/pages/BackOfficeDispatchPreview";
import BackOfficeVoita from "@/pages/BackOfficeVoita";
import BackOfficeVoitaQuiz from "@/pages/BackOfficeVoitaQuiz";
import Mittari from "@/pages/Mittari";
import Pelisignaalit from "@/pages/Pelisignaalit";
import Voita from "@/pages/Voita";
import VoitaRaffle from "@/pages/VoitaRaffle";
import VoitaKiitos from "@/pages/VoitaKiitos";
import VoitaSaannot from "@/pages/VoitaSaannot";
import Mestari from "@/pages/Mestari";
import RedirectWithQuery from "@/components/RedirectWithQuery";
import TopicHubPage from "@/pages/TopicHubPage";
import Article from "@/pages/Article";
import StreamerIntl from "@/pages/StreamerIntl";
import Toimitus from "@/pages/Toimitus";
import VoitaPalkinto from "@/pages/VoitaPalkinto";
import Profiilit from "@/pages/Profiilit";
import MittariHistoria from "@/pages/MittariHistoria";
import Uutiset from "@/pages/Uutiset";
import { Skene, SkeneTalous } from "@/pages/Skene";
import { Raha, Kulttuuri, Sponsoroinnit, Saantely } from "@/pages/EditorialArchives";
import { Pelit, PelitBlackjack, PelitPoker, PelitSlotit, PelitCraps, PelitRuletti, PelitLive, PelitBonusmatematiikka } from "@/pages/Pelit";
import Pulssi from "@/pages/Pulssi";
import { Korjaukset, Affiliaatti, Avoimuus, Lehdisto, Paivityslog } from "@/pages/Accountability";
import { Toaster } from "@/components/ui/sonner";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          {/* Standalone (no header/footer) */}
          <Route path="/landing" element={<ColdEmailLanding />} />
          <Route path="/aloita" element={<Signup />} />
          <Route path="/mestari" element={<Mestari />} />
          <Route path="/back-office" element={<BackOffice />} />
          <Route path="/back-office/queue" element={<BackOfficeQueue />} />
          <Route path="/back-office/foundational-research" element={<FoundationalResearch />} />
          <Route path="/back-office/operators" element={<OperatorsAdmin />} />
          <Route path="/back-office/streamers" element={<StreamersAdmin />} />
          <Route path="/back-office/webhooks" element={<BackOfficeWebhooks />} />
          <Route path="/back-office/drafts" element={<BackOfficeDrafts />} />
          <Route path="/back-office/weekly" element={<BackOfficeWeekly />} />
          <Route path="/back-office/peli" element={<BackOfficePeli />} />
          <Route path="/back-office/streamer-meta" element={<BackOfficeStreamerMeta />} />
          <Route path="/back-office/slot-registry" element={<BackOfficeSlotRegistry />} />
          <Route path="/back-office/optin-segments" element={<BackOfficeOptinSegments />} />
          <Route path="/back-office/dispatch-preview" element={<BackOfficeDispatchPreview />} />
          <Route path="/back-office/voita" element={<BackOfficeVoita />} />
          <Route path="/back-office/voita-quiz" element={<BackOfficeVoitaQuiz />} />
          <Route path="/topic/:id" element={<TopicHubPage />} />
          <Route path="/striimaajat/:id" element={<TopicHubPage kind="streamers" />} />
          <Route path="/operaattorit/:id" element={<TopicHubPage kind="operators" />} />

          {/* Main site */}
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="kasinot" element={<CasinoRanking />} />
            <Route path="kasinot/:slug" element={<OperatorReview />} />
            <Route path="striimaajat" element={<StreamerIndex />} />
            <Route path="striimaajat/kansainvaliset" element={<StreamerIntl />} />
            <Route path="striimaajat/:slug" element={<StreamerProfile />} />
            <Route path="menetelma" element={<Methodology />} />
            <Route path="ehdot" element={<Ehdot />} />
            <Route path="m/:slug" element={<MittariPermalink />} />
            <Route path="toimitus" element={<Toimitus />} />
            <Route path="peli" element={<Peli />} />
            <Route path="peli/legacy" element={<MiniGame />} />
            <Route path="tietoa-meista" element={<TietoaMeista />} />
            <Route path="voita-palkinto" element={<VoitaPalkinto />} />

            {/* Phase 1 Final Restructure · Chunk B — dedicated landing pages */}
            <Route path="mittari" element={<Mittari />} />
            <Route path="pelisignaalit" element={<Pelisignaalit />} />
            <Route path="voita" element={<Voita />} />
            <Route path="voita/saannot" element={<VoitaSaannot />} />
            <Route path="voita/:slug" element={<VoitaRaffle />} />
            <Route path="voita/:slug/kiitos" element={<VoitaKiitos />} />

            {/* Legacy routes — 301 redirect, preserving ?ref / ?invite / ?pick query params */}
            <Route path="viikon-kortti" element={<RedirectWithQuery to="/pelisignaalit" />} />
            <Route path="vihjeet" element={<RedirectWithQuery to="/pelisignaalit" />} />
            <Route path="mittari/historia" element={<MittariHistoria />} />
            <Route path="uutiset" element={<Uutiset />} />

            {/* V2 Master Brief: new editorial surfaces */}
            <Route path="profiilit" element={<Profiilit />} />
            <Route path="skene" element={<Skene />} />
            <Route path="skene/talous" element={<SkeneTalous />} />
            <Route path="raha" element={<Raha />} />
            <Route path="kulttuuri" element={<Kulttuuri />} />
            <Route path="sponsoroinnit" element={<Sponsoroinnit />} />
            <Route path="saantely" element={<Saantely />} />
            <Route path="pelit" element={<Pelit />} />
            <Route path="pelit/blackjack" element={<PelitBlackjack />} />
            <Route path="pelit/poker" element={<PelitPoker />} />
            <Route path="pelit/slotit" element={<PelitSlotit />} />
            <Route path="pelit/craps" element={<PelitCraps />} />
            <Route path="pelit/ruletti" element={<PelitRuletti />} />
            <Route path="pelit/live" element={<PelitLive />} />
            <Route path="pelit/bonusmatematiikka" element={<PelitBonusmatematiikka />} />
            <Route path="pulssi" element={<Pulssi />} />

            {/* V2 accountability surfaces */}
            <Route path="korjaukset" element={<Korjaukset />} />
            {/* Phase 4 Week 3: auto-published Layer 2 articles. Unified /uutiset
                prefix covers every category. Dedicated category prefixes are
                added where they don't collide with existing profile routes
                (urheilijat / saannot are net-new; kasinot/:slug + striimaajat/:slug
                are reserved for operator/streamer profiles). */}
            <Route path="uutiset/:slug" element={<Article />} />
            <Route path="urheilijat/:slug" element={<Article />} />
            <Route path="saannot/:slug" element={<Article />} />
            <Route path="affiliaatti" element={<Affiliaatti />} />
            <Route path="avoimuus/2026" element={<Avoimuus />} />
            <Route path="lehdisto" element={<Lehdisto />} />
            <Route path="paivityslog" element={<Paivityslog />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster />
    </div>
  );
}

export default App;
