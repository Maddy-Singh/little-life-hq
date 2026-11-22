import {Habit, HabitFrequency, HabitLog} from '../types/models';
import {
  addDays,
  daysBetween,
  formatShortDate,
  getTodayStr,
  getWeekStartMonday,
  parseLocalDate,
  toLocalDateStr,
} from './date';

export interface HabitFrequencyOption {
  value: HabitFrequency;
  label: string;
  unitLabel: string;
  defaultTarget: number;
  allowTargetEdit: boolean;
}

export const HABIT_FREQUENCY_OPTIONS: HabitFrequencyOption[] = [
  {
    value: 'daily',
    label: 'Daily',
    unitLabel: 'days per week',
    defaultTarget: 7,
    allowTargetEdit: true,
  },
  {
    value: 'weekly',
    label: 'Weekly',
    unitLabel: 'time per week',
    defaultTarget: 1,
    allowTargetEdit: false,
  },
  {
    value: 'twice_a_week',
    label: 'Twice a week',
    unitLabel: 'times per week',
    defaultTarget: 2,
    allowTargetEdit: false,
  },
  {
    value: 'custom_weekly',
    label: 'Custom times per week',
    unitLabel: 'times per week',
    defaultTarget: 3,
    allowTargetEdit: true,
  },
  {
    value: 'every_2_weeks',
    label: 'Every 2 weeks',
    unitLabel: 'times per 2 weeks',
    defaultTarget: 1,
    allowTargetEdit: true,
  },
  {
    value: 'monthly',
    label: 'Monthly',
    unitLabel: 'time per month',
    defaultTarget: 1,
    allowTargetEdit: false,
  },
  {
    value: 'custom_monthly',
    label: 'Custom times per month',
    unitLabel: 'times per month',
    defaultTarget: 4,
    allowTargetEdit: true,
  },
  {
    value: 'every_2_months',
    label: 'Every 2 months',
    unitLabel: 'times per 2 months',
    defaultTarget: 1,
    allowTargetEdit: true,
  },
  {
    value: 'custom_interval',
    label: 'Custom schedule / interval',
    unitLabel: 'times per interval',
    defaultTarget: 1,
    allowTargetEdit: true,
  },
];

export function getHabitFrequency(habit: Habit): HabitFrequency {
  return habit.frequency ?? 'daily';
}

export function getHabitTarget(habit: Habit): number {
  const freq = getHabitFrequency(habit);
  if (freq === 'daily') {
    return Math.max(1, Math.min(7, habit.targetCount ?? habit.targetDaysPerWeek ?? 7));
  }
  if (freq === 'weekly' || freq === 'monthly') {
    return Math.max(1, habit.targetCount ?? 1);
  }
  if (freq === 'twice_a_week') {
    return Math.max(1, habit.targetCount ?? 2);
  }
  const opt = HABIT_FREQUENCY_OPTIONS.find((o) => o.value === freq);
  return Math.max(1, habit.targetCount ?? opt?.defaultTarget ?? 1);
}

export function describeHabitFrequency(habit: Habit): string {
  const freq = getHabitFrequency(habit);
  const target = getHabitTarget(habit);
  switch (freq) {
    case 'daily':
      return target === 7 ? 'Daily' : `Daily (${target}d/wk)`;
    case 'weekly':
      return 'Weekly (1x/wk)';
    case 'twice_a_week':
      return 'Twice a week (2x/wk)';
    case 'custom_weekly':
      return `${target}x per week`;
    case 'every_2_weeks':
      return target === 1 ? 'Every 2 weeks' : `${target}x every 2 weeks`;
    case 'monthly':
      return 'Monthly (1x/mo)';
    case 'custom_monthly':
      return `${target}x per month`;
    case 'every_2_months':
      return target === 1 ? 'Every 2 months' : `${target}x every 2 months`;
    case 'custom_interval': {
      const days = Math.max(1, habit.intervalDays ?? 7);
      if (habit.customLabel?.trim()) {
        return `${habit.customLabel.trim()} (${target}x)`;
      }
      return target === 1 ? `Every ${days} days` : `${target}x every ${days} days`;
    }
  }
}

export interface HabitPeriodEvaluation {
  frequency: HabitFrequency;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  target: number;
  completed: number;
  pct: number;
  completedDates: string[];
  usesWeeklyGrid: boolean;
}

