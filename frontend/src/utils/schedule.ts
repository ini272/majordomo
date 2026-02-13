export type QuestRecurrence = "one-off" | "daily" | "weekly" | "monthly";

interface BaseSchedule {
  time?: string;
}

interface DailySchedule extends BaseSchedule {
  type?: "daily";
}

interface WeeklySchedule extends BaseSchedule {
  type?: "weekly";
  day?: string;
}

interface MonthlySchedule extends BaseSchedule {
  type?: "monthly";
  day?: number;
}

export type ParsedSchedule = DailySchedule | WeeklySchedule | MonthlySchedule;

const getOrdinalSuffix = (day: number): string => {
  if (day % 100 >= 11 && day % 100 <= 13) return "th";
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
};

export const parseSchedule = (schedule: string | null | undefined): ParsedSchedule | null => {
  if (!schedule) return null;

  try {
    const parsed = JSON.parse(schedule) as ParsedSchedule;
    return parsed;
  } catch {
    return null;
  }
};

export const buildSchedule = (
  recurrence: QuestRecurrence,
  scheduleTime: string,
  scheduleDay: string,
  scheduleDayOfMonth: number
): string | null => {
  if (recurrence === "one-off") return null;

  if (recurrence === "daily") {
    return JSON.stringify({ type: "daily", time: scheduleTime });
  }

  if (recurrence === "weekly") {
    return JSON.stringify({ type: "weekly", day: scheduleDay, time: scheduleTime });
  }

  return JSON.stringify({
    type: "monthly",
    day: scheduleDayOfMonth,
    time: scheduleTime,
  });
};

export const formatScheduleLabel = (
  recurrence: QuestRecurrence,
  schedule: string | null | undefined
): string | null => {
  const parsed = parseSchedule(schedule);
  if (!parsed || recurrence === "one-off") return null;

  if (recurrence === "daily") {
    return parsed.time ? `Daily ${parsed.time}` : "Daily";
  }

  if (recurrence === "weekly") {
    if (typeof (parsed as WeeklySchedule).day !== "string") return parsed.time || null;
    const dayValue = (parsed as WeeklySchedule).day as string;
    const day = dayValue.charAt(0).toUpperCase() + dayValue.slice(1);
    return `${day}s${parsed.time ? ` ${parsed.time}` : ""}`;
  }

  if (typeof (parsed as MonthlySchedule).day !== "number") return parsed.time || "Monthly";
  const day = (parsed as MonthlySchedule).day as number;
  const suffix = getOrdinalSuffix(day);
  return `Monthly ${day}${suffix}${parsed.time ? ` ${parsed.time}` : ""}`;
};
