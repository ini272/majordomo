import { useState, FormEvent } from "react";
import { api } from "../services/api";
import { COLORS } from "../constants/colors";
import { getRandomSampleQuest } from "../constants/sampleQuests";
import EditQuestModal from "./EditQuestModal";
import StewardImage from "../assets/thesteward.png";

const AVAILABLE_TAGS = [
  "Chores",
  "Learning",
  "Exercise",
  "Health",
  "Organization",
];

interface CreateQuestFormProps {
  token: string;
  onQuestCreated: () => void;
  onClose: () => void;
}

export default function CreateQuestForm({
  token,
  onQuestCreated,
  onClose,
}: CreateQuestFormProps) {
  const [title, setTitle] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skipAI, setSkipAI] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [createdTemplateId, setCreatedTemplateId] = useState<number | null>(
    null
  );

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    const userId = parseInt(localStorage.getItem("userId") || "");
    if (!userId) {
      setError("User ID not found in session");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const newTemplate = await api.quests.createTemplate(
        {
          title: title.trim(),
          ...(selectedTags.length > 0 && { tags: selectedTags.join(",") }),
          xp_reward: 25,
          gold_reward: 15,
          quest_type: "standard",
          recurrence: "one-off",
        },
        token,
        userId,
        skipAI
      );

      // Create quest instance from template
      await api.quests.create(
        {
          quest_template_id: newTemplate.id,
        },
        token,
        userId
      );

      // Open edit modal instead of closing immediately
      setCreatedTemplateId(newTemplate.id);
      setShowEditModal(true);
      setTitle("");
      setSelectedTags([]);
      setSkipAI(false);
      // Note: onQuestCreated will be called after edit modal saves
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create quest");
    } finally {
      setLoading(false);
    }
  };

  const handleRandomQuest = async () => {
    const userId = parseInt(localStorage.getItem("userId") || "");
    if (!userId) {
      setError("User ID not found in session");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const sample = getRandomSampleQuest();
      const xpReward = (sample.time + sample.effort + sample.dread) * 2;
      const goldReward = Math.floor(xpReward / 2);

      const newTemplate = await api.quests.createTemplate(
        {
          title: sample.title,
          display_name: sample.display_name,
          description: sample.description,
          tags: sample.tags,
          xp_reward: xpReward,
          gold_reward: goldReward,
          quest_type: "standard",
          recurrence: "one-off",
        },
        token,
        userId,
        true // skipAI - content already provided
      );

      // Create quest instance from template
      await api.quests.create(
        { quest_template_id: newTemplate.id },
        token,
        userId
      );

      // Open edit modal to review/adjust
      setCreatedTemplateId(newTemplate.id);
      setShowEditModal(true);
      setSkipAI(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create quest");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        className="w-full max-w-4xl p-6 md:p-8 rounded-lg shadow-xl flex gap-6"
        style={{
          backgroundColor: COLORS.darkPanel,
          borderColor: COLORS.gold,
          borderWidth: "2px",
        }}
      >
        {/* Form Content */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center mb-6">
            <h2
              className="text-xl font-serif font-bold"
              style={{ color: COLORS.gold }}
            >
              Create Quest
            </h2>
            <button
              onClick={onClose}
              className="text-2xl leading-none"
              style={{ color: COLORS.gold }}
            >
              ✕
            </button>
          </div>

          {error && (
            <div
              className="px-3 py-2 mb-4 rounded-sm text-sm font-serif"
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

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label
                className="block text-sm uppercase tracking-wider mb-2 font-serif"
                style={{ color: COLORS.gold }}
              >
                Quest Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Clean Kitchen"
                className="w-full px-3 py-2 font-serif focus:outline-none focus:shadow-lg transition-all"
                style={{
                  backgroundColor: COLORS.black,
                  borderColor: COLORS.gold,
                  borderWidth: "2px",
                  color: COLORS.parchment,
                }}
                disabled={loading}
              />
            </div>

            <div className="mb-6">
              <label
                className="block text-sm uppercase tracking-wider mb-2 font-serif"
                style={{ color: COLORS.gold }}
              >
                Tags (Optional)
              </label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      if (selectedTags.includes(tag)) {
                        setSelectedTags(selectedTags.filter((t) => t !== tag));
                      } else {
                        setSelectedTags([...selectedTags, tag]);
                      }
                    }}
                    className="px-3 py-1 text-xs uppercase tracking-wider font-serif rounded transition-all"
                    style={{
                      backgroundColor: selectedTags.includes(tag)
                        ? COLORS.gold
                        : `rgba(212, 175, 55, 0.2)`,
                      color: selectedTags.includes(tag)
                        ? COLORS.darkPanel
                        : COLORS.gold,
                      border: `1px solid ${COLORS.gold}`,
                      cursor: loading ? "not-allowed" : "pointer",
                    }}
                    disabled={loading}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Skip AI Scribe Checkbox */}
            <div className="mb-6 flex items-center gap-2">
              <input
                type="checkbox"
                id="skipAI"
                checked={skipAI}
                onChange={(e) => setSkipAI(e.target.checked)}
                className="w-4 h-4"
                style={{ accentColor: COLORS.gold }}
                disabled={loading}
              />
              <label
                htmlFor="skipAI"
                className="text-xs uppercase tracking-wider font-serif"
                style={{
                  color: COLORS.gold,
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                Skip AI Scribe (testing)
              </label>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading || !title.trim()}
                className="flex-1 py-3 font-serif font-semibold text-sm uppercase tracking-wider transition-all duration-300"
                style={{
                  backgroundColor:
                    loading || !title.trim()
                      ? `rgba(212, 175, 55, 0.1)`
                      : `rgba(212, 175, 55, 0.2)`,
                  borderColor: COLORS.gold,
                  borderWidth: "2px",
                  color: COLORS.gold,
                  cursor: loading || !title.trim() ? "not-allowed" : "pointer",
                  opacity: loading || !title.trim() ? 0.5 : 1,
                }}
              >
                {loading ? "Creating..." : "Create Quest"}
              </button>
              <button
                type="button"
                onClick={handleRandomQuest}
                disabled={loading}
                className="py-3 px-4 font-serif font-semibold text-sm uppercase tracking-wider transition-all duration-300"
                style={{
                  backgroundColor: loading
                    ? `rgba(107, 95, 183, 0.1)`
                    : `rgba(107, 95, 183, 0.3)`,
                  borderColor: "#6b5fb7",
                  borderWidth: "2px",
                  color: "#9d84ff",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.5 : 1,
                }}
                title="Create a random test quest with pre-filled content"
              >
                Random
              </button>
            </div>
          </form>
        </div>

        {/* Steward Image - Right side (hidden on mobile/tablet) */}
        <div className="hidden xl:flex flex-shrink-0 items-center justify-center w-48">
          <img
            src={StewardImage}
            alt="The Steward"
            className="w-full h-auto object-contain"
            style={{ maxHeight: "500px" }}
          />
        </div>
      </div>

      {/* Edit Quest Modal */}
      {showEditModal && createdTemplateId && (
        <EditQuestModal
          templateId={createdTemplateId}
          token={token}
          skipAI={skipAI}
          onSave={() => {
            // After save, close and notify parent to refetch quests
            setShowEditModal(false);
            onQuestCreated();
            onClose();
          }}
          onClose={() => {
            setShowEditModal(false);
            onQuestCreated();
            onClose();
          }}
        />
      )}
    </div>
  );
}
