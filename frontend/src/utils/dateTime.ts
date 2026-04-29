const EXPLICIT_TIME_ZONE_PATTERN = /(?:Z|[+-]\d{2}:?\d{2})$/i;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export interface RelativeQuestTime {
  bucket: "past" | "soon" | "hours" | "days";
  diffMs: number;
  value: number | null;
}

export const parseApiDateTime = (value?: string | Date | null): Date | null => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) return null;

  // Backend datetimes are stored in UTC. SQLite can return them without an
  // offset, so make that assumption explicit before browser-local formatting.
  const normalizedValue = EXPLICIT_TIME_ZONE_PATTERN.test(trimmedValue)
    ? trimmedValue
    : `${trimmedValue}Z`;
  const date = new Date(normalizedValue);

  return Number.isNaN(date.getTime()) ? null : date;
};

export const addHoursToApiDateTime = (
  value?: string | Date | null,
  hours?: number | null
): Date | null => {
  if (typeof hours !== "number" || !Number.isFinite(hours)) return null;

  const date = parseApiDateTime(value);
  if (!date) return null;

  return new Date(date.getTime() + hours * 60 * 60 * 1000);
};

export const getQuestDeadlineDate = (
  value?: string | Date | null,
  hours?: number | null
): Date | null => addHoursToApiDateTime(value, hours);

const getRelativeQuestTime = (value?: string | Date | null): RelativeQuestTime | null => {
  const date = parseApiDateTime(value);
  if (!date) return null;

  const diffMs = date.getTime() - Date.now();
  if (diffMs <= 0) {
    return {
      bucket: "past",
      diffMs,
      value: null,
    };
  }

  if (diffMs < HOUR_MS) {
    return {
      bucket: "soon",
      diffMs,
      value: null,
    };
  }

  if (diffMs < DAY_MS) {
    return {
      bucket: "hours",
      diffMs,
      value: Math.max(1, Math.floor(diffMs / HOUR_MS)),
    };
  }

  return {
    bucket: "days",
    diffMs,
    value: Math.max(1, Math.floor(diffMs / DAY_MS)),
  };
};

const formatRelativeUnit = (value: number, unit: "hour" | "day", compact: boolean): string => {
  if (compact) return `${value}${unit === "hour" ? "h" : "d"}`;
  return `${value} ${unit}${value === 1 ? "" : "s"}`;
};

export const describeQuestDeadline = (
  value?: string | Date | null,
  hours?: number | null
): RelativeQuestTime | null => getRelativeQuestTime(getQuestDeadlineDate(value, hours));

export const formatQuestDeadlineLabel = (
  value?: string | Date | null,
  hours?: number | null,
  options: { compact?: boolean } = {}
): string | null => {
  const relativeTime = describeQuestDeadline(value, hours);
  if (!relativeTime) return null;

  const compact = options.compact ?? false;

  if (relativeTime.bucket === "past") return "Corrupted";
  if (relativeTime.bucket === "soon") return compact ? "Corrupts soon" : "Due soon";

  const unit = relativeTime.bucket === "hours" ? "hour" : "day";
  const formattedValue = formatRelativeUnit(relativeTime.value ?? 1, unit, compact);
  return compact ? `Corrupts in ${formattedValue}` : `${formattedValue} left`;
};

export const describeUpcomingSpawn = (value?: string | Date | null): RelativeQuestTime | null =>
  getRelativeQuestTime(value);

export const formatUpcomingSpawnLabel = (
  value?: string | Date | null,
  options: { compact?: boolean } = {}
): string | null => {
  const relativeTime = describeUpcomingSpawn(value);
  if (!relativeTime) return null;

  const compact = options.compact ?? false;

  if (relativeTime.bucket === "past" || relativeTime.bucket === "soon") {
    return "Spawns soon";
  }

  const unit = relativeTime.bucket === "hours" ? "hour" : "day";
  const formattedValue = formatRelativeUnit(relativeTime.value ?? 1, unit, compact);
  return `Spawns in ${formattedValue}`;
};

export const formatQuestDateTime = (
  value?: string | Date | null,
  options: { timeZone?: string } = {}
): string | null => {
  const date = parseApiDateTime(value);
  if (!date) return null;

  return date.toLocaleString("en-GB", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    ...(options.timeZone ? { timeZone: options.timeZone } : {}),
  });
};
