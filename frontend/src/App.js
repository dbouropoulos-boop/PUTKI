import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import OperatorReview from "@/pages/OperatorReview";
import CasinoRanking from "@/pages/CasinoRanking";
import StreamerProfile from "@/pages/StreamerProfile";
import StreamerIndex from "@/pages/StreamerIndex";
import Methodology from "@/pages/Methodology";
import ColdEmailLanding from "@/pages/ColdEmailLanding";
import Signup from "@/pages/Signup";
import MiniGame from "@/pages/MiniGame";
import WeeklyCard from "@/pages/WeeklyCard";
import BackOffice from "@/pages/BackOffice";
import StreamerIntl from "@/pages/StreamerIntl";
import Toimitus from "@/pages/Toimitus";
import VoitaPalkinto from "@/pages/VoitaPalkinto";
import { Toaster } from "@/components/ui/sonner";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          {/* Standalone (no header/footer) */}
          <Route path="/landing" element={<ColdEmailLanding />} />
          <Route path="/aloita" element={<Signup />} />
          <Route path="/back-office" element={<BackOffice />} />

          {/* Main site */}
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="kasinot" element={<CasinoRanking />} />
            <Route path="kasinot/:slug" element={<OperatorReview />} />
            <Route path="striimaajat" element={<StreamerIndex />} />
            <Route path="striimaajat/kansainvaliset" element={<StreamerIntl />} />
            <Route path="striimaajat/:slug" element={<StreamerProfile />} />
            <Route path="menetelma" element={<Methodology />} />
            <Route path="toimitus" element={<Toimitus />} />
            <Route path="peli" element={<MiniGame />} />
            <Route path="voita-palkinto" element={<VoitaPalkinto />} />
            <Route path="viikon-kortti" element={<WeeklyCard />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster />
    </div>
  );
}

export default App;
