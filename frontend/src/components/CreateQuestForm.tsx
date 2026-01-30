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
  const [editingQuestId, setEditingQuestId] = useState<number | null>(null);
  const [templates, setTemplates] = useState<QuestTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<QuestTemplate | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Recurring quest fields
  const [recurrence, setRecurrence] = useState<"one-off" | "daily" | "weekly" | "monthly">(
    "one-off"
  );
  const [scheduleTime, setScheduleTime] = useState("08:00");
  const [scheduleDay, setScheduleDay] = useState<string>("monday");
  const [scheduleDayOfMonth, setScheduleDayOfMonth] = useState<number>(1);
  const [dueInHours, setDueInHours] = useState<string>("");

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
      // Create standalone quest (AI generates content in background)
      const quest = await api.quests.createAIScribe(
        {
          title: title.trim(),
          ...(selectedTags.length > 0 && { tags: selectedTags.join(",") }),
          xp_reward: 25,
          gold_reward: 15,
        },
        token,
        userId,
        skipAI
      );

      // Open EditQuestModal with quest
      setEditingQuestId(quest.id);
      setShowEditModal(true);

      // Reset form
      setTitle("");
      setSelectedTags([]);
      setDueDate("");
      setSkipAI(false);
      setRecurrence("one-off");
      setScheduleTime("08:00");
      setScheduleDay("monday");
      setScheduleDayOfMonth(1);
      setDueInHours("");
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
      // Create standalone quest with random sample data
      const quest = await api.quests.createRandom(token, userId);

      // Open EditQuestModal with quest
      setEditingQuestId(quest.id);
      setShowEditModal(true);
      setSkipAI(true);  // AI already populated by backend
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

    if (openEditModal) {
      // Open edit modal to customize before creating quest
      setCreatedTemplateId(selectedTemplate.id);
      setShowEditModal(true);
      setShowCreateMode(true);  // Flag to create quest on save
    } else {
      // Quick create - create quest immediately
      setLoading(true);
      setError(null);

      try {
        await api.quests.create({ quest_template_id: selectedTemplate.id }, token, userId);
        onQuestCreated();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create quest from template");
      } finally {
        setLoading(false);
      }
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

              {/* Recurrence Configuration */}
              <div className="mb-6">
                <label
                  className="block text-sm uppercase tracking-wider mb-2 font-serif"
                  style={{ color: COLORS.gold }}
                >
                  Recurrence
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                  {(["one-off", "daily", "weekly", "monthly"] as const).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setRecurrence(type)}
                      className="py-2 px-3 font-serif font-semibold text-xs uppercase tracking-wider transition-all"
                      style={{
                        backgroundColor:
                          recurrence === type ? COLORS.gold : `rgba(212, 175, 55, 0.2)`,
                        color: recurrence === type ? COLORS.darkPanel : COLORS.gold,
                        border: `2px solid ${COLORS.gold}`,
                        cursor: loading ? "not-allowed" : "pointer",
                      }}
                      disabled={loading}
                    >
                      {type === "one-off"
                        ? "One-off"
                        : type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Schedule Configuration */}
                {recurrence !== "one-off" && (
                  <div
                    className="space-y-3 p-3 rounded"
                    style={{
                      backgroundColor: `rgba(212, 175, 55, 0.1)`,
                      border: `1px solid ${COLORS.gold}`,
                    }}
                  >
                    {recurrence === "daily" && (
                      <div>
                        <label
                          className="block text-xs uppercase tracking-wider mb-1 font-serif"
                          style={{ color: COLORS.parchment }}
                        >
                          Time
                        </label>
                        <input
                          type="time"
                          value={scheduleTime}
                          onChange={e => setScheduleTime(e.target.value)}
                          className="w-full px-3 py-2 font-serif focus:outline-none transition-all"
                          style={{
                            backgroundColor: COLORS.black,
                            borderColor: COLORS.gold,
                            borderWidth: "2px",
                            color: COLORS.parchment,
                            colorScheme: "dark",
                          }}
                          disabled={loading}
                        />
                      </div>
                    )}

                    {recurrence === "weekly" && (
                      <>
                        <div>
                          <label
                            className="block text-xs uppercase tracking-wider mb-1 font-serif"
                            style={{ color: COLORS.parchment }}
                          >
                            Day of Week
                          </label>
                          <select
                            value={scheduleDay}
                            onChange={e => setScheduleDay(e.target.value)}
                            className="w-full px-3 py-2 font-serif focus:outline-none transition-all"
                            style={{
                              backgroundColor: COLORS.black,
                              borderColor: COLORS.gold,
                              borderWidth: "2px",
                              color: COLORS.parchment,
                            }}
                            disabled={loading}
                          >
                            {[
                              "monday",
                              "tuesday",
                              "wednesday",
                              "thursday",
                              "friday",
                              "saturday",
                              "sunday",
                            ].map(day => (
                              <option key={day} value={day}>
                                {day.charAt(0).toUpperCase() + day.slice(1)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label
                            className="block text-xs uppercase tracking-wider mb-1 font-serif"
                            style={{ color: COLORS.parchment }}
                          >
                            Time
                          </label>
                          <input
                            type="time"
                            value={scheduleTime}
                            onChange={e => setScheduleTime(e.target.value)}
                            className="w-full px-3 py-2 font-serif focus:outline-none transition-all"
                            style={{
                              backgroundColor: COLORS.black,
                              borderColor: COLORS.gold,
                              borderWidth: "2px",
                              color: COLORS.parchment,
                              colorScheme: "dark",
                            }}
                            disabled={loading}
                          />
                        </div>
                      </>
                    )}

                    {recurrence === "monthly" && (
                      <>
                        <div>
                          <label
                            className="block text-xs uppercase tracking-wider mb-1 font-serif"
                            style={{ color: COLORS.parchment }}
                          >
                            Day of Month
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="31"
                            value={scheduleDayOfMonth}
                            onChange={e => setScheduleDayOfMonth(parseInt(e.target.value) || 1)}
                            className="w-full px-3 py-2 font-serif focus:outline-none transition-all"
                            style={{
                              backgroundColor: COLORS.black,
                              borderColor: COLORS.gold,
                              borderWidth: "2px",
                              color: COLORS.parchment,
                            }}
                            disabled={loading}
                          />
                          <p
                            className="text-xs mt-1 font-serif italic"
                            style={{ color: COLORS.parchment }}
                          >
                            If day doesn't exist in month, uses last day
                          </p>
                        </div>
                        <div>
                          <label
                            className="block text-xs uppercase tracking-wider mb-1 font-serif"
                            style={{ color: COLORS.parchment }}
                          >
                            Time
                          </label>
                          <input
                            type="time"
                            value={scheduleTime}
                            onChange={e => setScheduleTime(e.target.value)}
                            className="w-full px-3 py-2 font-serif focus:outline-none transition-all"
                            style={{
                              backgroundColor: COLORS.black,
                              borderColor: COLORS.gold,
                              borderWidth: "2px",
                              color: COLORS.parchment,
                              colorScheme: "dark",
                            }}
                            disabled={loading}
                          />
                        </div>
                      </>
                    )}

                    {/* Optional Auto-Deadline */}
                    <div>
                      <label
                        className="block text-xs uppercase tracking-wider mb-1 font-serif"
                        style={{ color: COLORS.parchment }}
                      >
                        Auto-Deadline (Optional)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="8760"
                        value={dueInHours}
                        onChange={e => setDueInHours(e.target.value)}
                        placeholder="Hours until corruption"
                        className="w-full px-3 py-2 font-serif focus:outline-none transition-all"
                        style={{
                          backgroundColor: COLORS.black,
                          borderColor: COLORS.gold,
                          borderWidth: "2px",
                          color: COLORS.parchment,
                        }}
                        disabled={loading}
                      />
                      {dueInHours && parseInt(dueInHours) > 0 && (
                        <p
                          className="text-xs mt-1 font-serif italic"
                          style={{ color: COLORS.parchment }}
                        >
                          {parseInt(dueInHours) < 24
                            ? `${dueInHours} hours`
                            : `${Math.floor(parseInt(dueInHours) / 24)} days${parseInt(dueInHours) % 24 ? ` ${parseInt(dueInHours) % 24}h` : ""}`}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Due Date Field - only for one-off quests */}
              {recurrence === "one-off" && (
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
              )}

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
      {showEditModal && editingQuestId && (
        <EditQuestModal
          questId={editingQuestId}
          token={token}
          skipAI={skipAI}
          onSave={() => {
            setShowEditModal(false);
            setEditingQuestId(null);
            onQuestCreated();
            onClose();
          }}
          onClose={() => {
            setShowEditModal(false);
            setEditingQuestId(null);
            onClose();
          }}
        />
      )}
    </div>
  );
}
