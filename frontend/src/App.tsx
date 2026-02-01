import { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/Login";
import HeroStatusBar from "./components/HeroStatusBar";
import BottomNav from "./components/BottomNav";
import Board from "./pages/Board";
import Profile from "./pages/Profile";
import Market from "./pages/Market";
import NFCTrigger from "./pages/NFCTrigger";
import QuestCardPlayground from "./pages/QuestCardPlayground";
import { COLORS } from "./constants/colors";

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [username, setUsername] = useState<string | null>(localStorage.getItem("username"));
  const [refreshStats, setRefreshStats] = useState(0);

  const handleLogout = () => {
    setToken(null);
    setUsername(null);
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("userId");
    localStorage.removeItem("homeId");
  };

  const handleQuestUpdate = () => {
    setRefreshStats(prev => prev + 1);
  };

  if (!token) {
    return (
      <Router>
        <div className="max-w-2xl mx-auto">
          <header
            className="text-center mb-10 md:mb-16 pb-6 md:pb-8"
            style={{ borderBottomColor: COLORS.gold, borderBottomWidth: "4px" }}
          >
            <h1
              className="text-4xl md:text-5xl font-serif font-bold drop-shadow-lg mb-2"
              style={{ color: COLORS.gold }}
            >
              MAJORDOMO
            </h1>
            <p className="text-sm md:text-base italic font-serif" style={{ color: COLORS.brown }}>
              Gamified Family Quests
            </p>
          </header>
          <Login
            onLoginSuccess={token => {
              setToken(token);
              const username = localStorage.getItem("username");
              setUsername(username);
            }}
          />
        </div>
      </Router>
    );
  }

  return (
    <Router>
      <div className="max-w-4xl mx-auto pb-32">
        {/* Header */}
        <header
          className="text-center mb-6 md:mb-8 pb-4 md:pb-6"
          style={{ borderBottomColor: COLORS.gold, borderBottomWidth: "4px" }}
        >
          <div className="flex justify-between items-start">
            <h1
              className="text-3xl md:text-4xl font-serif font-bold"
              style={{ color: COLORS.gold }}
            >
              MAJORDOMO
            </h1>
            <button
              className="px-3 py-1 md:px-4 md:py-2 font-serif text-xs uppercase tracking-wider transition-all"
              style={{
                backgroundColor: COLORS.redDark,
                borderColor: COLORS.gold,
                borderWidth: "1px",
                color: COLORS.gold,
              }}
              onClick={handleLogout}
            >
              Exit
            </button>
          </div>
        </header>

        {/* Hero Status Bar */}
        <HeroStatusBar username={username || ""} token={token} refreshTrigger={refreshStats} />

        {/* Page Content */}
        <Routes>
          <Route
            path="/board"
            element={<Board token={token} onQuestUpdate={handleQuestUpdate} />}
          />
          <Route path="/profile" element={<Profile token={token} />} />
          <Route path="/market" element={<Market />} />
          <Route path="/trigger/quest/:questTemplateId" element={<NFCTrigger />} />
          <Route path="/playground" element={<QuestCardPlayground />} />
          <Route path="/" element={<Navigate to="/board" replace />} />
        </Routes>

        {/* Bottom Navigation */}
        <BottomNav />
      </div>
    </Router>
  );
}

export default App;
