import { describe, expect, test } from "bun:test";

import {
  addHoursToApiDateTime,
  formatQuestDateTime,
  formatTimeZoneLabel,
  parseApiDateTime,
} from "../src/utils/dateTime";

describe("parseApiDateTime", () => {
  test("treats offset-less API datetimes as UTC", () => {
    expect(parseApiDateTime("2026-04-21T12:00:00")?.toISOString()).toBe("2026-04-21T12:00:00.000Z");
  });

  test("keeps explicit timezone offsets intact", () => {
    expect(parseApiDateTime("2026-04-21T12:00:00+02:00")?.toISOString()).toBe(
      "2026-04-21T10:00:00.000Z"
    );
  });
});

describe("formatQuestDateTime", () => {
  test("formats UTC API timestamps in the selected timezone", () => {
    expect(formatQuestDateTime("2026-04-21T12:00:00", { timeZone: "Europe/Berlin" })).toBe(
      "21 Apr, 14:00"
    );
    expect(formatQuestDateTime("2026-04-21T12:00:00", { timeZone: "America/New_York" })).toBe(
      "21 Apr, 08:00"
    );
  });

  test("formats quest creation and due timestamps from the same UTC source", () => {
    const createdAt = "2026-04-21T12:00:00";
    const dueAt = addHoursToApiDateTime(createdAt, 2);

    expect(formatQuestDateTime(createdAt, { timeZone: "Europe/Berlin" })).toBe("21 Apr, 14:00");
    expect(formatQuestDateTime(dueAt, { timeZone: "Europe/Berlin" })).toBe("21 Apr, 16:00");
  });
});

describe("formatTimeZoneLabel", () => {
  test("includes the source timezone and a readable offset for valid timezone names", () => {
    const label = formatTimeZoneLabel("Europe/Berlin");

    expect(label.startsWith("Europe/Berlin")).toBe(true);
    expect(label).toContain("(");
    expect(label).toContain("GMT");
  });

  test("falls back to UTC when no timezone is stored", () => {
    expect(formatTimeZoneLabel(null).startsWith("UTC")).toBe(true);
  });

  test("returns invalid timezone names unchanged", () => {
    expect(formatTimeZoneLabel("Mars/Olympus")).toBe("Mars/Olympus");
  });
});
