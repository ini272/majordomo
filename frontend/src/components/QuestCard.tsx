import { useEffect, useState } from "react";

import { COLORS } from "../constants/colors";
import type { Quest } from "../types/api";
import { formatScheduleLabel } from "../utils/schedule";

interface QuestTypeStyles {
  borderColor: string;
  titleColor: string;
  badgeBg: string;
  badgeColor: string;
}

const getQuestTypeStyles = (questType: string): QuestTypeStyles => {
  switch (questType) {
    case "bounty":
      return {
        borderColor: "#6b5fb7",
        titleColor: "#9d84ff",
        badgeBg: "rgba(107, 95, 183, 0.3)",
        badgeColor: "#9d84ff",
      };
    case "corrupted":
      return {
        borderColor: "#8b3a3a",
        titleColor: "#ff6b6b",
        badgeBg: "rgba(139, 58, 58, 0.3)",
        badgeColor: "#ff8080",
      };
    default: // standard
      return {
        borderColor: COLORS.gold,
        titleColor: COLORS.gold,
        badgeBg: "rgba(212, 175, 55, 0.1)",
        badgeColor: COLORS.gold,
      };
  }
};

interface QuestCardProps {
  quest: Quest;
  questParticipantNames?: string;
  questCreatorName?: string;
  onComplete: (questId: number) => void;
  onAbandon?: (questId: number) => void;
  isDailyBounty?: boolean;
  isUpcoming?: boolean;
  upcomingSpawnTime?: string;
  isAbandoning?: boolean;
}

