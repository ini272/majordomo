import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent,
} from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import QuestCard from "../components/QuestCard";
import CreateQuestForm from "../components/CreateQuestForm";
import EditQuestModal from "../components/EditQuestModal";
import TypeWriter from "../components/TypeWriter";
import { api } from "../services/api";
import { COLORS, PARCHMENT_STYLES } from "../constants/colors";
import { LAYERS } from "../constants/layers";
import bountyEmblem from "../assets/bounty_emblem_cutout.png";
import boardBackground from "../assets/empty_board.png";
import createQuestFabIcon from "../assets/quill_and_scroll_with_plus_fab.png";
import hourglassEmblem from "../assets/hourglass_emblem_cutout.png";
import type { Quest, DailyBounty, UpcomingSubscription } from "../types/api";
import { useAuth } from "../contexts/AuthContext";
import { useSound } from "../contexts/SoundContext";
import ModalShell from "../components/modal/ModalShell";
import {
  describeQuestDeadline,
  describeUpcomingSpawn,
  formatQuestDeadlineLabel,
  formatUpcomingSpawnLabel,
  getQuestDeadlineDate,
  parseApiDateTime,
} from "../utils/dateTime";

const QUESTS_PER_PAGE = 6;
const SWIPE_DISTANCE_THRESHOLD = 72;
const SWIPE_VELOCITY_THRESHOLD = 420;
const TRACKPAD_NAVIGATION_THRESHOLD = 60;
const TRACKPAD_NAVIGATION_COOLDOWN_MS = 450;
const QUEST_PROMPT_LONG_PRESS_MS = 560;
const QUEST_PROMPT_HOVER_MS = 450;
const QUEST_PROMPT_MOVE_CANCEL_PX = 12;
const QUEST_PROMPT_AUTO_HIDE_MS = 2000;
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

type QuestCollectionView = "current" | "upcoming";
type CurrentQuestSort = "newest" | "expiring-soon";
type UpcomingQuestSort = "spawn-soonest" | "spawn-latest" | "user-az";
type CurrentQuestFilter = "all" | "mine";
type UpcomingQuestFilter = "all" | "mine";

interface BoardControlOption<T extends string> {
  value: T;
  label: string;
  shortLabel: string;
}

interface QuestBoardEntry {
  quest: Quest;
  participantNames: string;
  title: string;
  createdTimestamp: number;
  deadlineTimestamp: number | null;
}

interface UpcomingQuestBoardEntry extends QuestBoardEntry {
  nextSpawnTimestamp: number;
}

interface CompactQuestCardProps {
  quest: Quest;
  questParticipantNames?: string;
  isUpcoming?: boolean;
  isDailyBounty?: boolean;
  upcomingSpawnTime?: string;
  onClick: () => void;
  isPromptRevealed?: boolean;
  promptRevealMode?: QuestPromptRevealMode | null;
  onPromptReveal?: (quest: Quest, mode: QuestPromptRevealMode) => void;
  onPromptHide?: (questId: number) => void;
}

interface CompactQuestStatusChip {
  label: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
}

type QuestPromptRevealMode = "hover" | "press" | "keyboard";

interface QuestPromptRevealState {
  questId: number;
  mode: QuestPromptRevealMode;
}

interface QuestPromptContentProps {
  quest: Quest;
  compact?: boolean;
  className?: string;
  lineClampClassName?: string;
  onTypingComplete?: () => void;
}

interface QuestPromptFaceProps {
  quest: Quest;
  compact?: boolean;
  onTypingComplete?: () => void;
}

const CURRENT_SORT_OPTIONS: BoardControlOption<CurrentQuestSort>[] = [
  { value: "newest", label: "Newest", shortLabel: "Newest" },
  {
    value: "expiring-soon",
    label: "Corrupted / Expiring",
    shortLabel: "Expiring",
  },
];

const UPCOMING_SORT_OPTIONS: BoardControlOption<UpcomingQuestSort>[] = [
  { value: "spawn-soonest", label: "Next Spawn Soonest", shortLabel: "Soonest" },
  { value: "spawn-latest", label: "Next Spawn Latest", shortLabel: "Latest" },
  { value: "user-az", label: "User A-Z", shortLabel: "User A-Z" },
];

const CURRENT_FILTER_OPTIONS: BoardControlOption<CurrentQuestFilter>[] = [
  { value: "all", label: "All Quests", shortLabel: "All" },
  { value: "mine", label: "My Quests", shortLabel: "Mine" },
];

const UPCOMING_FILTER_OPTIONS: BoardControlOption<UpcomingQuestFilter>[] = [
  { value: "all", label: "All Quests", shortLabel: "All" },
  { value: "mine", label: "My Quests", shortLabel: "Mine" },
];

const SortIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor">
    <path d="M7 4v12" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M4.5 6.5 7 4l2.5 2.5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13 16V4" strokeWidth="1.8" strokeLinecap="round" />
    <path
      d="M10.5 13.5 13 16l2.5-2.5"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const FilterIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor">
    <path
      d="M3.5 5.5h13l-5 5.7v3.5l-3 1.8v-5.3Z"
      strokeWidth="1.6"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  </svg>
);

const NewestSortIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor">
    <path d="M10 3.75v12.5" strokeWidth="1.7" strokeLinecap="round" />
    <path
      d="M6.25 7.5 10 3.75 13.75 7.5"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M5 15.25h10" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

const CorruptionSortIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor">
    <path d="M6.25 3.75h7.5" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M6.25 16.25h7.5" strokeWidth="1.6" strokeLinecap="round" />
    <path
      d="M7.5 4.1v2.7c0 1 .42 1.9 1.15 2.5l1.35 1.05-1.35 1.05A3.17 3.17 0 0 0 7.5 13.95v1.95"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12.5 4.1v2.7c0 1-.42 1.9-1.15 2.5L10 10.35l1.35 1.05a3.17 3.17 0 0 1 1.15 2.55v1.95"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

interface BoardControlMenuProps<T extends string> {
  label: string;
  icon: ReactNode;
  options: BoardControlOption<T>[];
  value: T;
  onSelect: (value: T) => void;
}

