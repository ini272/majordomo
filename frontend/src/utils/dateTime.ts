const EXPLICIT_TIME_ZONE_PATTERN = /(?:Z|[+-]\d{2}:?\d{2})$/i;

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
