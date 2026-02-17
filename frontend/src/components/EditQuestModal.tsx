import { useState, useEffect, useCallback, ChangeEvent, FormEvent } from "react";
import { api } from "../services/api";
import { COLORS, PARCHMENT_STYLES } from "../constants/colors";
import type { Quest, UserTemplateSubscription } from "../types/api";
import StewardImage from "../assets/thesteward.png";
import ParchmentTypeWriter from "./ParchmentTypeWriter";
import { useAuth } from "../contexts/AuthContext";
import { buildSchedule, parseSchedule, type QuestRecurrence } from "../utils/schedule";
import {
  buildStandaloneQuestUpdateData,
  deriveDifficultySlidersFromXP,
  getEditQuestModalLabels,
  toDueInHoursStateValue,
} from "./editQuestModalHelpers";

const AVAILABLE_TAGS = ["Chores", "Learning", "Exercise", "Health", "Organization"];

interface TemplateInitialData {
  title: string;
  display_name?: string;
  description?: string;
  tags?: string;
  xp_reward?: number;
  gold_reward?: number;
  recurrence?: string;
  schedule?: string;
  due_in_hours?: number;
}

interface EditQuestModalProps {
  // Edit existing quest (fetch by ID)
  questId?: number;
  // From template - review & edit before creating quest
  templateId?: number;
  // Random quest - initial data before creating quest
  initialData?: TemplateInitialData;

  token: string;
  skipAI: boolean;
  createQuestOnSave?: boolean;  // If true, creates quest on save (for template/initialData modes)
  onSave?: (result: { createdQuest: boolean; updatedTemplateDefaults: boolean }) => void;
  onClose?: () => void;
}

