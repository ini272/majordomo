import { COLORS } from "../constants/colors";
import type { Quest } from "../types/api";
import { formatScheduleLabel } from "../utils/schedule";
import questCardFrame from "../assets/white_board.png";
import "../styles/QuestCard.css";

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
  onComplete: (questId: number) => void;
  isDailyBounty?: boolean;
  isUpcoming?: boolean;
  upcomingSpawnTime?: string;
}

export default function QuestCard({ quest, onComplete, isDailyBounty = false, isUpcoming = false, upcomingSpawnTime }: QuestCardProps) {
  const typeStyles = getQuestTypeStyles(quest.quest_type);
  const isCorrupted = quest.quest_type === "corrupted";
  const accentColor = isDailyBounty ? "#6b5fb7" : typeStyles.borderColor;

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

    if (diff < 0) return "Overdue";
    if (days > 0) return `${days} day${days > 1 ? "s" : ""} left`;
    if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} left`;
    return "Due soon";
  };

  const scheduleInfo = formatScheduleLabel(quest.recurrence as "one-off" | "daily" | "weekly" | "monthly", quest.schedule);
  const isRecurring = quest.recurrence !== "one-off";

  return (
    <div className="quest-card-shell" style={{ opacity: isUpcoming ? 0.72 : 1 }}>
      <div
        className="quest-card-frame"
        style={{
          backgroundImage: `linear-gradient(rgba(21, 13, 9, 0.12), rgba(21, 13, 9, 0.12)), url(${questCardFrame})`,
        }}
      />

      <div className="quest-card-safe-area">
        <div
          className="quest-card-safe-inner"
          style={{
            border: `2px solid ${accentColor}`,
          }}
        >
          <div className="flex items-start justify-between gap-4 mb-3 md:mb-4">
            <div className="flex gap-2 flex-wrap">
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
                  2x Bounty
                </span>
              )}
              {quest.due_in_hours && !quest.completed && (
                <span
                  className="px-2 py-1 rounded text-xs font-serif font-bold"
                  style={{
                    backgroundColor: isCorrupted ? "rgba(139, 58, 58, 0.2)" : "rgba(255, 165, 0, 0.2)",
                    color: isCorrupted ? "#ff6b6b" : "#ffa500",
                    border: `1px solid ${isCorrupted ? "#ff6b6b" : "#ffa500"}`,
                  }}
                >
                  📅 {formatDeadline()}
                </span>
              )}
            </div>
            <span className="text-xl md:text-2xl opacity-35">⚔</span>
          </div>

          <h2
            className="text-lg sm:text-xl md:text-2xl font-serif font-bold pb-2 mb-3 uppercase tracking-wide"
            style={{
              color: typeStyles.titleColor,
              borderBottom: `2px solid ${typeStyles.titleColor}`,
            }}
          >
            {quest.display_name || quest.title || "Unknown Quest"}
          </h2>

          <p
            className="quest-card-description font-serif italic leading-relaxed text-sm sm:text-base"
            style={{ color: COLORS.parchment }}
          >
            {quest.description || "No description"}
          </p>

          {quest.tags && (
            <div className="flex flex-wrap gap-2 mt-3 md:mt-4">
              {quest.tags.split(",").map(tag => (
                <span
                  key={tag}
                  className="px-2 py-1 text-[11px] uppercase font-serif rounded"
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

          <div
            className="grid grid-cols-3 gap-3 mt-4 md:mt-5 pt-4 md:pt-5"
            style={{ borderTop: `1px solid ${COLORS.redBorder}` }}
          >
            <div className="text-center">
              <div
                className="text-[10px] sm:text-xs uppercase tracking-widest mb-1 font-serif"
                style={{ color: COLORS.brown }}
              >
                XP
              </div>
              <div className="text-lg sm:text-xl font-serif font-bold" style={{ color: COLORS.gold }}>
                {isDailyBounty && !quest.completed ? (quest.xp_reward || 0) * 2 : quest.xp_reward || 0}
              </div>
            </div>
            <div className="text-center">
              <div
                className="text-[10px] sm:text-xs uppercase tracking-widest mb-1 font-serif"
                style={{ color: COLORS.brown }}
              >
                Gold
              </div>
              <div className="text-lg sm:text-xl font-serif font-bold" style={{ color: COLORS.gold }}>
                {isDailyBounty && !quest.completed ? (quest.gold_reward || 0) * 2 : quest.gold_reward || 0}
              </div>
            </div>
            <div className="text-center">
              <div
                className="text-[10px] sm:text-xs uppercase tracking-widest mb-1 font-serif"
                style={{ color: COLORS.brown }}
              >
                Status
              </div>
              <div className="text-sm sm:text-base font-serif font-bold" style={{ color: COLORS.gold }}>
                {quest.completed ? "DONE" : "ACTIVE"}
              </div>
            </div>
          </div>

          {isUpcoming ? (
            <div
              className="w-full mt-4 md:mt-5 py-2.5 md:py-3 px-3 font-serif font-semibold text-xs sm:text-sm uppercase tracking-wider text-center"
              style={{
                backgroundColor: "rgba(212, 175, 55, 0.15)",
                border: `2px solid ${COLORS.gold}`,
                color: COLORS.gold,
              }}
            >
              📅 {formatUpcomingTime(upcomingSpawnTime)}
            </div>
          ) : !quest.completed ? (
            <button
              className="w-full mt-4 md:mt-5 py-2.5 md:py-3 px-3 font-serif font-semibold text-xs sm:text-sm uppercase tracking-wider transition-all duration-300 hover:shadow-lg cursor-pointer"
              style={{
                backgroundColor: "rgba(95, 183, 84, 0.25)",
                border: `2px solid ${COLORS.greenSuccess}`,
                color: COLORS.greenSuccess,
              }}
              onClick={() => onComplete(quest.id)}
            >
              ⚔ Complete Quest
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
