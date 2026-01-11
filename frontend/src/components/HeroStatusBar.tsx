import { useState, useEffect } from "react";
import { api } from "../services/api";
import { COLORS } from "../constants/colors";

interface HeroStatusBarProps {
  username: string;
  token: string;
  refreshTrigger?: number;
}

export default function HeroStatusBar({
  username,
  token,
  refreshTrigger,
}: HeroStatusBarProps) {
  const [userStats, setUserStats] = useState({
    level: 1,
    xp: 0,
    gold_balance: 0,
  });

  useEffect(() => {
    const fetchUserStats = async () => {
      try {
        const data = await api.user.getStats(token);
        setUserStats(data);
      } catch (err) {
        console.error("Failed to fetch user stats:", err);
      }
    };

    if (token && username) {
      fetchUserStats();
    }
  }, [token, username, refreshTrigger]);

  return (
    <div
      className="mb-8 p-4 md:p-6 rounded-sm font-serif"
      style={{
        backgroundColor: COLORS.darkPanel,
        borderTopColor: COLORS.gold,
        borderTopWidth: "3px",
      }}
    >
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        {/* Username */}
        <div>
          <p
            className="text-xs uppercase tracking-widest"
            style={{ color: COLORS.brown }}
          >
            Hero
          </p>
          <p
            className="text-lg md:text-xl font-bold"
            style={{ color: COLORS.gold }}
          >
            {username
              ? username.charAt(0).toUpperCase() + username.slice(1)
              : "Unknown"}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="flex gap-8 md:gap-12">
          {/* Level */}
          <div className="text-center">
            <p
              className="text-xs uppercase tracking-widest"
              style={{ color: COLORS.brown }}
            >
              Level
            </p>
            <p
              className="text-2xl md:text-3xl font-bold"
              style={{ color: COLORS.gold }}
            >
              {userStats.level ?? 1}
            </p>
          </div>

          {/* XP */}
          <div className="text-center">
            <p
              className="text-xs uppercase tracking-widest"
              style={{ color: COLORS.brown }}
            >
              XP
            </p>
            <p
              className="text-2xl md:text-3xl font-bold"
              style={{ color: COLORS.gold }}
            >
              {userStats.xp ?? 0}
            </p>
          </div>

          {/* Gold */}
          <div className="text-center">
            <p
              className="text-xs uppercase tracking-widest"
              style={{ color: COLORS.brown }}
            >
              Gold
            </p>
            <p
              className="text-2xl md:text-3xl font-bold"
              style={{ color: COLORS.gold }}
            >
              {userStats.gold_balance ?? 0}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
