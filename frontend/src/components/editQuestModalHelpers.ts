interface StandaloneQuestUpdateDataInput {
  displayName: string;
  description: string;
  selectedTags: string[];
  baseXP: number;
  baseGold: number;
  dueInHours: string;
  selectedParticipantIds?: number[];
}

interface StandaloneQuestUpdateData {
  display_name?: string;
  description?: string;
  tags?: string;
  xp_reward: number;
  gold_reward: number;
  due_in_hours: number | null;
  user_id?: number;
  participant_user_ids?: number[];
}

interface DifficultySliders {
  time: number;
  effort: number;
  dread: number;
}

interface EditQuestModalLabelsInput {
  hasTemplateId: boolean;
  isCreateMode: boolean;
  hasQuestId: boolean;
}

interface EditQuestModalLabels {
  title: string;
  submitLabel: string;
}

interface ScribeQuestSnapshot {
  display_name?: string | null;
  description?: string | null;
}

interface WaitForScribeContentOptions<T extends ScribeQuestSnapshot> {
  initialQuest?: T;
  maxAttempts?: number;
  intervalMs?: number;
  sleep?: (intervalMs: number) => Promise<void>;
}

const DEFAULT_SCRIBE_POLL_ATTEMPTS = 12;
const DEFAULT_SCRIBE_POLL_INTERVAL_MS = 750;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function delay(intervalMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, intervalMs));
}

export function toDueInHoursStateValue(dueInHours?: number | null): string {
  return dueInHours && dueInHours > 0 ? dueInHours.toString() : "";
}

export function buildStandaloneQuestUpdateData({
  displayName,
  description,
  selectedTags,
  baseXP,
  baseGold,
  dueInHours,
  selectedParticipantIds,
}: StandaloneQuestUpdateDataInput): StandaloneQuestUpdateData {
  const participantIds = selectedParticipantIds ?? [];

  return {
    ...(displayName.trim() && { display_name: displayName.trim() }),
    ...(description.trim() && { description: description.trim() }),
    ...(selectedTags.length > 0 && { tags: selectedTags.join(",").toLowerCase() }),
    xp_reward: baseXP,
    gold_reward: baseGold,
    due_in_hours: dueInHours ? parseInt(dueInHours, 10) : null,
    ...(participantIds.length > 0 && {
      user_id: participantIds[0],
      participant_user_ids: participantIds,
    }),
  };
}

export function deriveDifficultySlidersFromXP(xpReward?: number): DifficultySliders {
  if (!xpReward || xpReward <= 0) {
    return { time: 2, effort: 2, dread: 2 };
  }

  const targetSum = clamp(Math.round(xpReward / 2), 3, 15);
  const sliders = [1, 1, 1];
  let remaining = targetSum - 3;
  let index = 0;

  while (remaining > 0) {
    if (sliders[index] < 5) {
      sliders[index] += 1;
      remaining -= 1;
    }
    index = (index + 1) % 3;
  }

  return { time: sliders[0], effort: sliders[1], dread: sliders[2] };
}

export function getEditQuestModalLabels({
  hasTemplateId,
  isCreateMode,
  hasQuestId,
}: EditQuestModalLabelsInput): EditQuestModalLabels {
  if (hasTemplateId) {
    return {
      title: "Edit Template Defaults",
      submitLabel: "Update Template Defaults",
    };
  }

  if (isCreateMode) {
    return {
      title: "Scribe Quest Details",
      submitLabel: "Create Quest",
    };
  }

  if (hasQuestId) {
    return {
      title: "Edit Quest",
      submitLabel: "Save Quest",
    };
  }

  return {
    title: "Quest Details",
    submitLabel: "Save Quest",
  };
}

export function hasScribeContent(quest: ScribeQuestSnapshot): boolean {
  return Boolean(quest.display_name?.trim() || quest.description?.trim());
}

export async function waitForScribeContent<T extends ScribeQuestSnapshot>(
  fetchQuest: () => Promise<T>,
  options: WaitForScribeContentOptions<T> = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_SCRIBE_POLL_ATTEMPTS;
  const intervalMs = options.intervalMs ?? DEFAULT_SCRIBE_POLL_INTERVAL_MS;
  const sleep = options.sleep ?? delay;
  let latestQuest = options.initialQuest ?? (await fetchQuest());

  if (hasScribeContent(latestQuest)) {
    return latestQuest;
  }

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await sleep(intervalMs);
    latestQuest = await fetchQuest();

    if (hasScribeContent(latestQuest)) {
      return latestQuest;
    }
  }

  return latestQuest;
}
