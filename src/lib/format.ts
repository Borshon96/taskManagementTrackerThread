export const APP_TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE || "Asia/Dhaka";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIMEZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const timeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

const secondsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

/** "10 Nov 2026" */
export function formatDate(iso: string | null | undefined) {
  if (!iso) return "";
  return dateFmt.format(new Date(iso));
}

/** "10:35 PM" */
export function formatTime(iso: string | null | undefined) {
  if (!iso) return "";
  return timeFmt.format(new Date(iso));
}

/** "10 Nov 2026, 10:35 PM" */
export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "";
  return `${formatDate(iso)}, ${formatTime(iso)}`;
}

/** Full precision for tooltips: "10 Nov 2026, 10:35:12 PM (Asia/Dhaka)" */
export function formatTimestamp(iso: string | null | undefined) {
  if (!iso) return "";
  return `${formatDate(iso)}, ${secondsFmt.format(new Date(iso))} (${APP_TIMEZONE})`;
}

/** Due dates are calendar dates (YYYY-MM-DD) with no time zone. */
export function formatDueDate(date: string | null | undefined) {
  if (!date) return "";
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

export function todayInAppZone(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE }).format(now);
}

export function formatRelative(iso: string | null | undefined, now = new Date()) {
  if (!iso) return "";
  const diff = Math.round((now.getTime() - new Date(iso).getTime()) / 1000);
  if (diff < 45) return "just now";
  const minutes = Math.round(diff / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatDate(iso);
}

/** UTC ISO instant for midnight at the start of a YYYY-MM-DD date in the app time zone. */
export function zonedDayStartIso(date: string, timeZone = APP_TIMEZONE) {
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(guess));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asIfUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return new Date(guess - (asIfUtc - guess)).toISOString();
}

export function initials(name: string | null | undefined) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}
