import { useState, useEffect, useMemo } from "react";
import { COLORS } from "../constants/colors";
import { api } from "../services/api";
import type { User, Quest, Achievement, UserAchievement, Home } from "../types/api";
import { useAuth } from "../contexts/AuthContext";
import QuestCard from "../components/QuestCard";
import EditQuestModal from "../components/EditQuestModal";
import ModalShell from "../components/modal/ModalShell";
import { LAYERS } from "../constants/layers";
import { sortHomeUsers } from "../utils/homeUsers";

function HomeIcon() {
  return (
    <svg
      className="h-7 w-7"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.7}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M4.2 20.2V8.5l2.2 1.3 2.2-1.3 2.2 1.3 2.2-1.3 2.2 1.3 2.2-1.3 2.4 1.3v10.4" />
      <path d="M7.2 8V4.2h3.1V8" />
      <path d="M13.7 8V4.2h3.1V8" />
      <path d="M9.3 20.2v-4.5a2.7 2.7 0 0 1 5.4 0v4.5" />
      <path d="M3.2 20.2h17.6" />
    </svg>
  );
}

function getLevelProgress(xp: number, level: number) {
  const xpForCurrentLevel = level > 1 ? (100 * (level - 1) * level) / 2 : 0;
  const xpForNextLevel = (100 * level * (level + 1)) / 2;
  const xpProgress = xp - xpForCurrentLevel;
  const xpNeeded = xpForNextLevel - xpForCurrentLevel;

  return {
    xpProgress,
    xpNeeded,
    progressPercent: Math.min((xpProgress / xpNeeded) * 100, 100),
  };
}

