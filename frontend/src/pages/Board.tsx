import { useState, useEffect, useMemo } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import QuestCard from "../components/QuestCard";
import CreateQuestForm from "../components/CreateQuestForm";
import { api } from "../services/api";
import { COLORS } from "../constants/colors";
import { LAYERS } from "../constants/layers";
import boardBackground from "../assets/empty_board.png";
import type { Quest, DailyBounty, UpcomingSubscription } from "../types/api";
import { useAuth } from "../contexts/AuthContext";
import ModalShell from "../components/modal/ModalShell";

const QUESTS_PER_PAGE = 6;
const SWIPE_DISTANCE_THRESHOLD = 72;
const SWIPE_VELOCITY_THRESHOLD = 420;

type QuestCollectionView = "current" | "upcoming";

interface CompactQuestCardProps {
  quest: Quest;
  isUpcoming?: boolean;
  isDailyBounty?: boolean;
  onClick: () => void;
}

function CompactQuestCard({ quest, isUpcoming = false, isDailyBounty = false, onClick }: CompactQuestCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left p-3 sm:p-4 rounded-sm transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
      style={{
        backgroundColor: "rgba(30, 21, 17, 0.7)",
        border: `2px solid ${isDailyBounty ? "#6b5fb7" : COLORS.gold}`,
        boxShadow: "0 6px 12px rgba(0, 0, 0, 0.25)",
        opacity: isUpcoming ? 0.8 : 1,
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3
          className="text-sm sm:text-base font-serif font-bold leading-tight line-clamp-2"
          style={{ color: isDailyBounty ? "#c0b4ff" : COLORS.gold }}
        >
          {quest.display_name || quest.title || "Unknown Quest"}
        </h3>
        {quest.completed && (
          <span
            className="text-[10px] sm:text-xs px-2 py-0.5 font-serif uppercase"
            style={{ backgroundColor: "rgba(95, 183, 84, 0.2)", color: COLORS.greenSuccess }}
          >
            Done
          </span>
        )}
      </div>

      <p
        className="text-xs sm:text-sm font-serif mb-3 line-clamp-2"
        style={{ color: "rgba(241, 231, 214, 0.88)" }}
      >
        {quest.description || "No description"}
      </p>

      <div className="flex items-center justify-between text-xs font-serif" style={{ color: COLORS.brown }}>
        <div className="flex gap-2">
          {(quest.tags || "")
            .split(",")
            .map(tag => tag.trim())
            .filter(Boolean)
            .slice(0, 2)
            .map(tag => (
              <span
                key={`${quest.id}-${tag}`}
                className="px-1.5 py-0.5 uppercase"
                style={{ border: `1px solid ${COLORS.brown}`, color: COLORS.parchment }}
              >
                {tag}
              </span>
            ))}
        </div>
        <span style={{ color: COLORS.gold }}>+{quest.xp_reward || 0} XP</span>
      </div>
    </button>
  );
}

const toUpcomingQuest = (upcoming: UpcomingSubscription): Quest => ({
  id: upcoming.id,
  home_id: 0,
  user_id: upcoming.user_id,
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
  template: upcoming.template,
});

const getPageCount = (items: unknown[]) => Math.max(1, Math.ceil(items.length / QUESTS_PER_PAGE));

export default function Board() {
  const { token } = useAuth();
  const [view, setView] = useState<"current" | "upcoming">("current");
  const [quests, setQuests] = useState<Quest[]>([]);
  const [upcomingQuests, setUpcomingQuests] = useState<UpcomingSubscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [dailyBounty, setDailyBounty] = useState<DailyBounty | null>(null);

  const [currentPage, setCurrentPage] = useState(0);
  const [upcomingPage, setUpcomingPage] = useState(0);
  const [pageDirection, setPageDirection] = useState(1);

  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
  const [selectedQuestView, setSelectedQuestView] = useState<QuestCollectionView | null>(null);
  const [selectedUpcomingSpawnTime, setSelectedUpcomingSpawnTime] = useState<string | undefined>();
  const [selectedIsDailyBounty, setSelectedIsDailyBounty] = useState(false);
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);

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
          setQuests(questsData);
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
    setCurrentPage(prev => Math.min(prev, getPageCount(quests) - 1));
  }, [quests]);

  useEffect(() => {
    setUpcomingPage(prev => Math.min(prev, getPageCount(upcomingQuests) - 1));
  }, [upcomingQuests]);

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
      setQuests(prev => prev.map(q => (q.id === questId ? updatedQuest : q)));
      setSelectedQuest(prev => (prev && prev.id === questId ? updatedQuest : prev));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete quest");
    }
  };

  const handleQuestCreated = () => {
    // Quest created - no additional action needed
  };

  const handleCreateFormClose = async () => {
    if (!token) return;

    try {
      const data = await api.quests.getAll(token);
      setQuests(data);
    } catch {
      // Silently fail - quests might be stale but UI won't break
    }
  };

  const currentPageCount = getPageCount(quests);
  const upcomingPageCount = getPageCount(upcomingQuests);
  const activePage = view === "current" ? currentPage : upcomingPage;
  const activePageCount = view === "current" ? currentPageCount : upcomingPageCount;
  const activeBountyQuest = dailyBounty?.status === "assigned" ? dailyBounty.quest : null;
  const fullUpcomingQuests = useMemo(
    () => upcomingQuests.map(toUpcomingQuest),
    [upcomingQuests]
  );

  const selectedQuestSequence = useMemo(() => {
    if (selectedQuestView === "current") return quests;
    if (selectedQuestView === "upcoming") return fullUpcomingQuests;
    return [];
  }, [selectedQuestView, quests, fullUpcomingQuests]);
  const selectedQuestIndex = useMemo(() => {
    if (!selectedQuest) return -1;
    return selectedQuestSequence.findIndex(quest => quest.id === selectedQuest.id);
  }, [selectedQuest, selectedQuestSequence]);

  const pagedCurrentQuests = useMemo(
    () => quests.slice(currentPage * QUESTS_PER_PAGE, (currentPage + 1) * QUESTS_PER_PAGE),
    [quests, currentPage]
  );

  const pagedUpcomingQuests = useMemo(
    () =>
      upcomingQuests.slice(upcomingPage * QUESTS_PER_PAGE, (upcomingPage + 1) * QUESTS_PER_PAGE),
    [upcomingQuests, upcomingPage]
  );

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
    setSelectedQuest(null);
    setSelectedQuestView(null);
    setSelectedUpcomingSpawnTime(undefined);
    setSelectedIsDailyBounty(false);
  };

  const moveSelectedQuest = (delta: 1 | -1) => {
    if (!selectedQuest || selectedQuestSequence.length < 2) return;

    const currentIndex = selectedQuestSequence.findIndex(quest => quest.id === selectedQuest.id);
    if (currentIndex === -1) return;

    const nextIndex = currentIndex + delta;
    if (nextIndex < 0 || nextIndex >= selectedQuestSequence.length) return;

    const nextQuest = selectedQuestSequence[nextIndex];
    setSelectedQuest(nextQuest);

    if (selectedQuestView === "upcoming") {
      const nextUpcomingQuest = upcomingQuests.find(upcoming => upcoming.id === nextQuest.id);
      setSelectedUpcomingSpawnTime(nextUpcomingQuest?.next_spawn_at);
      setSelectedIsDailyBounty(false);
      return;
    }

    setSelectedUpcomingSpawnTime(undefined);
    setSelectedIsDailyBounty(activeBountyQuest?.id === nextQuest.id);
  };

  const handleDetailSwipeEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
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

  const canSwipeQuestDetails = isCoarsePointer && selectedQuestSequence.length > 1;
  const canNavigatePrevQuest = selectedQuestIndex > 0;
  const canNavigateNextQuest =
    selectedQuestIndex !== -1 && selectedQuestIndex < selectedQuestSequence.length - 1;

  return (
    <div>
      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setView("current")}
          className="flex-1 py-2 px-3 font-serif font-semibold text-xs uppercase tracking-wider transition-all"
          style={{
            backgroundColor: view === "current" ? `rgba(212, 175, 55, 0.3)` : `rgba(212, 175, 55, 0.1)`,
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
            backgroundColor: view === "upcoming" ? `rgba(212, 175, 55, 0.3)` : `rgba(212, 175, 55, 0.1)`,
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
              2x Rewards
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
              {activeBountyQuest.description || "Complete this quest for double rewards!"}
            </p>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex gap-6 text-sm font-serif" style={{ color: COLORS.gold }}>
                <span>
                  XP: {activeBountyQuest.xp_reward} x2 = {activeBountyQuest.xp_reward * 2}
                </span>
                <span>
                  Gold: {activeBountyQuest.gold_reward} x2 ={" "}
                  {activeBountyQuest.gold_reward * 2}
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

      {!loading && ((view === "current" && quests.length > 0) || (view === "upcoming" && upcomingQuests.length > 0)) && (
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
              <h3 className="font-serif uppercase text-sm tracking-widest" style={{ color: COLORS.gold }}>
                {view === "current" ? "Quest Board" : "Upcoming Board"}
              </h3>
              <div className="font-serif text-xs" style={{ color: COLORS.parchment }}>
                Page {activePage + 1} / {activePageCount}
              </div>
            </div>

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
                  pagedCurrentQuests.map(quest => (
                    <CompactQuestCard
                      key={quest.id}
                      quest={quest}
                      isDailyBounty={activeBountyQuest?.id === quest.id}
                      onClick={() => openQuestDetails(quest, "current")}
                    />
                  ))}

                {view === "upcoming" &&
                  pagedUpcomingQuests.map(upcoming => {
                    const upcomingQuest = toUpcomingQuest(upcoming);
                    return (
                      <CompactQuestCard
                        key={upcoming.id}
                        quest={upcomingQuest}
                        isUpcoming={true}
                        onClick={() =>
                          openQuestDetails(upcomingQuest, "upcoming", upcoming.next_spawn_at)
                        }
                      />
                    );
                  })}
              </motion.div>
            </AnimatePresence>

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

      {!loading && view === "current" && quests.length === 0 && (
        <div className="text-center py-12 md:py-16 font-serif" style={{ color: COLORS.brown }}>
          No quests found
        </div>
      )}

      {!loading && view === "upcoming" && upcomingQuests.length === 0 && (
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
          overlayClassName="p-3 sm:p-6 items-end sm:items-center bg-black/75"
          panelClassName="w-full max-w-3xl max-h-[92dvh]"
          zIndex={LAYERS.modal}
        >
          <div className="mb-2 flex justify-end">
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
          <div className="relative">
            {!isCoarsePointer && selectedQuestSequence.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous quest"
                  onClick={() => moveSelectedQuest(-1)}
                  disabled={!canNavigatePrevQuest}
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full text-lg font-bold disabled:opacity-35"
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
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full text-lg font-bold disabled:opacity-35"
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
                onComplete={handleCompleteQuest}
                isDailyBounty={selectedIsDailyBounty}
                isUpcoming={selectedQuestView === "upcoming"}
                upcomingSpawnTime={selectedUpcomingSpawnTime}
              />
            </motion.div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