export default function QuestCard({
  quest,
  questParticipantNames,
  questCreatorName,
  onComplete,
  onAbandon,
  isDailyBounty = false,
  isUpcoming = false,
  upcomingSpawnTime,
  isAbandoning = false,
}: QuestCardProps) {
  const typeStyles = getQuestTypeStyles(quest.quest_type);
  const isCorrupted = quest.quest_type === "corrupted";
  const hasCorruptionDebuff =
    !quest.completed && quest.corruption_debuff_active && (quest.corruption_debuff ?? 1) < 1;
  const corruptionPenaltyPercent = hasCorruptionDebuff
    ? Math.round((1 - (quest.corruption_debuff ?? 1)) * 100)
    : 0;
  const cardBorderColor = isCorrupted
    ? typeStyles.borderColor
    : isDailyBounty
      ? "#6b5fb7"
      : typeStyles.borderColor;
  const displayTitle = quest.display_name?.trim() || quest.title || "Unknown Quest";
  const originalTitle = quest.title?.trim() || "";
  const hasOriginalTitle = Boolean(
    quest.display_name?.trim() && originalTitle && originalTitle !== quest.display_name.trim()
  );
  const [showOriginalTitle, setShowOriginalTitle] = useState(false);
  const originalTitlePanelId = `quest-original-title-${quest.id}`;
  const participantCount = quest.participants?.length || 1;
  const participantLabel = participantCount > 1 ? "Party" : "For";
  const completedXpTotal =
    quest.completed && quest.participants?.some((participant) => participant.xp_awarded !== null)
      ? quest.participants.reduce((total, participant) => total + (participant.xp_awarded ?? 0), 0)
      : quest.xp_reward || 0;
  const completedGoldTotal =
    quest.completed && quest.participants?.some((participant) => participant.gold_awarded !== null)
      ? quest.participants.reduce(
          (total, participant) => total + (participant.gold_awarded ?? 0),
          0
        )
      : quest.gold_reward || 0;
  const baseXpReward = quest.xp_reward || 0;
  const baseGoldReward = quest.gold_reward || 0;
  const previewXpReward = quest.effective_xp_reward ?? baseXpReward;
  const previewGoldReward = quest.effective_gold_reward ?? baseGoldReward;
  const displayXpReward = quest.completed ? completedXpTotal : previewXpReward;
  const displayGoldReward =
    isDailyBounty && !quest.completed && participantCount === 1
      ? previewGoldReward * 3
      : quest.completed
        ? completedGoldTotal
        : previewGoldReward;

  useEffect(() => {
    setShowOriginalTitle(false);
  }, [quest.id]);

  // Format upcoming spawn time
  const formatUpcomingTime = (spawnTime: string | undefined) => {
    if (!spawnTime) return null;
    const spawn = new Date(spawnTime);
    const now = new Date();
    const diff = spawn.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return "Spawns soon";
    if (hours < 24) return `Spawns in ${hours} hour${hours > 1 ? "s" : ""}`;
    if (days === 1) return "Spawns tomorrow";
    if (days < 7) return `Spawns in ${days} days`;

    // Show actual date for far future
    return `Spawns ${spawn.toLocaleDateString()}`;
  };

  // Calculate deadline from created_at + due_in_hours
  const calculateDeadline = () => {
    if (!quest.due_in_hours) return null;
    const createdAt = new Date(quest.created_at);
    const deadline = new Date(createdAt.getTime() + quest.due_in_hours * 60 * 60 * 1000);
    return deadline;
  };

  // Format deadline for display
  const formatDeadline = () => {
    const deadline = calculateDeadline();
    if (!deadline) return null;

    const now = new Date();
    const diff = deadline.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (diff < 0) return "Corrupted";
    if (days > 0) return `${days} day${days > 1 ? "s" : ""} left`;
    if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} left`;
    return "Due soon";
  };

  const scheduleInfo = formatScheduleLabel(
    quest.recurrence as "one-off" | "daily" | "weekly" | "monthly",
    quest.schedule
  );
  const isRecurring = quest.recurrence !== "one-off";
  const showAbandonAction = Boolean(onAbandon) && !quest.completed;
  const deadlineLabel = formatDeadline();
  const isDeadlineCorrupted = deadlineLabel === "Corrupted";
  const showDeadlineBadge = Boolean(quest.due_in_hours && !quest.completed && !isCorrupted);

  return (
    <div
      className="relative p-6 md:p-8 mb-6 md:mb-8 shadow-lg"
      style={{
        backgroundColor: COLORS.darkPanel,
        borderColor: cardBorderColor,
        borderWidth: "3px",
        opacity: isUpcoming ? 0.6 : 1,
      }}
    >
      {/* Decorative element */}
      <div className="absolute top-3 right-4 text-2xl opacity-20">⚔</div>

      {/* Quest Type Badge */}
      <div className="mb-4 pr-8 flex gap-2 flex-wrap">
        <span
          className={`px-2 py-1 rounded text-xs uppercase font-serif font-bold ${isCorrupted ? "animate-pulse" : ""}`}
          style={{
            backgroundColor: typeStyles.badgeBg,
            color: typeStyles.badgeColor,
          }}
        >
          {quest.quest_type}
        </span>
        {isRecurring && scheduleInfo && (
          <span
            className="px-2 py-1 rounded text-xs font-serif font-bold"
            style={{
              backgroundColor: "rgba(100, 149, 237, 0.2)",
              color: "#6495ED",
              border: "1px solid #6495ED",
            }}
            title="Recurring Quest"
          >
            🔄 {scheduleInfo}
          </span>
        )}
        {isDailyBounty && (
          <span
            className="px-2 py-1 rounded text-xs uppercase font-serif font-bold"
            style={{
              backgroundColor: "rgba(107, 95, 183, 0.3)",
              color: "#9d84ff",
            }}
          >
            3x Gold Bounty
          </span>
        )}
        {hasCorruptionDebuff && (
          <span
            className="px-2 py-1 rounded text-xs uppercase font-serif font-bold"
            style={{
              backgroundColor: "rgba(139, 58, 58, 0.24)",
              color: "#ff8080",
              border: "1px solid #ff8080",
            }}
          >
            Household -{corruptionPenaltyPercent}%
          </span>
        )}
        {showDeadlineBadge && deadlineLabel && (
          <span
            className="px-2 py-1 rounded text-xs font-serif font-bold"
            style={{
              backgroundColor: isDeadlineCorrupted
                ? "rgba(139, 58, 58, 0.2)"
                : "rgba(255, 165, 0, 0.2)",
              color: isDeadlineCorrupted ? "#ff6b6b" : "#ffa500",
              border: `1px solid ${isDeadlineCorrupted ? "#ff6b6b" : "#ffa500"}`,
            }}
          >
            📅 {deadlineLabel}
          </span>
        )}
      </div>

      {/* Title */}
      <div
        className="pb-3 md:pb-4 mb-4"
        style={{
          borderBottomColor: typeStyles.titleColor,
          borderBottomWidth: "2px",
        }}
      >
        <div className="flex items-start gap-3">
          <h2
            className="flex-1 text-2xl md:text-3xl font-serif font-bold uppercase tracking-wider"
            style={{
              color: typeStyles.titleColor,
            }}
          >
            {displayTitle}
          </h2>
          {hasOriginalTitle && (
            <button
              type="button"
              aria-label={showOriginalTitle ? "Hide original title" : "Show original title"}
              aria-controls={originalTitlePanelId}
              aria-expanded={showOriginalTitle}
              onClick={() => setShowOriginalTitle((current) => !current)}
              className="w-8 h-8 shrink-0 rounded-full text-sm font-serif font-bold"
              style={{
                border: `1px solid ${COLORS.gold}`,
                backgroundColor: "rgba(24, 17, 14, 0.88)",
                color: COLORS.gold,
              }}
              title={showOriginalTitle ? "Hide original title" : "Show original title"}
            >
              i
            </button>
          )}
        </div>

        {hasOriginalTitle && showOriginalTitle && (
          <div
            id={originalTitlePanelId}
            className="mt-3 rounded px-3 py-2 select-text"
            style={{
              backgroundColor: "rgba(24, 17, 14, 0.82)",
              border: `1px solid ${COLORS.gold}`,
            }}
          >
            <div
              className="text-[11px] uppercase tracking-widest font-serif mb-1"
              style={{ color: COLORS.brown }}
            >
              Original Title
            </div>
            <p className="font-serif italic normal-case" style={{ color: COLORS.parchment }}>
              {originalTitle}
            </p>
          </div>
        )}
      </div>

      {/* Description */}
      <p
        className="italic leading-relaxed mb-6 md:mb-8 font-serif"
        style={{ color: COLORS.parchment }}
      >
        {quest.description || "No description"}
      </p>

      {(questParticipantNames || questCreatorName) && (
        <div className="mb-6 md:mb-8 flex flex-wrap gap-3 text-xs font-serif uppercase tracking-wide">
          {questParticipantNames && (
            <span style={{ color: COLORS.brown }}>
              {participantLabel}:{" "}
              <span style={{ color: COLORS.gold }}>{questParticipantNames}</span>
            </span>
          )}
          {questCreatorName && !questParticipantNames?.split(", ").includes(questCreatorName) && (
            <span style={{ color: COLORS.brown }}>
              Created by: <span style={{ color: COLORS.parchment }}>{questCreatorName}</span>
            </span>
          )}
        </div>
      )}

      {/* Tags */}
      {quest.tags && (
        <div className="flex flex-wrap gap-2 mb-6 md:mb-8">
          {quest.tags.split(",").map((tag) => (
            <span
              key={tag}
              className="px-2 py-1 text-xs uppercase font-serif rounded"
              style={{
                backgroundColor: "rgba(212, 175, 55, 0.2)",
                color: COLORS.gold,
                border: `1px solid ${COLORS.gold}`,
              }}
            >
              {tag.trim()}
            </span>
          ))}
        </div>
      )}

      {/* Stats Grid */}
      <div
        className="flex flex-col md:flex-row gap-8 md:gap-12 md:gap-16 mt-6 md:mt-8 pt-6 md:pt-8"
        style={{ borderTopColor: COLORS.redBorder, borderTopWidth: "1px" }}
      >
        <div className="text-center flex-1">
          <div
            className="text-xs uppercase tracking-widest mb-2 font-serif"
            style={{ color: COLORS.brown }}
          >
            {quest.completed ? "XP Awarded" : "XP Reward"}
          </div>
          <div className="text-2xl md:text-3xl font-serif font-bold" style={{ color: COLORS.gold }}>
            {displayXpReward}
          </div>
          {hasCorruptionDebuff && (
            <div className="mt-1 text-xs font-serif" style={{ color: "#ff8080" }}>
              Base {baseXpReward} XP, corruption -{corruptionPenaltyPercent}%
            </div>
          )}
        </div>
        <div className="text-center flex-1">
          <div
            className="text-xs uppercase tracking-widest mb-2 font-serif"
            style={{ color: COLORS.brown }}
          >
            {quest.completed ? "Gold Awarded" : "Gold Reward"}
          </div>
          <div className="text-2xl md:text-3xl font-serif font-bold" style={{ color: COLORS.gold }}>
            {displayGoldReward}
            {isDailyBounty && !quest.completed && participantCount === 1 && (
              <span className="text-sm ml-2" style={{ color: "#9d84ff" }}>
                (3x)
              </span>
            )}
          </div>
          {hasCorruptionDebuff && (
            <div className="mt-1 text-xs font-serif" style={{ color: "#ff8080" }}>
              Base {baseGoldReward} Gold, corruption -{corruptionPenaltyPercent}%
            </div>
          )}
        </div>
        <div className="text-center flex-1">
          <div
            className="text-xs uppercase tracking-widest mb-2 font-serif"
            style={{ color: COLORS.brown }}
          >
            Status
          </div>
          <div className="text-2xl md:text-3xl font-serif font-bold" style={{ color: COLORS.gold }}>
            {quest.completed ? "COMPLETED" : "ACTIVE"}
          </div>
        </div>
      </div>

      {/* Complete Button / Upcoming Info */}
      {isUpcoming ? (
        <div
          className="w-full mt-6 md:mt-8 py-3 md:py-4 px-4 font-serif font-semibold text-sm md:text-base uppercase tracking-wider text-center"
          style={{
            backgroundColor: "rgba(212, 175, 55, 0.15)",
            borderColor: COLORS.gold,
            borderWidth: "2px",
            color: COLORS.gold,
          }}
        >
          📅 {formatUpcomingTime(upcomingSpawnTime)}
        </div>
      ) : !quest.completed || showAbandonAction ? (
        <div className="mt-7 md:mt-8 flex items-stretch gap-2">
          {showAbandonAction && (
            <button
              className="flex-1 min-w-0 py-2.5 md:py-3 px-3 font-serif font-semibold text-xs md:text-sm uppercase tracking-wide transition-all duration-300 hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                backgroundColor: "rgba(196, 72, 72, 0.2)",
                borderColor: COLORS.redLight,
                borderWidth: "2px",
                color: COLORS.redLight,
              }}
              onClick={() => onAbandon?.(quest.id)}
              disabled={isAbandoning}
            >
              {isAbandoning ? "Abandoning..." : "Abandon"}
            </button>
          )}
          {!quest.completed && (
            <button
              className="flex-1 min-w-0 py-2.5 md:py-3 px-3 font-serif font-semibold text-xs md:text-sm uppercase tracking-wide transition-all duration-300 hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                backgroundColor: "rgba(95, 183, 84, 0.25)",
                borderColor: COLORS.greenSuccess,
                borderWidth: "2px",
                color: COLORS.greenSuccess,
              }}
              onClick={() => onComplete(quest.id)}
              disabled={isAbandoning}
            >
              Complete
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
