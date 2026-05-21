import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  type ReactNode,
  type WheelEvent,
} from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import QuestCard from "../components/QuestCard";
import CreateQuestForm from "../components/CreateQuestForm";
import EditQuestModal from "../components/EditQuestModal";
import { api } from "../services/api";
import { COLORS } from "../constants/colors";
import { LAYERS } from "../constants/layers";
import boardBackground from "../assets/empty_board.png";
import createQuestFabIcon from "../assets/quill_and_scroll_with_plus_fab.png";
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
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

type QuestCollectionView = "current" | "upcoming";
type CurrentQuestSort = "newest" | "expiring-soon" | "user-az";
type UpcomingQuestSort = "spawn-soonest" | "spawn-latest" | "user-az";
type QuestFilter = "all" | "mine";

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
}

interface CompactQuestStatusChip {
  label: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
}

const CURRENT_SORT_OPTIONS: BoardControlOption<CurrentQuestSort>[] = [
  { value: "newest", label: "Newest", shortLabel: "Newest" },
  {
    value: "expiring-soon",
    label: "Corrupted / Expiring",
    shortLabel: "Expiring",
  },
  { value: "user-az", label: "User A-Z", shortLabel: "User A-Z" },
];

const UPCOMING_SORT_OPTIONS: BoardControlOption<UpcomingQuestSort>[] = [
  { value: "spawn-soonest", label: "Next Spawn Soonest", shortLabel: "Soonest" },
  { value: "spawn-latest", label: "Next Spawn Latest", shortLabel: "Latest" },
  { value: "user-az", label: "User A-Z", shortLabel: "User A-Z" },
];

