import { useState, useEffect } from "react";
import { COLORS } from "../constants/colors";
import { api } from "../services/api";
import type { User, Quest } from "../types/api";

interface ProfileProps {
  token: string;
}

export default function Profile({ token }: ProfileProps) {
  const [userStats, setUserStats] = useState<User | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [stats, questsData] = await Promise.all([
          api.user.getStats(token),
          api.quests.getAll(token),
        ]);
        setUserStats(stats);
        setQuests(questsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load profile data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="font-serif" style={{ color: COLORS.parchment }}>
          Loading your character sheet...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="p-4 rounded-lg text-center my-4"
        style={{
          backgroundColor: COLORS.redDarker,
          borderColor: COLORS.redBorder,
          borderWidth: "2px",
          color: COLORS.redLight,
        }}
      >
        <p className="font-serif">{error}</p>
      </div>
    );
  }

  if (!userStats) {
    return null;
  }

  const completedQuests = quests.filter((q) => q.completed);
  const completedCount = completedQuests.length;

  // Calculate XP progress to next level
  // Based on backend formula: Level N requires 100 * (N-1) * N / 2 total XP
  const currentLevel = userStats.level;
  const currentXP = userStats.xp;
  const xpForCurrentLevel = currentLevel > 1 ? (100 * (currentLevel - 1) * currentLevel) / 2 : 0;
  const xpForNextLevel = (100 * currentLevel * (currentLevel + 1)) / 2;
  const xpProgress = currentXP - xpForCurrentLevel;
  const xpNeeded = xpForNextLevel - xpForCurrentLevel;
  const progressPercent = (xpProgress / xpNeeded) * 100;

  return (
    <div className="py-6 px-4">
      {/* Header */}
      <h2
        className="text-3xl md:text-4xl font-serif font-bold mb-8 text-center"
        style={{ color: COLORS.gold }}
      >
        Character Sheet
      </h2>

      {/* Hero Name */}
      <div className="mb-8 text-center">
        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: COLORS.brown }}>
          Hero Name
        </p>
        <h3 className="text-2xl md:text-3xl font-serif font-bold" style={{ color: COLORS.gold }}>
          {userStats.username}
        </h3>
      </div>

      {/* Stats Grid */}
      <div
        className="p-6 rounded-lg mb-8"
        style={{
          backgroundColor: COLORS.darkPanel,
          borderColor: COLORS.gold,
          borderWidth: "2px",
        }}
      >
        <h3
          className="text-xl font-serif font-bold mb-6 text-center"
          style={{ color: COLORS.gold }}
        >
          Statistics
        </h3>

        <div className="grid grid-cols-2 gap-6 md:gap-8 mb-6">
          {/* Level */}
          <div className="text-center">
            <p className="text-xs uppercase tracking-widest mb-2" style={{ color: COLORS.brown }}>
              Level
            </p>
            <p className="text-4xl md:text-5xl font-bold" style={{ color: COLORS.gold }}>
              {userStats.level}
            </p>
          </div>

          {/* Gold */}
          <div className="text-center">
            <p className="text-xs uppercase tracking-widest mb-2" style={{ color: COLORS.brown }}>
              Gold
            </p>
            <p className="text-4xl md:text-5xl font-bold" style={{ color: COLORS.gold }}>
              {userStats.gold_balance}
            </p>
          </div>

          {/* Total XP */}
          <div className="text-center">
            <p className="text-xs uppercase tracking-widest mb-2" style={{ color: COLORS.brown }}>
              Total XP
            </p>
            <p className="text-3xl md:text-4xl font-bold" style={{ color: COLORS.parchment }}>
              {userStats.xp}
            </p>
          </div>

          {/* Quests Completed */}
          <div className="text-center">
            <p className="text-xs uppercase tracking-widest mb-2" style={{ color: COLORS.brown }}>
              Quests Done
            </p>
            <p className="text-3xl md:text-4xl font-bold" style={{ color: COLORS.greenSuccess }}>
              {completedCount}
            </p>
          </div>
        </div>

        {/* XP Progress Bar */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <p className="text-xs uppercase tracking-widest" style={{ color: COLORS.brown }}>
              Progress to Level {currentLevel + 1}
            </p>
            <p className="text-xs" style={{ color: COLORS.parchment }}>
              {xpProgress} / {xpNeeded} XP
            </p>
          </div>
          <div
            className="w-full h-4 rounded-full overflow-hidden"
            style={{ backgroundColor: COLORS.dark }}
          >
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${Math.min(progressPercent, 100)}%`,
                backgroundColor: COLORS.gold,
              }}
            />
          </div>
        </div>
      </div>

      {/* Achievements Section (Placeholder) */}
      <div
        className="p-6 rounded-lg mb-8"
        style={{
          backgroundColor: COLORS.darkPanel,
          borderColor: COLORS.brown,
          borderWidth: "2px",
        }}
      >
        <h3
          className="text-xl font-serif font-bold mb-4 text-center"
          style={{ color: COLORS.gold }}
        >
          Achievements
        </h3>
        <div className="text-center py-8">
          <p className="font-serif text-lg mb-2" style={{ color: COLORS.brown }}>
            No achievements unlocked yet
          </p>
          <p className="font-serif text-sm" style={{ color: COLORS.parchment, opacity: 0.7 }}>
            Complete quests and reach milestones to earn badges of honor
          </p>
        </div>
      </div>

      {/* Recent Completed Quests Section (Placeholder) */}
      <div
        className="p-6 rounded-lg"
        style={{
          backgroundColor: COLORS.darkPanel,
          borderColor: COLORS.brown,
          borderWidth: "2px",
        }}
      >
        <h3
          className="text-xl font-serif font-bold mb-4 text-center"
          style={{ color: COLORS.gold }}
        >
          Quest History
        </h3>
        {completedQuests.length > 0 ? (
          <div className="space-y-3">
            {completedQuests.slice(-5).reverse().map((quest) => (
              <div
                key={quest.id}
                className="p-4 rounded"
                style={{
                  backgroundColor: COLORS.dark,
                  borderLeftColor: COLORS.greenSuccess,
                  borderLeftWidth: "4px",
                }}
              >
                <p className="font-serif font-bold mb-1" style={{ color: COLORS.parchment }}>
                  {quest.template.display_name || quest.template.title}
                </p>
                <div className="flex justify-between items-center text-xs">
                  <p style={{ color: COLORS.brown }}>
                    Completed {new Date(quest.completed_at!).toLocaleDateString()}
                  </p>
                  <div className="flex gap-3">
                    <span style={{ color: COLORS.gold }}>
                      +{quest.template.xp_reward} XP
                    </span>
                    <span style={{ color: COLORS.gold }}>
                      +{quest.template.gold_reward} Gold
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {completedQuests.length > 5 && (
              <p className="text-center text-sm pt-2" style={{ color: COLORS.brown }}>
                Showing 5 most recent of {completedCount} total completed quests
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="font-serif text-lg mb-2" style={{ color: COLORS.brown }}>
              No quests completed yet
            </p>
            <p className="font-serif text-sm" style={{ color: COLORS.parchment, opacity: 0.7 }}>
              Begin your journey on the Quest Board
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
