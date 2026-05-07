import { describe, expect, test } from "bun:test";

import {
  SKIP_AI_QUEST_CREATION_STORAGE_KEY,
  readStoredSkipAiQuestCreationPreference,
  writeStoredSkipAiQuestCreationPreference,
} from "../src/utils/preferences";

const createStorage = () => {
  const values = new Map<string, string>();

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    values,
  };
};

describe("skip AI quest creation preference", () => {
  test("reads true only when the stored value is true", () => {
    const storage = createStorage();

    expect(readStoredSkipAiQuestCreationPreference(storage)).toBe(false);

    storage.values.set(SKIP_AI_QUEST_CREATION_STORAGE_KEY, "true");
    expect(readStoredSkipAiQuestCreationPreference(storage)).toBe(true);

    storage.values.set(SKIP_AI_QUEST_CREATION_STORAGE_KEY, "false");
    expect(readStoredSkipAiQuestCreationPreference(storage)).toBe(false);
  });

  test("writes boolean values as stable storage strings", () => {
    const storage = createStorage();

    writeStoredSkipAiQuestCreationPreference(storage, true);
    expect(storage.values.get(SKIP_AI_QUEST_CREATION_STORAGE_KEY)).toBe("true");

    writeStoredSkipAiQuestCreationPreference(storage, false);
    expect(storage.values.get(SKIP_AI_QUEST_CREATION_STORAGE_KEY)).toBe("false");
  });

  test("falls back safely when storage is missing or unavailable", () => {
    expect(readStoredSkipAiQuestCreationPreference(null)).toBe(false);

    const throwingStorage = {
      getItem: () => {
        throw new Error("storage unavailable");
      },
      setItem: () => {
        throw new Error("storage unavailable");
      },
    };

    expect(readStoredSkipAiQuestCreationPreference(throwingStorage)).toBe(false);
    expect(() => writeStoredSkipAiQuestCreationPreference(throwingStorage, true)).not.toThrow();
  });
});
