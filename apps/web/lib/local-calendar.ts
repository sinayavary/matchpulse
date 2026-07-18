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

function localMidnightUtc(date: CalendarParts, timeZone?: string): Date {
  if (!timeZone) return new Date(date.year, date.month - 1, date.day);
  const target = Date.UTC(date.year, date.month - 1, date.day);
  let candidate = target;
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const actual = parts(new Date(candidate), timeZone);
    const actualDay = Date.UTC(actual.year, actual.month - 1, actual.day);
    const formatter = new Intl.DateTimeFormat("en-US", { timeZone, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const formatted = formatter.formatToParts(new Date(candidate));
    const hour = Number(formatted.find((part) => part.type === "hour")?.value) % 24;
    const minute = Number(formatted.find((part) => part.type === "minute")?.value);
    const second = Number(formatted.find((part) => part.type === "second")?.value);
    candidate -= (actualDay - target) + hour * 3_600_000 + minute * 60_000 + second * 1_000;
  }
  return new Date(candidate);
}

export function localDayUtcRange(now: Date, offsetDays = 0, timeZone?: string): { from: string; to: string } {
  const current = parts(now, timeZone);
  const noon = new Date(Date.UTC(current.year, current.month - 1, current.day + offsetDays, 12));
  const selected = parts(noon, "UTC");
  const nextNoon = new Date(Date.UTC(selected.year, selected.month - 1, selected.day + 1, 12));
  const next = parts(nextNoon, "UTC");
  return { from: localMidnightUtc(selected, timeZone).toISOString(), to: localMidnightUtc(next, timeZone).toISOString() };
}

export function customLocalDateUtcRange(value: string, timeZone?: string): { from: string; to: string } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const selected = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  const check = new Date(Date.UTC(selected.year, selected.month - 1, selected.day));
  if (check.getUTCFullYear() !== selected.year || check.getUTCMonth() + 1 !== selected.month || check.getUTCDate() !== selected.day) return null;
  const nextDate = new Date(Date.UTC(selected.year, selected.month - 1, selected.day + 1));
  return { from: localMidnightUtc(selected, timeZone).toISOString(), to: localMidnightUtc({ year: nextDate.getUTCFullYear(), month: nextDate.getUTCMonth() + 1, day: nextDate.getUTCDate() }, timeZone).toISOString() };
}
