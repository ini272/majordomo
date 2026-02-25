import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/Login";
import BottomNav from "./components/BottomNav";
import Board from "./pages/Board";
import Profile from "./pages/Profile";
import Market from "./pages/Market";
import NFCTrigger from "./pages/NFCTrigger";
import QuestCardPlayground from "./pages/QuestCardPlayground";
import { COLORS } from "./constants/colors";
import { useAuth } from "./contexts/AuthContext";
import { useSound } from "./contexts/SoundContext";

function App() {
  const { isAuthenticated, logout } = useAuth();
  const { isMuted, toggleMute } = useSound();

  if (!isAuthenticated) {
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
          <Login />
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
            <div className="flex items-center gap-2 md:gap-3">
              <button
                type="button"
                className="px-3 py-1 md:px-4 md:py-2 font-serif text-xs uppercase tracking-wider transition-all"
                style={{
                  backgroundColor: "rgba(212, 175, 55, 0.14)",
                  borderColor: COLORS.gold,
                  borderWidth: "1px",
                  color: COLORS.gold,
                }}
                onClick={toggleMute}
                title={isMuted ? "Unmute sound effects" : "Mute sound effects"}
                aria-label={isMuted ? "Unmute sound effects" : "Mute sound effects"}
                aria-pressed={isMuted}
              >
                {isMuted ? "Sound: Off" : "Sound: On"}
              </button>
              <button
                type="button"
                className="px-3 py-1 md:px-4 md:py-2 font-serif text-xs uppercase tracking-wider transition-all"
                style={{
                  backgroundColor: COLORS.redDark,
                  borderColor: COLORS.gold,
                  borderWidth: "1px",
                  color: COLORS.gold,
                }}
                onClick={logout}
              >
                Exit
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <Routes>
          <Route path="/board" element={<Board />} />
          <Route path="/profile" element={<Profile />} />
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
