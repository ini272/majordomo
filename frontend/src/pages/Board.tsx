import { useState, useEffect } from "react";
import QuestCard from "../components/QuestCard";
import CreateQuestForm from "../components/CreateQuestForm";
import { api } from "../services/api";
import { COLORS } from "../constants/colors";
import type { Quest, DailyBounty } from "../types/api";

interface BoardProps {
  token: string;
  onQuestUpdate: () => void;
}

export default function Board({ token, onQuestUpdate }: BoardProps) {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [dailyBounty, setDailyBounty] = useState<DailyBounty | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch quests and daily bounty in parallel
        const [questsData, bountyData] = await Promise.all([
          api.quests.getAll(token),
          api.bounty.getToday(token),
        ]);
        setQuests(questsData);
        setDailyBounty(bountyData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  const handleCompleteQuest = async (questId: number) => {
    try {
      const result = await api.quests.complete(questId, token);
      // Response now includes { quest, rewards }
      const updatedQuest = result.quest;
      setQuests(quests.map(q => (q.id === questId ? updatedQuest : q)));
      setError(null);
      // Notify parent to update hero stats
      onQuestUpdate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete quest");
    }
  };

  const handleQuestCreated = () => {
    onQuestUpdate?.();
  };

  const handleCreateFormClose = async () => {
    // Refetch quests after create form closes (whether quest was created or not)
    try {
      const data = await api.quests.getAll(token);
      setQuests(data);
    } catch (err) {
      // Silently fail - quests might be stale but UI won't break
    }
  };

  return (
    <div>
      {/* Error */}
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

      {/* Loading */}
      {loading && (
        <div className="text-center py-12 md:py-16 font-serif" style={{ color: COLORS.brown }}>
          Loading quests...
        </div>
      )}

      {/* Daily Bounty Section */}
      {dailyBounty?.template && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <h2
              className="text-lg font-serif font-bold uppercase tracking-wider"
              style={{ color: "#9d84ff" }}
            >
              Today's Bounty
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
              {dailyBounty.template.display_name || dailyBounty.template.title}
            </h3>
            <p className="font-serif italic mb-4" style={{ color: COLORS.parchment }}>
              {dailyBounty.template.description || "Complete this quest for double rewards!"}
            </p>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex gap-6 text-sm font-serif" style={{ color: COLORS.gold }}>
                <span>
                  XP: {dailyBounty.template.xp_reward} x2 = {dailyBounty.template.xp_reward * 2}
                </span>
                <span>
                  Gold: {dailyBounty.template.gold_reward} x2 ={" "}
                  {dailyBounty.template.gold_reward * 2}
                </span>
              </div>
              <button
                onClick={async () => {
                  try {
                    const userId = parseInt(localStorage.getItem("userId") || "");
                    await api.quests.create(
                      { quest_template_id: dailyBounty.template.id },
                      token,
                      userId
                    );
                    // Refresh quests
                    const data = await api.quests.getAll(token);
                    setQuests(data);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Failed to accept bounty");
                  }
                }}
                className="px-4 py-2 font-serif font-semibold text-sm uppercase tracking-wider rounded transition-all"
                style={{
                  backgroundColor: "rgba(107, 95, 183, 0.3)",
                  border: "2px solid #6b5fb7",
                  color: "#9d84ff",
                }}
              >
                Accept Bounty
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quests List */}
      {quests.length > 0 ? (
        <div>
          {quests.map(quest => (
            <QuestCard
              key={quest.id}
              quest={quest}
              onComplete={handleCompleteQuest}
              isDailyBounty={dailyBounty?.template?.id === quest.quest_template_id}
            />
          ))}
        </div>
      ) : (
        !loading && (
          <div className="text-center py-12 md:py-16 font-serif" style={{ color: COLORS.brown }}>
            No quests found
          </div>
        )
      )}

      {/* FAB - Create Quest */}
      <button
        onClick={() => setShowCreateForm(true)}
        className="fixed right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-2xl transition-all hover:shadow-xl active:scale-95 z-40"
        style={{
          backgroundColor: COLORS.gold,
          color: COLORS.darkPanel,
          bottom: "6rem",
        }}
        title="Create Quest"
      >
        +
      </button>

      {/* Create Quest Modal */}
      {showCreateForm && (
        <CreateQuestForm
          token={token}
          onQuestCreated={handleQuestCreated}
          onClose={() => {
            setShowCreateForm(false);
            handleCreateFormClose();
          }}
        />
      )}
    </div>
  );
}
