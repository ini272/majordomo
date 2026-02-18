interface StandaloneQuestUpdateDataInput {
  displayName: string;
  description: string;
  selectedTags: string[];
  baseXP: number;
  baseGold: number;
  dueInHours: string;
}

interface StandaloneQuestUpdateData {
  display_name?: string;
  description?: string;
  tags?: string;
  xp_reward: number;
  gold_reward: number;
  due_in_hours: number | null;
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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
}: StandaloneQuestUpdateDataInput): StandaloneQuestUpdateData {
  return {
    ...(displayName.trim() && { display_name: displayName.trim() }),
    ...(description.trim() && { description: description.trim() }),
    ...(selectedTags.length > 0 && { tags: selectedTags.join(",").toLowerCase() }),
    xp_reward: baseXP,
    gold_reward: baseGold,
    due_in_hours: dueInHours ? parseInt(dueInHours, 10) : null,
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
