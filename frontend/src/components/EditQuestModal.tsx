import { useState, useEffect, useCallback, ChangeEvent, FormEvent } from "react";
import { api } from "../services/api";
import { COLORS, PARCHMENT_STYLES } from "../constants/colors";
import type { QuestTemplate, QuestTemplateUpdateRequest, UserTemplateSubscription } from "../types/api";
import StewardImage from "../assets/thesteward.png";
import ParchmentTypeWriter from "./ParchmentTypeWriter";

const AVAILABLE_TAGS = ["Chores", "Learning", "Exercise", "Health", "Organization"];

interface EditQuestModalProps {
  templateId: number;
  token: string;
  skipAI: boolean;
  onSave?: (updated: QuestTemplate) => void;
  onClose?: () => void;
}

export default function EditQuestModal({
  templateId,
  token,
  skipAI,
  onSave,
  onClose,
}: EditQuestModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [time, setTime] = useState(2);
  const [effort, setEffort] = useState(2);
  const [dread, setDread] = useState(2);
  const [showTypeWriter, setShowTypeWriter] = useState(false);
  const [nameAnimationDone, setNameAnimationDone] = useState(false);
  const [subscription, setSubscription] = useState<UserTemplateSubscription | null>(null);
  const [originalRecurrence, setOriginalRecurrence] = useState<"one-off" | "daily" | "weekly" | "monthly">("one-off");

  // Recurring quest fields
  const [recurrence, setRecurrence] = useState<"one-off" | "daily" | "weekly" | "monthly">(
    "one-off"
  );
  const [scheduleTime, setScheduleTime] = useState("08:00");
  const [scheduleDay, setScheduleDay] = useState<string>("monday");
  const [scheduleDayOfMonth, setScheduleDayOfMonth] = useState<number>(1);
  const [dueInHours, setDueInHours] = useState<string>("");

  // Fetch template and wait for Groq to populate it (unless skipAI is true)
  useEffect(() => {
    const fetchTemplate = async () => {
      try {
        // Wait for Groq background task to complete (unless skipping AI)
        if (!skipAI) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }

        // Fetch the template
        const response = await api.quests.getTemplate(templateId, token);

        // Fetch user's subscriptions to see if they're subscribed to this template
        const subscriptions = await api.subscriptions.getAll(token);
        const userSubscription = subscriptions.find(sub => sub.quest_template_id === templateId);
        setSubscription(userSubscription || null);

        // Set form values from template
        setDisplayName(response.display_name || "");
        setDescription(response.description || "");

        // Parse tags
        if (response.tags) {
          const tags = response.tags.split(",").map(t => {
            const trimmed = t.trim();
            // Capitalize first letter to match AVAILABLE_TAGS
            return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
          });
          setSelectedTags(tags);
        }

        // Parse recurring quest settings - prefer subscription over template (Phase 3)
        const effectiveRecurrence = userSubscription ? userSubscription.recurrence : response.recurrence;
        const effectiveSchedule = userSubscription?.schedule || response.schedule;
        const effectiveDueInHours = userSubscription?.due_in_hours ?? response.due_in_hours;

        setRecurrence(effectiveRecurrence as "one-off" | "daily" | "weekly" | "monthly");
        setOriginalRecurrence(effectiveRecurrence as "one-off" | "daily" | "weekly" | "monthly");

        if (effectiveSchedule) {
          try {
            const schedule = JSON.parse(effectiveSchedule);
            if (schedule.time) setScheduleTime(schedule.time);
            if (schedule.day && typeof schedule.day === "string") setScheduleDay(schedule.day);
            if (schedule.day && typeof schedule.day === "number")
              setScheduleDayOfMonth(schedule.day);
          } catch (err) {
            console.error("Failed to parse schedule:", err);
          }
        }
        if (effectiveDueInHours) {
          setDueInHours(effectiveDueInHours.toString());
        }

        setLoading(false);
        // Show typewriter animation after loading completes and has content
        if (response.display_name || response.description) {
          setShowTypeWriter(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load template");
        setLoading(false);
      }
    };

    fetchTemplate();
  }, [templateId, token, skipAI]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);

    try {
      // Calculate XP/Gold based on sliders
      const baseXP = (time + effort + dread) * 2;
      const baseGold = Math.floor(baseXP / 2);

      // Build schedule JSON if recurring
      let schedule: string | null = null;
      if (recurrence !== "one-off") {
        if (recurrence === "daily") {
          schedule = JSON.stringify({ type: "daily", time: scheduleTime });
        } else if (recurrence === "weekly") {
          schedule = JSON.stringify({ type: "weekly", day: scheduleDay, time: scheduleTime });
        } else if (recurrence === "monthly") {
          schedule = JSON.stringify({
            type: "monthly",
            day: scheduleDayOfMonth,
            time: scheduleTime,
          });
        }
      }

      const updateData: QuestTemplateUpdateRequest = {
        ...(displayName.trim() && { display_name: displayName.trim() }),
        ...(description.trim() && { description: description.trim() }),
        ...(selectedTags.length > 0 && {
          tags: selectedTags.join(",").toLowerCase(),
        }),
        xp_reward: baseXP,
        gold_reward: baseGold,
        recurrence: recurrence,
        schedule: schedule,
        due_in_hours: dueInHours ? parseInt(dueInHours) : null,
      };

      const updated = await api.quests.updateTemplate(templateId, updateData, token);

      // Handle subscription changes (Phase 3)
      if (originalRecurrence === "one-off" && recurrence !== "one-off") {
        // Changed from one-off to recurring - create subscription
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
        // Changed from recurring to one-off - delete subscription
        if (subscription) {
          await api.subscriptions.delete(subscription.id, token);
        }
      } else if (recurrence !== "one-off" && subscription) {
        // Still recurring - update subscription
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

      onSave?.(updated);
      onClose?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setSaving(false);
    }
  }, [
    time,
    effort,
    dread,
    displayName,
    description,
    selectedTags,
    recurrence,
    scheduleTime,
    scheduleDay,
    scheduleDayOfMonth,
    dueInHours,
    templateId,
    token,
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
                Scribe Quest Details
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
                The Scribe is weaving your quest...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
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
                        disabled={saving}
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
                  {saving ? "Saving..." : "Save Quest"}
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
