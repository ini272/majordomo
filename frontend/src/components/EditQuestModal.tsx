import { useState, useEffect, useCallback, ChangeEvent, FormEvent } from "react";
import { api } from "../services/api";
import { COLORS, PARCHMENT_STYLES } from "../constants/colors";
import { LAYERS } from "../constants/layers";
import type { Quest, User, UserTemplateSubscription } from "../types/api";
import StewardImage from "../assets/thesteward.png";
import ParchmentTypeWriter from "./ParchmentTypeWriter";
import { useAuth } from "../contexts/AuthContext";
import ModalShell from "./modal/ModalShell";
import { buildSchedule, parseSchedule, type QuestRecurrence } from "../utils/schedule";
import { sortHomeUsers } from "../utils/homeUsers";
import { copyTextToClipboard } from "../utils/clipboard";
import {
  buildSuggestedNfcCode,
  buildNfcTagUrl,
  buildStandaloneQuestUpdateData,
  CORRUPTION_TIMER_PRESETS,
  CORRUPTION_TIMER_UNITS,
  customCorruptionTimerToHours,
  deriveCustomCorruptionTimerValue,
  deriveDifficultySlidersFromXP,
  formatCorruptionTimerDuration,
  getMaxCorruptionTimerAmount,
  getEditQuestModalLabels,
  isCorruptionTimerPreset,
  MAX_NFC_CODE_LENGTH,
  normalizeNfcCode,
  normalizeCustomCorruptionTimerAmount,
  toDueInHoursStateValue,
  type CorruptionTimerUnit,
  waitForScribeContent,
} from "./editQuestModalHelpers";

const AVAILABLE_TAGS = ["Chores", "Cleaning", "Learning", "Exercise", "Health", "Organization"];
type CorruptionTimerMode = "preset" | "custom";

interface ScribeDraft {
  displayName: string;
  description: string;
  selectedTags: string[];
}

const toSelectedTags = (tags?: string | null): string[] =>
  tags
    ? tags.split(",").map((tag) => {
        const trimmed = tag.trim();
        return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
      })
    : [];

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
  targetUserId?: number | null;
  targetParticipantUserIds?: number[];
  createQuestOnSave?: boolean; // If true, creates quest on save (for template/initialData modes)
  initialSaveAsTemplate?: boolean;
  onSave?: (result: {
    createdQuest: boolean;
    updatedTemplateDefaults: boolean;
    quest?: Quest;
  }) => void;
  onClose?: () => void;
}

