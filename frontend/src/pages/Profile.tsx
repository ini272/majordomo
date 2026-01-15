import { useState, useEffect } from "react";
import { COLORS } from "../constants/colors";
import { api } from "../services/api";
import type { User, Quest, Achievement, UserAchievement } from "../types/api";

interface ProfileProps {
  token: string;
}

export default function Profile({ token }: ProfileProps) {
  const [userStats, setUserStats] = useState<User | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllQuests, setShowAllQuests] = useState(false);
  const [homeInfo, setHomeInfo] = useState<{ invite_code: string; home_name: string } | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [userAchievements, setUserAchievements] = useState<UserAchievement[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [stats, questsData, achievementsData, userAchievementsData] = await Promise.all([
          api.user.getStats(token),
          api.quests.getAll(token),
          api.achievements.getAll(token),
          api.achievements.getMyAchievements(token),
        ]);
        setUserStats(stats);
        setQuests(questsData);
        setAchievements(achievementsData);
        setUserAchievements(userAchievementsData);

        // Fetch home info after we have the user stats
        if (stats.home_id) {
          const homeData = await api.home.getInviteCode(stats.home_id, token);
          setHomeInfo(homeData);
        }
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

  const completedQuests = quests.filter(q => q.completed);
  const completedCount = completedQuests.length;

  // Helper function to check if user has unlocked an achievement
  const isAchievementUnlocked = (achievementId: number): boolean => {
    return userAchievements.some(ua => ua.achievement_id === achievementId);
  };

  // Helper function to calculate progress toward an achievement
  const getAchievementProgress = (achievement: Achievement): { current: number; max: number; percent: number } => {
    if (!userStats) return { current: 0, max: achievement.criteria_value, percent: 0 };

    let current = 0;
    switch (achievement.criteria_type) {
      case "quests_completed":
        current = completedCount;
        break;
      case "level_reached":
        current = userStats.level;
        break;
      case "gold_earned":
        current = userStats.gold_balance;
        break;
      case "xp_earned":
        current = userStats.xp;
        break;
      default:
        current = 0;
    }

    const percent = Math.min((current / achievement.criteria_value) * 100, 100);
    return { current, max: achievement.criteria_value, percent };
  };

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

      {/* Home Information Section */}
      {homeInfo && (
        <div
          className="p-6 rounded-lg mb-8"
          style={{
            backgroundColor: COLORS.darkPanel,
            borderColor: COLORS.gold,
            borderWidth: "2px",
          }}
        >
          <h3
            className="text-xl font-serif font-bold mb-4 text-center"
            style={{ color: COLORS.gold }}
          >
            Your Home
          </h3>
          <div className="text-center mb-6">
            <p className="text-xs uppercase tracking-widest mb-1" style={{ color: COLORS.brown }}>
              Home Name
            </p>
            <p className="text-2xl font-serif font-bold" style={{ color: COLORS.parchment }}>
              {homeInfo.home_name}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs uppercase tracking-widest mb-2" style={{ color: COLORS.brown }}>
              Invite Code
            </p>
            <div className="flex items-center justify-center gap-3 mb-2">
              <p className="text-xl font-mono font-bold" style={{ color: COLORS.gold }}>
                {homeInfo.invite_code}
              </p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(homeInfo.invite_code);
                  setCopiedInvite(true);
                  setTimeout(() => setCopiedInvite(false), 2000);
                }}
                className="px-3 py-1 text-xs font-serif uppercase tracking-wider transition-all"
                style={{
                  backgroundColor: copiedInvite ? COLORS.greenSuccess : "transparent",
                  borderColor: copiedInvite ? COLORS.greenSuccess : COLORS.gold,
                  borderWidth: "2px",
                  color: copiedInvite ? COLORS.dark : COLORS.gold,
                }}
              >
                {copiedInvite ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="font-serif text-sm" style={{ color: COLORS.parchment, opacity: 0.7 }}>
              Share this code with others to invite them to your home
            </p>
          </div>
        </div>
      )}

      {/* Achievements Section */}
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
        {achievements.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {achievements.map(achievement => {
              const unlocked = isAchievementUnlocked(achievement.id);
              const progress = getAchievementProgress(achievement);

              return (
                <div
                  key={achievement.id}
                  className="p-4 rounded-lg"
                  style={{
                    backgroundColor: COLORS.dark,
                    borderColor: unlocked ? COLORS.gold : COLORS.brown,
                    borderWidth: "2px",
                    opacity: unlocked ? 1 : 0.7,
                  }}
                >
                  <div className="flex items-start gap-3 mb-2">
                    {/* Icon */}
                    <div
                      className="text-2xl flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full"
                      style={{
                        backgroundColor: unlocked ? COLORS.gold : COLORS.brown,
                        color: COLORS.dark,
                      }}
                    >
                      {achievement.icon === "trophy-bronze" && "🥉"}
                      {achievement.icon === "trophy-silver" && "🥈"}
                      {achievement.icon === "star" && "⭐"}
                      {achievement.icon === "coin" && "🪙"}
                      {!achievement.icon && "🏆"}
                    </div>

                    {/* Name and Description */}
                    <div className="flex-1">
                      <h4
                        className="font-serif font-bold mb-1"
                        style={{ color: unlocked ? COLORS.gold : COLORS.parchment }}
                      >
                        {achievement.name}
                      </h4>
                      <p
                        className="text-sm font-serif"
                        style={{ color: COLORS.brown }}
                      >
                        {achievement.description}
                      </p>
                    </div>

                    {/* Unlocked Badge */}
                    {unlocked && (
                      <div
                        className="text-xs font-serif px-2 py-1 rounded"
                        style={{
                          backgroundColor: COLORS.greenSuccess,
                          color: COLORS.dark,
                        }}
                      >
                        ✓
                      </div>
                    )}
                  </div>

                  {/* Progress Bar (only for locked achievements) */}
                  {!unlocked && (
                    <div className="mt-3">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-xs" style={{ color: COLORS.brown }}>
                          Progress
                        </p>
                        <p className="text-xs" style={{ color: COLORS.parchment }}>
                          {progress.current} / {progress.max}
                        </p>
                      </div>
                      <div
                        className="w-full h-2 rounded-full overflow-hidden"
                        style={{ backgroundColor: COLORS.dark }}
                      >
                        <div
                          className="h-full transition-all duration-500"
                          style={{
                            width: `${progress.percent}%`,
                            backgroundColor: COLORS.brown,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Unlocked Date */}
                  {unlocked && (
                    <div className="mt-2">
                      <p className="text-xs" style={{ color: COLORS.brown }}>
                        Unlocked {new Date(
                          userAchievements.find(ua => ua.achievement_id === achievement.id)?.unlocked_at || ""
                        ).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="font-serif text-lg mb-2" style={{ color: COLORS.brown }}>
              No achievements available yet
            </p>
            <p className="font-serif text-sm" style={{ color: COLORS.parchment, opacity: 0.7 }}>
              Complete quests and reach milestones to earn badges of honor
            </p>
          </div>
        )}
      </div>

      {/* Quest History Section */}
      <div
        className="p-6 rounded-lg"
        style={{
          backgroundColor: COLORS.darkPanel,
          borderColor: COLORS.brown,
          borderWidth: "2px",
        }}
      >
        <div className="flex justify-between items-center mb-4">
          <h3
            className="text-xl font-serif font-bold text-center flex-1"
            style={{ color: COLORS.gold }}
          >
            Quest History
          </h3>
          {completedQuests.length > 5 && (
            <button
              onClick={() => setShowAllQuests(!showAllQuests)}
              className="text-sm font-serif px-3 py-1 rounded transition-colors"
              style={{
                color: COLORS.gold,
                borderColor: COLORS.gold,
                borderWidth: "1px",
                backgroundColor: "transparent",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = COLORS.gold;
                e.currentTarget.style.color = COLORS.dark;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = COLORS.gold;
              }}
            >
              {showAllQuests ? "Show Recent" : `View All (${completedCount})`}
            </button>
          )}
        </div>
        {completedQuests.length > 0 ? (
          <div className="space-y-3">
            {completedQuests
              .sort((a, b) => {
                // Sort by completed_at timestamp, newest first
                const dateA = new Date(a.completed_at!).getTime();
                const dateB = new Date(b.completed_at!).getTime();
                return dateB - dateA;
              })
              .slice(0, showAllQuests ? completedQuests.length : 5)
              .map(quest => (
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
                      <span style={{ color: COLORS.gold }}>+{quest.template.xp_reward} XP</span>
                      <span style={{ color: COLORS.gold }}>+{quest.template.gold_reward} Gold</span>
                    </div>
                  </div>
                </div>
              ))}
            {!showAllQuests && completedQuests.length > 5 && (
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