const FILTER_OPTIONS: BoardControlOption<QuestFilter>[] = [
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

const getCurrentQuestStatusChip = (quest: Quest): CompactQuestStatusChip | null => {
  if (quest.completed) return null;
  if (quest.quest_type === "corrupted") return null;

  const relativeDeadline = describeQuestDeadline(quest.created_at, quest.due_in_hours);
  const label = formatQuestDeadlineLabel(quest.created_at, quest.due_in_hours, { compact: true });
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

function CompactQuestCard({
  quest,
  questParticipantNames,
  isUpcoming = false,
  isDailyBounty = false,
  upcomingSpawnTime,
  onClick,
}: CompactQuestCardProps) {
  const participantLabel = (quest.participants?.length || 1) > 1 ? "Party" : "For";
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

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left p-3 sm:p-4 rounded-sm transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
      style={{
        backgroundColor: isDailyBounty ? "rgba(42, 28, 62, 0.72)" : "rgba(30, 21, 17, 0.7)",
        border: `2px solid ${borderColor}`,
        boxShadow: isDailyBounty
          ? "0 0 0 1px rgba(157, 132, 255, 0.3), 0 10px 18px rgba(40, 20, 68, 0.35)"
          : "0 6px 12px rgba(0, 0, 0, 0.25)",
        opacity: isUpcoming ? 0.8 : 1,
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3
          className="text-sm sm:text-base font-serif font-bold leading-tight line-clamp-2"
          style={{ color: titleColor }}
        >
          {quest.display_name || quest.title || "Unknown Quest"}
        </h3>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
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
        </div>
      </div>

      <p
        className="text-xs sm:text-sm font-serif mb-3 line-clamp-2"
        style={{ color: "rgba(241, 231, 214, 0.88)" }}
      >
        {quest.description || "No description"}
      </p>

      {questParticipantNames && (
        <div className="mb-3 text-[11px] sm:text-xs font-serif uppercase tracking-wide">
          <span style={{ color: COLORS.brown }}>{participantLabel}:</span>{" "}
          <span style={{ color: COLORS.gold }}>{questParticipantNames}</span>
        </div>
      )}

      <div
        className="flex items-center justify-between gap-3 text-xs font-serif"
        style={{ color: COLORS.brown }}
      >
        <div className="flex gap-2">
          {(quest.tags || "")
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
            .slice(0, 2)
            .map((tag) => (
              <span
                key={`${quest.id}-${tag}`}
                className="px-1.5 py-0.5 uppercase"
                style={{ border: `1px solid ${COLORS.brown}`, color: COLORS.parchment }}
              >
                {tag}
              </span>
            ))}
        </div>
        <span className="min-w-0 text-right" style={{ color: rewardColor }}>
          +{previewXpReward} XP / +{displayGoldReward} Gold
          {hasCorruptionDebuff && (
            <span className="ml-1" style={{ color: "#ff8080" }}>
              -{corruptionPenaltyPercent}%
            </span>
          )}
        </span>
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
const getQuestTitle = (quest: Quest) => quest.display_name || quest.title || "Unknown Quest";
const getTimestamp = (value: string | null | undefined) => {
  const parsed = parseApiDateTime(value);
  return parsed ? parsed.getTime() : 0;
};
const getQuestDeadlineTimestamp = (quest: Quest) => {
  const deadline = getQuestDeadlineDate(quest.created_at, quest.due_in_hours);
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
  const [questPendingAbandon, setQuestPendingAbandon] = useState<Quest | null>(null);
  const [abandoningQuestId, setAbandoningQuestId] = useState<number | null>(null);
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const [userLevel, setUserLevel] = useState<number | null>(null);
  const [currentSearchTerm, setCurrentSearchTerm] = useState("");
  const [upcomingSearchTerm, setUpcomingSearchTerm] = useState("");
  const [currentSort, setCurrentSort] = useState<CurrentQuestSort>("newest");
  const [upcomingSort, setUpcomingSort] = useState<UpcomingQuestSort>("spawn-soonest");
  const [currentFilter, setCurrentFilter] = useState<QuestFilter>("all");
  const [upcomingFilter, setUpcomingFilter] = useState<QuestFilter>("all");
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
  const activeBountyQuest =
    dailyBounty?.status === "assigned" && dailyBounty.quest && !dailyBounty.quest.completed
      ? (currentQuestById.get(dailyBounty.quest.id) ?? dailyBounty.quest)
      : null;
  const activeBountyXpReward =
    activeBountyQuest?.effective_xp_reward ?? activeBountyQuest?.xp_reward ?? 0;
  const activeBountyGoldReward =
    activeBountyQuest?.effective_gold_reward ?? activeBountyQuest?.gold_reward ?? 0;
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

        if (currentSort === "user-az") {
          const participantCompare = compareText(left.participantNames, right.participantNames);
          return participantCompare !== 0
            ? participantCompare
            : compareText(left.title, right.title);
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
  const activeSort = view === "current" ? currentSort : upcomingSort;
  const activeFilter = view === "current" ? currentFilter : upcomingFilter;
  const activeSortOptions = view === "current" ? CURRENT_SORT_OPTIONS : UPCOMING_SORT_OPTIONS;
  const activeSortOption = activeSortOptions.find((option) => option.value === activeSort);
  const activeFilterOption = FILTER_OPTIONS.find((option) => option.value === activeFilter);
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
  const visibleCurrentQuestIds = useMemo(
    () => new Set(filteredCurrentQuests.map((quest) => quest.id)),
    [filteredCurrentQuests]
  );
  const isActiveBountyVisible = activeBountyQuest
    ? visibleCurrentQuestIds.has(activeBountyQuest.id)
    : false;

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
    setShowEditQuestModal(false);
    setEditQuestStartsAsTemplate(false);
    setSelectedQuest(null);
    setSelectedQuestView(null);
    setSelectedUpcomingSpawnTime(undefined);
    setSelectedIsDailyBounty(false);
    setQuestPendingAbandon(null);
  };

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

      {view === "current" && activeCorruptionPenaltyPercent > 0 && (
        <div
          className="mb-6 flex flex-col gap-1 rounded-sm px-4 py-3 font-serif sm:flex-row sm:items-center sm:justify-between"
          style={{
            backgroundColor: "rgba(139, 58, 58, 0.18)",
            border: "1px solid #8b3a3a",
            color: "#ff8080",
          }}
        >
          <span className="font-bold uppercase tracking-wide">Household Corruption</span>
          <span className="text-sm">
            {activeCorruptedQuestCount} corrupted{" "}
            {activeCorruptedQuestCount === 1 ? "quest" : "quests"} • -
            {activeCorruptionPenaltyPercent}% XP and gold
          </span>
        </div>
      )}

      {view === "current" && activeBountyQuest && isActiveBountyVisible && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => openQuestDetails(activeBountyQuest, "current")}
            className="w-full rounded-lg px-4 py-3 text-left transition-all duration-200 hover:translate-y-[-1px]"
            style={{
              backgroundColor: "rgba(54, 36, 82, 0.24)",
              border: "2px solid #6b5fb7",
              boxShadow: "0 8px 18px rgba(36, 19, 62, 0.28)",
            }}
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div
                  className="mb-1 text-[11px] font-serif font-bold uppercase tracking-[0.22em]"
                  style={{ color: "#9d84ff" }}
                >
                  Today&apos;s Bounty
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="min-w-0 text-base font-serif font-bold sm:text-lg"
                    style={{ color: "#c9b7ff" }}
                  >
                    {activeBountyQuest.display_name || activeBountyQuest.title}
                  </span>
                  <span
                    className="rounded px-2 py-1 text-[10px] font-serif font-bold uppercase tracking-wide"
                    style={{
                      backgroundColor: "rgba(107, 95, 183, 0.3)",
                      color: "#c0b4ff",
                    }}
                  >
                    3x Gold
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs font-serif sm:text-sm">
                <span style={{ color: COLORS.gold }}>Your XP: {activeBountyXpReward}</span>
                <span style={{ color: COLORS.gold }}>
                  Your Gold: {activeBountyGoldReward} x3 = {activeBountyGoldReward * 3}
                </span>
                <span
                  className="rounded px-3 py-1 font-serif font-semibold uppercase tracking-wide"
                  style={{
                    backgroundColor: "rgba(107, 95, 183, 0.3)",
                    border: "1px solid #6b5fb7",
                    color: "#c9b7ff",
                  }}
                >
                  Open
                </span>
              </div>
            </div>
          </button>
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
                  <BoardControlMenu
                    label="Sort Quests"
                    icon={<SortIcon />}
                    options={activeSortOptions}
                    value={activeSort}
                    onSelect={(value) =>
                      view === "current"
                        ? setCurrentSort(value as CurrentQuestSort)
                        : setUpcomingSort(value as UpcomingQuestSort)
                    }
                  />
                  <BoardControlMenu
                    label="Filter Quests"
                    icon={<FilterIcon />}
                    options={FILTER_OPTIONS}
                    value={activeFilter}
                    onSelect={(value) =>
                      view === "current" ? setCurrentFilter(value) : setUpcomingFilter(value)
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
                        onClick={() => openQuestDetails(quest, "current")}
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
                          onClick={() =>
                            openQuestDetails(quest, "upcoming", upcoming?.next_spawn_at)
                          }
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