export function evaluateHabitForWeek(
  habit: Habit,
  habitLogs: HabitLog[],
  weekStartStr: string
): HabitPeriodEvaluation {
  const freq = getHabitFrequency(habit);
  const target = getHabitTarget(habit);
  const weekEndStr = addDays(weekStartStr, 6);

  let periodStart = weekStartStr;
  let periodEnd = weekEndStr;
  let periodLabel = `${formatShortDate(weekStartStr)} – ${formatShortDate(weekEndStr)}`;
  let usesWeeklyGrid = true;

  if (freq === 'every_2_weeks') {
    usesWeeklyGrid = false;
    const anchorDate = habit.createdAt ? habit.createdAt.slice(0, 10) : weekStartStr;
    const anchorMonday = getWeekStartMonday(anchorDate);
    const blockIdx = Math.floor(daysBetween(anchorMonday, weekStartStr) / 14);
    periodStart = addDays(anchorMonday, blockIdx * 14);
    periodEnd = addDays(periodStart, 13);
    periodLabel = `2-week window: ${formatShortDate(periodStart)} – ${formatShortDate(periodEnd)}`;
  } else if (freq === 'monthly' || freq === 'custom_monthly') {
    usesWeeklyGrid = false;
    const midWeek = parseLocalDate(addDays(weekStartStr, 3));
    const start = new Date(midWeek.getFullYear(), midWeek.getMonth(), 1);
    const end = new Date(midWeek.getFullYear(), midWeek.getMonth() + 1, 0);
    periodStart = toLocalDateStr(start);
    periodEnd = toLocalDateStr(end);
    periodLabel = start.toLocaleDateString(undefined, {month: 'long', year: 'numeric'});
  } else if (freq === 'every_2_months') {
    usesWeeklyGrid = false;
    const anchorStr = habit.createdAt ? habit.createdAt.slice(0, 10) : weekStartStr;
    const anchor = parseLocalDate(anchorStr);
    const ref = parseLocalDate(addDays(weekStartStr, 3));
    const monthsDiff =
      (ref.getFullYear() - anchor.getFullYear()) * 12 + (ref.getMonth() - anchor.getMonth());
    const blockIdx = Math.floor(monthsDiff / 2);
    const blockStart = new Date(anchor.getFullYear(), anchor.getMonth() + blockIdx * 2, 1);
    const blockEnd = new Date(blockStart.getFullYear(), blockStart.getMonth() + 2, 0);
    periodStart = toLocalDateStr(blockStart);
    periodEnd = toLocalDateStr(blockEnd);
    const m1 = blockStart.toLocaleDateString(undefined, {month: 'short'});
    const m2 = blockEnd.toLocaleDateString(undefined, {month: 'short', year: 'numeric'});
    periodLabel = `${m1} – ${m2}`;
  } else if (freq === 'custom_interval') {
    usesWeeklyGrid = false;
    const interval = Math.max(1, habit.intervalDays ?? 7);
    const anchorStr = habit.createdAt ? habit.createdAt.slice(0, 10) : weekStartStr;
    const todayStr = getTodayStr();
    const refStr =
      todayStr >= weekStartStr && todayStr <= weekEndStr ? todayStr : addDays(weekStartStr, 3);
    const blockIdx = Math.floor(daysBetween(anchorStr, refStr) / interval);
    periodStart = addDays(anchorStr, blockIdx * interval);
    periodEnd = addDays(periodStart, interval - 1);
    periodLabel = `${formatShortDate(periodStart)} – ${formatShortDate(periodEnd)}`;
  }

  const completedDates = habitLogs
    .filter(
      (l) =>
        l.habitId === habit.id &&
        l.completed &&
        l.date >= periodStart &&
        l.date <= periodEnd
    )
    .map((l) => l.date)
    .sort();

  const completed = completedDates.length;
  const pct = Math.min(100, Math.round((completed / target) * 100));

  return {
    frequency: freq,
    periodStart,
    periodEnd,
    periodLabel,
    target,
    completed,
    pct,
    completedDates,
    usesWeeklyGrid,
  };
}

export function computeOverallHabitSummary(
  habits: Habit[],
  habitLogs: HabitLog[],
  weekStartStr: string
): {
  overallPct: number;
  onTargetCount: number;
  totalHabits: number;
  evaluations: Map<string, HabitPeriodEvaluation>;
} {
  const evaluations = new Map<string, HabitPeriodEvaluation>();
  if (habits.length === 0) {
    return {overallPct: 0, onTargetCount: 0, totalHabits: 0, evaluations};
  }

  let pctSum = 0;
  let onTargetCount = 0;
  for (const h of habits) {
    const ev = evaluateHabitForWeek(h, habitLogs, weekStartStr);
    evaluations.set(h.id, ev);
    pctSum += ev.pct;
    if (ev.pct >= 100) onTargetCount++;
  }

  return {
    overallPct: Math.min(100, Math.round(pctSum / habits.length)),
    onTargetCount,
    totalHabits: habits.length,
    evaluations,
  };
}
