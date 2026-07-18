type CalendarParts = { year: number; month: number; day: number };

function parts(value: Date, timeZone?: string): CalendarParts {
  const formatted = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  return {
    year: Number(formatted.find((part) => part.type === "year")?.value),
    month: Number(formatted.find((part) => part.type === "month")?.value),
    day: Number(formatted.find((part) => part.type === "day")?.value)
  };
}

function key(value: Date, timeZone?: string): string {
  const date = parts(value, timeZone);
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

export function localCalendarDayKey(value: string | null, timeZone?: string): string {
  if (value === null) return "Date unavailable";
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? key(parsed, timeZone) : "Date unavailable";
}

export function localCalendarDayLabel(value: string | null, now: Date, timeZone?: string): string {
  const parsed = value === null ? null : new Date(value);
  if (parsed === null || !Number.isFinite(parsed.getTime())) return "Date unavailable";
  const today = parts(now, timeZone);
  const tomorrowInstant = new Date(Date.UTC(today.year, today.month - 1, today.day + 1, 12));
  const dayKey = key(parsed, timeZone);
  if (dayKey === key(now, timeZone)) return "Today";
  if (dayKey === key(tomorrowInstant, timeZone)) return "Tomorrow";
  return new Intl.DateTimeFormat(undefined, { timeZone, dateStyle: "full" }).format(parsed);
}