function BoardControlMenu<T extends string>({
  label,
  icon,
  options,
  value,
  onSelect,
}: BoardControlMenuProps<T>) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const activeOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label}: ${activeOption.label}`}
        className="flex h-10 items-center gap-2 rounded-sm px-3 font-serif text-xs uppercase tracking-[0.18em] transition-all"
        style={{
          backgroundColor: "rgba(14, 10, 8, 0.92)",
          border: `1px solid ${COLORS.gold}`,
          color: COLORS.parchment,
        }}
      >
        <span style={{ color: COLORS.gold }}>{icon}</span>
        <span className="hidden sm:inline">{activeOption.shortLabel}</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label={label}
          className="absolute right-0 top-[calc(100%+0.45rem)] z-20 min-w-[12.75rem] overflow-hidden rounded-sm"
          style={{
            backgroundColor: "rgba(16, 11, 9, 0.98)",
            border: `1px solid ${COLORS.gold}`,
            boxShadow: "0 10px 24px rgba(0, 0, 0, 0.35)",
          }}
        >
          <div
            className="px-3 py-2 text-[11px] font-serif uppercase tracking-[0.2em]"
            style={{
              backgroundColor: "rgba(212, 175, 55, 0.08)",
              borderBottom: `1px solid ${COLORS.brown}`,
              color: COLORS.brown,
            }}
          >
            {label}
          </div>
          <div className="p-1">
            {options.map((option) => {
              const isActive = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  onClick={() => {
                    onSelect(option.value);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left font-serif text-sm transition-colors"
                  style={{
                    backgroundColor: isActive ? "rgba(212, 175, 55, 0.16)" : "transparent",
                    color: isActive ? COLORS.gold : COLORS.parchment,
                  }}
                >
                  <span>{option.label}</span>
                  <span aria-hidden="true" style={{ color: isActive ? COLORS.gold : COLORS.brown }}>
                    {isActive ? "✓" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface CurrentSortButtonProps {
  label: string;
  icon: ReactNode;
  isActive: boolean;
  onClick: () => void;
}

function CurrentSortButton({ label, icon, isActive, onClick }: CurrentSortButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className="flex h-10 items-center gap-2 rounded-sm px-3 font-serif text-xs uppercase tracking-[0.18em] transition-all"
      style={{
        backgroundColor: isActive ? "rgba(212, 175, 55, 0.16)" : "rgba(14, 10, 8, 0.92)",
        border: `1px solid ${isActive ? COLORS.gold : COLORS.brown}`,
        color: isActive ? COLORS.gold : COLORS.parchment,
        boxShadow: isActive ? "0 0 0 1px rgba(212, 175, 55, 0.16) inset" : "none",
      }}
    >
      <span style={{ color: isActive ? COLORS.gold : COLORS.brown }}>{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

const getCurrentQuestStatusChip = (quest: Quest): CompactQuestStatusChip | null => {
  if (quest.completed) return null;
  if (quest.quest_type === "corrupted") return null;

  const relativeDeadline = describeQuestDeadline(
    quest.created_at,
    quest.due_in_hours,
    quest.due_date
  );
  const label = formatQuestDeadlineLabel(quest.created_at, quest.due_in_hours, quest.due_date, {
    compact: true,
  });
  if (!relativeDeadline || !label) return null;

  if (relativeDeadline.bucket === "past") {
    return {
      label: "Corrupted",
      backgroundColor: "rgba(139, 58, 58, 0.28)",
      borderColor: "#8b3a3a",
      textColor: "#ff8080",
    };
  }

  if (relativeDeadline.bucket === "soon" || relativeDeadline.diffMs <= 12 * HOUR_MS) {
    return {
      label,
      backgroundColor: "rgba(139, 58, 58, 0.24)",
      borderColor: "#8b3a3a",
      textColor: "#ff9b80",
    };
  }

  if (relativeDeadline.diffMs <= 2 * DAY_MS) {
    return {
      label,
      backgroundColor: "rgba(186, 122, 44, 0.22)",
      borderColor: "#ba7a2c",
      textColor: "#f0c36b",
    };
  }

  return {
    label,
    backgroundColor: "rgba(108, 87, 48, 0.2)",
    borderColor: COLORS.brown,
    textColor: COLORS.parchment,
  };
};

const getUpcomingQuestStatusChip = (upcomingSpawnTime?: string): CompactQuestStatusChip | null => {
  const relativeSpawn = describeUpcomingSpawn(upcomingSpawnTime);
  const label = formatUpcomingSpawnLabel(upcomingSpawnTime, { compact: true });
  if (!relativeSpawn || !label) return null;

  if (relativeSpawn.bucket === "past" || relativeSpawn.bucket === "soon") {
    return {
      label: "Spawns soon",
      backgroundColor: "rgba(84, 127, 183, 0.26)",
      borderColor: "#547fb7",
      textColor: "#9ec5ff",
    };
  }

  return {
    label,
    backgroundColor: "rgba(84, 127, 183, 0.18)",
    borderColor: "#547fb7",
    textColor: "#9ec5ff",
  };
};

const formatCorruptionCountdown = (
  value?: string | Date | null,
  hours?: number | null,
  dueDate?: string | Date | null
) => {
  const deadline = getQuestDeadlineDate(value, hours, dueDate);
  if (!deadline) return null;

  const diffMs = deadline.getTime() - Date.now();
  if (diffMs <= 0) return "Corrupted";

  if (diffMs < HOUR_MS) {
    const minutes = Math.max(1, Math.ceil(diffMs / MINUTE_MS));
    return `${minutes}m left`;
  }

  if (diffMs < DAY_MS) {
    const totalMinutes = Math.max(1, Math.ceil(diffMs / MINUTE_MS));
    const hoursLeft = Math.floor(totalMinutes / 60);
    const minutesLeft = totalMinutes % 60;
    return minutesLeft > 0 ? `${hoursLeft}h ${minutesLeft}m left` : `${hoursLeft}h left`;
  }

  const daysLeft = Math.floor(diffMs / DAY_MS);
  const hoursLeft = Math.floor((diffMs % DAY_MS) / HOUR_MS);
  return hoursLeft > 0 && daysLeft < 4 ? `${daysLeft}d ${hoursLeft}h left` : `${daysLeft}d left`;
};

function QuestCardEmblem({
  accentColor,
  backgroundColor,
}: {
  accentColor: string;
  backgroundColor: string;
}) {
  return (
    <div
      className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border sm:h-12 sm:w-12 xl:h-14 xl:w-14"
      style={{
        borderColor: accentColor,
        background: `radial-gradient(circle at 30% 30%, rgba(212, 175, 55, 0.16), ${backgroundColor} 72%)`,
        boxShadow: "inset 0 0 18px rgba(0, 0, 0, 0.45), 0 8px 16px rgba(0, 0, 0, 0.22)",
      }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 48 48"
        className="h-6 w-6 sm:h-7 sm:w-7 xl:h-8 xl:w-8"
        fill="none"
        stroke={accentColor}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="24" cy="24" r="17" strokeWidth="1.4" opacity="0.35" />
        <path d="M24 10v7" strokeWidth="1.8" />
        <path d="M24 31v7" strokeWidth="1.8" />
        <path d="M10 24h7" strokeWidth="1.8" />
        <path d="M31 24h7" strokeWidth="1.8" />
        <path d="m15 15 5 5" strokeWidth="1.4" opacity="0.85" />
        <path d="m28 28 5 5" strokeWidth="1.4" opacity="0.85" />
        <path d="m33 15-5 5" strokeWidth="1.4" opacity="0.85" />
        <path d="m20 28-5 5" strokeWidth="1.4" opacity="0.85" />
        <path d="m24 16 5.6 5.6L24 32l-5.6-10.4L24 16Z" strokeWidth="1.8" />
        <circle cx="24" cy="24" r="2.4" strokeWidth="1.6" />
      </svg>
    </div>
  );
}

function QuestParticipantIcon({ multiple, color }: { multiple: boolean; color: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4"
      fill="none"
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {multiple ? (
        <>
          <circle cx="7" cy="7.25" r="2.1" strokeWidth="1.4" />
          <path d="M3.9 14.2c.7-1.8 2-2.8 3.9-2.8 1.5 0 2.7.6 3.5 1.8" strokeWidth="1.4" />
          <circle cx="13.3" cy="8.2" r="1.75" strokeWidth="1.3" opacity="0.85" />
          <path
            d="M11.3 14.2c.5-1.3 1.5-2.1 3.1-2.1 1 0 1.9.3 2.5 1.1"
            strokeWidth="1.3"
            opacity="0.85"
          />
        </>
      ) : (
        <>
          <circle cx="10" cy="6.75" r="2.35" strokeWidth="1.45" />
          <path d="M5.7 14.5c.8-2.1 2.4-3.2 4.8-3.2 2.1 0 3.7 1 4.5 3.2" strokeWidth="1.45" />
        </>
      )}
    </svg>
  );
}

const getQuestDisplayTitle = (quest: Quest) =>
  quest.display_name?.trim() || quest.title?.trim() || "Unknown Quest";

const getQuestPromptInput = (quest: Quest) => quest.title?.trim() || "";

const canRevealQuestPrompt = (quest: Quest) => {
  const promptInput = getQuestPromptInput(quest);
  if (!promptInput) return false;

  return promptInput !== getQuestDisplayTitle(quest);
};

function QuestPromptContent({
  quest,
  compact = false,
  className = "",
  lineClampClassName = "",
  onTypingComplete,
}: QuestPromptContentProps) {
  const promptInput = getQuestPromptInput(quest);
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    setIsTyping(true);
  }, [promptInput, quest.id]);

  return (
    <div className={`relative z-10 flex h-full flex-col ${className}`.trim()}>
      <div
        className="mb-2 font-serif text-[10px] font-bold uppercase tracking-[0.22em]"
        style={{ color: COLORS.brown }}
      >
        Original Request
      </div>
      <div className="flex-1">
        <p
          className={`font-serif font-semibold leading-relaxed ${compact ? "text-sm" : "text-base"} ${lineClampClassName}`.trim()}
          style={{ color: PARCHMENT_STYLES.textColor }}
        >
          <TypeWriter
            key={`${quest.id}-${promptInput}`}
            text={promptInput}
            speed={30}
            delay={200}
            hideCursor
            onComplete={() => {
              setIsTyping(false);
              onTypingComplete?.();
            }}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none inline-flex align-baseline"
            style={{
              width: compact ? "23px" : "26px",
              marginLeft: "4px",
            }}
          >
            {isTyping ? (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: [1, 0.5] }}
                transition={{ duration: 0.6, repeat: Infinity }}
                style={{ fontSize: compact ? "17px" : "20px" }}
              >
                🖋️
              </motion.span>
            ) : (
              <span
                style={{
                  fontSize: compact ? "17px" : "20px",
                  visibility: "hidden",
                }}
              >
                🖋️
              </span>
            )}
          </span>
        </p>
      </div>
    </div>
  );
}

function QuestPromptFace({ quest, compact = false, onTypingComplete }: QuestPromptFaceProps) {
  return (
    <div
      className={`relative h-full overflow-hidden ${compact ? "px-3 py-3 sm:px-4 sm:py-4" : "p-5"}`}
      style={{
        backgroundColor: PARCHMENT_STYLES.backgroundColor,
        backgroundImage: PARCHMENT_STYLES.backgroundImage,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: PARCHMENT_STYLES.burnt }}
        aria-hidden="true"
      />
      <QuestPromptContent
        quest={quest}
        compact={compact}
        lineClampClassName={compact ? "line-clamp-5 sm:line-clamp-6" : ""}
        onTypingComplete={onTypingComplete}
      />
    </div>
  );
}

function CompactQuestCard({
  quest,
  questParticipantNames,
  isUpcoming = false,
  isDailyBounty = false,
  upcomingSpawnTime,
  onClick,
  isPromptRevealed = false,
  promptRevealMode = null,
  onPromptReveal,
  onPromptHide,
}: CompactQuestCardProps) {
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClickRef = useRef(false);
  const suppressClickClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerStartRef = useRef<{
    x: number;
    y: number;
    pointerType: string;
  } | null>(null);
  const participantCount = quest.participants?.length || 1;
  const isCorrupted = quest.quest_type === "corrupted";
  const hasCorruptionDebuff =
    !quest.completed && quest.corruption_debuff_active && (quest.corruption_debuff ?? 1) < 1;
  const corruptionPenaltyPercent = hasCorruptionDebuff
    ? Math.round((1 - (quest.corruption_debuff ?? 1)) * 100)
    : 0;
  const baseXpReward = quest.xp_reward || 0;
  const baseGoldReward = quest.gold_reward || 0;
  const previewXpReward = quest.effective_xp_reward ?? baseXpReward;
  const previewGoldReward = quest.effective_gold_reward ?? baseGoldReward;
  const displayGoldReward =
    isDailyBounty && !quest.completed ? previewGoldReward * 3 : previewGoldReward;
  const borderColor = isCorrupted ? "#8b3a3a" : isDailyBounty ? "#6b5fb7" : COLORS.gold;
  const titleColor = isCorrupted ? "#ff6b6b" : isDailyBounty ? "#c0b4ff" : COLORS.gold;
  const rewardColor = hasCorruptionDebuff ? "#ff8080" : COLORS.gold;
  const statusChip = isUpcoming
    ? getUpcomingQuestStatusChip(upcomingSpawnTime)
    : getCurrentQuestStatusChip(quest);
  const cardBackgroundColor = isDailyBounty ? "rgba(42, 28, 62, 0.72)" : "rgba(30, 21, 17, 0.7)";
  const questTitle = getQuestDisplayTitle(quest);
  const questDescription = quest.description || "No description";
  const canRevealPrompt = Boolean(onPromptReveal && canRevealQuestPrompt(quest));
  const isPersistentPromptReveal = promptRevealMode === "press" || promptRevealMode === "keyboard";
  const showPromptFace = canRevealPrompt && isPromptRevealed;
  const participantNames = (questParticipantNames || "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  const hiddenParticipantCount = Math.max(0, participantNames.length - 2);
  const displayParticipantNames =
    hiddenParticipantCount > 0
      ? `${participantNames.slice(0, 2).join(", ")} +${hiddenParticipantCount} more`
      : participantNames.join(", ");
  const renderStatusChips = () => (
    <>
      {statusChip && (
        <span
          className="text-[10px] sm:text-xs px-2 py-0.5 font-serif uppercase"
          style={{
            backgroundColor: statusChip.backgroundColor,
            border: `1px solid ${statusChip.borderColor}`,
            color: statusChip.textColor,
          }}
        >
          {statusChip.label}
        </span>
      )}
      {isCorrupted && (
        <span
          className="text-[10px] sm:text-xs px-2 py-0.5 font-serif uppercase"
          style={{ backgroundColor: "rgba(139, 58, 58, 0.28)", color: "#ff8080" }}
        >
          Corrupted
        </span>
      )}
      {isDailyBounty && (
        <span
          className="text-[10px] sm:text-xs px-2 py-0.5 font-serif uppercase"
          style={{ backgroundColor: "rgba(107, 95, 183, 0.3)", color: "#c0b4ff" }}
        >
          Bounty x3
        </span>
      )}
      {quest.completed && (
        <span
          className="text-[10px] sm:text-xs px-2 py-0.5 font-serif uppercase"
          style={{ backgroundColor: "rgba(95, 183, 84, 0.2)", color: COLORS.greenSuccess }}
        >
          Done
        </span>
      )}
    </>
  );

  const clearHoverTimer = () => {
    if (hoverTimerRef.current !== null) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  const clearPressTimer = () => {
    if (pressTimerRef.current !== null) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const clearAutoHideTimer = () => {
    if (autoHideTimerRef.current !== null) {
      clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = null;
    }
  };

  const revealPrompt = (mode: QuestPromptRevealMode) => {
    if (!canRevealPrompt) return;
    onPromptReveal?.(quest, mode);
  };

  const scheduleHoverReveal = () => {
    clearHoverTimer();
    hoverTimerRef.current = setTimeout(() => {
      hoverTimerRef.current = null;
      revealPrompt("hover");
    }, QUEST_PROMPT_HOVER_MS);
  };

  const handlePointerEnter = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!canRevealPrompt || event.pointerType !== "mouse") return;

    pointerStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      pointerType: event.pointerType,
    };
    scheduleHoverReveal();
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!canRevealPrompt || event.pointerType === "mouse") return;

    if (showPromptFace && isPersistentPromptReveal) {
      suppressClickRef.current = false;
      clearAutoHideTimer();
      if (suppressClickClearTimerRef.current !== null) {
        clearTimeout(suppressClickClearTimerRef.current);
        suppressClickClearTimerRef.current = null;
      }
    }

    pointerStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      pointerType: event.pointerType,
    };
    clearPressTimer();
    pressTimerRef.current = setTimeout(() => {
      pressTimerRef.current = null;
      suppressClickRef.current = true;

      if (suppressClickClearTimerRef.current !== null) {
        clearTimeout(suppressClickClearTimerRef.current);
      }
      suppressClickClearTimerRef.current = setTimeout(() => {
        suppressClickRef.current = false;
        suppressClickClearTimerRef.current = null;
      }, 900);

      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.(8);
      }

      revealPrompt("press");
    }, QUEST_PROMPT_LONG_PRESS_MS);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = pointerStartRef.current;
    if (!start) return;

    const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    if (moved < QUEST_PROMPT_MOVE_CANCEL_PX) return;

    if (event.pointerType === "mouse" && hoverTimerRef.current !== null) {
      pointerStartRef.current = {
        x: event.clientX,
        y: event.clientY,
        pointerType: event.pointerType,
      };
      scheduleHoverReveal();
      return;
    }

    if (event.pointerType !== "mouse") {
      clearPressTimer();
      pointerStartRef.current = null;
    }
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== "mouse") {
      clearPressTimer();
      pointerStartRef.current = null;
    }
  };

  const handlePointerCancel = () => {
    clearPressTimer();
    pointerStartRef.current = null;
  };

  const handlePointerLeave = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse") {
      clearHoverTimer();
      onPromptHide?.(quest.id);
    } else {
      clearPressTimer();
    }
    pointerStartRef.current = null;
  };

  const handleClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (suppressClickRef.current) {
      event.preventDefault();
      event.stopPropagation();
      suppressClickRef.current = false;
      return;
    }

    if (showPromptFace && isPersistentPromptReveal) {
      event.preventDefault();
      event.stopPropagation();
      clearAutoHideTimer();
      onPromptHide?.(quest.id);
      return;
    }

    onClick();
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!canRevealPrompt || event.defaultPrevented) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key.toLowerCase() !== "i") return;

    event.preventDefault();
    if (showPromptFace && isPersistentPromptReveal) {
      clearAutoHideTimer();
      onPromptHide?.(quest.id);
      return;
    }
    revealPrompt("keyboard");
  };

  const handleContextMenu = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (suppressClickRef.current) {
      event.preventDefault();
    }
  };

  const handlePromptTypingComplete = () => {
    if (!showPromptFace || promptRevealMode !== "press") return;

    clearAutoHideTimer();
    autoHideTimerRef.current = setTimeout(() => {
      autoHideTimerRef.current = null;
      onPromptHide?.(quest.id);
    }, QUEST_PROMPT_AUTO_HIDE_MS);
  };

  useEffect(() => {
    if (!showPromptFace || promptRevealMode !== "press") {
      clearAutoHideTimer();
    }
  }, [promptRevealMode, showPromptFace]);

  useEffect(
    () => () => {
      clearHoverTimer();
      clearPressTimer();
      clearAutoHideTimer();
      if (suppressClickClearTimerRef.current !== null) {
        clearTimeout(suppressClickClearTimerRef.current);
      }
    },
    []
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
      onPointerCancel={handlePointerCancel}
      onPointerDown={handlePointerDown}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="relative w-full overflow-hidden rounded-sm p-3 text-left transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] sm:p-4"
      style={{
        backgroundColor: cardBackgroundColor,
        border: `2px solid ${borderColor}`,
        boxShadow: isDailyBounty
          ? "0 0 0 1px rgba(157, 132, 255, 0.3), 0 10px 18px rgba(40, 20, 68, 0.35)"
          : "0 6px 12px rgba(0, 0, 0, 0.25)",
        opacity: isUpcoming ? 0.8 : 1,
        touchAction: "pan-y",
        perspective: "1400px",
      }}
    >
      <div className="relative">
        <motion.div
          animate={
            showPromptFace
              ? { opacity: 0, rotateY: -180, scale: 0.985 }
              : { opacity: 1, rotateY: 0, scale: 1 }
          }
          transition={{ duration: 0.2, ease: "easeOut" }}
          style={{ backfaceVisibility: "hidden", transformStyle: "preserve-3d" }}
          aria-hidden={showPromptFace}
        >
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="mt-0.5 flex shrink-0">
              <QuestCardEmblem accentColor={borderColor} backgroundColor={cardBackgroundColor} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3
                  className="line-clamp-2 text-sm font-serif font-bold leading-tight sm:text-base"
                  style={{ color: titleColor }}
                >
                  {questTitle}
                </h3>
                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                  {renderStatusChips()}
                </div>
              </div>

              <p
                className="mb-3 line-clamp-2 text-xs font-serif sm:text-sm"
                style={{ color: "rgba(241, 231, 214, 0.88)" }}
              >
                {questDescription}
              </p>

              <div
                className={`flex items-end gap-3 text-xs font-serif ${
                  displayParticipantNames ? "justify-between" : "justify-end"
                }`}
                style={{ color: COLORS.brown }}
              >
                {displayParticipantNames && (
                  <div className="min-w-0 flex flex-1 items-center gap-1.5 text-[11px] tracking-wide sm:text-xs">
                    <QuestParticipantIcon multiple={participantCount > 1} color={COLORS.brown} />
                    <span className="truncate uppercase" style={{ color: COLORS.gold }}>
                      {displayParticipantNames}
                    </span>
                  </div>
                )}

                <span className="shrink-0 text-right" style={{ color: rewardColor }}>
                  +{previewXpReward} XP / +{displayGoldReward} Gold
                  {hasCorruptionDebuff && (
                    <span className="ml-1" style={{ color: "#ff8080" }}>
                      -{corruptionPenaltyPercent}%
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        <AnimatePresence initial={false}>
          {showPromptFace && (
            <motion.div
              key={`${quest.id}-${promptRevealMode ?? "prompt"}`}
              initial={{ opacity: 0, rotateY: 180, scale: 0.985 }}
              animate={{ opacity: 1, rotateY: 0, scale: 1 }}
              exit={{ opacity: 0, rotateY: 180, scale: 0.985 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute inset-[-0.75rem] sm:inset-[-1rem]"
              style={{ backfaceVisibility: "hidden", transformStyle: "preserve-3d" }}
              aria-hidden={!showPromptFace}
            >
              <QuestPromptFace
                quest={quest}
                compact
                onTypingComplete={handlePromptTypingComplete}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </button>
  );
}

const toUpcomingQuest = (upcoming: UpcomingSubscription): Quest => ({
  id: upcoming.id,
  home_id: 0,
  user_id: upcoming.user_id,
  created_by: upcoming.user_id,
  quest_template_id: upcoming.quest_template_id,
  completed: false,
  created_at: upcoming.created_at,
  completed_at: null,
  title: upcoming.template.title,
  display_name: upcoming.template.display_name,
  description: upcoming.template.description,
  tags: upcoming.template.tags,
  xp_reward: upcoming.template.xp_reward,
  gold_reward: upcoming.template.gold_reward,
  recurrence: upcoming.recurrence,
  schedule: upcoming.schedule,
  quest_type: upcoming.template.quest_type,
  due_in_hours: upcoming.due_in_hours,
  due_date: null,
  corrupted_at: null,
  effective_xp_reward: upcoming.template.xp_reward,
  effective_gold_reward: upcoming.template.gold_reward,
  corruption_debuff: null,
  corrupted_quest_count: 0,
  corruption_debuff_active: false,
  template: upcoming.template,
  participants: [
    {
      id: upcoming.id,
      quest_id: upcoming.id,
      user_id: upcoming.user_id,
      xp_awarded: null,
      gold_awarded: null,
      completed_at: null,
      created_at: upcoming.created_at,
    },
  ],
});

const getPageCount = (items: unknown[]) => Math.max(1, Math.ceil(items.length / QUESTS_PER_PAGE));
const getCurrentBoardQuests = (quests: Quest[]) => quests.filter((quest) => !quest.completed);
const getQuestParticipantUserIds = (quest: Quest) =>
  quest.participants && quest.participants.length > 0
    ? quest.participants.map((participant) => participant.user_id)
    : [quest.user_id];
const getQuestParticipantNames = (quest: Quest, homeUsers: Record<number, string>) =>
  getQuestParticipantUserIds(quest)
    .map((participantUserId) => homeUsers[participantUserId])
    .filter(Boolean)
    .join(", ");
const getQuestTitle = getQuestDisplayTitle;
const getTimestamp = (value: string | null | undefined) => {
  const parsed = parseApiDateTime(value);
  return parsed ? parsed.getTime() : 0;
};
const getQuestDeadlineTimestamp = (quest: Quest) => {
  const deadline = getQuestDeadlineDate(quest.created_at, quest.due_in_hours, quest.due_date);
  return deadline ? deadline.getTime() : null;
};
const compareText = (left: string, right: string) =>
  left.localeCompare(right, undefined, { sensitivity: "base" });
const compareNullableNumber = (left: number | null, right: number | null) => {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left - right;
};
const matchesQuestSearch = (
  quest: Quest,
  participantNames: string | undefined,
  searchTerm: string
) => {
  const normalizedSearch = searchTerm.trim().toLowerCase();
  if (!normalizedSearch) return true;

  const searchableFields = [
    quest.display_name,
    quest.title,
    quest.description,
    quest.tags,
    participantNames,
  ];

  return searchableFields.some((value) =>
    value ? String(value).toLowerCase().includes(normalizedSearch) : false
  );
};

const questIncludesUser = (quest: Quest, userId: number | null) =>
  userId !== null && getQuestParticipantUserIds(quest).includes(userId);

export default function Board() {
  const { token, userId, homeId } = useAuth();
  const { playSound } = useSound();
  const [view, setView] = useState<"current" | "upcoming">("current");
  const [quests, setQuests] = useState<Quest[]>([]);
  const [upcomingQuests, setUpcomingQuests] = useState<UpcomingSubscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditQuestModal, setShowEditQuestModal] = useState(false);
  const [editQuestStartsAsTemplate, setEditQuestStartsAsTemplate] = useState(false);
  const [dailyBounty, setDailyBounty] = useState<DailyBounty | null>(null);
  const [homeUsers, setHomeUsers] = useState<Record<number, string>>({});
  const [homeTimeZone, setHomeTimeZone] = useState("UTC");

  const [currentPage, setCurrentPage] = useState(0);
  const [upcomingPage, setUpcomingPage] = useState(0);
  const [pageDirection, setPageDirection] = useState(1);

  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
  const [selectedQuestView, setSelectedQuestView] = useState<QuestCollectionView | null>(null);
  const [selectedUpcomingSpawnTime, setSelectedUpcomingSpawnTime] = useState<string | undefined>();
  const [selectedIsDailyBounty, setSelectedIsDailyBounty] = useState(false);
  const [revealedQuestPrompt, setRevealedQuestPrompt] = useState<QuestPromptRevealState | null>(
    null
  );
  const [questPendingAbandon, setQuestPendingAbandon] = useState<Quest | null>(null);
  const [abandoningQuestId, setAbandoningQuestId] = useState<number | null>(null);
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const [userLevel, setUserLevel] = useState<number | null>(null);
  const [currentSearchTerm, setCurrentSearchTerm] = useState("");
  const [upcomingSearchTerm, setUpcomingSearchTerm] = useState("");
  const [currentSort, setCurrentSort] = useState<CurrentQuestSort>("newest");
  const [upcomingSort, setUpcomingSort] = useState<UpcomingQuestSort>("spawn-soonest");
  const [currentFilter, setCurrentFilter] = useState<CurrentQuestFilter>("all");
  const [upcomingFilter, setUpcomingFilter] = useState<UpcomingQuestFilter>("all");
  const userLevelRef = useRef<number | null>(null);
  const lastDetailWheelNavigationAtRef = useRef(0);

  useEffect(() => {
    userLevelRef.current = userLevel;
  }, [userLevel]);

  useEffect(() => {
    const fetchData = async () => {
      if (!token) {
        setError("Not authenticated");
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        if (view === "current") {
          const [questsData, bountyData] = await Promise.all([
            api.quests.getAll(token),
            api.bounty.getToday(token),
          ]);
          setQuests(getCurrentBoardQuests(questsData));
          setDailyBounty(bountyData);
        } else {
          const upcomingData = await api.subscriptions.getUpcoming(token);
          setUpcomingQuests(upcomingData);
        }
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token, view]);

  useEffect(() => {
    const fetchHomeUsers = async () => {
      if (!token) {
        setHomeUsers({});
        return;
      }

      try {
        const users = await api.user.getAll(token);
        setHomeUsers(Object.fromEntries(users.map((user) => [user.id, user.username])));
      } catch {
        // Keep stale names rather than failing the board entirely.
      }
    };

    fetchHomeUsers();
  }, [token]);

  useEffect(() => {
    const fetchHomeTimeZone = async () => {
      if (!token || !homeId) {
        setHomeTimeZone("UTC");
        return;
      }

      try {
        const home = await api.home.get(homeId, token);
        setHomeTimeZone(home.timezone || "UTC");
      } catch {
        setHomeTimeZone("UTC");
      }
    };

    fetchHomeTimeZone();
  }, [homeId, token]);

  useEffect(() => {
    const fetchUserLevel = async () => {
      if (!token) {
        setUserLevel(null);
        return;
      }

      try {
        const user = await api.user.getStats(token);
        setUserLevel(user.level);
      } catch {
        // If stats request fails, skip level-up audio until next successful fetch.
      }
    };

    fetchUserLevel();
  }, [token]);

  useEffect(() => {
    setCurrentPage(0);
  }, [currentSearchTerm, currentSort, currentFilter]);

  useEffect(() => {
    setUpcomingPage(0);
  }, [upcomingSearchTerm, upcomingSort, upcomingFilter]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const mediaQuery = window.matchMedia("(pointer: coarse)");
    const updatePointerType = () => setIsCoarsePointer(mediaQuery.matches);
    updatePointerType();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updatePointerType);
      return () => mediaQuery.removeEventListener("change", updatePointerType);
    }

    mediaQuery.addListener(updatePointerType);
    return () => mediaQuery.removeListener(updatePointerType);
  }, []);

  const handleCompleteQuest = async (questId: number) => {
    if (!token) {
      setError("Not authenticated");
      return;
    }

    try {
      const result = await api.quests.complete(questId, token);
      const updatedQuest = result.quest;
      setQuests((prev) => prev.filter((quest) => quest.id !== questId));
      setDailyBounty((prev) => {
        if (!prev || prev.quest?.id !== questId) return prev;
        return { ...prev, quest: updatedQuest };
      });
      if (selectedQuest?.id === questId && selectedQuestView === "current") {
        closeQuestDetails();
      } else {
        setSelectedQuest((prev) => (prev && prev.id === questId ? updatedQuest : prev));
      }
      playSound("questComplete");

      try {
        const latestUser = await api.user.getStats(token);
        const previousLevel = userLevelRef.current;
        if (previousLevel !== null && latestUser.level > previousLevel) {
          playSound("levelUp");
        }
        setUserLevel(latestUser.level);
      } catch {
        // Ignore stats refresh errors so completion still succeeds.
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete quest");
    }
  };

  const openAbandonConfirm = (questId: number) => {
    const questToAbandon = quests.find((quest) => quest.id === questId);
    if (!questToAbandon) return;

    setQuestPendingAbandon(questToAbandon);
  };

  const closeAbandonConfirm = () => {
    if (abandoningQuestId !== null) return;
    setQuestPendingAbandon(null);
  };

  const handleAbandonQuest = async () => {
    if (!questPendingAbandon) return;

    if (!token) {
      setError("Not authenticated");
      return;
    }

    const questId = questPendingAbandon.id;
    setAbandoningQuestId(questId);

    try {
      await api.quests.delete(questId, token);
      setQuests((prev) => prev.filter((quest) => quest.id !== questId));
      setDailyBounty((prev) => {
        if (!prev || prev.quest?.id !== questId) return prev;
        return { ...prev, quest: null };
      });

      if (selectedQuest?.id === questId) {
        closeQuestDetails();
      } else {
        setQuestPendingAbandon(null);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to abandon quest");
    } finally {
      setAbandoningQuestId(null);
    }
  };

  const handleQuestCreated = () => {
    // New quests appear first; return to page 1 of the current board to reveal them immediately.
    setView("current");
    setCurrentPage(0);
    setPageDirection(-1);
  };

  const handleCreateFormClose = async () => {
    if (!token) return;

    try {
      const data = await api.quests.getAll(token);
      setQuests(getCurrentBoardQuests(data));
    } catch {
      // Silently fail - quests might be stale but UI won't break
    }
  };

  const currentQuestById = useMemo(
    () => new Map(quests.map((quest) => [quest.id, quest])),
    [quests]
  );
  const bountyDecisionQuest =
    dailyBounty?.status === "assigned" && dailyBounty.quest
      ? (currentQuestById.get(dailyBounty.quest.id) ?? dailyBounty.quest)
      : null;
  const activeBountyQuest =
    bountyDecisionQuest && !bountyDecisionQuest.completed ? bountyDecisionQuest : null;
  const fulfilledBountyQuest =
    bountyDecisionQuest && bountyDecisionQuest.completed ? bountyDecisionQuest : null;
  const currentQuestEntries = useMemo<QuestBoardEntry[]>(
    () =>
      quests.map((quest) => ({
        quest,
        participantNames: getQuestParticipantNames(quest, homeUsers),
        title: getQuestTitle(quest),
        createdTimestamp: getTimestamp(quest.created_at),
        deadlineTimestamp: getQuestDeadlineTimestamp(quest),
      })),
    [quests, homeUsers]
  );
  const upcomingQuestEntries = useMemo<UpcomingQuestBoardEntry[]>(
    () =>
      upcomingQuests.map((upcoming) => {
        const quest = toUpcomingQuest(upcoming);
        return {
          quest,
          participantNames: getQuestParticipantNames(quest, homeUsers),
          title: getQuestTitle(quest),
          createdTimestamp: getTimestamp(quest.created_at),
          deadlineTimestamp: getQuestDeadlineTimestamp(quest),
          nextSpawnTimestamp: getTimestamp(upcoming.next_spawn_at),
        };
      }),
    [upcomingQuests, homeUsers]
  );
  const filteredCurrentQuests = useMemo(() => {
    const now = Date.now();
    return currentQuestEntries
      .filter(({ quest, participantNames }) => {
        if (!matchesQuestSearch(quest, participantNames, currentSearchTerm)) return false;
        if (currentFilter === "mine") return questIncludesUser(quest, userId);
        return true;
      })
      .sort((left, right) => {
        if (currentSort === "expiring-soon") {
          const leftIsCorrupted =
            left.quest.quest_type === "corrupted" ||
            (left.deadlineTimestamp !== null && left.deadlineTimestamp <= now);
          const rightIsCorrupted =
            right.quest.quest_type === "corrupted" ||
            (right.deadlineTimestamp !== null && right.deadlineTimestamp <= now);

          if (leftIsCorrupted !== rightIsCorrupted) {
            return leftIsCorrupted ? -1 : 1;
          }

          const deadlineCompare = compareNullableNumber(
            left.deadlineTimestamp,
            right.deadlineTimestamp
          );
          if (deadlineCompare !== 0) return deadlineCompare;

          return right.createdTimestamp - left.createdTimestamp;
        }
        return right.createdTimestamp - left.createdTimestamp;
      })
      .map(({ quest }) => quest);
  }, [currentQuestEntries, currentSearchTerm, currentFilter, currentSort, userId]);
  const filteredUpcomingQuests = useMemo(() => {
    return upcomingQuestEntries
      .filter(({ quest, participantNames }) => {
        if (!matchesQuestSearch(quest, participantNames, upcomingSearchTerm)) return false;
        if (upcomingFilter === "mine") return questIncludesUser(quest, userId);
        return true;
      })
      .sort((left, right) => {
        if (upcomingSort === "spawn-latest") {
          return right.nextSpawnTimestamp - left.nextSpawnTimestamp;
        }
        if (upcomingSort === "user-az") {
          const participantCompare = compareText(left.participantNames, right.participantNames);
          return participantCompare !== 0
            ? participantCompare
            : compareText(left.title, right.title);
        }
        return left.nextSpawnTimestamp - right.nextSpawnTimestamp;
      })
      .map(({ quest }) => quest);
  }, [upcomingQuestEntries, upcomingSearchTerm, upcomingFilter, upcomingSort, userId]);
  const currentSearchLabel = `${filteredCurrentQuests.length} of ${quests.length} ${
    quests.length === 1 ? "quest" : "quests"
  }`;
  const upcomingSearchLabel = `${filteredUpcomingQuests.length} of ${upcomingQuestEntries.length} ${
    upcomingQuestEntries.length === 1 ? "quest" : "quests"
  }`;
  const activeSearchTerm = view === "current" ? currentSearchTerm : upcomingSearchTerm;
  const activeFilter = view === "current" ? currentFilter : upcomingFilter;
  const activeSortOption =
    view === "current"
      ? CURRENT_SORT_OPTIONS.find((option) => option.value === currentSort)
      : UPCOMING_SORT_OPTIONS.find((option) => option.value === upcomingSort);
  const activeFilterOption =
    view === "current"
      ? CURRENT_FILTER_OPTIONS.find((option) => option.value === currentFilter)
      : UPCOMING_FILTER_OPTIONS.find((option) => option.value === upcomingFilter);
  const hasBoardContent =
    view === "current"
      ? quests.length > 0 || currentSearchTerm.trim().length > 0
      : upcomingQuests.length > 0 || upcomingSearchTerm.trim().length > 0;
  const activeCorruptionDebuffQuest = quests.find(
    (quest) => quest.corruption_debuff_active && (quest.corruption_debuff ?? 1) < 1
  );
  const activeCorruptionPenaltyPercent = activeCorruptionDebuffQuest
    ? Math.round((1 - (activeCorruptionDebuffQuest.corruption_debuff ?? 1)) * 100)
    : 0;
  const activeCorruptedQuestCount =
    activeCorruptionDebuffQuest?.corrupted_quest_count ??
    quests.filter((quest) => quest.quest_type === "corrupted").length;
  const hasActiveCorruption = activeCorruptedQuestCount > 0 || activeCorruptionPenaltyPercent > 0;
  const nextCorruptionQuest = useMemo(() => {
    const now = Date.now();
    const [nearestQuest] = currentQuestEntries
      .filter(
        ({ quest, deadlineTimestamp }) =>
          !quest.completed &&
          quest.quest_type !== "corrupted" &&
          deadlineTimestamp !== null &&
          deadlineTimestamp > now
      )
      .sort((left, right) => (left.deadlineTimestamp ?? 0) - (right.deadlineTimestamp ?? 0));

    return nearestQuest?.quest ?? null;
  }, [currentQuestEntries]);
  const nextCorruptionCountdown = nextCorruptionQuest
    ? formatCorruptionCountdown(
        nextCorruptionQuest.created_at,
        nextCorruptionQuest.due_in_hours,
        nextCorruptionQuest.due_date
      )
    : null;
  const visibleCurrentQuestIds = useMemo(
    () => new Set(filteredCurrentQuests.map((quest) => quest.id)),
    [filteredCurrentQuests]
  );
  const isActiveBountyVisible = activeBountyQuest
    ? visibleCurrentQuestIds.has(activeBountyQuest.id)
    : false;
  const showActiveBountySummary = Boolean(activeBountyQuest && isActiveBountyVisible);
  const showFulfilledBountySummary = Boolean(fulfilledBountyQuest);
  const showBountySummary = showActiveBountySummary || showFulfilledBountySummary;
  const hasUpcomingCorruptionRisk = !hasActiveCorruption && Boolean(nextCorruptionCountdown);
  const canFocusCorruption = hasActiveCorruption || hasUpcomingCorruptionRisk;
  const showCorruptionSummary = !loading;

  const handleCorruptionSummaryClick = useCallback(() => {
    if (!canFocusCorruption) return;
    setCurrentFilter("all");
    setCurrentSort("expiring-soon");
  }, [canFocusCorruption]);

  const selectedQuestSequence = useMemo(() => {
    if (selectedQuestView === "current") return filteredCurrentQuests;
    if (selectedQuestView === "upcoming") return filteredUpcomingQuests;
    return [];
  }, [selectedQuestView, filteredCurrentQuests, filteredUpcomingQuests]);
  const selectedQuestIndex = useMemo(() => {
    if (!selectedQuest) return -1;
    return selectedQuestSequence.findIndex((quest) => quest.id === selectedQuest.id);
  }, [selectedQuest, selectedQuestSequence]);

  const pagedCurrentQuests = useMemo(
    () =>
      filteredCurrentQuests.slice(
        currentPage * QUESTS_PER_PAGE,
        (currentPage + 1) * QUESTS_PER_PAGE
      ),
    [filteredCurrentQuests, currentPage]
  );

  const pagedUpcomingQuests = useMemo(
    () =>
      filteredUpcomingQuests.slice(
        upcomingPage * QUESTS_PER_PAGE,
        (upcomingPage + 1) * QUESTS_PER_PAGE
      ),
    [filteredUpcomingQuests, upcomingPage]
  );
  const currentPageCount = getPageCount(filteredCurrentQuests);
  const upcomingPageCount = getPageCount(filteredUpcomingQuests);
  const activePage = view === "current" ? currentPage : upcomingPage;
  const activePageCount = view === "current" ? currentPageCount : upcomingPageCount;

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, currentPageCount - 1));
  }, [currentPageCount]);

  useEffect(() => {
    setUpcomingPage((prev) => Math.min(prev, upcomingPageCount - 1));
  }, [upcomingPageCount]);

  const goToPage = (nextPage: number) => {
    const clampedPage = Math.max(0, Math.min(nextPage, activePageCount - 1));
    if (clampedPage === activePage) return;

    setPageDirection(clampedPage > activePage ? 1 : -1);
    if (view === "current") {
      setCurrentPage(clampedPage);
    } else {
      setUpcomingPage(clampedPage);
    }
  };

  const openQuestDetails = (
    quest: Quest,
    sourceView: QuestCollectionView,
    upcomingSpawnTime?: string
  ) => {
    setRevealedQuestPrompt(null);
    setSelectedQuest(quest);
    setSelectedQuestView(sourceView);

    if (sourceView === "upcoming") {
      setSelectedUpcomingSpawnTime(upcomingSpawnTime);
      setSelectedIsDailyBounty(false);
      return;
    }

    setSelectedUpcomingSpawnTime(undefined);
    setSelectedIsDailyBounty(activeBountyQuest?.id === quest.id);
  };

  const closeQuestDetails = () => {
    setRevealedQuestPrompt(null);
    setShowEditQuestModal(false);
    setEditQuestStartsAsTemplate(false);
    setSelectedQuest(null);
    setSelectedQuestView(null);
    setSelectedUpcomingSpawnTime(undefined);
    setSelectedIsDailyBounty(false);
    setQuestPendingAbandon(null);
  };

  const showQuestPromptPreview = useCallback((quest: Quest, mode: QuestPromptRevealMode) => {
    if (!canRevealQuestPrompt(quest)) return;

    setRevealedQuestPrompt({ questId: quest.id, mode });
  }, []);

  const hideQuestPromptPreview = useCallback((questId: number) => {
    setRevealedQuestPrompt((current) => (current?.questId === questId ? null : current));
  }, []);

  const handleQuestEditSaved = async (updatedQuest?: Quest) => {
    setShowEditQuestModal(false);
    setEditQuestStartsAsTemplate(false);

    if (updatedQuest) {
      setSelectedQuest(updatedQuest);
    }

    if (!token) return;

    try {
      const updatedQuests = await api.quests.getAll(token);
      const currentBoardQuests = getCurrentBoardQuests(updatedQuests);
      setQuests(currentBoardQuests);

      if (updatedQuest) {
        const refreshedQuest =
          currentBoardQuests.find((quest) => quest.id === updatedQuest.id) ?? updatedQuest;
        setSelectedQuest(refreshedQuest);
        setSelectedIsDailyBounty(activeBountyQuest?.id === refreshedQuest.id);
      }
    } catch {
      if (updatedQuest) {
        setQuests((prev) =>
          prev.map((quest) => (quest.id === updatedQuest.id ? updatedQuest : quest))
        );
      }
    }
  };

  const canSwipeQuestDetails = isCoarsePointer && selectedQuestSequence.length > 1;
  const canNavigatePrevQuest = selectedQuestIndex > 0;
  const canNavigateNextQuest =
    selectedQuestIndex !== -1 && selectedQuestIndex < selectedQuestSequence.length - 1;

  useEffect(() => {
    if (!revealedQuestPrompt) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setRevealedQuestPrompt(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [revealedQuestPrompt]);

  const moveSelectedQuest = useCallback(
    (delta: 1 | -1) => {
      if (!selectedQuest || selectedQuestSequence.length < 2) return;

      const currentIndex = selectedQuestSequence.findIndex(
        (quest) => quest.id === selectedQuest.id
      );
      if (currentIndex === -1) return;

      const nextIndex = currentIndex + delta;
      if (nextIndex < 0 || nextIndex >= selectedQuestSequence.length) return;

      const nextQuest = selectedQuestSequence[nextIndex];
      setSelectedQuest(nextQuest);

      if (selectedQuestView === "upcoming") {
        const nextUpcomingQuest = upcomingQuests.find((upcoming) => upcoming.id === nextQuest.id);
        setSelectedUpcomingSpawnTime(nextUpcomingQuest?.next_spawn_at);
        setSelectedIsDailyBounty(false);
        return;
      }

      setSelectedUpcomingSpawnTime(undefined);
      setSelectedIsDailyBounty(activeBountyQuest?.id === nextQuest.id);
    },
    [activeBountyQuest?.id, selectedQuest, selectedQuestSequence, selectedQuestView, upcomingQuests]
  );

  useEffect(() => {
    if (
      !selectedQuest ||
      selectedQuestSequence.length < 2 ||
      showEditQuestModal ||
      questPendingAbandon
    ) {
      return;
    }

    const handleQuestDetailKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      ) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName))
      ) {
        return;
      }

      if (event.key === "ArrowLeft" && canNavigatePrevQuest) {
        event.preventDefault();
        moveSelectedQuest(-1);
      }

      if (event.key === "ArrowRight" && canNavigateNextQuest) {
        event.preventDefault();
        moveSelectedQuest(1);
      }
    };

    window.addEventListener("keydown", handleQuestDetailKeyDown);
    return () => window.removeEventListener("keydown", handleQuestDetailKeyDown);
  }, [
    canNavigateNextQuest,
    canNavigatePrevQuest,
    moveSelectedQuest,
    questPendingAbandon,
    selectedQuest,
    selectedQuestSequence.length,
    showEditQuestModal,
  ]);

  const handleQuestDetailWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (isCoarsePointer || selectedQuestSequence.length < 2) return;

    const horizontalIntent = Math.abs(event.deltaX) > Math.abs(event.deltaY) * 1.25;
    if (!horizontalIntent || Math.abs(event.deltaX) < TRACKPAD_NAVIGATION_THRESHOLD) return;

    const now = Date.now();
    if (now - lastDetailWheelNavigationAtRef.current < TRACKPAD_NAVIGATION_COOLDOWN_MS) {
      event.preventDefault();
      return;
    }

    if (event.deltaX > 0 && canNavigateNextQuest) {
      event.preventDefault();
      lastDetailWheelNavigationAtRef.current = now;
      moveSelectedQuest(1);
    }

    if (event.deltaX < 0 && canNavigatePrevQuest) {
      event.preventDefault();
      lastDetailWheelNavigationAtRef.current = now;
      moveSelectedQuest(-1);
    }
  };

  const handleDetailSwipeEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!isCoarsePointer) return;

    const swipedLeft =
      info.offset.x <= -SWIPE_DISTANCE_THRESHOLD || info.velocity.x <= -SWIPE_VELOCITY_THRESHOLD;
    const swipedRight =
      info.offset.x >= SWIPE_DISTANCE_THRESHOLD || info.velocity.x >= SWIPE_VELOCITY_THRESHOLD;

    if (swipedLeft) {
      moveSelectedQuest(1);
      return;
    }

    if (swipedRight) {
      moveSelectedQuest(-1);
    }
  };

  const pendingAbandonQuestLabel =
    questPendingAbandon?.display_name || questPendingAbandon?.title || "this quest";
  const canCreateTemplateFromSelectedQuest = Boolean(
    selectedQuest && selectedQuestView === "current" && selectedQuest.quest_template_id === null
  );

  return (
    <div>
      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setView("current")}
          className="flex-1 py-2 px-3 font-serif font-semibold text-xs uppercase tracking-wider transition-all"
          style={{
            backgroundColor:
              view === "current" ? `rgba(212, 175, 55, 0.3)` : `rgba(212, 175, 55, 0.1)`,
            borderColor: COLORS.gold,
            borderWidth: "2px",
            color: COLORS.gold,
            opacity: view === "current" ? 1 : 0.6,
          }}
        >
          Current Quests
        </button>
        <button
          type="button"
          onClick={() => setView("upcoming")}
          className="flex-1 py-2 px-3 font-serif font-semibold text-xs uppercase tracking-wider transition-all"
          style={{
            backgroundColor:
              view === "upcoming" ? `rgba(212, 175, 55, 0.3)` : `rgba(212, 175, 55, 0.1)`,
            borderColor: COLORS.gold,
            borderWidth: "2px",
            color: COLORS.gold,
            opacity: view === "upcoming" ? 1 : 0.6,
          }}
        >
          Upcoming Quests
        </button>
      </div>

      {error && (
        <div
          className="px-4 py-3 mb-6 rounded-sm font-serif"
          style={{
            backgroundColor: COLORS.redDarker,
            borderColor: COLORS.redBorder,
            borderWidth: "1px",
            color: COLORS.redLight,
          }}
        >
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-12 md:py-16 font-serif" style={{ color: COLORS.brown }}>
          Loading quests...
        </div>
      )}

      {view === "current" && (showBountySummary || showCorruptionSummary) && (
        <div
          className="mb-6 overflow-hidden rounded-lg"
          style={{
            backgroundColor: "rgba(10, 9, 7, 0.96)",
            border: `2px solid rgba(116, 88, 50, 0.75)`,
            boxShadow: "0 12px 22px rgba(0, 0, 0, 0.26)",
          }}
        >
          <div
            className={`grid ${showBountySummary && showCorruptionSummary ? "lg:grid-cols-2" : "grid-cols-1"}`}
          >
            {showActiveBountySummary && activeBountyQuest && (
              <button
                type="button"
                onClick={() => openQuestDetails(activeBountyQuest, "current")}
                className="w-full text-left transition-transform duration-200 hover:translate-y-[-1px]"
                style={{
                  background:
                    "radial-gradient(circle at 16% 50%, rgba(212, 175, 55, 0.1), transparent 24%), linear-gradient(135deg, rgba(11, 12, 10, 0.98), rgba(9, 14, 14, 0.94))",
                }}
              >
                <div className="flex min-h-[6.25rem] items-center gap-3 px-4 py-3 sm:min-h-[6.75rem] sm:gap-3.5 sm:px-4">
                  <img
                    src={bountyEmblem}
                    alt=""
                    aria-hidden="true"
                    className="h-12 w-12 shrink-0 object-contain sm:h-14 sm:w-14 lg:h-[4rem] lg:w-[4rem]"
                    style={{ filter: "drop-shadow(0 10px 14px rgba(0, 0, 0, 0.38))" }}
                  />

                  <div className="min-w-0 flex-1">
                    <div
                      className="mb-1 text-[10px] font-serif font-bold uppercase tracking-[0.18em] sm:text-[11px]"
                      style={{ color: COLORS.gold }}
                    >
                      Daily Bounty
                    </div>
                    <div
                      className="text-lg font-serif font-bold leading-tight sm:text-[1.4rem] lg:text-[1.5rem]"
                      style={{ color: COLORS.parchment }}
                    >
                      {activeBountyQuest.display_name || activeBountyQuest.title}
                    </div>
                    <div
                      className="mt-1.5 text-xs font-serif sm:text-sm"
                      style={{ color: COLORS.parchment }}
                    >
                      Gold reward{" "}
                      <span style={{ color: COLORS.gold }}>
                        x{dailyBounty?.bonus_multiplier ?? 3}
                      </span>
                    </div>
                  </div>

                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-serif text-[1.55rem] font-bold sm:h-14 sm:w-14 sm:text-[1.85rem] lg:h-[3.75rem] lg:w-[3.75rem] lg:text-[2.1rem]"
                    style={{
                      color: COLORS.gold,
                      border: "2px solid rgba(167, 122, 45, 0.8)",
                      background:
                        "radial-gradient(circle at 32% 28%, rgba(235, 196, 104, 0.28), rgba(45, 25, 8, 0.96) 72%)",
                      boxShadow:
                        "inset 0 0 18px rgba(0, 0, 0, 0.42), 0 10px 18px rgba(0, 0, 0, 0.26)",
                    }}
                  >
                    x{dailyBounty?.bonus_multiplier ?? 3}
                  </div>
                </div>
              </button>
            )}

            {!showActiveBountySummary && showFulfilledBountySummary && fulfilledBountyQuest && (
              <div
                style={{
                  background:
                    "radial-gradient(circle at 16% 50%, rgba(212, 175, 55, 0.08), transparent 24%), linear-gradient(135deg, rgba(11, 12, 10, 0.98), rgba(9, 14, 14, 0.94))",
                }}
              >
                <div className="flex min-h-[6.25rem] items-center gap-3 px-4 py-3 sm:min-h-[6.75rem] sm:gap-3.5 sm:px-4">
                  <img
                    src={bountyEmblem}
                    alt=""
                    aria-hidden="true"
                    className="h-12 w-12 shrink-0 object-contain sm:h-14 sm:w-14 lg:h-[4rem] lg:w-[4rem]"
                    style={{ filter: "drop-shadow(0 10px 14px rgba(0, 0, 0, 0.38))" }}
                  />

                  <div className="min-w-0 flex-1">
                    <div
                      className="mb-1 text-[10px] font-serif font-bold uppercase tracking-[0.18em] sm:text-[11px]"
                      style={{ color: COLORS.gold }}
                    >
                      Daily Bounty
                    </div>
                    <div
                      className="text-lg font-serif font-bold leading-tight sm:text-[1.4rem] lg:text-[1.5rem]"
                      style={{ color: COLORS.parchment }}
                    >
                      Daily bounty fulfilled
                    </div>
                    <div
                      className="mt-1.5 text-xs font-serif sm:text-sm"
                      style={{ color: COLORS.parchment }}
                    >
                      Next bounty at midnight.
                    </div>
                  </div>

                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-serif text-[1.55rem] font-bold sm:h-14 sm:w-14 sm:text-[1.85rem] lg:h-[3.75rem] lg:w-[3.75rem] lg:text-[2.1rem]"
                    style={{
                      color: COLORS.gold,
                      border: "2px solid rgba(167, 122, 45, 0.8)",
                      background:
                        "radial-gradient(circle at 32% 28%, rgba(235, 196, 104, 0.28), rgba(45, 25, 8, 0.96) 72%)",
                      boxShadow:
                        "inset 0 0 18px rgba(0, 0, 0, 0.42), 0 10px 18px rgba(0, 0, 0, 0.26)",
                    }}
                  >
                    x{dailyBounty?.bonus_multiplier ?? 3}
                  </div>
                </div>
              </div>
            )}

            {showCorruptionSummary && (
              <div className="relative">
                <div
                  className={`h-full ${showBountySummary ? "border-t lg:border-t-0 lg:border-l" : ""}`}
                  style={{ borderColor: "rgba(116, 88, 50, 0.5)" }}
                >
                  <button
                    type="button"
                    onClick={handleCorruptionSummaryClick}
                    disabled={!canFocusCorruption}
                    className="flex min-h-[6.25rem] w-full items-center gap-3 px-4 py-3 text-left sm:min-h-[6.75rem] sm:gap-3.5 sm:px-4"
                    style={{
                      background:
                        "radial-gradient(circle at 16% 50%, rgba(139, 58, 58, 0.18), transparent 24%), linear-gradient(135deg, rgba(12, 10, 9, 0.98), rgba(17, 10, 8, 0.94))",
                      cursor: canFocusCorruption ? "pointer" : "default",
                    }}
                  >
                    <img
                      src={hourglassEmblem}
                      alt=""
                      aria-hidden="true"
                      className="h-12 w-12 shrink-0 object-contain sm:h-14 sm:w-14 lg:h-[3.7rem] lg:w-[3.7rem]"
                      style={{ filter: "drop-shadow(0 10px 14px rgba(0, 0, 0, 0.38))" }}
                    />

                    <div className="min-w-0 flex-1">
                      <div
                        className="mb-1 text-[10px] font-serif font-bold uppercase tracking-[0.18em] sm:text-[11px]"
                        style={{ color: COLORS.gold }}
                      >
                        Quest Corruption
                      </div>
                      <div
                        className="text-base font-serif font-bold leading-tight sm:text-[1.3rem] lg:text-[1.4rem]"
                        style={{ color: COLORS.parchment }}
                      >
                        {hasActiveCorruption
                          ? "Corruption is already active"
                          : hasUpcomingCorruptionRisk
                            ? "Overdue quests will become Corrupted"
                            : "No active quests with corruption"}
                      </div>
                      {hasActiveCorruption && (
                        <div
                          className="mt-1.5 text-xs font-serif sm:text-sm"
                          style={{ color: "#ff9b80" }}
                        >
                          {activeCorruptedQuestCount} corrupted{" "}
                          {activeCorruptedQuestCount === 1 ? "quest" : "quests"} • -
                          {activeCorruptionPenaltyPercent}% XP and gold
                        </div>
                      )}
                    </div>

                    {hasUpcomingCorruptionRisk && nextCorruptionCountdown && (
                      <div className="shrink-0 text-right">
                        <div
                          className="flex items-center justify-end gap-1.5 text-xs font-serif font-bold sm:text-sm"
                          style={{ color: "#ff6b4a" }}
                        >
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 20 20"
                            className="h-4 w-4 shrink-0"
                            fill="none"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M6 3.5h8" strokeWidth="1.6" />
                            <path d="M6 16.5h8" strokeWidth="1.6" />
                            <path
                              d="M7.5 3.8v3.1c0 1.2.5 2.2 1.4 2.9l1.1.8-1.1.8c-.9.7-1.4 1.7-1.4 2.9v1.9"
                              strokeWidth="1.6"
                            />
                            <path
                              d="M12.5 3.8v3.1c0 1.2-.5 2.2-1.4 2.9l-1.1.8 1.1.8c.9.7 1.4 1.7 1.4 2.9v1.9"
                              strokeWidth="1.6"
                            />
                          </svg>
                          <span>{nextCorruptionCountdown}</span>
                        </div>
                      </div>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && hasBoardContent && (
        <div className="mb-6">
          <div
            className="relative rounded-lg overflow-hidden p-4 sm:p-6"
            style={{
              backgroundImage: `linear-gradient(rgba(12, 8, 6, 0.42), rgba(12, 8, 6, 0.42)), url(${boardBackground})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              border: `2px solid ${COLORS.brown}`,
              minHeight: "520px",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3
                className="font-serif uppercase text-sm tracking-widest"
                style={{ color: COLORS.gold }}
              >
                {view === "current" ? "Quest Board" : "Upcoming Board"}
              </h3>
              <div className="font-serif text-xs" style={{ color: COLORS.parchment }}>
                Page {activePage + 1} / {activePageCount}
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-start gap-2">
                <div className="relative min-w-0 flex-1">
                  <input
                    type="text"
                    value={view === "current" ? currentSearchTerm : upcomingSearchTerm}
                    onChange={(event) =>
                      view === "current"
                        ? setCurrentSearchTerm(event.target.value)
                        : setUpcomingSearchTerm(event.target.value)
                    }
                    placeholder={
                      view === "current"
                        ? "Search quests by title, description, tag, or person..."
                        : "Search upcoming quests by title, description, tag, or person..."
                    }
                    aria-label={
                      view === "current" ? "Search current quests" : "Search upcoming quests"
                    }
                    className="w-full px-3 py-2 pr-10 font-serif focus:outline-none focus:shadow-lg transition-all"
                    style={{
                      backgroundColor: COLORS.black,
                      borderColor: COLORS.gold,
                      borderWidth: "2px",
                      color: COLORS.parchment,
                    }}
                  />
                  {activeSearchTerm && (
                    <button
                      type="button"
                      onClick={() =>
                        view === "current" ? setCurrentSearchTerm("") : setUpcomingSearchTerm("")
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-sm font-serif"
                      style={{ color: COLORS.gold }}
                      aria-label="Clear quest search"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {view === "current" ? (
                    <>
                      <CurrentSortButton
                        label="Newest"
                        icon={<NewestSortIcon />}
                        isActive={currentSort === "newest"}
                        onClick={() => setCurrentSort("newest")}
                      />
                      <CurrentSortButton
                        label="Corrupted / Expiring"
                        icon={<CorruptionSortIcon />}
                        isActive={currentSort === "expiring-soon"}
                        onClick={() => setCurrentSort("expiring-soon")}
                      />
                    </>
                  ) : (
                    <BoardControlMenu
                      label="Sort Quests"
                      icon={<SortIcon />}
                      options={UPCOMING_SORT_OPTIONS}
                      value={upcomingSort}
                      onSelect={setUpcomingSort}
                    />
                  )}
                  <BoardControlMenu
                    label="Filter Quests"
                    icon={<FilterIcon />}
                    options={view === "current" ? CURRENT_FILTER_OPTIONS : UPCOMING_FILTER_OPTIONS}
                    value={activeFilter}
                    onSelect={(value) =>
                      view === "current"
                        ? setCurrentFilter(value as CurrentQuestFilter)
                        : setUpcomingFilter(value as UpcomingQuestFilter)
                    }
                  />
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs font-serif" style={{ color: COLORS.goldDarker }}>
                  {view === "current" ? currentSearchLabel : upcomingSearchLabel}
                </div>
                <div
                  className="text-[11px] font-serif uppercase tracking-[0.18em]"
                  style={{ color: COLORS.brown }}
                >
                  {activeSortOption?.shortLabel}
                  {activeFilterOption && activeFilterOption.value !== "all"
                    ? ` • ${activeFilterOption.shortLabel}`
                    : ""}
                </div>
              </div>
            </div>

            {(view === "current" && pagedCurrentQuests.length > 0) ||
            (view === "upcoming" && pagedUpcomingQuests.length > 0) ? (
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`${view}-${activePage}`}
                  initial={{ opacity: 0, x: 30 * pageDirection }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 * pageDirection }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4"
                >
                  {view === "current" &&
                    pagedCurrentQuests.map((quest) => (
                      <CompactQuestCard
                        key={quest.id}
                        quest={quest}
                        questParticipantNames={getQuestParticipantNames(quest, homeUsers)}
                        isDailyBounty={activeBountyQuest?.id === quest.id}
                        isPromptRevealed={revealedQuestPrompt?.questId === quest.id}
                        promptRevealMode={
                          revealedQuestPrompt?.questId === quest.id
                            ? revealedQuestPrompt.mode
                            : null
                        }
                        onClick={() => openQuestDetails(quest, "current")}
                        onPromptReveal={showQuestPromptPreview}
                        onPromptHide={hideQuestPromptPreview}
                      />
                    ))}

                  {view === "upcoming" &&
                    pagedUpcomingQuests.map((quest) => {
                      const upcoming = upcomingQuests.find((item) => item.id === quest.id);
                      return (
                        <CompactQuestCard
                          key={quest.id}
                          quest={quest}
                          questParticipantNames={getQuestParticipantNames(quest, homeUsers)}
                          isUpcoming={true}
                          upcomingSpawnTime={upcoming?.next_spawn_at}
                          isPromptRevealed={revealedQuestPrompt?.questId === quest.id}
                          promptRevealMode={
                            revealedQuestPrompt?.questId === quest.id
                              ? revealedQuestPrompt.mode
                              : null
                          }
                          onClick={() =>
                            openQuestDetails(quest, "upcoming", upcoming?.next_spawn_at)
                          }
                          onPromptReveal={showQuestPromptPreview}
                          onPromptHide={hideQuestPromptPreview}
                        />
                      );
                    })}
                </motion.div>
              </AnimatePresence>
            ) : (
              <div className="py-16 text-center font-serif" style={{ color: COLORS.brown }}>
                {activeSearchTerm
                  ? "No quests match your search"
                  : view === "current"
                    ? "No quests found"
                    : "No upcoming quests found"}
              </div>
            )}

            {activePageCount > 1 && (
              <div className="mt-4 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => goToPage(activePage - 1)}
                  disabled={activePage === 0}
                  className="px-4 py-2 font-serif text-sm uppercase tracking-wide disabled:opacity-35"
                  style={{
                    border: `1px solid ${COLORS.gold}`,
                    color: COLORS.gold,
                    backgroundColor: "rgba(30, 21, 17, 0.65)",
                  }}
                >
                  ← Prev
                </button>

                <button
                  type="button"
                  onClick={() => goToPage(activePage + 1)}
                  disabled={activePage >= activePageCount - 1}
                  className="px-4 py-2 font-serif text-sm uppercase tracking-wide disabled:opacity-35"
                  style={{
                    border: `1px solid ${COLORS.gold}`,
                    color: COLORS.gold,
                    backgroundColor: "rgba(30, 21, 17, 0.65)",
                  }}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && view === "current" && quests.length === 0 && !currentSearchTerm && (
        <div className="text-center py-12 md:py-16 font-serif" style={{ color: COLORS.brown }}>
          No quests found
        </div>
      )}

      {!loading && view === "upcoming" && upcomingQuests.length === 0 && !upcomingSearchTerm && (
        <div className="text-center py-12 md:py-16 font-serif" style={{ color: COLORS.brown }}>
          No upcoming quests. Create recurring quest templates to see them here!
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowCreateForm(true)}
        className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+5.75rem)] md:bottom-[calc(env(safe-area-inset-bottom,0px)+7rem)] flex items-center justify-center overflow-hidden rounded-full transition-transform duration-200 hover:scale-[1.03] focus-visible:outline-none active:scale-95"
        style={{
          width: "clamp(4.25rem, 11vw, 5rem)",
          height: "clamp(4.25rem, 11vw, 5rem)",
          right: "max(1rem, calc(env(safe-area-inset-right, 0px) + 1rem))",
          backgroundColor: "transparent",
          boxShadow: "0 14px 28px rgba(0, 0, 0, 0.42), 0 0 14px rgba(212, 175, 55, 0.14)",
          zIndex: LAYERS.floatingAction,
        }}
        title="Create Quest"
        aria-label="Create Quest"
      >
        <img
          src={createQuestFabIcon}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="h-full w-full object-cover"
        />
      </button>

      {showCreateForm && token && (
        <CreateQuestForm
          token={token}
          onQuestCreated={handleQuestCreated}
          onClose={() => {
            setShowCreateForm(false);
            handleCreateFormClose();
          }}
        />
      )}

      {selectedQuest && (
        <ModalShell
          isOpen={true}
          onClose={closeQuestDetails}
          closeOnBackdrop={true}
          overlayClassName="items-end bg-black/75 p-2 sm:items-center sm:p-6"
          panelClassName="w-full max-w-4xl max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-3rem)]"
          zIndex={LAYERS.modal}
        >
          <div className="mx-auto mb-1 flex max-w-3xl justify-end gap-2 sm:mb-2">
            {selectedQuestView === "current" && (
              <button
                type="button"
                onClick={() => {
                  setEditQuestStartsAsTemplate(false);
                  setShowEditQuestModal(true);
                }}
                className="px-3 py-1 font-serif text-xs uppercase tracking-wider"
                style={{
                  border: `1px solid ${COLORS.gold}`,
                  color: COLORS.gold,
                  backgroundColor: "rgba(24, 17, 14, 0.85)",
                }}
              >
                Edit
              </button>
            )}
            {canCreateTemplateFromSelectedQuest && (
              <button
                type="button"
                onClick={() => {
                  setEditQuestStartsAsTemplate(true);
                  setShowEditQuestModal(true);
                }}
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
              onClick={closeQuestDetails}
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
          <div
            className="relative mx-auto max-w-4xl md:px-14"
            onWheelCapture={handleQuestDetailWheel}
          >
            {!isCoarsePointer && selectedQuestSequence.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous quest"
                  onClick={() => moveSelectedQuest(-1)}
                  disabled={!canNavigatePrevQuest}
                  className="absolute left-2 top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full text-lg font-bold disabled:opacity-35"
                  style={{
                    backgroundColor: "rgba(24, 17, 14, 0.92)",
                    border: `1px solid ${COLORS.gold}`,
                    color: COLORS.gold,
                  }}
                >
                  ←
                </button>
                <button
                  type="button"
                  aria-label="Next quest"
                  onClick={() => moveSelectedQuest(1)}
                  disabled={!canNavigateNextQuest}
                  className="absolute right-2 top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full text-lg font-bold disabled:opacity-35"
                  style={{
                    backgroundColor: "rgba(24, 17, 14, 0.92)",
                    border: `1px solid ${COLORS.gold}`,
                    color: COLORS.gold,
                  }}
                >
                  →
                </button>
              </>
            )}
            <motion.div
              drag={canSwipeQuestDetails ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragDirectionLock={true}
              dragElastic={0.2}
              onDragEnd={handleDetailSwipeEnd}
              style={{ touchAction: canSwipeQuestDetails ? "pan-y" : "auto" }}
            >
              <QuestCard
                quest={selectedQuest}
                questParticipantNames={getQuestParticipantNames(selectedQuest, homeUsers)}
                questCreatorName={homeUsers[selectedQuest.created_by]}
                onComplete={handleCompleteQuest}
                onAbandon={selectedQuestView === "current" ? openAbandonConfirm : undefined}
                isDailyBounty={selectedIsDailyBounty}
                isUpcoming={selectedQuestView === "upcoming"}
                upcomingSpawnTime={selectedUpcomingSpawnTime}
                isAbandoning={abandoningQuestId === selectedQuest.id}
                timeZone={homeTimeZone}
              />
            </motion.div>
          </div>
        </ModalShell>
      )}

      {showEditQuestModal && selectedQuest && selectedQuestView === "current" && token && (
        <EditQuestModal
          questId={selectedQuest.id}
          token={token}
          skipAI={true}
          initialSaveAsTemplate={editQuestStartsAsTemplate}
          onSave={(result) => handleQuestEditSaved(result.quest)}
          onClose={() => {
            setShowEditQuestModal(false);
            setEditQuestStartsAsTemplate(false);
          }}
        />
      )}

      {questPendingAbandon && (
        <ModalShell
          isOpen={true}
          onClose={closeAbandonConfirm}
          closeOnBackdrop={abandoningQuestId === null}
          closeOnEscape={abandoningQuestId === null}
          overlayClassName="items-center p-4 bg-black/80"
          panelClassName="w-full max-w-md"
          zIndex={LAYERS.nestedModal}
        >
          <div
            className="rounded-lg p-6 shadow-xl"
            style={{
              backgroundColor: COLORS.darkPanel,
              border: `2px solid ${COLORS.redLight}`,
            }}
          >
            <h3 className="font-serif text-xl font-bold mb-3" style={{ color: COLORS.redLight }}>
              Abandon quest?
            </h3>
            <p className="font-serif text-sm leading-relaxed" style={{ color: COLORS.parchment }}>
              This will permanently delete{" "}
              <span style={{ color: COLORS.gold }}>{pendingAbandonQuestLabel}</span> from your
              board.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeAbandonConfirm}
                disabled={abandoningQuestId !== null}
                className="px-4 py-2 font-serif text-sm uppercase tracking-wider disabled:opacity-50"
                style={{
                  border: `1px solid ${COLORS.gold}`,
                  color: COLORS.gold,
                  backgroundColor: "rgba(24, 17, 14, 0.85)",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAbandonQuest}
                disabled={abandoningQuestId !== null}
                className="px-4 py-2 font-serif text-sm uppercase tracking-wider disabled:opacity-50"
                style={{
                  border: `1px solid ${COLORS.redLight}`,
                  color: COLORS.redLight,
                  backgroundColor: "rgba(139, 58, 58, 0.25)",
                }}
              >
                {abandoningQuestId !== null ? "Abandoning..." : "Abandon"}
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
