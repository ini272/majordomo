import { useState, useEffect, useMemo, useRef, useCallback, type WheelEvent } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import QuestCard from "../components/QuestCard";
import CreateQuestForm from "../components/CreateQuestForm";
import EditQuestModal from "../components/EditQuestModal";
import { api } from "../services/api";
import { COLORS } from "../constants/colors";
import { LAYERS } from "../constants/layers";
import boardBackground from "../assets/empty_board.png";
import type { Quest, DailyBounty, UpcomingSubscription } from "../types/api";
import { useAuth } from "../contexts/AuthContext";
import { useSound } from "../contexts/SoundContext";
import ModalShell from "../components/modal/ModalShell";

const QUESTS_PER_PAGE = 6;
const SWIPE_DISTANCE_THRESHOLD = 72;
const SWIPE_VELOCITY_THRESHOLD = 420;
const TRACKPAD_NAVIGATION_THRESHOLD = 60;
const TRACKPAD_NAVIGATION_COOLDOWN_MS = 450;

type QuestCollectionView = "current" | "upcoming";

interface CompactQuestCardProps {
  quest: Quest;
  questParticipantNames?: string;
  isUpcoming?: boolean;
  isDailyBounty?: boolean;
  onClick: () => void;
}

function CompactQuestCard({
  quest,
  questParticipantNames,
  isUpcoming = false,
  isDailyBounty = false,
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

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left p-3 sm:p-4 rounded-sm transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
      style={{
        backgroundColor: "rgba(30, 21, 17, 0.7)",
        border: `2px solid ${borderColor}`,
        boxShadow: "0 6px 12px rgba(0, 0, 0, 0.25)",
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
              3x
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

export default function Board() {
  const { token } = useAuth();
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
  }, [currentSearchTerm]);

  useEffect(() => {
    setUpcomingPage(0);
  }, [upcomingSearchTerm]);

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
  const fullUpcomingQuests = useMemo(() => upcomingQuests.map(toUpcomingQuest), [upcomingQuests]);
  const filteredCurrentQuests = useMemo(
    () =>
      quests.filter((quest) =>
        matchesQuestSearch(quest, getQuestParticipantNames(quest, homeUsers), currentSearchTerm)
      ),
    [quests, homeUsers, currentSearchTerm]
  );
  const filteredUpcomingQuests = useMemo(
    () =>
      fullUpcomingQuests.filter((quest) =>
        matchesQuestSearch(quest, getQuestParticipantNames(quest, homeUsers), upcomingSearchTerm)
      ),
    [fullUpcomingQuests, homeUsers, upcomingSearchTerm]
  );
  const currentSearchLabel = `${filteredCurrentQuests.length} of ${quests.length} ${
    quests.length === 1 ? "quest" : "quests"
  }`;
  const upcomingSearchLabel = `${filteredUpcomingQuests.length} of ${fullUpcomingQuests.length} ${
    fullUpcomingQuests.length === 1 ? "quest" : "quests"
  }`;
  const activeSearchTerm = view === "current" ? currentSearchTerm : upcomingSearchTerm;
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

      {view === "current" && activeBountyQuest && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <h2
              className="text-lg font-serif font-bold uppercase tracking-wider"
              style={{ color: "#9d84ff" }}
            >
              Today&apos;s Bounty
            </h2>
            <span
              className="px-2 py-1 text-xs font-serif font-bold rounded"
              style={{
                backgroundColor: "rgba(107, 95, 183, 0.3)",
                color: "#9d84ff",
              }}
            >
              3x Gold
            </span>
          </div>
          <div
            className="p-4 md:p-6 rounded-lg"
            style={{
              backgroundColor: "rgba(107, 95, 183, 0.1)",
              border: "2px solid #6b5fb7",
            }}
          >
            <h3
              className="text-xl md:text-2xl font-serif font-bold mb-2"
              style={{ color: "#9d84ff" }}
            >
              {activeBountyQuest.display_name || activeBountyQuest.title}
            </h3>
            <p className="font-serif italic mb-4" style={{ color: COLORS.parchment }}>
              {activeBountyQuest.description || "Complete this quest for triple gold rewards!"}
            </p>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex gap-6 text-sm font-serif" style={{ color: COLORS.gold }}>
                <span>Your XP: {activeBountyXpReward}</span>
                <span>
                  Your Gold: {activeBountyGoldReward} x3 = {activeBountyGoldReward * 3}
                </span>
              </div>
              <span
                className="px-4 py-2 font-serif font-semibold text-sm uppercase tracking-wider rounded"
                style={{
                  backgroundColor: "rgba(107, 95, 183, 0.3)",
                  border: "2px solid #6b5fb7",
                  color: "#9d84ff",
                }}
              >
                Bounty Locked
              </span>
            </div>
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
              <div className="relative">
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
              <div className="mt-2 text-xs font-serif" style={{ color: COLORS.goldDarker }}>
                {view === "current" ? currentSearchLabel : upcomingSearchLabel}
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
        onClick={() => setShowCreateForm(true)}
        className="fixed right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-2xl transition-all hover:shadow-xl active:scale-95"
        style={{
          backgroundColor: COLORS.gold,
          color: COLORS.darkPanel,
          bottom: "6rem",
          zIndex: LAYERS.floatingAction,
        }}
        title="Create Quest"
      >
        +
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
