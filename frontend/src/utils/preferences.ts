export const SKIP_AI_QUEST_CREATION_STORAGE_KEY = "majordomo.preferences.skipAiQuestCreation";

export const readStoredSkipAiQuestCreationPreference = (
  storage: Pick<Storage, "getItem"> | null | undefined,
  storageKey: string = SKIP_AI_QUEST_CREATION_STORAGE_KEY
): boolean => {
  if (!storage) return false;

  try {
    return storage.getItem(storageKey) === "true";
  } catch {
    return false;
  }
};

export const writeStoredSkipAiQuestCreationPreference = (
  storage: Pick<Storage, "setItem"> | null | undefined,
  skipAiQuestCreation: boolean,
  storageKey: string = SKIP_AI_QUEST_CREATION_STORAGE_KEY
): void => {
  if (!storage) return;

  try {
    storage.setItem(storageKey, skipAiQuestCreation ? "true" : "false");
  } catch {
    // Ignore storage errors (private mode, quota, disabled storage).
  }
};
