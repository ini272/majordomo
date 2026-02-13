import { motion, useReducedMotion } from "framer-motion";
import whiteBoardBackground from "../assets/white_board.png";
import { COLORS } from "../constants/colors";
import type { Quest } from "../types/api";

interface QuestTypeStyles {
  borderColor: string;
  titleColor: string;
  badgeBg: string;
  badgeColor: string;
}

interface CandleAnchor {
  left: string;
  top: string;
  size: number;
  delay: number;
}

const CANDLE_ANCHORS: CandleAnchor[] = [
  { left: "11%", top: "9%", size: 0.95, delay: 0 },
  { left: "18%", top: "8.5%", size: 1.08, delay: 0.2 },
  { left: "82%", top: "8.5%", size: 1, delay: 0.35 },
  { left: "89%", top: "9.5%", size: 0.9, delay: 0.5 },
];

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

function CandleFlame({ left, top, size, delay }: CandleAnchor) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      className="absolute pointer-events-none"
      style={{ left, top, transform: "translate(-50%, -50%) scale(var(--flame-scale))", ["--flame-scale" as string]: size }}
      aria-hidden="true"
    >
      <motion.div
        className="absolute rounded-full"
        style={{
          width: "20px",
          height: "20px",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          background: "radial-gradient(circle, rgba(255, 193, 94, 0.72), rgba(255, 147, 30, 0))",
          filter: "blur(5px)",
        }}
        animate={shouldReduceMotion ? undefined : { opacity: [0.35, 0.7, 0.42, 0.65, 0.35], scale: [0.9, 1.1, 0.95, 1.05, 0.9] }}
        transition={shouldReduceMotion ? undefined : { duration: 1.5, repeat: Infinity, ease: "easeInOut", delay }}
      />
      <motion.div
        className="rounded-full"
        style={{
          width: "8px",
          height: "14px",
          transformOrigin: "center bottom",
          background: "linear-gradient(180deg, #fff6ce 0%, #ffd56b 35%, #ff9b2f 70%, #ff5d1a 100%)",
          borderRadius: "55% 55% 60% 60% / 65% 65% 35% 35%",
          boxShadow: "0 0 10px rgba(255, 178, 74, 0.7)",
        }}
        animate={
          shouldReduceMotion
            ? undefined
            : {
                scaleY: [1, 1.08, 0.92, 1.03, 1],
                scaleX: [1, 0.96, 1.04, 0.98, 1],
                y: [0, -1.5, 0, -2, 0],
                rotate: [0, -2.2, 1.8, -1.4, 0],
                opacity: [0.94, 1, 0.88, 0.98, 0.94],
              }
        }
        transition={shouldReduceMotion ? undefined : { duration: 1.15, repeat: Infinity, ease: "easeInOut", delay }}
      />
    </div>
  );
}

export default function QuestCard({ quest, onComplete, isDailyBounty = false, isUpcoming = false, upcomingSpawnTime }: QuestCardProps) {
  const typeStyles = getQuestTypeStyles(quest.quest_type);
  const isCorrupted = quest.quest_type === "corrupted";

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

  // Format recurring schedule for display (uses quest's snapshot, not template)
  const formatSchedule = () => {
    if (quest.recurrence === "one-off" || !quest.schedule) return null;

    try {
      const schedule = JSON.parse(quest.schedule);
      if (quest.recurrence === "daily") {
        return `Daily ${schedule.time}`;
      } else if (quest.recurrence === "weekly") {
        const day = schedule.day.charAt(0).toUpperCase() + schedule.day.slice(1);
        return `${day}s ${schedule.time}`;
      } else if (quest.recurrence === "monthly") {
        return `Monthly ${schedule.day}${schedule.day === 1 ? "st" : schedule.day === 2 ? "nd" : schedule.day === 3 ? "rd" : "th"} ${schedule.time}`;
      }
    } catch (err) {
      console.error("Failed to parse schedule:", err);
    }
    return null;
  };

  const scheduleInfo = formatSchedule();
  const isRecurring = quest.recurrence !== "one-off";

  return (
    <div
      className="relative p-6 md:p-8 mb-6 md:mb-8 shadow-lg overflow-hidden"
      style={{
        backgroundColor: COLORS.darkPanel,
        borderColor: isDailyBounty ? "#6b5fb7" : typeStyles.borderColor,
        borderWidth: "3px",
        opacity: isUpcoming ? 0.6 : 1,
        backgroundImage: `linear-gradient(rgba(16, 10, 7, 0.68), rgba(16, 10, 7, 0.68)), url(${whiteBoardBackground})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {CANDLE_ANCHORS.map(anchor => (
          <CandleFlame key={`${anchor.left}-${anchor.top}`} {...anchor} />
        ))}
      </div>

      {/* Decorative element */}
      <div className="absolute top-3 right-4 text-2xl opacity-20">⚔</div>

      {/* Quest Type Badge */}
      <div className="absolute top-4 left-4 flex gap-2 flex-wrap">
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

      {/* Title */}
      <h2
        className="text-2xl md:text-3xl font-serif font-bold pb-3 md:pb-4 mb-4 uppercase tracking-wider"
        style={{
          color: typeStyles.titleColor,
          borderBottomColor: typeStyles.titleColor,
          borderBottomWidth: "2px",
        }}
      >
        {quest.display_name || quest.title || "Unknown Quest"}
      </h2>

      {/* Description */}
      <p
        className="italic leading-relaxed mb-6 md:mb-8 font-serif"
        style={{ color: COLORS.parchment }}
      >
        {quest.description || "No description"}
      </p>

      {/* Tags */}
      {quest.tags && (
        <div className="flex flex-wrap gap-2 mb-6 md:mb-8">
          {quest.tags.split(",").map(tag => (
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
            XP Reward
          </div>
          <div className="text-2xl md:text-3xl font-serif font-bold" style={{ color: COLORS.gold }}>
            {isDailyBounty && !quest.completed
              ? (quest.xp_reward || 0) * 2
              : quest.xp_reward || 0}
            {isDailyBounty && !quest.completed && (
              <span className="text-sm ml-2" style={{ color: "#9d84ff" }}>
                (2x)
              </span>
            )}
          </div>
        </div>
        <div className="text-center flex-1">
          <div
            className="text-xs uppercase tracking-widest mb-2 font-serif"
            style={{ color: COLORS.brown }}
          >
            Gold Reward
          </div>
          <div className="text-2xl md:text-3xl font-serif font-bold" style={{ color: COLORS.gold }}>
            {isDailyBounty && !quest.completed
              ? (quest.gold_reward || 0) * 2
              : quest.gold_reward || 0}
            {isDailyBounty && !quest.completed && (
              <span className="text-sm ml-2" style={{ color: "#9d84ff" }}>
                (2x)
              </span>
            )}
          </div>
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
      ) : !quest.completed ? (
        <button
          className="w-full mt-6 md:mt-8 py-3 md:py-4 px-4 font-serif font-semibold text-sm md:text-base uppercase tracking-wider transition-all duration-300 hover:shadow-lg cursor-pointer"
          style={{
            backgroundColor: "rgba(95, 183, 84, 0.25)",
            borderColor: COLORS.greenSuccess,
            borderWidth: "2px",
            color: COLORS.greenSuccess,
          }}
          onClick={() => onComplete(quest.id)}
        >
          ⚔ Complete Quest
        </button>
      ) : null}
    </div>
  );
}