export default function Profile() {
  const { token, userId, homeId, username } = useAuth();
  const [userStats, setUserStats] = useState<User | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [homeCompletedQuests, setHomeCompletedQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllQuests, setShowAllQuests] = useState(false);
  const [home, setHome] = useState<Home | null>(null);
  const [homeUsers, setHomeUsers] = useState<User[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [userAchievements, setUserAchievements] = useState<UserAchievement[]>([]);
  const [homeUsersById, setHomeUsersById] = useState<Record<number, string>>({});
  const [selectedCompletedQuest, setSelectedCompletedQuest] = useState<Quest | null>(null);
  const [showCompletedQuestEditModal, setShowCompletedQuestEditModal] = useState(false);
  const [showHomeMembersModal, setShowHomeMembersModal] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!token || userId === null) {
        setError("Not authenticated");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const [stats, questsData, achievementsData, userAchievementsData] = await Promise.all([
          api.user.getStats(token),
          api.quests.getByUser(userId, token, true),
          api.achievements.getAll(token),
          api.achievements.getMyAchievements(token),
        ]);
        setUserStats(stats);
        setQuests(questsData);
        setAchievements(achievementsData);
        setUserAchievements(userAchievementsData);

        try {
          const homeQuestsData = await api.quests.getAll(token);
          setHomeCompletedQuests(homeQuestsData.filter((quest) => quest.completed));
        } catch {
          setHomeCompletedQuests([]);
        }

        try {
          const homeUsersData = await api.user.getAll(token);
          setHomeUsers(sortHomeUsers(homeUsersData, userId));
          setHomeUsersById(
            homeUsersData.reduce<Record<number, string>>((usersById, homeUser) => {
              usersById[homeUser.id] = homeUser.username;
              return usersById;
            }, {})
          );
        } catch {
          setHomeUsers([]);
          setHomeUsersById({});
        }

        try {
          const resolvedHomeId = homeId ?? stats.home_id;
          if (resolvedHomeId) {
            const homeData = await api.home.get(resolvedHomeId, token);
            setHome(homeData);
          } else {
            setHome(null);
          }
        } catch {
          setHome(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load profile data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [homeId, token, userId]);

  const completedQuests = useMemo(() => quests.filter((q) => q.completed), [quests]);
  const sortedCompletedQuests = useMemo(
    () =>
      [...completedQuests].sort((a, b) => {
        const dateA = new Date(a.completed_at || 0).getTime();
        const dateB = new Date(b.completed_at || 0).getTime();
        return dateB - dateA;
      }),
    [completedQuests]
  );
  const completedCount = completedQuests.length;
  const getQuestParticipantUserIds = (quest: Quest) =>
    quest.participants && quest.participants.length > 0
      ? quest.participants.map((participant) => participant.user_id)
      : [quest.user_id];
  const getQuestParticipantNames = (quest: Quest) => {
    const participantNames = getQuestParticipantUserIds(quest)
      .map((participantUserId) => homeUsersById[participantUserId])
      .filter(Boolean);
    return participantNames.length > 0 ? participantNames.join(", ") : null;
  };
  const getCurrentUserQuestAward = (quest: Quest) => {
    const participantAward = quest.participants?.find(
      (participant) => participant.user_id === userId
    );
    return {
      xp: participantAward?.xp_awarded ?? quest.xp_reward,
      gold: participantAward?.gold_awarded ?? quest.gold_reward,
    };
  };
  const getQuestHouseholdAward = (quest: Quest) => {
    if (quest.participants && quest.participants.length > 0) {
      return quest.participants.reduce(
        (totals, participant) => ({
          xp: totals.xp + (participant.xp_awarded ?? quest.xp_reward),
          gold: totals.gold + (participant.gold_awarded ?? quest.gold_reward),
        }),
        { xp: 0, gold: 0 }
      );
    }

    return {
      xp: quest.xp_reward,
      gold: quest.gold_reward,
    };
  };
  const homeTotalXpEarned = useMemo(
    () =>
      homeCompletedQuests.reduce((total, quest) => total + getQuestHouseholdAward(quest).xp, 0),
    [homeCompletedQuests]
  );
  const homeTotalGoldEarned = useMemo(
    () =>
      homeCompletedQuests.reduce((total, quest) => total + getQuestHouseholdAward(quest).gold, 0),
    [homeCompletedQuests]
  );

  const closeCompletedQuestDetails = () => {
    setShowCompletedQuestEditModal(false);
    setSelectedCompletedQuest(null);
  };

  const handleCompletedQuestEditSaved = async (updatedQuest?: Quest) => {
    setShowCompletedQuestEditModal(false);

    if (updatedQuest) {
      setSelectedCompletedQuest(updatedQuest);
    }

    if (!token || userId === null) return;

    try {
      const updatedQuests = await api.quests.getByUser(userId, token, true);
      setQuests(updatedQuests);

      try {
        const updatedHomeQuests = await api.quests.getAll(token);
        setHomeCompletedQuests(updatedHomeQuests.filter((quest) => quest.completed));
      } catch {}

      if (updatedQuest) {
        const refreshedQuest =
          updatedQuests.find((quest) => quest.id === updatedQuest.id) ?? updatedQuest;
        setSelectedCompletedQuest(refreshedQuest);
      }
    } catch {
      if (updatedQuest) {
        setQuests((previousQuests) =>
          previousQuests.map((quest) => (quest.id === updatedQuest.id ? updatedQuest : quest))
        );
      }
    }
  };

  const canCreateTemplateFromSelectedCompletedQuest = Boolean(
    selectedCompletedQuest && selectedCompletedQuest.quest_template_id === null
  );

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

  // Helper function to check if user has unlocked an achievement
  const isAchievementUnlocked = (achievementId: number): boolean => {
    return userAchievements.some((ua) => ua.achievement_id === achievementId);
  };

  // Helper function to calculate progress toward an achievement
  const getAchievementProgress = (
    achievement: Achievement
  ): { current: number; max: number; percent: number } => {
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
  const { xpProgress, xpNeeded, progressPercent } = getLevelProgress(currentXP, currentLevel);
  const displayHeroName = username ?? userStats.username;
  const homeMembersCount = homeUsers.length;
  const homeTotalQuestsCompleted = homeCompletedQuests.length;

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

          {/* Quests Completed */}
          <div className="text-center">
            <p className="text-xs uppercase tracking-widest mb-2" style={{ color: COLORS.brown }}>
              Quests Done
            </p>
            <p className="text-3xl md:text-4xl font-bold" style={{ color: COLORS.greenSuccess }}>
              {completedCount}
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

          {/* Total Gold */}
          <div className="text-center">
            <p className="text-xs uppercase tracking-widest mb-2" style={{ color: COLORS.brown }}>
              Total Gold
            </p>
            <p className="text-4xl md:text-5xl font-bold" style={{ color: COLORS.gold }}>
              {userStats.gold_balance}
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
      {home && (
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
          <div className="mx-auto flex w-fit max-w-full items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => setShowHomeMembersModal(true)}
              aria-label={`View members of ${home.name}`}
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full focus-visible:outline-none sm:h-18 sm:w-18"
              style={{
                color: COLORS.gold,
                backgroundColor: COLORS.dark,
                border: `2px solid ${COLORS.gold}`,
              }}
            >
              <HomeIcon />
            </button>
            <div className="min-w-0 max-w-xs sm:max-w-sm">
              <h3
                className="text-2xl font-serif font-bold"
                style={{ color: COLORS.parchment }}
              >
                {home.name}
              </h3>
              <p className="mt-1 font-serif text-sm" style={{ color: COLORS.brown }}>
                Home of {displayHeroName}
              </p>
              <p className="mt-2 text-xs uppercase tracking-widest" style={{ color: COLORS.gold }}>
                Tap the crest to view members
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 md:gap-6 mt-6">
            <div className="text-center">
              <p className="text-xs uppercase tracking-widest mb-2" style={{ color: COLORS.brown }}>
                Members
              </p>
              <p className="text-3xl md:text-4xl font-bold" style={{ color: COLORS.gold }}>
                {homeMembersCount}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs uppercase tracking-widest mb-2" style={{ color: COLORS.brown }}>
                Quests Done
              </p>
              <p className="text-3xl md:text-4xl font-bold" style={{ color: COLORS.greenSuccess }}>
                {homeTotalQuestsCompleted}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs uppercase tracking-widest mb-2" style={{ color: COLORS.brown }}>
                Total XP
              </p>
              <p className="text-3xl md:text-4xl font-bold" style={{ color: COLORS.parchment }}>
                {homeTotalXpEarned}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs uppercase tracking-widest mb-2" style={{ color: COLORS.brown }}>
                Total Gold
              </p>
              <p className="text-3xl md:text-4xl font-bold" style={{ color: COLORS.gold }}>
                {homeTotalGoldEarned}
              </p>
            </div>
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
            {achievements.map((achievement) => {
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
                      <p className="text-sm font-serif" style={{ color: COLORS.brown }}>
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
                        Unlocked{" "}
                        {new Date(
                          userAchievements.find((ua) => ua.achievement_id === achievement.id)
                            ?.unlocked_at || ""
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
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = COLORS.gold;
                e.currentTarget.style.color = COLORS.dark;
              }}
              onMouseLeave={(e) => {
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
            {sortedCompletedQuests
              .slice(0, showAllQuests ? sortedCompletedQuests.length : 5)
              .map((quest) => {
                const award = getCurrentUserQuestAward(quest);
                const participantNames = getQuestParticipantNames(quest);
                const participantLabel = (quest.participants?.length || 1) > 1 ? "Party" : "For";
                return (
                  <button
                    type="button"
                    onClick={() => setSelectedCompletedQuest(quest)}
                    key={quest.id}
                    className="w-full p-4 rounded text-left transition-all hover:brightness-110"
                    style={{
                      backgroundColor: COLORS.dark,
                      borderLeftColor: COLORS.greenSuccess,
                      borderLeftWidth: "4px",
                    }}
                  >
                    <p className="font-serif font-bold mb-1" style={{ color: COLORS.parchment }}>
                      {quest.display_name || quest.title}
                    </p>
                    {participantNames && (
                      <p
                        className="mb-2 text-[11px] font-serif uppercase tracking-wide"
                        style={{ color: COLORS.brown }}
                      >
                        {participantLabel}:{" "}
                        <span style={{ color: COLORS.gold }}>{participantNames}</span>
                      </p>
                    )}
                    <div className="flex justify-between items-center text-xs">
                      <p style={{ color: COLORS.brown }}>
                        Completed {new Date(quest.completed_at!).toLocaleDateString()}
                      </p>
                      <div className="flex gap-3 items-center">
                        <span style={{ color: COLORS.gold }}>+{award.xp} XP</span>
                        <span style={{ color: COLORS.gold }}>+{award.gold} Gold</span>
                      </div>
                    </div>
                  </button>
                );
              })}
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

      {selectedCompletedQuest && (
        <ModalShell
          isOpen={true}
          onClose={closeCompletedQuestDetails}
          closeOnBackdrop={true}
          overlayClassName="p-3 sm:p-6 items-end sm:items-center bg-black/75"
          panelClassName="w-full max-w-3xl max-h-[92dvh]"
          zIndex={LAYERS.modal}
        >
          <div className="mb-2 flex justify-end gap-2">
            {canCreateTemplateFromSelectedCompletedQuest && (
              <button
                type="button"
                onClick={() => setShowCompletedQuestEditModal(true)}
                className="px-3 py-1 font-serif text-xs uppercase tracking-wider"
                style={{
                  border: `1px solid ${COLORS.gold}`,
                  color: COLORS.gold,
                  backgroundColor: "rgba(24, 17, 14, 0.85)",
                }}
              >
                Template
              </button>
            )}
            <button
              type="button"
              onClick={closeCompletedQuestDetails}
              className="px-3 py-1 font-serif text-xs uppercase tracking-wider"
              style={{
                border: `1px solid ${COLORS.gold}`,
                color: COLORS.gold,
                backgroundColor: "rgba(24, 17, 14, 0.85)",
              }}
            >
              Close
            </button>
          </div>
          <QuestCard
            quest={selectedCompletedQuest}
            questParticipantNames={getQuestParticipantNames(selectedCompletedQuest) ?? undefined}
            questCreatorName={homeUsersById[selectedCompletedQuest.created_by]}
            onComplete={() => undefined}
          />
        </ModalShell>
      )}

      {showCompletedQuestEditModal && selectedCompletedQuest && token && (
        <EditQuestModal
          questId={selectedCompletedQuest.id}
          token={token}
          skipAI={true}
          initialSaveAsTemplate={true}
          onSave={(result) => handleCompletedQuestEditSaved(result.quest)}
          onClose={() => setShowCompletedQuestEditModal(false)}
        />
      )}

      {home && (
        <ModalShell
          isOpen={showHomeMembersModal}
          onClose={() => setShowHomeMembersModal(false)}
          closeOnBackdrop={true}
          overlayClassName="p-3 sm:p-6 items-end sm:items-center bg-black/75"
          panelClassName="w-full max-w-2xl max-h-[88dvh]"
          zIndex={LAYERS.modal}
        >
          <div
            className="p-6 rounded-lg"
            style={{
              backgroundColor: COLORS.darkPanel,
              borderColor: COLORS.gold,
              borderWidth: "2px",
            }}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest" style={{ color: COLORS.brown }}>
                  Your Home
                </p>
                <h3 className="mt-2 font-serif text-2xl font-bold" style={{ color: COLORS.gold }}>
                  {home.name}
                </h3>
                <p className="mt-2 font-serif text-sm" style={{ color: COLORS.parchment }}>
                  {homeUsers.length} member{homeUsers.length === 1 ? "" : "s"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowHomeMembersModal(false)}
                className="px-3 py-1 font-serif text-xs uppercase tracking-wider"
                style={{
                  border: `1px solid ${COLORS.gold}`,
                  color: COLORS.gold,
                  backgroundColor: "rgba(24, 17, 14, 0.85)",
                }}
              >
                Close
              </button>
            </div>

            <div className="space-y-3">
              {homeUsers.length > 0 ? (
                homeUsers.map((member) => {
                  const isCurrentUser = member.id === userId;
                  const memberLevelProgress = getLevelProgress(member.xp, member.level);

                  return (
                    <div
                      key={member.id}
                      className="p-4 rounded-lg"
                      style={{
                        backgroundColor: COLORS.dark,
                        borderColor: isCurrentUser ? COLORS.gold : COLORS.brown,
                        borderWidth: "2px",
                      }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p
                              className="truncate font-serif text-lg font-bold"
                              style={{ color: isCurrentUser ? COLORS.gold : COLORS.parchment }}
                            >
                              {member.username}
                            </p>
                            {isCurrentUser && (
                              <span
                                className="px-2 py-0.5 text-xs font-serif uppercase tracking-wider"
                                style={{
                                  color: COLORS.dark,
                                  backgroundColor: COLORS.gold,
                                }}
                              >
                                You
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs uppercase tracking-widest" style={{ color: COLORS.brown }}>
                            Level {member.level}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-serif text-sm" style={{ color: COLORS.gold }}>
                            {member.xp} XP
                          </p>
                          <p className="mt-1 font-serif text-sm" style={{ color: COLORS.parchment }}>
                            {member.gold_balance} Gold
                          </p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-xs uppercase tracking-widest" style={{ color: COLORS.brown }}>
                            Progress to Level {member.level + 1}
                          </p>
                          <p className="text-xs" style={{ color: COLORS.parchment }}>
                            {memberLevelProgress.xpProgress} / {memberLevelProgress.xpNeeded} XP
                          </p>
                        </div>
                        <div
                          className="w-full h-4 rounded-full overflow-hidden"
                          style={{ backgroundColor: COLORS.darkPanel }}
                        >
                          <div
                            className="h-full transition-all duration-500"
                            style={{
                              width: `${memberLevelProgress.progressPercent}%`,
                              backgroundColor: COLORS.gold,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div
                  className="p-4 rounded-lg text-center"
                  style={{
                    backgroundColor: COLORS.dark,
                    borderColor: COLORS.brown,
                    borderWidth: "2px",
                  }}
                >
                  <p className="font-serif text-base" style={{ color: COLORS.parchment }}>
                    House members are not available right now.
                  </p>
                </div>
              )}
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