export default function EditQuestModal({
  questId,
  templateId,
  initialData,
  token,
  skipAI,
  createQuestOnSave = false,
  onSave,
  onClose,
}: EditQuestModalProps) {
  const isCreateMode = !!initialData;
  const isTemplateDefaultsMode = !!templateId && !createQuestOnSave;
  const modalLabels = getEditQuestModalLabels({
    hasTemplateId: !!templateId,
    isCreateMode,
    hasQuestId: !!questId,
  });
  const { userId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quest, setQuest] = useState<Quest | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [time, setTime] = useState(2);
  const [effort, setEffort] = useState(2);
  const [dread, setDread] = useState(2);
  const [showTypeWriter, setShowTypeWriter] = useState(false);
  const [nameAnimationDone, setNameAnimationDone] = useState(false);
  const [subscription, setSubscription] = useState<UserTemplateSubscription | null>(null);
  const [originalRecurrence, setOriginalRecurrence] = useState<QuestRecurrence>("one-off");
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);

  // Recurring quest fields
  const [recurrence, setRecurrence] = useState<QuestRecurrence>(
    "one-off"
  );
  const [scheduleTime, setScheduleTime] = useState("08:00");
  const [scheduleDay, setScheduleDay] = useState<string>("monday");
  const [scheduleDayOfMonth, setScheduleDayOfMonth] = useState<number>(1);
  const [dueInHours, setDueInHours] = useState<string>("");

  // Load data based on mode
  useEffect(() => {
    const loadData = async () => {
      try {
        if (isCreateMode) {
          // CREATE MODE (Random): Use provided initial data
          setDisplayName(initialData.display_name || "");
          setDescription(initialData.description || "");

          // Parse tags
          if (initialData.tags) {
            const tags = initialData.tags.split(",").map(t => {
              const trimmed = t.trim();
              return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
            });
            setSelectedTags(tags);
          }
          const createModeSliders = deriveDifficultySlidersFromXP(initialData.xp_reward);
          setTime(createModeSliders.time);
          setEffort(createModeSliders.effort);
          setDread(createModeSliders.dread);
          setDueInHours(toDueInHoursStateValue(initialData.due_in_hours));

          setLoading(false);
          if (initialData.display_name || initialData.description) {
            setShowTypeWriter(true);
          }
        } else if (templateId) {
          // FROM TEMPLATE MODE: Fetch template to review before creating quest
          if (!skipAI) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }

          const response = await api.quests.getTemplate(templateId, token);

          // Fetch user's subscriptions
          const subscriptions = await api.subscriptions.getAll(token);
          const userSubscription = subscriptions.find(sub => sub.quest_template_id === templateId);
          setSubscription(userSubscription || null);

          setDisplayName(response.display_name || "");
          setDescription(response.description || "");

          if (response.tags) {
            const tags = response.tags.split(",").map(t => {
              const trimmed = t.trim();
              return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
            });
            setSelectedTags(tags);
          }
          const templateSliders = deriveDifficultySlidersFromXP(response.xp_reward);
          setTime(templateSliders.time);
          setEffort(templateSliders.effort);
          setDread(templateSliders.dread);

          // Use subscription schedule if available (Phase 3)
          const effectiveRecurrence = userSubscription ? userSubscription.recurrence : response.recurrence;
          const effectiveSchedule = userSubscription?.schedule || response.schedule;
          const effectiveDueInHours = userSubscription?.due_in_hours ?? response.due_in_hours;

          setRecurrence(effectiveRecurrence as QuestRecurrence);
          setOriginalRecurrence(effectiveRecurrence as QuestRecurrence);

          const parsedSchedule = parseSchedule(effectiveSchedule);
          if (parsedSchedule) {
            if (parsedSchedule.time) setScheduleTime(parsedSchedule.time);
            if ("day" in parsedSchedule && typeof parsedSchedule.day === "string") {
              setScheduleDay(parsedSchedule.day);
            }
            if ("day" in parsedSchedule && typeof parsedSchedule.day === "number") {
              setScheduleDayOfMonth(parsedSchedule.day);
            }
          }
          setDueInHours(toDueInHoursStateValue(effectiveDueInHours));

          setLoading(false);
          if (response.display_name || response.description) {
            setShowTypeWriter(true);
          }
        } else if (questId) {
          // EDIT QUEST MODE: Fetch quest by ID
          if (!skipAI) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }

          const response = await api.quests.getQuest(questId, token);

          setDisplayName(response.display_name || "");
          setDescription(response.description || "");

          if (response.tags) {
            const tags = response.tags.split(",").map(t => {
              const trimmed = t.trim();
              return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
            });
            setSelectedTags(tags);
          }
          const editModeSliders = deriveDifficultySlidersFromXP(response.xp_reward);
          setTime(editModeSliders.time);
          setEffort(editModeSliders.effort);
          setDread(editModeSliders.dread);

          setRecurrence(response.recurrence as QuestRecurrence);
          setOriginalRecurrence(response.recurrence as QuestRecurrence);

          const parsedSchedule = parseSchedule(response.schedule);
          if (parsedSchedule) {
            if (parsedSchedule.time) setScheduleTime(parsedSchedule.time);
            if ("day" in parsedSchedule && typeof parsedSchedule.day === "string") {
              setScheduleDay(parsedSchedule.day);
            }
            if ("day" in parsedSchedule && typeof parsedSchedule.day === "number") {
              setScheduleDayOfMonth(parsedSchedule.day);
            }
          }
          setDueInHours(toDueInHoursStateValue(response.due_in_hours));

          setQuest(response);
          setLoading(false);

          if (response.display_name || response.description) {
            setShowTypeWriter(true);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
        setLoading(false);
      }
    };

    loadData();
  }, [questId, templateId, initialData, token, skipAI, isCreateMode]);

  const handleSave = useCallback(async (options?: { createQuestAfterTemplateSave?: boolean }) => {
    const createQuestAfterTemplateSave = options?.createQuestAfterTemplateSave ?? false;
    setSaving(true);
    setError(null);

    try {
      // Calculate XP/Gold based on sliders
      const baseXP = (time + effort + dread) * 2;
      const baseGold = Math.floor(baseXP / 2);

      // Build schedule JSON if needed
      const schedule = buildSchedule(recurrence, scheduleTime, scheduleDay, scheduleDayOfMonth);

      if (createQuestOnSave) {
        // CREATE QUEST MODE (From Template or Random with initialData)
        if (userId === null) {
          throw new Error("User ID not found in session");
        }

        if (isCreateMode) {
          // Random quest with initialData - create standalone quest
          const questData = {
            title: initialData!.title,
            ...(displayName.trim() && { display_name: displayName.trim() }),
            ...(description.trim() && { description: description.trim() }),
            ...(selectedTags.length > 0 && { tags: selectedTags.join(",").toLowerCase() }),
            xp_reward: baseXP,
            gold_reward: baseGold,
            ...(dueInHours && { due_in_hours: parseInt(dueInHours) }),
          };

          const createdQuest = await api.quests.createAIScribe(questData, token, userId, true); // skip_ai=true

          // Convert to template if checkbox checked
          if (saveAsTemplate) {
            await api.quests.convertToTemplate(
              createdQuest.id,
              {
                recurrence: recurrence,
                schedule: schedule,
                due_in_hours: dueInHours ? parseInt(dueInHours) : null,
              },
              token
            );
          }
        } else if (templateId) {
          // From template create mode - create quest from current template defaults
          await api.quests.create(
            { quest_template_id: templateId },
            token,
            userId
          );
        }

        onSave?.({ createdQuest: true, updatedTemplateDefaults: false });
        // Don't call onClose - parent's onSave callback handles closing
      } else if (templateId) {
        // EDIT TEMPLATE MODE: Update template and subscriptions
        const updateData = {
          ...(displayName.trim() && { display_name: displayName.trim() }),
          ...(description.trim() && { description: description.trim() }),
          ...(selectedTags.length > 0 && { tags: selectedTags.join(",").toLowerCase() }),
          xp_reward: baseXP,
          gold_reward: baseGold,
          recurrence: recurrence,
          schedule: schedule,
          due_in_hours: dueInHours ? parseInt(dueInHours) : null,
        };

        await api.quests.updateTemplate(templateId, updateData, token);

        // Handle subscription changes
        if (originalRecurrence === "one-off" && recurrence !== "one-off") {
          // Create subscription
          await api.subscriptions.create(
            {
              quest_template_id: templateId,
              recurrence: recurrence,
              ...(schedule && { schedule }),
              ...(dueInHours && { due_in_hours: parseInt(dueInHours) }),
            },
            token
          );
        } else if (originalRecurrence !== "one-off" && recurrence === "one-off") {
          // Delete subscription
          if (subscription) {
            await api.subscriptions.delete(subscription.id, token);
          }
        } else if (recurrence !== "one-off" && subscription) {
          // Update subscription
          await api.subscriptions.update(
            subscription.id,
            {
              recurrence: recurrence,
              schedule: schedule,
              due_in_hours: dueInHours ? parseInt(dueInHours) : null,
            },
            token
          );
        }

        if (createQuestAfterTemplateSave) {
          if (userId === null) {
            throw new Error("User ID not found in session");
          }
          await api.quests.create({ quest_template_id: templateId }, token, userId);
        }

        onSave?.({
          createdQuest: createQuestAfterTemplateSave,
          updatedTemplateDefaults: true,
        });
        // Don't call onClose - parent's onSave callback handles closing
      } else if (quest) {
        // EDIT QUEST MODE: Update existing quest
        const updateData = buildStandaloneQuestUpdateData({
          displayName,
          description,
          selectedTags,
          baseXP,
          baseGold,
          dueInHours,
        });

        await api.quests.update(quest.id, updateData, token);

        // Convert to template if checkbox checked
        if (saveAsTemplate && quest.quest_template_id === null) {
          const conversionData = {
            recurrence: recurrence,
            schedule: schedule,
            due_in_hours: dueInHours ? parseInt(dueInHours) : null,
          };
          console.log("Converting to template with data:", conversionData);
          console.log("dueInHours state:", dueInHours);
          await api.quests.convertToTemplate(quest.id, conversionData, token);
        }

        onSave?.({ createdQuest: false, updatedTemplateDefaults: false });
        // Don't call onClose - parent's onSave callback handles closing
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [
    quest,
    createQuestOnSave,
    isCreateMode,
    initialData,
    templateId,
    subscription,
    originalRecurrence,
    time,
    effort,
    dread,
    displayName,
    description,
    selectedTags,
    saveAsTemplate,
    recurrence,
    scheduleTime,
    scheduleDay,
    scheduleDayOfMonth,
    dueInHours,
    token,
    userId,
    onSave,
    onClose,
  ]);

  const xp = (time + effort + dread) * 2;
  const gold = Math.floor(xp / 2);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!saving && !loading) {
      handleSave();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        className="w-full max-w-4xl p-6 md:p-8 rounded-lg shadow-xl max-h-[90vh] overflow-y-auto flex gap-6"
        style={{
          backgroundColor: COLORS.darkPanel,
          borderColor: COLORS.gold,
          borderWidth: "2px",
        }}
      >
        {/* Form Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-serif font-bold" style={{ color: COLORS.gold }}>
                {modalLabels.title}
              </h2>
              <button
                onClick={onClose}
                className="text-2xl leading-none"
                style={{ color: COLORS.gold }}
                disabled={loading || saving}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Error */}
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

          {/* Loading State */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin mb-4">
                <div
                  className="w-12 h-12 border-4 rounded-full"
                  style={{
                    borderColor: COLORS.gold,
                    borderTopColor: "transparent",
                  }}
                />
              </div>
              <p className="text-center font-serif" style={{ color: COLORS.brown }}>
                {templateId ? "Loading template..." : questId ? "Loading quest..." : "The Scribe is weaving your quest..."}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {/* Template Info Badge (for templated quests) */}
              {quest && quest.quest_template_id !== null && (
                <div
                  className="mb-4 px-3 py-2 rounded text-sm font-serif"
                  style={{
                    backgroundColor: `rgba(212, 175, 55, 0.1)`,
                    borderColor: COLORS.gold,
                    borderWidth: "1px",
                    color: COLORS.parchment,
                  }}
                >
                  📜 From template: {quest.template?.display_name || quest.template?.title || "Unknown"}
                  <div className="text-xs mt-1 italic">
                    Changes only affect this quest. To edit template/schedule, go to template management.
                  </div>
                </div>
              )}

              {isTemplateDefaultsMode && (
                <div
                  className="mb-4 px-3 py-2 rounded text-sm font-serif"
                  style={{
                    backgroundColor: `rgba(212, 175, 55, 0.1)`,
                    borderColor: COLORS.gold,
                    borderWidth: "1px",
                    color: COLORS.parchment,
                  }}
                >
                  Updating template defaults. Changes affect future template-based quests.
                </div>
              )}

              {/* Display Name */}
              <div className="mb-6">
                <label
                  className="block text-sm uppercase tracking-wider mb-2 font-serif"
                  style={{ color: COLORS.gold }}
                >
                  Quest Name (Fantasy)
                </label>
                {showTypeWriter ? (
                  <div
                    onClick={() => setShowTypeWriter(false)}
                    title="Click to skip animation"
                    className="cursor-pointer"
                  >
                    <ParchmentTypeWriter
                      text={displayName}
                      speed={30}
                      delay={200}
                      onComplete={() => setNameAnimationDone(true)}
                    />
                  </div>
                ) : (
                  <div
                    className="w-full rounded"
                    style={{
                      backgroundColor: PARCHMENT_STYLES.backgroundColor,
                      backgroundImage: PARCHMENT_STYLES.backgroundImage,
                      border: `2px solid ${PARCHMENT_STYLES.borderColor}`,
                      boxShadow: PARCHMENT_STYLES.boxShadow,
                    }}
                  >
                    <input
                      type="text"
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      placeholder="e.g., The Cookery Cleanup"
                      className="w-full px-3 py-2 font-serif focus:outline-none transition-all"
                      style={{
                        backgroundColor: "transparent",
                        border: "none",
                        color: PARCHMENT_STYLES.textColor,
                        fontFamily: "Georgia, serif",
                      }}
                      disabled={saving}
                    />
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="mb-6">
                <label
                  className="block text-sm uppercase tracking-wider mb-2 font-serif"
                  style={{ color: COLORS.gold }}
                >
                  Description
                </label>
                {showTypeWriter && nameAnimationDone ? (
                  <div
                    onClick={() => setShowTypeWriter(false)}
                    title="Click to skip animation"
                    className="cursor-pointer"
                  >
                    <ParchmentTypeWriter
                      text={description}
                      speed={40}
                      delay={200}
                      onComplete={() => setShowTypeWriter(false)}
                    />
                  </div>
                ) : showTypeWriter ? (
                  <div
                    className="p-6 rounded"
                    style={{
                      backgroundColor: PARCHMENT_STYLES.backgroundColor,
                      backgroundImage: PARCHMENT_STYLES.backgroundImage,
                      border: `2px solid ${PARCHMENT_STYLES.borderColor}`,
                      minHeight: "100px",
                      boxShadow: PARCHMENT_STYLES.boxShadow,
                    }}
                  />
                ) : (
                  <div
                    className="w-full rounded"
                    style={{
                      backgroundColor: PARCHMENT_STYLES.backgroundColor,
                      backgroundImage: PARCHMENT_STYLES.backgroundImage,
                      border: `2px solid ${PARCHMENT_STYLES.borderColor}`,
                      boxShadow: PARCHMENT_STYLES.boxShadow,
                    }}
                  >
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="e.g., Vanquish the grimy counters and slay the sink dragon."
                      rows={3}
                      className="w-full px-3 py-2 font-serif focus:outline-none transition-all"
                      style={{
                        backgroundColor: "transparent",
                        border: "none",
                        color: PARCHMENT_STYLES.textColor,
                        fontFamily: "Georgia, serif",
                        resize: "none",
                      }}
                      disabled={saving}
                    />
                  </div>
                )}
              </div>

              {/* Tags */}
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
                        cursor: saving ? "not-allowed" : "pointer",
                      }}
                      disabled={saving}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Corruption Timer - always visible */}
              <div className="mb-6">
                <label
                  className="block text-sm uppercase tracking-wider mb-2 font-serif"
                  style={{ color: COLORS.gold }}
                >
                  Corruption Timer
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "None", hours: 0 },
                    { label: "1 Day", hours: 24 },
                    { label: "3 Days", hours: 72 },
                    { label: "7 Days", hours: 168 },
                    { label: "1 Month", hours: 720 },
                  ].map(option => (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => setDueInHours(option.hours > 0 ? option.hours.toString() : "")}
                      className="px-3 py-1.5 text-xs uppercase tracking-wider font-serif rounded transition-all"
                      style={{
                        backgroundColor:
                          (option.hours === 0 && !dueInHours) ||
                          parseInt(dueInHours || "0") === option.hours
                            ? COLORS.gold
                            : `rgba(212, 175, 55, 0.2)`,
                        color:
                          (option.hours === 0 && !dueInHours) ||
                          parseInt(dueInHours || "0") === option.hours
                            ? COLORS.darkPanel
                            : COLORS.gold,
                        border: `1px solid ${COLORS.gold}`,
                        cursor: saving ? "not-allowed" : "pointer",
                      }}
                      disabled={saving}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {dueInHours && parseInt(dueInHours) > 0 && (
                  <p
                    className="text-xs mt-2 font-serif italic"
                    style={{ color: COLORS.parchment }}
                  >
                    Quest will corrupt if not completed within {parseInt(dueInHours)} hours
                  </p>
                )}
              </div>

              {/* Template Conversion (for standalone quests and new quest creation) */}
              {((quest && quest.quest_template_id === null) || isCreateMode) && !templateId && (
                <div className="mb-6">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={saveAsTemplate}
                      onChange={e => setSaveAsTemplate(e.target.checked)}
                      className="w-4 h-4"
                      style={{ accentColor: COLORS.gold }}
                      disabled={saving}
                    />
                    <span
                      className="text-sm uppercase tracking-wider font-serif"
                      style={{ color: COLORS.gold }}
                    >
                      Save as reusable template
                    </span>
                  </label>
                  {saveAsTemplate && (
                    <p className="text-xs mt-1 font-serif italic" style={{ color: COLORS.parchment }}>
                      Template can be reused and scheduled for recurring quests
                    </p>
                  )}
                </div>
              )}

              {/* Recurrence Configuration */}
              {/* Show when: (1) editing template defaults, or (2) standalone quest with save-as-template */}
              {(isTemplateDefaultsMode || saveAsTemplate) && !(quest && quest.quest_template_id !== null) && (
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
                        cursor: saving ? "not-allowed" : "pointer",
                      }}
                      disabled={saving}
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
                          disabled={saving}
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
                            disabled={saving}
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
                            disabled={saving}
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
                            disabled={saving}
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
                            disabled={saving}
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
              )}

              {/* Sliders */}
              <div
                className="mb-6 p-4 rounded-lg"
                style={{
                  backgroundColor: `rgba(212, 175, 55, 0.1)`,
                  borderColor: COLORS.gold,
                  borderWidth: "1px",
                }}
              >
                <h3
                  className="text-sm uppercase tracking-wider mb-4 font-serif"
                  style={{ color: COLORS.gold }}
                >
                  Difficulty Assessment
                </h3>

                {/* Time Slider */}
                <div className="mb-4">
                  <label
                    className="block text-xs uppercase tracking-wider mb-2 font-serif"
                    style={{ color: COLORS.parchment }}
                  >
                    Time: {time}/5 (1=Quick, 5=Long)
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={time}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setTime(parseInt(e.target.value))
                    }
                    className="w-full"
                    disabled={saving}
                    style={{ accentColor: COLORS.gold }}
                  />
                </div>

                {/* Effort Slider */}
                <div className="mb-4">
                  <label
                    className="block text-xs uppercase tracking-wider mb-2 font-serif"
                    style={{ color: COLORS.parchment }}
                  >
                    Effort: {effort}/5 (1=Easy, 5=Hard)
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={effort}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setEffort(parseInt(e.target.value))
                    }
                    className="w-full"
                    disabled={saving}
                    style={{ accentColor: COLORS.gold }}
                  />
                </div>

                {/* Dread Slider */}
                <div className="mb-4">
                  <label
                    className="block text-xs uppercase tracking-wider mb-2 font-serif"
                    style={{ color: COLORS.parchment }}
                  >
                    Dread: {dread}/5 (1=Love it, 5=Hate it)
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={dread}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setDread(parseInt(e.target.value))
                    }
                    className="w-full"
                    disabled={saving}
                    style={{ accentColor: COLORS.gold }}
                  />
                </div>
              </div>

              {/* Rewards Preview */}
              <div
                className="grid grid-cols-2 gap-4 mb-6 p-4 rounded-lg"
                style={{ backgroundColor: `rgba(212, 175, 55, 0.1)` }}
              >
                <div className="text-center">
                  <div
                    className="text-xs uppercase tracking-wider mb-1 font-serif"
                    style={{ color: COLORS.brown }}
                  >
                    XP Reward
                  </div>
                  <div className="text-2xl font-serif font-bold" style={{ color: COLORS.gold }}>
                    {xp}
                  </div>
                </div>
                <div className="text-center">
                  <div
                    className="text-xs uppercase tracking-wider mb-1 font-serif"
                    style={{ color: COLORS.brown }}
                  >
                    Gold Reward
                  </div>
                  <div className="text-2xl font-serif font-bold" style={{ color: COLORS.gold }}>
                    {gold}
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="flex-1 py-3 font-serif font-semibold text-sm uppercase tracking-wider transition-all"
                  style={{
                    backgroundColor: `rgba(212, 175, 55, 0.1)`,
                    borderColor: COLORS.gold,
                    borderWidth: "2px",
                    color: COLORS.gold,
                    cursor: saving ? "not-allowed" : "pointer",
                    opacity: saving ? 0.5 : 1,
                  }}
                >
                  Cancel
                </button>
                {isTemplateDefaultsMode && (
                  <button
                    type="button"
                    onClick={() => handleSave({ createQuestAfterTemplateSave: true })}
                    disabled={saving}
                    className="flex-1 py-3 font-serif font-semibold text-sm uppercase tracking-wider transition-all"
                    style={{
                      backgroundColor: saving ? `rgba(56, 189, 248, 0.1)` : `rgba(56, 189, 248, 0.25)`,
                      borderColor: "#38bdf8",
                      borderWidth: "2px",
                      color: "#bae6fd",
                      cursor: saving ? "not-allowed" : "pointer",
                      opacity: saving ? 0.5 : 1,
                    }}
                  >
                    {saving ? "Saving..." : "Save Defaults & Create Quest"}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 font-serif font-semibold text-sm uppercase tracking-wider transition-all"
                  style={{
                    backgroundColor: saving ? `rgba(212, 175, 55, 0.1)` : `rgba(212, 175, 55, 0.2)`,
                    borderColor: COLORS.gold,
                    borderWidth: "2px",
                    color: COLORS.gold,
                    cursor: saving ? "not-allowed" : "pointer",
                    opacity: saving ? 0.5 : 1,
                  }}
                >
                  {saving ? "Saving..." : modalLabels.submitLabel}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Steward Image - Right side (hidden on mobile/tablet) */}
        <div className="hidden lg:flex flex-shrink-0 items-center justify-center w-48">
          <img
            src={StewardImage}
            alt="The Steward"
            className="w-full h-auto object-contain"
            style={{ maxHeight: "600px" }}
          />
        </div>
      </div>
    </div>
  );
}
