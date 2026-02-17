import { describe, expect, test } from "bun:test";

import {
  buildStandaloneQuestUpdateData,
  deriveDifficultySlidersFromXP,
  getEditQuestModalLabels,
  toDueInHoursStateValue,
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