export default function EditQuestModal({
  questId,
  templateId,
  initialData,
  token,
  skipAI,
  targetUserId,
  targetParticipantUserIds,
  createQuestOnSave = false,
  initialSaveAsTemplate = false,
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
  const [regeneratingScribe, setRegeneratingScribe] = useState(false);
  const [preRegenerateDraft, setPreRegenerateDraft] = useState<ScribeDraft | null>(null);
  const [time, setTime] = useState(2);
  const [effort, setEffort] = useState(2);
  const [dread, setDread] = useState(2);
  const [showTypeWriter, setShowTypeWriter] = useState(false);
  const [nameAnimationDone, setNameAnimationDone] = useState(false);
  const [subscription, setSubscription] = useState<UserTemplateSubscription | null>(null);
  const [originalRecurrence, setOriginalRecurrence] = useState<QuestRecurrence>("one-off");
  const [saveAsTemplate, setSaveAsTemplate] = useState(initialSaveAsTemplate);
  const [homeUsers, setHomeUsers] = useState<User[]>([]);
  const [templateTitle, setTemplateTitle] = useState(initialData?.title || "");
  const [nfcEnabled, setNfcEnabled] = useState(false);
  const [nfcCode, setNfcCode] = useState("");
  const [copiedNfcUrl, setCopiedNfcUrl] = useState(false);
  const getInitialParticipantIds = useCallback(() => {
    if (targetParticipantUserIds && targetParticipantUserIds.length > 0) {
      return targetParticipantUserIds;
    }

    const fallbackUserId = targetUserId ?? userId;
    return fallbackUserId !== null ? [fallbackUserId] : [];
  }, [targetParticipantUserIds, targetUserId, userId]);
  const [selectedParticipantIds, setSelectedParticipantIds] =
    useState<number[]>(getInitialParticipantIds);
  const showParticipantSelector = Boolean(quest || isTemplateDefaultsMode);
  const participantLabel = isTemplateDefaultsMode
    ? selectedParticipantIds.length > 1
      ? "New Quest Party"
      : "New Quest For"
    : selectedParticipantIds.length > 1
      ? "Quest Party"
      : "Quest For";

  // Recurring quest fields
  const [recurrence, setRecurrence] = useState<QuestRecurrence>("one-off");
  const [scheduleTime, setScheduleTime] = useState("08:00");
  const [scheduleDay, setScheduleDay] = useState<string>("monday");
  const [scheduleDayOfMonth, setScheduleDayOfMonth] = useState<number>(1);
  const [dueInHours, setDueInHours] = useState<string>("");
  const [corruptionTimerMode, setCorruptionTimerMode] = useState<CorruptionTimerMode>("preset");
  const [customDueAmount, setCustomDueAmount] = useState("2");
  const [customDueUnit, setCustomDueUnit] = useState<CorruptionTimerUnit>("days");
  const normalizedNfcCode = normalizeNfcCode(nfcCode);
  const suggestedNfcCode = buildSuggestedNfcCode(templateTitle || "quest-tag");
  const nfcTagUrl = normalizedNfcCode
    ? buildNfcTagUrl(
        normalizedNfcCode,
        typeof window !== "undefined" ? window.location.origin : "http://majordomo"
      )
    : "";

  const setCorruptionTimerFromHours = useCallback((nextDueInHours?: number | null) => {
    setDueInHours(toDueInHoursStateValue(nextDueInHours));

    const customValue = deriveCustomCorruptionTimerValue(nextDueInHours);
    setCustomDueAmount(customValue.amount);
    setCustomDueUnit(customValue.unit);
    setCorruptionTimerMode(isCorruptionTimerPreset(nextDueInHours) ? "preset" : "custom");
  }, []);

  useEffect(() => {
    const loadHomeUsers = async () => {
      try {
        const users = sortHomeUsers(await api.user.getAll(token), userId);
        setHomeUsers(users);
      } catch {
        setHomeUsers([]);
      }
    };

    loadHomeUsers();
  }, [token, userId]);

  useEffect(() => {
    setSaveAsTemplate(initialSaveAsTemplate);
  }, [initialSaveAsTemplate, questId]);

  useEffect(() => {
    if (!questId) {
      setSelectedParticipantIds(getInitialParticipantIds());
    }
  }, [questId, getInitialParticipantIds]);

  // Load data based on mode
  useEffect(() => {
    const loadData = async () => {
      setPreRegenerateDraft(null);
      setRegeneratingScribe(false);
      setSelectedTags([]);
      try {
        if (isCreateMode) {
          // CREATE MODE (Random): Use provided initial data
          setTemplateTitle(initialData.title);
          setNfcEnabled(false);
          setNfcCode("");
          setDisplayName(initialData.display_name || "");
          setDescription(initialData.description || "");

          // Parse tags
          if (initialData.tags) {
            setSelectedTags(toSelectedTags(initialData.tags));
          }
          const createModeSliders = deriveDifficultySlidersFromXP(initialData.xp_reward);
          setTime(createModeSliders.time);
          setEffort(createModeSliders.effort);
          setDread(createModeSliders.dread);
          setCorruptionTimerFromHours(initialData.due_in_hours);

          setLoading(false);
          if (initialData.display_name || initialData.description) {
            setShowTypeWriter(true);
          }
        } else if (templateId) {
          // FROM TEMPLATE MODE: Fetch template to review before creating quest
          if (!skipAI) {
            await new Promise((resolve) => setTimeout(resolve, 1500));
          }

          const response = await api.quests.getTemplate(templateId, token);
          setTemplateTitle(response.title);
          setNfcEnabled(response.nfc_enabled);
          setNfcCode(response.nfc_code || "");

          // Fetch user's subscriptions
          const subscriptions = await api.subscriptions.getAll(token);
          const userSubscription = subscriptions.find(
            (sub) => sub.quest_template_id === templateId
          );
          setSubscription(userSubscription || null);

          setDisplayName(response.display_name || "");
          setDescription(response.description || "");

          if (response.tags) {
            setSelectedTags(toSelectedTags(response.tags));
          }
          const templateSliders = deriveDifficultySlidersFromXP(response.xp_reward);
          setTime(templateSliders.time);
          setEffort(templateSliders.effort);
          setDread(templateSliders.dread);

          // Use subscription schedule if available (Phase 3)
          const effectiveRecurrence = userSubscription
            ? userSubscription.recurrence
            : response.recurrence;
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
          setCorruptionTimerFromHours(effectiveDueInHours);

          setLoading(false);
          if (response.display_name || response.description) {
            setShowTypeWriter(true);
          }
        } else if (questId) {
          // EDIT QUEST MODE: Fetch quest by ID
          let response = await api.quests.getQuest(questId, token);
          if (!skipAI) {
            response = await waitForScribeContent(() => api.quests.getQuest(questId, token), {
              initialQuest: response,
            });
          }

          setTemplateTitle(response.template?.title || response.title);
          setNfcEnabled(false);
          setNfcCode("");
          setDisplayName(response.display_name || "");
          setDescription(response.description || "");

          if (response.tags) {
            setSelectedTags(toSelectedTags(response.tags));
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
          setCorruptionTimerFromHours(response.due_in_hours);

          setQuest(response);
          setSelectedParticipantIds(
            response.participants && response.participants.length > 0
              ? response.participants.map((participant) => participant.user_id)
              : [response.user_id]
          );
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
  }, [questId, templateId, initialData, token, skipAI, isCreateMode, setCorruptionTimerFromHours]);

  const handleSave = useCallback(
    async (options?: { createQuestAfterTemplateSave?: boolean }) => {
      const createQuestAfterTemplateSave = options?.createQuestAfterTemplateSave ?? false;
      setSaving(true);
      setError(null);

      try {
        // Calculate XP/Gold based on sliders
        const baseXP = (time + effort + dread) * 2;
        const baseGold = Math.floor(baseXP / 2);

        // Build schedule JSON if needed
        const schedule = buildSchedule(recurrence, scheduleTime, scheduleDay, scheduleDayOfMonth);
        const dueInHoursValue = dueInHours ? parseInt(dueInHours, 10) : null;

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
              ...(dueInHoursValue !== null && { due_in_hours: dueInHoursValue }),
              participant_user_ids: selectedParticipantIds,
            };

            const createdQuest = await api.quests.createAIScribe(
              questData,
              token,
              selectedParticipantIds[0] ?? targetUserId ?? userId,
              true
            ); // skip_ai=true

            // Convert to template if checkbox checked
            if (saveAsTemplate) {
              await api.quests.convertToTemplate(
                createdQuest.id,
                {
                  recurrence: recurrence,
                  schedule: schedule,
                  due_in_hours: dueInHoursValue,
                },
                token
              );
            }
            onSave?.({ createdQuest: true, updatedTemplateDefaults: false, quest: createdQuest });
          } else if (templateId) {
            // From template create mode - create quest from current template defaults
            const createdQuest = await api.quests.create(
              {
                quest_template_id: templateId,
                participant_user_ids: selectedParticipantIds,
              },
              token,
              selectedParticipantIds[0] ?? targetUserId ?? userId
            );
            onSave?.({ createdQuest: true, updatedTemplateDefaults: false, quest: createdQuest });
          }
          // Don't call onClose - parent's onSave callback handles closing
        } else if (templateId) {
          // EDIT TEMPLATE MODE: Update template and subscriptions
          const resolvedNfcCode = normalizedNfcCode || null;
          if (nfcEnabled && !resolvedNfcCode) {
            throw new Error("NFC code is required when NFC is enabled");
          }

          const updateData = {
            ...(displayName.trim() && { display_name: displayName.trim() }),
            ...(description.trim() && { description: description.trim() }),
            ...(selectedTags.length > 0 && { tags: selectedTags.join(",").toLowerCase() }),
            xp_reward: baseXP,
            gold_reward: baseGold,
            recurrence: recurrence,
            schedule: schedule,
            due_in_hours: dueInHoursValue,
            nfc_enabled: nfcEnabled,
            nfc_code: resolvedNfcCode,
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
                ...(dueInHoursValue !== null && { due_in_hours: dueInHoursValue }),
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
                due_in_hours: dueInHoursValue,
              },
              token
            );
          }

          if (createQuestAfterTemplateSave) {
            if (userId === null) {
              throw new Error("User ID not found in session");
            }
            await api.quests.create(
              {
                quest_template_id: templateId,
                participant_user_ids: selectedParticipantIds,
              },
              token,
              selectedParticipantIds[0] ?? targetUserId ?? userId
            );
          }

          onSave?.({
            createdQuest: createQuestAfterTemplateSave,
            updatedTemplateDefaults: true,
          });
          // Don't call onClose - parent's onSave callback handles closing
        } else if (quest) {
          // EDIT QUEST MODE: Update existing quest
          if (selectedParticipantIds.length === 0) {
            throw new Error("Select at least one participant");
          }

          const updateData = buildStandaloneQuestUpdateData({
            displayName,
            description,
            selectedTags,
            baseXP,
            baseGold,
            dueInHours,
            selectedParticipantIds: quest.completed ? undefined : selectedParticipantIds,
          });

          const updatedQuest = await api.quests.update(quest.id, updateData, token);

          // Convert to template if checkbox checked
          if (saveAsTemplate && quest.quest_template_id === null) {
            const conversionData = {
              recurrence: recurrence,
              schedule: schedule,
              due_in_hours: dueInHoursValue,
            };
            console.log("Converting to template with data:", conversionData);
            console.log("dueInHours state:", dueInHours);
            await api.quests.convertToTemplate(quest.id, conversionData, token);
          }

          onSave?.({ createdQuest: false, updatedTemplateDefaults: false, quest: updatedQuest });
          // Don't call onClose - parent's onSave callback handles closing
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      } finally {
        setSaving(false);
      }
    },
    [
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
      nfcEnabled,
      normalizedNfcCode,
      selectedParticipantIds,
      token,
      userId,
      targetUserId,
      onSave,
    ]
  );

  const xp = (time + effort + dread) * 2;
  const gold = Math.floor(xp / 2);
  const canRegenerateScribe = Boolean(
    questId && quest && !quest.completed && !templateId && !isCreateMode
  );

  const handleRegenerateScribe = async () => {
    if (!quest || !canRegenerateScribe || regeneratingScribe) return;

    const previousDraft = {
      displayName,
      description,
      selectedTags: [...selectedTags],
    };

    setRegeneratingScribe(true);
    setError(null);
    setShowTypeWriter(false);
    setNameAnimationDone(false);

    try {
      const preview = await api.quests.regenerateScribePreview(quest.id, token);
      setPreRegenerateDraft((current) => current ?? previousDraft);
      setDisplayName(preview.display_name || "");
      setDescription(preview.description || "");
      setSelectedTags(toSelectedTags(preview.tags));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate quest description");
    } finally {
      setRegeneratingScribe(false);
    }
  };

  const handleRevertRegeneratedScribe = () => {
    if (!preRegenerateDraft) return;

    setDisplayName(preRegenerateDraft.displayName);
    setDescription(preRegenerateDraft.description);
    setSelectedTags([...preRegenerateDraft.selectedTags]);
    setPreRegenerateDraft(null);
    setShowTypeWriter(false);
    setNameAnimationDone(false);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!saving && !loading && !regeneratingScribe) {
      handleSave();
    }
  };

  const handleSelectCorruptionTimerPreset = (hours: number) => {
    setCorruptionTimerMode("preset");
    setDueInHours(toDueInHoursStateValue(hours));
  };

  const handleSelectCustomCorruptionTimer = () => {
    const currentDueInHours = parseInt(dueInHours, 10);
    const customValue = deriveCustomCorruptionTimerValue(
      Number.isFinite(currentDueInHours) && currentDueInHours > 0 ? currentDueInHours : null
    );

    setCustomDueAmount(customValue.amount);
    setCustomDueUnit(customValue.unit);
    setDueInHours(customCorruptionTimerToHours(customValue.amount, customValue.unit));
    setCorruptionTimerMode("custom");
  };

  const handleCustomCorruptionAmountChange = (rawAmount: string) => {
    const normalizedAmount = normalizeCustomCorruptionTimerAmount(rawAmount, customDueUnit);

    setCustomDueAmount(normalizedAmount);
    setDueInHours(customCorruptionTimerToHours(normalizedAmount, customDueUnit));
    setCorruptionTimerMode("custom");
  };

  const handleCustomCorruptionUnitChange = (unit: CorruptionTimerUnit) => {
    const normalizedAmount = normalizeCustomCorruptionTimerAmount(customDueAmount, unit);

    setCustomDueUnit(unit);
    setCustomDueAmount(normalizedAmount);
    setDueInHours(customCorruptionTimerToHours(normalizedAmount, unit));
    setCorruptionTimerMode("custom");
  };

  const corruptionTimerDuration = formatCorruptionTimerDuration(dueInHours);

  const toggleParticipant = (participantId: number) => {
    setSelectedParticipantIds((current) =>
      current.includes(participantId)
        ? current.filter((id) => id !== participantId)
        : [...current, participantId]
    );
  };

  const handleToggleNfcEnabled = (enabled: boolean) => {
    setNfcEnabled(enabled);
    if (enabled && !normalizedNfcCode) {
      setNfcCode(suggestedNfcCode);
    }
  };

  const handleCopyNfcUrl = async () => {
    if (!nfcTagUrl) return;

    const copied = await copyTextToClipboard(nfcTagUrl);
    if (!copied) return;

    setCopiedNfcUrl(true);
    window.setTimeout(() => setCopiedNfcUrl(false), 2000);
  };

  return (
    <ModalShell
      isOpen={true}
      onClose={onClose}
      closeOnEscape={!loading && !saving && !regeneratingScribe}
      overlayClassName="items-start sm:items-center p-4"
      panelClassName="w-full max-w-4xl"
      zIndex={LAYERS.nestedModal}
    >
      <div
        className="p-6 md:p-8 rounded-lg shadow-xl flex gap-6"
        style={{
          backgroundColor: COLORS.darkPanel,
          border: `2px solid ${COLORS.gold}`,
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
                type="button"
                onClick={onClose}
                className="text-2xl leading-none"
                style={{ color: COLORS.gold }}
                disabled={loading || saving || regeneratingScribe}
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
                {templateId
                  ? "Loading template..."
                  : questId
                    ? "Loading quest..."
                    : "The Scribe is weaving your quest..."}
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
                  📜 From template:{" "}
                  {quest.template?.display_name || quest.template?.title || "Unknown"}
                  <div className="text-xs mt-1 italic">
                    Changes only affect this quest. To edit template/schedule, go to template
                    management.
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

              {showParticipantSelector && (
                <div className="mb-6">
                  <label
                    className="block text-sm uppercase tracking-wider mb-2 font-serif"
                    style={{ color: COLORS.gold }}
                  >
                    {participantLabel}
                  </label>
                  <div
                    className="rounded p-3 flex flex-wrap gap-2"
                    style={{
                      backgroundColor: COLORS.black,
                      borderColor: COLORS.gold,
                      borderWidth: "2px",
                    }}
                  >
                    {homeUsers.length === 0 && (
                      <span className="font-serif text-sm" style={{ color: COLORS.parchment }}>
                        Loading household members...
                      </span>
                    )}
                    {homeUsers.map((member) => {
                      const selected = selectedParticipantIds.includes(member.id);
                      return (
                        <label
                          key={member.id}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-sm font-serif text-sm"
                          style={{
                            backgroundColor: selected
                              ? "rgba(212, 175, 55, 0.25)"
                              : "rgba(212, 175, 55, 0.08)",
                            border: `1px solid ${selected ? COLORS.gold : COLORS.brown}`,
                            color: selected ? COLORS.gold : COLORS.parchment,
                            cursor: saving || quest?.completed ? "not-allowed" : "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleParticipant(member.id)}
                            disabled={saving || quest?.completed}
                            style={{ accentColor: COLORS.gold }}
                          />
                          <span>
                            {member.username}
                            {member.id === userId ? " (You)" : ""}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {quest?.completed && (
                    <p
                      className="mt-2 text-xs font-serif italic"
                      style={{ color: COLORS.parchment }}
                    >
                      Completed quests keep their current party so rewards and history stay
                      consistent.
                    </p>
                  )}
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
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g., The Cookery Cleanup"
                      className="w-full px-3 py-2 font-serif focus:outline-none transition-all"
                      style={{
                        backgroundColor: "transparent",
                        border: "none",
                        color: PARCHMENT_STYLES.textColor,
                        fontFamily: "Georgia, serif",
                      }}
                      disabled={saving || regeneratingScribe}
                    />
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="mb-6">
                <div className="mb-2 flex min-h-9 items-center justify-between gap-3">
                  <label
                    className="block text-sm uppercase tracking-wider font-serif"
                    style={{ color: COLORS.gold }}
                  >
                    Description
                  </label>
                  {canRegenerateScribe && (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleRegenerateScribe}
                        disabled={saving || regeneratingScribe}
                        aria-label="Regenerate quest description"
                        title="Regenerate quest description"
                        className="min-h-9 rounded px-2.5 py-1.5 font-serif text-xs uppercase tracking-wider transition-all"
                        style={{
                          backgroundColor: `rgba(212, 175, 55, 0.1)`,
                          border: `1px solid ${COLORS.gold}`,
                          color: COLORS.gold,
                          cursor: saving || regeneratingScribe ? "not-allowed" : "pointer",
                          opacity: saving || regeneratingScribe ? 0.65 : 1,
                        }}
                      >
                        <span aria-hidden="true" className="mr-1.5">
                          ↻
                        </span>
                        {regeneratingScribe ? "Working" : "Regenerate"}
                      </button>
                      {preRegenerateDraft && (
                        <button
                          type="button"
                          onClick={handleRevertRegeneratedScribe}
                          disabled={saving || regeneratingScribe}
                          aria-label="Revert regenerated quest description"
                          title="Revert regenerated quest description"
                          className="flex min-h-9 min-w-9 items-center justify-center rounded px-2 transition-all"
                          style={{
                            backgroundColor: `rgba(212, 175, 55, 0.08)`,
                            border: `1px solid ${COLORS.gold}`,
                            color: COLORS.gold,
                            cursor: saving || regeneratingScribe ? "not-allowed" : "pointer",
                            opacity: saving || regeneratingScribe ? 0.65 : 1,
                          }}
                        >
                          <span aria-hidden="true">↶</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
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
                      onChange={(e) => setDescription(e.target.value)}
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
                      disabled={saving || regeneratingScribe}
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
                        color: selectedTags.includes(tag) ? COLORS.darkPanel : COLORS.gold,
                        border: `1px solid ${COLORS.gold}`,
                        cursor: saving || regeneratingScribe ? "not-allowed" : "pointer",
                      }}
                      disabled={saving || regeneratingScribe}
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
                  {CORRUPTION_TIMER_PRESETS.map((option) => (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => handleSelectCorruptionTimerPreset(option.hours)}
                      className="px-3 py-1.5 text-xs uppercase tracking-wider font-serif rounded transition-all"
                      style={{
                        backgroundColor:
                          corruptionTimerMode === "preset" &&
                          ((option.hours === 0 && !dueInHours) ||
                            parseInt(dueInHours || "0", 10) === option.hours)
                            ? COLORS.gold
                            : `rgba(212, 175, 55, 0.2)`,
                        color:
                          corruptionTimerMode === "preset" &&
                          ((option.hours === 0 && !dueInHours) ||
                            parseInt(dueInHours || "0", 10) === option.hours)
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
                  <button
                    type="button"
                    onClick={handleSelectCustomCorruptionTimer}
                    className="px-3 py-1.5 text-xs uppercase tracking-wider font-serif rounded transition-all"
                    style={{
                      backgroundColor:
                        corruptionTimerMode === "custom" ? COLORS.gold : `rgba(212, 175, 55, 0.2)`,
                      color: corruptionTimerMode === "custom" ? COLORS.darkPanel : COLORS.gold,
                      border: `1px solid ${COLORS.gold}`,
                      cursor: saving ? "not-allowed" : "pointer",
                    }}
                    disabled={saving}
                  >
                    Custom
                  </button>
                </div>

                {corruptionTimerMode === "custom" && (
                  <div
                    className="mt-3 p-3 rounded space-y-3"
                    style={{
                      backgroundColor: `rgba(212, 175, 55, 0.1)`,
                      border: `1px solid ${COLORS.gold}`,
                    }}
                  >
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                      <div>
                        <label
                          className="block text-xs uppercase tracking-wider mb-1 font-serif"
                          style={{ color: COLORS.parchment }}
                        >
                          Corrupts After
                        </label>
                        <input
                          type="number"
                          min="1"
                          max={getMaxCorruptionTimerAmount(customDueUnit)}
                          value={customDueAmount}
                          onChange={(e) => handleCustomCorruptionAmountChange(e.target.value)}
                          className="w-full px-3 py-2 font-serif focus:outline-none transition-all"
                          style={{
                            backgroundColor: COLORS.black,
                            borderColor: COLORS.gold,
                            borderWidth: "2px",
                            color: COLORS.parchment,
                          }}
                          disabled={saving}
                        />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {CORRUPTION_TIMER_UNITS.map((option) => (
                          <button
                            key={option.unit}
                            type="button"
                            onClick={() => handleCustomCorruptionUnitChange(option.unit)}
                            className="px-3 py-2 text-xs uppercase tracking-wider font-serif rounded transition-all"
                            style={{
                              backgroundColor:
                                customDueUnit === option.unit
                                  ? COLORS.gold
                                  : `rgba(212, 175, 55, 0.2)`,
                              color: customDueUnit === option.unit ? COLORS.darkPanel : COLORS.gold,
                              border: `1px solid ${COLORS.gold}`,
                              cursor: saving ? "not-allowed" : "pointer",
                            }}
                            disabled={saving}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {corruptionTimerDuration && (
                  <p className="text-xs mt-2 font-serif italic" style={{ color: COLORS.parchment }}>
                    Quest will corrupt if not completed within {corruptionTimerDuration}
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
                      onChange={(e) => setSaveAsTemplate(e.target.checked)}
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
                    <p
                      className="text-xs mt-1 font-serif italic"
                      style={{ color: COLORS.parchment }}
                    >
                      Template can be reused and scheduled for recurring quests
                    </p>
                  )}
                </div>
              )}

              {/* Recurrence Configuration */}
              {/* Show when: (1) editing template defaults, or (2) standalone quest with save-as-template */}
              {(isTemplateDefaultsMode || saveAsTemplate) &&
                !(quest && quest.quest_template_id !== null) && (
                  <div className="mb-6">
                    <label
                      className="block text-sm uppercase tracking-wider mb-2 font-serif"
                      style={{ color: COLORS.gold }}
                    >
                      Recurrence
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                      {(["one-off", "daily", "weekly", "monthly"] as const).map((type) => (
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
                              onChange={(e) => setScheduleTime(e.target.value)}
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
                                onChange={(e) => setScheduleDay(e.target.value)}
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
                                ].map((day) => (
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
                                onChange={(e) => setScheduleTime(e.target.value)}
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
                                onChange={(e) =>
                                  setScheduleDayOfMonth(parseInt(e.target.value) || 1)
                                }
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
                                onChange={(e) => setScheduleTime(e.target.value)}
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

              {isTemplateDefaultsMode && (
                <div
                  className="mb-6 p-4 rounded-lg"
                  style={{
                    backgroundColor: `rgba(212, 175, 55, 0.1)`,
                    borderColor: COLORS.gold,
                    borderWidth: "1px",
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3
                        className="text-sm uppercase tracking-wider font-serif"
                        style={{ color: COLORS.gold }}
                      >
                        NFC Trigger
                      </h3>
                      <p className="mt-1 text-xs font-serif" style={{ color: COLORS.parchment }}>
                        Scanning the tag completes your active quest from this template or creates
                        and completes one if none exists.
                      </p>
                    </div>
                    <label className="inline-flex items-center gap-2 font-serif text-sm">
                      <input
                        type="checkbox"
                        checked={nfcEnabled}
                        onChange={(e) => handleToggleNfcEnabled(e.target.checked)}
                        className="w-4 h-4"
                        style={{ accentColor: COLORS.gold }}
                        disabled={saving}
                      />
                      <span style={{ color: COLORS.gold }}>Use for NFC</span>
                    </label>
                  </div>

                  {nfcEnabled && (
                    <div className="mt-4 space-y-4">
                      <div>
                        <label
                          className="block text-xs uppercase tracking-wider mb-1 font-serif"
                          style={{ color: COLORS.parchment }}
                        >
                          NFC Code
                        </label>
                        <input
                          type="text"
                          value={nfcCode}
                          onChange={(e) => setNfcCode(normalizeNfcCode(e.target.value))}
                          placeholder={suggestedNfcCode || "trash-bin"}
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
                          className="mt-1 text-xs font-serif italic"
                          style={{ color: COLORS.brown }}
                        >
                          Lowercase letters, numbers, and dashes only. Suggested codes are capped at{" "}
                          {MAX_NFC_CODE_LENGTH} characters. Changing the code means rewriting the
                          physical tag.
                        </p>
                      </div>

                      <div>
                        <label
                          className="block text-xs uppercase tracking-wider mb-1 font-serif"
                          style={{ color: COLORS.parchment }}
                        >
                          Tag URL
                        </label>
                        <div className="flex flex-col gap-2 md:flex-row">
                          <input
                            type="text"
                            value={nfcTagUrl}
                            readOnly
                            className="w-full px-3 py-2 font-serif focus:outline-none"
                            style={{
                              backgroundColor: COLORS.black,
                              borderColor: COLORS.gold,
                              borderWidth: "2px",
                              color: COLORS.parchment,
                            }}
                          />
                          <button
                            type="button"
                            onClick={handleCopyNfcUrl}
                            className="px-4 py-2 font-serif text-xs uppercase tracking-wider transition-all"
                            style={{
                              backgroundColor: copiedNfcUrl
                                ? COLORS.gold
                                : `rgba(212, 175, 55, 0.2)`,
                              border: `1px solid ${COLORS.gold}`,
                              color: copiedNfcUrl ? COLORS.darkPanel : COLORS.gold,
                              cursor: nfcTagUrl ? "pointer" : "not-allowed",
                            }}
                            disabled={saving || !nfcTagUrl}
                          >
                            {copiedNfcUrl ? "Copied" : "Copy URL"}
                          </button>
                        </div>
                      </div>
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
                  disabled={saving || regeneratingScribe}
                  className="flex-1 py-3 font-serif font-semibold text-sm uppercase tracking-wider transition-all"
                  style={{
                    backgroundColor: `rgba(212, 175, 55, 0.1)`,
                    borderColor: COLORS.gold,
                    borderWidth: "2px",
                    color: COLORS.gold,
                    cursor: saving || regeneratingScribe ? "not-allowed" : "pointer",
                    opacity: saving || regeneratingScribe ? 0.5 : 1,
                  }}
                >
                  Cancel
                </button>
                {isTemplateDefaultsMode && (
                  <button
                    type="button"
                    onClick={() => handleSave({ createQuestAfterTemplateSave: true })}
                    disabled={saving || regeneratingScribe}
                    className="flex-1 py-3 font-serif font-semibold text-sm uppercase tracking-wider transition-all"
                    style={{
                      backgroundColor: saving
                        ? `rgba(56, 189, 248, 0.1)`
                        : `rgba(56, 189, 248, 0.25)`,
                      borderColor: "#38bdf8",
                      borderWidth: "2px",
                      color: "#bae6fd",
                      cursor: saving || regeneratingScribe ? "not-allowed" : "pointer",
                      opacity: saving || regeneratingScribe ? 0.5 : 1,
                    }}
                  >
                    {saving ? "Saving..." : "Save Defaults & Create Quest"}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={saving || regeneratingScribe}
                  className="flex-1 py-3 font-serif font-semibold text-sm uppercase tracking-wider transition-all"
                  style={{
                    backgroundColor: saving ? `rgba(212, 175, 55, 0.1)` : `rgba(212, 175, 55, 0.2)`,
                    borderColor: COLORS.gold,
                    borderWidth: "2px",
                    color: COLORS.gold,
                    cursor: saving || regeneratingScribe ? "not-allowed" : "pointer",
                    opacity: saving || regeneratingScribe ? 0.5 : 1,
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
    </ModalShell>
  );
}
