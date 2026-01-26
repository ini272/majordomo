import { useState, useEffect } from "react";
import { api } from "../services/api";
import { COLORS } from "../constants/colors";
import type { User } from "../types/api";

interface HeroStatusBarProps {
  username: string;
  token: string;
  refreshTrigger?: number;
}

export default function HeroStatusBar({ username, token, refreshTrigger }: HeroStatusBarProps) {
  const [userStats, setUserStats] = useState<User | null>(null);

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

  // Calculate time remaining for shield
  const getShieldTimeRemaining = () => {
    if (!userStats?.active_shield_expiry) return null;
    const expiry = new Date(userStats.active_shield_expiry);
    const now = new Date();
    const diff = expiry.getTime() - now.getTime();

    if (diff < 0) return null;

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const hasElixir = userStats?.active_xp_boost_count && userStats.active_xp_boost_count > 0;
  const hasShield =
    userStats?.active_shield_expiry && new Date(userStats.active_shield_expiry) > new Date();
  const shieldTime = getShieldTimeRemaining();

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
          <p className="text-xs uppercase tracking-widest" style={{ color: COLORS.brown }}>
            Hero
          </p>
          <p className="text-lg md:text-xl font-bold" style={{ color: COLORS.gold }}>
            {username ? username.charAt(0).toUpperCase() + username.slice(1) : "Unknown"}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="flex gap-8 md:gap-12">
          {/* Level */}
          <div className="text-center">
            <p className="text-xs uppercase tracking-widest" style={{ color: COLORS.brown }}>
              Level
            </p>
            <p className="text-2xl md:text-3xl font-bold" style={{ color: COLORS.gold }}>
              {userStats?.level ?? 1}
            </p>
          </div>

          {/* XP */}
          <div className="text-center">
            <p className="text-xs uppercase tracking-widest" style={{ color: COLORS.brown }}>
              XP
            </p>
            <p className="text-2xl md:text-3xl font-bold" style={{ color: COLORS.gold }}>
              {userStats?.xp ?? 0}
            </p>
          </div>

          {/* Gold */}
          <div className="text-center">
            <p className="text-xs uppercase tracking-widest" style={{ color: COLORS.brown }}>
              Gold
            </p>
            <p className="text-2xl md:text-3xl font-bold" style={{ color: COLORS.gold }}>
              {userStats?.gold_balance ?? 0}
            </p>
          </div>
        </div>
      </div>

      {/* Active Consumables */}
      {(hasElixir || hasShield) && (
        <div className="mt-4 pt-4 border-t" style={{ borderColor: COLORS.brown }}>
          <p className="text-xs uppercase tracking-widest mb-2" style={{ color: COLORS.brown }}>
            Active Effects
          </p>
          <div className="flex flex-wrap gap-2">
            {hasElixir && (
              <div
                className="px-3 py-1.5 rounded text-sm font-bold flex items-center gap-2 animate-pulse"
                style={{
                  backgroundColor: "rgba(107, 95, 183, 0.3)",
                  color: "#9d84ff",
                  borderColor: "#6b5fb7",
                  borderWidth: "1px",
                  borderStyle: "solid",
                }}
              >
                <span>⚗️</span>
                <span>Heroic Elixir ({userStats?.active_xp_boost_count} quests)</span>
              </div>
            )}
            {hasShield && shieldTime && (
              <div
                className="px-3 py-1.5 rounded text-sm font-bold flex items-center gap-2 animate-pulse"
                style={{
                  backgroundColor: "rgba(74, 124, 155, 0.3)",
                  color: "#5fb7d4",
                  borderColor: "#4a7c9b",
                  borderWidth: "1px",
                  borderStyle: "solid",
                }}
              >
                <span>🛡️</span>
                <span>Purification Shield ({shieldTime})</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
