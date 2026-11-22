export function toLocalDateStr(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

export function getTodayStr(): string {
  return toLocalDateStr(new Date());
}

export function addDays(dateStr: string, days: number): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + days);
  return toLocalDateStr(d);
}

export function getWeekStartMonday(dateInput: Date | string): string {
  const d =
    typeof dateInput === 'string'
      ? parseLocalDate(dateInput)
      : new Date(
          dateInput.getFullYear(),
          dateInput.getMonth(),
          dateInput.getDate()
        );
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toLocalDateStr(d);
}

export function getWeekDates(weekStartStr: string, includeSunday = true): string[] {
  const count = includeSunday ? 7 : 6;
  return Array.from({length: count}, (_, i) => addDays(weekStartStr, i));
}

export function getDayOfWeekFromStr(dateStr: string): number {
  return parseLocalDate(dateStr).getDay();
}

export function formatLongDate(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatShortDate(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function formatWeekdayShort(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString(undefined, {weekday: 'short'});
}

export function formatWeekRange(weekStartStr: string, includeSunday = false): string {
  const endStr = addDays(weekStartStr, includeSunday ? 6 : 5);
  const start = parseLocalDate(weekStartStr);
  const end = parseLocalDate(endStr);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    const month = start.toLocaleDateString(undefined, {month: 'short'});
    return `${month} ${start.getDate()} – ${end.getDate()}, ${end.getFullYear()}`;
  }
  return `${formatShortDate(weekStartStr)} – ${formatShortDate(endStr)}, ${end.getFullYear()}`;
}

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(totalMins: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, totalMins));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatTime12h(hhmm: string): string {
  const [hRaw, mRaw] = hhmm.split(':').map(Number);
  const h = hRaw ?? 0;
  const m = mRaw ?? 0;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function getCurrentTimeHHMM(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function getGreeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function daysBetween(fromStr: string, toStr: string): number {
  const a = parseLocalDate(fromStr).getTime();
  const b = parseLocalDate(toStr).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

export const WEEKDAY_NAMES = [
  {value: 1, label: 'Monday', short: 'Mon'},
  {value: 2, label: 'Tuesday', short: 'Tue'},
  {value: 3, label: 'Wednesday', short: 'Wed'},
  {value: 4, label: 'Thursday', short: 'Thu'},
  {value: 5, label: 'Friday', short: 'Fri'},
  {value: 6, label: 'Saturday', short: 'Sat'},
  {value: 0, label: 'Sunday', short: 'Sun'},
];
