import { useState, FormEvent, useEffect } from "react";
import { api } from "../services/api";
import { COLORS } from "../constants/colors";
import { getRandomSampleQuest } from "../constants/sampleQuests";
import EditQuestModal from "./EditQuestModal";
import StewardImage from "../assets/thesteward.png";
import SearchableSelect from "./SearchableSelect";
import type { QuestTemplate } from "../types/api";

const AVAILABLE_TAGS = ["Chores", "Learning", "Exercise", "Health", "Organization"];

type CreationMode = "ai-scribe" | "random" | "from-template";

interface CreateQuestFormProps {
  token: string;
  onQuestCreated: () => void;
  onClose: () => void;
}

export default function CreateQuestForm({ token, onQuestCreated, onClose }: CreateQuestFormProps) {
  const [mode, setMode] = useState<CreationMode>("ai-scribe");
  const [title, setTitle] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skipAI, setSkipAI] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [createdTemplateId, setCreatedTemplateId] = useState<number | null>(null);
  const [templates, setTemplates] = useState<QuestTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<QuestTemplate | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Fetch templates on mount
  useEffect(() => {
    const fetchTemplates = async () => {
      setLoadingTemplates(true);
      try {
        const fetchedTemplates = await api.quests.getAllTemplates(token);
        setTemplates(fetchedTemplates);
      } catch (err) {
        console.error("Failed to fetch templates:", err);
      } finally {
        setLoadingTemplates(false);
      }
    };

    fetchTemplates();
  }, [token]);

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
          ...(dueDate && { due_date: new Date(dueDate).toISOString() }),
        },
        token,
        userId
      );

      // Open edit modal instead of closing immediately
      setCreatedTemplateId(newTemplate.id);
      setShowEditModal(true);
      setTitle("");
      setSelectedTags([]);
      setDueDate("");
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
      await api.quests.create({ quest_template_id: newTemplate.id }, token, userId);

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

  const handleCreateFromTemplate = async (openEditModal: boolean) => {
    if (!selectedTemplate) return;

    const userId = parseInt(localStorage.getItem("userId") || "");
    if (!userId) {
      setError("User ID not found in session");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create quest instance from selected template
      await api.quests.create({ quest_template_id: selectedTemplate.id }, token, userId);

      if (openEditModal) {
        // Open edit modal to review/adjust before finalizing
        setCreatedTemplateId(selectedTemplate.id);
        setShowEditModal(true);
      } else {
        // Quick create - close modal and notify parent
        onQuestCreated();
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create quest from template");
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
            <h2 className="text-xl font-serif font-bold" style={{ color: COLORS.gold }}>
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

          {/* Mode Selection */}
          <div className="flex gap-2 mb-6">
            <button
              type="button"
              onClick={() => {
                setMode("ai-scribe");
                setSelectedTemplate(null);
                setError(null);
              }}
              className="flex-1 py-2 px-3 font-serif font-semibold text-xs uppercase tracking-wider transition-all"
              style={{
                backgroundColor:
                  mode === "ai-scribe" ? `rgba(212, 175, 55, 0.3)` : `rgba(212, 175, 55, 0.1)`,
                borderColor: COLORS.gold,
                borderWidth: "2px",
                color: COLORS.gold,
                opacity: mode === "ai-scribe" ? 1 : 0.6,
              }}
            >
              AI Scribe
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("from-template");
                setTitle("");
                setSelectedTags([]);
                setError(null);
              }}
              className="flex-1 py-2 px-3 font-serif font-semibold text-xs uppercase tracking-wider transition-all"
              style={{
                backgroundColor:
                  mode === "from-template" ? `rgba(212, 175, 55, 0.3)` : `rgba(212, 175, 55, 0.1)`,
                borderColor: COLORS.gold,
                borderWidth: "2px",
                color: COLORS.gold,
                opacity: mode === "from-template" ? 1 : 0.6,
              }}
            >
              From Template
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

          {mode === "ai-scribe" && (
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
                  onChange={e => setTitle(e.target.value)}
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
                  {AVAILABLE_TAGS.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        if (selectedTags.includes(tag)) {
                          setSelectedTags(selectedTags.filter(t => t !== tag));
                        } else {
                          setSelectedTags([...selectedTags, tag]);
                        }
                      }}
                      className="px-3 py-1 text-xs uppercase tracking-wider font-serif rounded transition-all"
                      style={{
                        backgroundColor: selectedTags.includes(tag)
                          ? COLORS.gold
                          : `rgba(212, 175, 55, 0.2)`,
                        color: selectedTags.includes(tag) ? COLORS.darkPanel : COLORS.gold,
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

              {/* Due Date Field */}
              <div className="mb-6">
                <label
                  className="block text-sm uppercase tracking-wider mb-2 font-serif"
                  style={{ color: COLORS.gold }}
                >
                  Due Date (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 font-serif focus:outline-none focus:shadow-lg transition-all"
                  style={{
                    backgroundColor: COLORS.black,
                    borderColor: COLORS.gold,
                    borderWidth: "2px",
                    color: COLORS.parchment,
                    colorScheme: "dark",
                  }}
                  disabled={loading}
                />
                <p className="text-xs mt-1 font-serif italic" style={{ color: COLORS.parchment }}>
                  Quest will become corrupted (1.5x rewards) if not completed by this time
                </p>
              </div>

              {/* Skip AI Scribe Checkbox */}
              <div className="mb-6 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="skipAI"
                  checked={skipAI}
                  onChange={e => setSkipAI(e.target.checked)}
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
          )}

          {mode === "from-template" && (
            <div className="flex flex-col h-[500px]">
              {loadingTemplates ? (
                <div
                  className="flex items-center justify-center h-full text-sm font-serif"
                  style={{ color: COLORS.gold }}
                >
                  Loading templates...
                </div>
              ) : (
                <>
                  <SearchableSelect<QuestTemplate>
                    items={templates}
                    onSelect={template => setSelectedTemplate(template)}
                    searchFields={["title", "display_name", "description"]}
                    placeholder="Search templates by name, description..."
                    emptyMessage="No templates found. Create some quests first!"
                    renderItem={(template, isHighlighted) => (
                      <div
                        className="p-4 transition-all"
                        style={{
                          backgroundColor:
                            selectedTemplate?.id === template.id
                              ? `rgba(212, 175, 55, 0.25)`
                              : isHighlighted
                                ? `rgba(212, 175, 55, 0.1)`
                                : "transparent",
                        }}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <h3 className="font-serif font-bold" style={{ color: COLORS.gold }}>
                              {template.display_name || template.title}
                            </h3>
                            {template.display_name && template.title !== template.display_name && (
                              <div
                                className="text-xs font-serif italic mt-1"
                                style={{ color: COLORS.goldDarker }}
                              >
                                {template.title}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2 ml-4">
                            <span
                              className="text-xs font-serif px-2 py-1"
                              style={{
                                color: "#9d84ff",
                                backgroundColor: "rgba(107, 95, 183, 0.2)",
                                border: "1px solid #6b5fb7",
                              }}
                            >
                              {template.xp_reward} XP
                            </span>
                            <span
                              className="text-xs font-serif px-2 py-1"
                              style={{
                                color: COLORS.gold,
                                backgroundColor: "rgba(212, 175, 55, 0.2)",
                                border: `1px solid ${COLORS.gold}`,
                              }}
                            >
                              {template.gold_reward} Gold
                            </span>
                          </div>
                        </div>
                        {template.description && (
                          <p
                            className="text-xs font-serif mb-2 line-clamp-2"
                            style={{ color: COLORS.parchment }}
                          >
                            {template.description}
                          </p>
                        )}
                        {template.tags && (
                          <div className="flex flex-wrap gap-1">
                            {template.tags.split(",").map((tag, idx) => (
                              <span
                                key={idx}
                                className="text-xs font-serif px-2 py-0.5"
                                style={{
                                  color: COLORS.goldDarker,
                                  backgroundColor: "rgba(212, 175, 55, 0.1)",
                                  border: `1px solid ${COLORS.goldDarker}`,
                                }}
                              >
                                {tag.trim()}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  />

                  {/* Action buttons for selected template */}
                  {selectedTemplate && (
                    <div className="flex gap-3 mt-4">
                      <button
                        type="button"
                        onClick={() => handleCreateFromTemplate(false)}
                        disabled={loading}
                        className="flex-1 py-3 font-serif font-semibold text-sm uppercase tracking-wider transition-all duration-300"
                        style={{
                          backgroundColor: loading
                            ? `rgba(212, 175, 55, 0.1)`
                            : `rgba(212, 175, 55, 0.2)`,
                          borderColor: COLORS.gold,
                          borderWidth: "2px",
                          color: COLORS.gold,
                          cursor: loading ? "not-allowed" : "pointer",
                          opacity: loading ? 0.5 : 1,
                        }}
                      >
                        {loading ? "Creating..." : "Create Quest"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCreateFromTemplate(true)}
                        disabled={loading}
                        className="flex-1 py-3 font-serif font-semibold text-sm uppercase tracking-wider transition-all duration-300"
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
                      >
                        Review & Edit
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
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
