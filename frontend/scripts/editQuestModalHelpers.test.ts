import { describe, expect, test } from "bun:test";

import {
  buildStandaloneQuestUpdateData,
  deriveDifficultySlidersFromXP,
  getEditQuestModalLabels,
  hasScribeContent,
  toDueInHoursStateValue,
  waitForScribeContent,
} from "../src/components/editQuestModalHelpers";

describe("buildStandaloneQuestUpdateData", () => {
  test("includes due_in_hours when corruption timer is set", () => {
    const payload = buildStandaloneQuestUpdateData({
      displayName: "The Kitchen Cleanse",
      description: "Defeat the sink dragon",
      selectedTags: ["Chores", "Health"],
      baseXP: 30,
      baseGold: 15,
      dueInHours: "72",
    });

    expect(payload.due_in_hours).toBe(72);
  });

  test("sends due_in_hours as null when timer is none", () => {
    const payload = buildStandaloneQuestUpdateData({
      displayName: "The Kitchen Cleanse",
      description: "Defeat the sink dragon",
      selectedTags: ["Chores", "Health"],
      baseXP: 30,
      baseGold: 15,
      dueInHours: "",
    });

    expect(payload.due_in_hours).toBeNull();
  });

  test("includes participant IDs when quest party is selected", () => {
    const payload = buildStandaloneQuestUpdateData({
      displayName: "The Kitchen Cleanse",
      description: "Defeat the sink dragon",
      selectedTags: ["Chores"],
      baseXP: 30,
      baseGold: 15,
      dueInHours: "",
      selectedParticipantIds: [2, 4],
    });

    expect(payload.user_id).toBe(2);
    expect(payload.participant_user_ids).toEqual([2, 4]);
  });
});

describe("toDueInHoursStateValue", () => {
  test("maps API due_in_hours value to UI state string", () => {
    expect(toDueInHoursStateValue(72)).toBe("72");
    expect(toDueInHoursStateValue(null)).toBe("");
    expect(toDueInHoursStateValue(undefined)).toBe("");
  });
});

describe("deriveDifficultySlidersFromXP", () => {
  test("returns default sliders when no XP exists", () => {
    expect(deriveDifficultySlidersFromXP()).toEqual({ time: 2, effort: 2, dread: 2 });
    expect(deriveDifficultySlidersFromXP(0)).toEqual({ time: 2, effort: 2, dread: 2 });
  });

  test("creates a slider tuple whose XP total matches the target", () => {
    const { time, effort, dread } = deriveDifficultySlidersFromXP(30);
    expect(time + effort + dread).toBe(15);
    expect(time).toBeLessThanOrEqual(5);
    expect(effort).toBeLessThanOrEqual(5);
    expect(dread).toBeLessThanOrEqual(5);
  });
});

describe("getEditQuestModalLabels", () => {
  test("uses template defaults wording for template edit mode", () => {
    const labels = getEditQuestModalLabels({
      hasTemplateId: true,
      isCreateMode: false,
      hasQuestId: false,
    });

    expect(labels.title).toBe("Edit Template Defaults");
    expect(labels.submitLabel).toBe("Update Template Defaults");
  });

  test("uses quest wording when editing an existing quest", () => {
    const labels = getEditQuestModalLabels({
      hasTemplateId: false,
      isCreateMode: false,
      hasQuestId: true,
    });

    expect(labels.title).toBe("Edit Quest");
    expect(labels.submitLabel).toBe("Save Quest");
  });
});

describe("waitForScribeContent", () => {
  test("returns immediately when the quest already has generated copy", async () => {
    let fetchCount = 0;
    const quest = {
      id: 1,
      display_name: "The Kitchen Cleanse",
      description: "",
    };

    const result = await waitForScribeContent(
      async () => {
        fetchCount += 1;
        return quest;
      },
      { initialQuest: quest, sleep: async () => {} }
    );

    expect(result).toBe(quest);
    expect(fetchCount).toBe(0);
  });

  test("polls until the background Scribe update is visible", async () => {
    const snapshots = [
      { id: 1, display_name: "", description: "" },
      { id: 1, display_name: "The Kitchen Cleanse", description: "Vanquish grime." },
    ];
    let fetchCount = 0;
    const sleeps: number[] = [];

    const result = await waitForScribeContent(
      async () => snapshots[Math.min(fetchCount++, snapshots.length - 1)],
      {
        initialQuest: snapshots[0],
        maxAttempts: 3,
        intervalMs: 10,
        sleep: async (intervalMs) => {
          sleeps.push(intervalMs);
        },
      }
    );

    expect(result.display_name).toBe("The Kitchen Cleanse");
    expect(fetchCount).toBe(2);
    expect(sleeps).toEqual([10, 10]);
  });

  test("returns the latest quest when generated copy never arrives", async () => {
    let fetchCount = 0;

    const result = await waitForScribeContent(
      async () => {
        fetchCount += 1;
        return { id: 1, display_name: "", description: "" };
      },
      {
        initialQuest: { id: 1, display_name: "", description: "" },
        maxAttempts: 2,
        sleep: async () => {},
      }
    );

    expect(hasScribeContent(result)).toBe(false);
    expect(fetchCount).toBe(2);
  });
});
