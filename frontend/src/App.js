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
import Voyager from "@/pages/Voyager";
import TietoaMeista from "@/pages/TietoaMeista";
import WeeklyCard from "@/pages/WeeklyCard";
// iter85c · Phase 3 — BettingTipsHub deprioritized (page exists but is
// no longer routed from the SPA; legacy /vihjeet redirects already
// route to /pelisignaalit which is the current canonical tips surface).
import BackOfficeToday from "@/pages/BackOfficeToday";
import BackOfficeActivity from "@/pages/BackOfficeActivity";
import BackOfficeQueue from "@/pages/BackOfficeQueue";
import FoundationalResearch from "@/pages/FoundationalResearch";
import OperatorsAdmin from "@/pages/OperatorsAdmin";
import StreamersAdmin from "@/pages/StreamersAdmin";
import BackOfficeWebhooks from "@/pages/BackOfficeWebhooks";
import BackOfficeTelegram from "@/pages/BackOfficeTelegram";
import BackOfficeDrafts from "@/pages/BackOfficeDrafts";
import BackOfficeWeekly from "@/pages/BackOfficeWeekly";
import BackOfficePeli from "@/pages/BackOfficePeli";
import BackOfficeStreamerMeta from "@/pages/BackOfficeStreamerMeta";
import BackOfficeSlotRegistry from "@/pages/BackOfficeSlotRegistry";
import BackOfficeOptinSegments from "@/pages/BackOfficeOptinSegments";
import BackOfficeDispatchPreview from "@/pages/BackOfficeDispatchPreview";
import BackOfficeVoita from "@/pages/BackOfficeVoita";
import BackOfficeVoitaQuiz from "@/pages/BackOfficeVoitaQuiz";
import BackOfficeMittariCopy from "@/pages/BackOfficeMittariCopy";
import BackOfficeMestariCopy from "@/pages/BackOfficeMestariCopy";
import BackOfficeVoyagerRotation from "@/pages/BackOfficeVoyagerRotation";
import BackOfficePlaybook from "@/pages/BackOfficePlaybook";
import BackOfficeLeads from "@/pages/BackOfficeLeads";
import BackOfficeOgImages from "@/pages/BackOfficeOgImages";
import BackOfficeIntegrations from "@/pages/BackOfficeIntegrations";
import BackOfficeNewsWatch from "@/pages/BackOfficeNewsWatch";
import BackOfficeEmailTemplates from "@/pages/BackOfficeEmailTemplates";
import BackOfficeMestariDiagnosticsCopy from "@/pages/BackOfficeMestariDiagnosticsCopy";
import BackOfficeProfilerFunnel from "@/pages/BackOfficeProfilerFunnel";
import BackOfficeBotRouting from "@/pages/BackOfficeBotRouting";
import BackOfficeFunnelHistory from "@/pages/BackOfficeFunnelHistory";
import BackOfficeRunbook from "@/pages/BackOfficeRunbook";
import BackOfficeSettings from "@/pages/BackOfficeSettings";
import BackOfficeShell from "@/components/back-office/BackOfficeShell";
import MittariSignup from "@/pages/MittariSignup";
import MittariMiniApp from "@/pages/MittariMiniApp";
import Mittari from "@/pages/Mittari";
import Pelisignaalit from "@/pages/Pelisignaalit";
import Voita from "@/pages/Voita";
import VoitaRaffle from "@/pages/VoitaRaffle";
import VoitaKiitos from "@/pages/VoitaKiitos";
import VoitaSaannot from "@/pages/VoitaSaannot";
import Mestari from "@/pages/Mestari";
import MestariHub from "@/pages/MestariHub";
import MestariDiagnostic from "@/pages/MestariDiagnostic";
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
import PeliAreenaHub from "@/pages/PeliAreenaHub";
import PeliAreenaQuiz from "@/pages/PeliAreenaQuiz";
import PeliAreenaScenario from "@/pages/PeliAreenaScenario";
import PeliAreenaInsight from "@/pages/PeliAreenaInsight";
import PeliAreenaSnake from "@/pages/PeliAreenaSnake";
import PeliAreenaTap from "@/pages/PeliAreenaTap";
import BackOfficeMiniGames from "@/pages/BackOfficeMiniGames";
import BackOfficeMiniGameAnalytics from "@/pages/BackOfficeMiniGameAnalytics";
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
          <Route path="/signup" element={<MittariSignup />} />
          <Route path="/tma" element={<MittariMiniApp />} />
          <Route path="/mestari" element={<MestariHub />} />
          <Route path="/mestari/sports" element={<Mestari />} />
          <Route path="/mestari/poker" element={<MestariDiagnostic diagnostic="poker" />} />
          <Route path="/mestari/blackjack" element={<MestariDiagnostic diagnostic="blackjack" />} />
          <Route path="/game" element={<Voyager />} />
          <Route path="/voyager" element={<Navigate to="/game" replace />} />
          {/* iter77 + iter82·Task2.2: shared shell - persistent sidebar,
              status strip, Cmd+K, unified AuthGate. All back-office
              routes render inside this shell. */}
          <Route element={<BackOfficeShell />}>
            <Route path="/back-office" element={<BackOfficeToday />} />
            <Route path="/back-office/activity" element={<BackOfficeActivity />} />
            <Route path="/back-office/queue" element={<BackOfficeQueue />} />
            <Route path="/back-office/foundational-research" element={<FoundationalResearch />} />
            <Route path="/back-office/operators" element={<OperatorsAdmin />} />
            <Route path="/back-office/streamers" element={<StreamersAdmin />} />
            <Route path="/back-office/webhooks" element={<BackOfficeWebhooks />} />
            <Route path="/back-office/telegram" element={<BackOfficeTelegram />} />
            <Route path="/back-office/drafts" element={<BackOfficeDrafts />} />
            <Route path="/back-office/weekly" element={<BackOfficeWeekly />} />
            <Route path="/back-office/peli" element={<BackOfficePeli />} />
            <Route path="/back-office/streamer-meta" element={<BackOfficeStreamerMeta />} />
            <Route path="/back-office/slot-registry" element={<BackOfficeSlotRegistry />} />
            <Route path="/back-office/optin-segments" element={<BackOfficeOptinSegments />} />
            <Route path="/back-office/dispatch-preview" element={<BackOfficeDispatchPreview />} />
            <Route path="/back-office/voita" element={<BackOfficeVoita />} />
            <Route path="/back-office/voita-quiz" element={<BackOfficeVoitaQuiz />} />
            <Route path="/back-office/mittari-copy" element={<BackOfficeMittariCopy />} />
            <Route path="/back-office/mestari-copy" element={<BackOfficeMestariCopy />} />
            <Route path="/back-office/voyager" element={<BackOfficeVoyagerRotation />} />
            <Route path="/back-office/playbook" element={<BackOfficePlaybook />} />
            <Route path="/back-office/profiler-funnel" element={<BackOfficeProfilerFunnel />} />
            <Route path="/back-office/bot-routing" element={<BackOfficeBotRouting />} />
            <Route path="/back-office/funnel" element={<BackOfficeFunnelHistory />} />
            <Route path="/back-office/runbook" element={<BackOfficeRunbook />} />
            <Route path="/back-office/settings" element={<BackOfficeSettings />} />
            <Route path="/back-office/leads" element={<BackOfficeLeads />} />
            <Route path="/back-office/og-images" element={<BackOfficeOgImages />} />
            <Route path="/back-office/integrations" element={<BackOfficeIntegrations />} />
            <Route path="/back-office/news-watch" element={<BackOfficeNewsWatch />} />
            <Route path="/back-office/mini-games" element={<BackOfficeMiniGames />} />
            <Route path="/back-office/analytics/mini-games" element={<BackOfficeMiniGameAnalytics />} />
            <Route path="/back-office/email-templates" element={<BackOfficeEmailTemplates />} />
            <Route path="/back-office/mestari-diagnostics-copy" element={<BackOfficeMestariDiagnosticsCopy />} />
          </Route>
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
            <Route path="peliareena" element={<PeliAreenaHub />} />
            <Route path="peliareena/tietoisuustesti" element={<PeliAreenaQuiz />} />
            <Route path="peliareena/paatospolku" element={<PeliAreenaScenario />} />
            <Route path="peliareena/tietoraape" element={<PeliAreenaInsight />} />
            <Route path="peliareena/aikatappo-mato" element={<PeliAreenaSnake />} />
            <Route path="peliareena/aikatappo-napautus" element={<PeliAreenaTap />} />
            <Route path="tietoa-meista" element={<TietoaMeista />} />
            <Route path="voita-palkinto" element={<VoitaPalkinto />} />

            {/* Phase 1 Final Restructure · Chunk B - dedicated landing pages */}
            <Route path="mittari" element={<Mittari />} />
            <Route path="pelisignaalit" element={<Pelisignaalit />} />
            <Route path="voita" element={<Voita />} />
            <Route path="voita/saannot" element={<VoitaSaannot />} />
            <Route path="voita/:slug" element={<VoitaRaffle />} />
            <Route path="voita/:slug/kiitos" element={<VoitaKiitos />} />

            {/* Legacy routes - 301 redirect, preserving ?ref / ?invite / ?pick query params */}
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
