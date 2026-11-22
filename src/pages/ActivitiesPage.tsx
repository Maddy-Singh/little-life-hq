import React, {useMemo, useState} from 'react';
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {motion} from 'motion/react';
import {useApp} from '../context/AppContext';
import {ConfirmDialog} from '../components/ui/ConfirmDialog';
import {EmptyState} from '../components/ui/EmptyState';
import {Modal} from '../components/ui/Modal';
import {
  Activity,
  ActivityStatus,
  ActivityType,
  Habit,
  HabitFrequency,
  PastelToken,
} from '../types/models';
import {
  addDays,
  formatShortDate,
  formatWeekRange,
  formatWeekdayShort,
  getTodayStr,
  getWeekDates,
  getWeekStartMonday,
  parseLocalDate,
} from '../utils/date';
import {
  HABIT_FREQUENCY_OPTIONS,
  computeOverallHabitSummary,
  describeHabitFrequency,
  getHabitFrequency,
  getHabitTarget,
} from '../utils/habits';
import {generateId} from '../utils/id';
import {PASTEL_KEYS, PASTEL_PALETTE} from '../utils/theme';

const ACTIVITY_TYPES: ActivityType[] = [
  'Extracurricular',
  'Club',
  'Personal Project',
  'One-off Event',
];

const VIBRANT_HABIT_CHECK: Record<PastelToken, string> = {
  mint: 'bg-[#28C780] border-[#21B271] text-white shadow-xs',
  lavender: 'bg-[#9D74F7] border-[#895FE8] text-white shadow-xs',
  pink: 'bg-[#F46CA8] border-[#DF5793] text-white shadow-xs',
  butter: 'bg-[#F7B924] border-[#E0A314] text-white shadow-xs',
  peach: 'bg-[#F38B59] border-[#DD7645] text-white shadow-xs',
  sky: 'bg-[#4FA3EC] border-[#3A8ED8] text-white shadow-xs',
};

type ActivityFilter = 'ALL' | ActivityType;

export const ActivitiesPage: React.FC = () => {
  const {
    activities,
    habits,
    habitLogs,
    saveActivity,
    deleteActivity,
    saveHabit,
    deleteHabit,
    toggleHabitLog,
    showToast,
  } = useApp();

  const todayStr = getTodayStr();
  const [habitWeekStart, setHabitWeekStart] = useState<string>(() =>
    getWeekStartMonday(todayStr)
  );
  const weekDates = useMemo(() => getWeekDates(habitWeekStart, true), [habitWeekStart]);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('ALL');

  // Habit modal
  const [habitModalOpen, setHabitModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [habitName, setHabitName] = useState('');
  const [habitCategory, setHabitCategory] = useState('Wellness');
  const [habitFrequency, setHabitFrequency] = useState<HabitFrequency>('daily');
  const [habitTarget, setHabitTarget] = useState(7);
  const [habitIntervalDays, setHabitIntervalDays] = useState(10);
  const [habitCustomLabel, setHabitCustomLabel] = useState('');
  const [habitColor, setHabitColor] = useState<PastelToken>('mint');
  const [deleteHabitTarget, setDeleteHabitTarget] = useState<Habit | null>(null);

  // Per-habit date input for period/long-cycle habits
  const [periodDateDrafts, setPeriodDateDrafts] = useState<Record<string, string>>({});

  // Activity modal
  const [actModalOpen, setActModalOpen] = useState(false);
  const [editingAct, setEditingAct] = useState<Activity | null>(null);
  const [actTitle, setActTitle] = useState('');
  const [actType, setActType] = useState<ActivityType>('Club');
  const [actRecurring, setActRecurring] = useState(true);
  const [actCadence, setActCadence] = useState('');
  const [actDate, setActDate] = useState('');
  const [actRole, setActRole] = useState('');
  const [actDesc, setActDesc] = useState('');
  const [actStatus, setActStatus] = useState<ActivityStatus>('Active');
  const [deleteActTarget, setDeleteActTarget] = useState<Activity | null>(null);

  const habitLogSet = useMemo(() => {
    const s = new Set<string>();
    for (const l of habitLogs) {
      if (l.completed) s.add(l.id);
    }
    return s;
  }, [habitLogs]);

  const habitSummary = useMemo(
    () => computeOverallHabitSummary(habits, habitLogs, habitWeekStart),
    [habits, habitLogs, habitWeekStart]
  );

  const weeklyGridHabits = useMemo(
    () => habits.filter((h) => habitSummary.evaluations.get(h.id)?.usesWeeklyGrid ?? true),
    [habits, habitSummary]
  );

  const periodHabits = useMemo(
    () => habits.filter((h) => !(habitSummary.evaluations.get(h.id)?.usesWeeklyGrid ?? true)),
    [habits, habitSummary]
  );

  // Mon-Sun daily completion counts across all habits for the chart
  const dailyCompletionSeries = useMemo(() => {
    return weekDates.map((d) => {
      let count = 0;
      for (const h of habits) {
        if (habitLogSet.has(`${h.id}_${d}`)) count++;
      }
      return {
        date: d,
        day: formatWeekdayShort(d),
        count,
      };
    });
  }, [weekDates, habits, habitLogSet]);

  const chartMax = useMemo(() => {
    const peak = Math.max(...dailyCompletionSeries.map((d) => d.count), 0);
    return Math.max(4, peak);
  }, [dailyCompletionSeries]);

  const filteredActivities = useMemo(() => {
    if (activityFilter === 'ALL') return activities;
    return activities.filter((a) => a.type === activityFilter);
  }, [activities, activityFilter]);

  const selectedFreqOption = useMemo(
    () => HABIT_FREQUENCY_OPTIONS.find((o) => o.value === habitFrequency) ?? HABIT_FREQUENCY_OPTIONS[0],
    [habitFrequency]
  );

  const openNewHabit = () => {
    setEditingHabit(null);
    setHabitName('');
    setHabitCategory('Wellness');
    setHabitFrequency('daily');
    setHabitTarget(7);
    setHabitIntervalDays(10);
    setHabitCustomLabel('');
    setHabitColor('mint');
    setHabitModalOpen(true);
  };

  const openEditHabit = (h: Habit) => {
    const freq = getHabitFrequency(h);
    const target = getHabitTarget(h);
    setEditingHabit(h);
    setHabitName(h.name);
    setHabitCategory(h.category);
    setHabitFrequency(freq);
    setHabitTarget(target);
    setHabitIntervalDays(h.intervalDays ?? 10);
    setHabitCustomLabel(h.customLabel ?? '');
    setHabitColor(h.color);
    setHabitModalOpen(true);
  };

  const handleFrequencyChange = (nextFreq: HabitFrequency) => {
    setHabitFrequency(nextFreq);
    const opt = HABIT_FREQUENCY_OPTIONS.find((o) => o.value === nextFreq);
    if (opt) {
      setHabitTarget(opt.defaultTarget);
    }
  };

  const handleSaveHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!habitName.trim()) return;
    const now = new Date().toISOString();
    const maxTarget = habitFrequency === 'daily' ? 7 : 60;
    const resolvedTarget = Math.max(1, Math.min(maxTarget, Number(habitTarget) || 1));

    await saveHabit({
      id: editingHabit?.id ?? generateId(),
      name: habitName.trim(),
      category: habitCategory.trim() || 'General',
      frequency: habitFrequency,
      targetCount: resolvedTarget,
      intervalDays:
        habitFrequency === 'custom_interval'
          ? Math.max(1, Number(habitIntervalDays) || 7)
          : undefined,
      customLabel:
        habitFrequency === 'custom_interval' ? habitCustomLabel.trim() || undefined : undefined,
      targetDaysPerWeek: habitFrequency === 'daily' ? Math.min(7, resolvedTarget) : resolvedTarget,
      color: habitColor,
      createdAt: editingHabit?.createdAt ?? now,
      updatedAt: now,
    });
    showToast(editingHabit ? 'Habit updated.' : 'Habit added.');
    setHabitModalOpen(false);
  };

  const openNewActivity = () => {
    setEditingAct(null);
    setActTitle('');
    setActType('Club');
    setActRecurring(true);
    setActCadence('');
    setActDate('');
    setActRole('');
    setActDesc('');
    setActStatus('Active');
    setActModalOpen(true);
  };

  const openEditActivity = (a: Activity) => {
    setEditingAct(a);
    setActTitle(a.title);
    setActType(a.type);
    setActRecurring(a.isRecurring);
    setActCadence(a.cadence ?? '');
    setActDate(a.date ?? '');
    setActRole(a.role ?? '');
    setActDesc(a.description);
    setActStatus(a.status);
    setActModalOpen(true);
  };

  const handleSaveActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actTitle.trim()) return;
    const now = new Date().toISOString();
    await saveActivity({
      id: editingAct?.id ?? generateId(),
      title: actTitle.trim(),
      type: actType,
      isRecurring: actRecurring,
      cadence: actRecurring ? actCadence.trim() || undefined : undefined,
      date: !actRecurring && actDate ? actDate : undefined,
      role: actRole.trim() || undefined,
      description: actDesc.trim(),
      status: actStatus,
      createdAt: editingAct?.createdAt ?? now,
      updatedAt: now,
    });
    showToast(editingAct ? 'Activity updated.' : 'Activity added.');
    setActModalOpen(false);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#1F1929] dark:text-white">
            My Activities
          </h1>
          <p className="text-sm text-[#685E75] dark:text-[#AFA6C2] mt-1">
            Clubs, extracurriculars, personal projects, one-off events, and your flexible habit tracker.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={openNewHabit}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold border border-[#E4DCD7] dark:border-[#39334B] bg-white dark:bg-[#1E1A2A] text-[#2D2638] dark:text-white hover:bg-[#FAF7F5] dark:hover:bg-[#292438] shadow-2xs transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add habit</span>
          </button>
          <button
            type="button"
            onClick={openNewActivity}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-xs font-bold bg-[#7B4CE2] hover:bg-[#6A3CD1] text-white shadow-sm shadow-[#7B4CE2]/25 transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add activity / event</span>
          </button>
        </div>
      </div>

      {/* HABIT TRACKER */}
      <section className="p-6 sm:p-7 rounded-3xl border border-[#ECE4DF] dark:border-[#322C42] bg-white dark:bg-[#1E1A2A] journal-card space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-[#1F1929] dark:text-white">
              Weekly Habit Tracker
            </h2>
            <p className="text-xs text-[#685E75] dark:text-[#AFA6C2] tabular-nums mt-0.5">
              {formatWeekRange(habitWeekStart, true)} ·{' '}
              <strong className="text-[#1D744E] dark:text-[#9CE4BF]">
                {habitSummary.overallPct}%
              </strong>{' '}
              target achievement ({habitSummary.onTargetCount}/{habitSummary.totalHabits} habits on
              target)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setHabitWeekStart(addDays(habitWeekStart, -7))}
              aria-label="Previous week"
              className="w-8 h-8 rounded-full border border-[#E4DCD7] dark:border-[#39334B] bg-white dark:bg-[#262233] hover:bg-[#FAF7F5] dark:hover:bg-[#312C40] inline-flex items-center justify-center transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setHabitWeekStart(getWeekStartMonday(todayStr))}
              className="px-4 py-1.5 rounded-full text-xs font-bold border border-[#E4DCD7] dark:border-[#39334B] bg-white dark:bg-[#262233] hover:bg-[#FAF7F5] dark:hover:bg-[#312C40] text-[#2D2638] dark:text-white transition-colors"
            >
              This week
            </button>
            <button
              type="button"
              onClick={() => setHabitWeekStart(addDays(habitWeekStart, 7))}
              aria-label="Next week"
              className="w-8 h-8 rounded-full border border-[#E4DCD7] dark:border-[#39334B] bg-white dark:bg-[#262233] hover:bg-[#FAF7F5] dark:hover:bg-[#312C40] inline-flex items-center justify-center transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {habits.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="w-6 h-6" />}
            title="No habits tracked yet"
            description="Create daily, weekly, fortnightly, monthly, or custom-schedule habits and track completions against your actual target."
            actionLabel="Add first habit"
            onAction={openNewHabit}
            tone="mint"
          />
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              {/* Left: Weekly Check-in Grid */}
              <div className="xl:col-span-8">
                {weeklyGridHabits.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px] border-collapse">
                      <thead>
                        <tr className="border-b border-[#F2ECE8] dark:border-[#2C273B] text-xs font-semibold text-[#685E75] dark:text-[#AFA6C2]">
                          <th className="py-2.5 pr-3 text-left">Habit</th>
                          {weekDates.map((d) => {
                            const dayNum = parseLocalDate(d).getDate();
                            const isToday = d === todayStr;
                            return (
                              <th key={d} className="py-2.5 px-1.5 text-center">
                                <div
                                  className={
                                    isToday ? 'text-[#7B4CE2] dark:text-[#C5B2F7] font-bold' : ''
                                  }
                                >
                                  {formatWeekdayShort(d)}
                                </div>
                                <div
                                  className={`text-[11px] tabular-nums mt-0.5 ${
                                    isToday
                                      ? 'text-[#7B4CE2] dark:text-[#C5B2F7] font-bold'
                                      : 'font-normal'
                                  }`}
                                >
                                  {dayNum}
                                </div>
                              </th>
                            );
                          })}
                          <th className="py-2.5 px-2 text-right">Target</th>
                          <th className="py-2.5 pl-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F2ECE8] dark:divide-[#2C273B]">
                        {weeklyGridHabits.map((h) => {
                          const evalInfo = habitSummary.evaluations.get(h.id);
                          const doneCount = evalInfo?.completed ?? 0;
                          const target = evalInfo?.target ?? getHabitTarget(h);
                          const pct = evalInfo?.pct ?? 0;
                          return (
                            <tr key={h.id}>
                              <td className="py-3.5 pr-3">
                                <p className="text-sm font-bold text-[#1F1929] dark:text-white">
                                  {h.name}
                                </p>
                                <p className="text-[11px] text-[#685E75] dark:text-[#AFA6C2]">
                                  {h.category} · {describeHabitFrequency(h)}
                                </p>
                              </td>

                              {weekDates.map((d) => {
                                const checked = habitLogSet.has(`${h.id}_${d}`);
                                return (
                                  <td key={d} className="py-3.5 px-1.5 text-center">
                                    <motion.button
                                      type="button"
                                      whileTap={{scale: 0.85}}
                                      onClick={() => toggleHabitLog(h.id, d)}
                                      aria-label={`${h.name} on ${d}: ${checked ? 'completed' : 'not completed'}`}
                                      aria-pressed={checked}
                                      className={`w-9 h-9 rounded-xl inline-flex items-center justify-center border transition-all ${
                                        checked
                                          ? VIBRANT_HABIT_CHECK[h.color]
                                          : 'bg-[#F5F2F0] dark:bg-[#2A2538] border-[#EAE2DC] dark:border-[#39334B] hover:border-[#C9BFB8] text-transparent'
                                      }`}
                                    >
                                      <Check className="w-4 h-4 stroke-[2.5]" />
                                    </motion.button>
                                  </td>
                                );
                              })}

                              <td className="py-3.5 px-2 text-right tabular-nums text-xs font-bold whitespace-nowrap">
                                <span
                                  className={
                                    pct >= 100
                                      ? 'text-[#1D744E] dark:text-[#9CE4BF]'
                                      : 'text-[#1F1929] dark:text-white'
                                  }
                                >
                                  {doneCount}/{target}
                                </span>
                                <span className="ml-1 text-[#685E75] dark:text-[#AFA6C2] font-semibold">
                                  ({pct}%)
                                </span>
                              </td>

                              <td className="py-3.5 pl-2 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => openEditHabit(h)}
                                    aria-label={`Edit ${h.name}`}
                                    className="p-1.5 rounded-lg text-[#685E75] hover:bg-[#F5F0F8] dark:text-[#AFA6C2] dark:hover:bg-[#2B263B]"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteHabitTarget(h)}
                                    aria-label={`Delete ${h.name}`}
                                    className="p-1.5 rounded-lg text-[#D9385A] hover:bg-[#FFF2F4] dark:text-[#F8A5AE] dark:hover:bg-[#3F2227]"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-[#685E75] dark:text-[#AFA6C2] py-4">
                    Your habits currently use fortnightly, monthly, or custom-interval targets shown
                    below.
                  </p>
                )}
              </div>

              {/* Right: Weekly Completion Summary Bar Chart */}
              <div className="xl:col-span-4 p-5 rounded-3xl bg-[#FAF7F5] dark:bg-[#252132] border border-[#EFE8E3] dark:border-[#332E45] space-y-3">
                <h3 className="text-sm font-bold text-[#1F1929] dark:text-white">
                  Weekly Completion Summary
                </h3>

                <div className="pt-1">
                  <svg
                    viewBox="0 0 280 155"
                    className="w-full h-40 overflow-visible"
                    role="img"
                    aria-label="Weekly completion summary bar chart from Monday to Sunday"
                  >
                    {/* Y axis */}
                    <line
                      x1="28"
                      y1="14"
                      x2="28"
                      y2="124"
                      stroke="currentColor"
                      strokeOpacity={0.28}
                      strokeWidth="1"
                    />
                    {/* X axis */}
                    <line
                      x1="28"
                      y1="124"
                      x2="274"
                      y2="124"
                      stroke="currentColor"
                      strokeOpacity={0.28}
                      strokeWidth="1"
                    />

                    {/* Y ticks */}
                    {Array.from({length: 5}, (_, i) => {
                      const val = Math.round((chartMax / 4) * i);
                      const y = 124 - (i / 4) * 110;
                      return (
                        <g key={i}>
                          <line
                            x1="24"
                            y1={y}
                            x2="28"
                            y2={y}
                            stroke="currentColor"
                            strokeOpacity={0.35}
                            strokeWidth="1"
                          />
                          <text
                            x="20"
                            y={y + 3.5}
                            textAnchor="end"
                            fontSize="10"
                            fill="currentColor"
                            opacity={0.65}
                            className="tabular-nums"
                          >
                            {val}
                          </text>
                        </g>
                      );
                    })}

                    {/* Bars */}
                    {dailyCompletionSeries.map((pt, idx) => {
                      const slotW = (274 - 34) / 7;
                      const barW = 24;
                      const x = 34 + idx * slotW + (slotW - barW) / 2;
                      const barH = pt.count > 0 ? Math.max(8, (pt.count / chartMax) * 110) : 0;
                      const y = 124 - barH;
                      return (
                        <g key={pt.date}>
                          {barH > 0 && (
                            <rect
                              x={x}
                              y={y}
                              width={barW}
                              height={barH}
                              rx={6}
                              fill="#9D7BF2"
                            >
                              <title>{`${pt.day} (${formatShortDate(pt.date)}): ${pt.count} completed`}</title>
                            </rect>
                          )}
                          <text
                            x={x + barW / 2}
                            y="142"
                            textAnchor="middle"
                            fontSize="10"
                            fill="currentColor"
                            opacity={0.72}
                          >
                            {pt.day}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            </div>

            {/* Multi-week / Monthly / Every-2-months / Custom-interval Habits */}
            {periodHabits.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-[#F2ECE8] dark:border-[#2C273B]">
                <h3 className="text-sm font-bold text-[#1F1929] dark:text-white">
                  Fortnightly, Monthly &amp; Custom-Interval Habits
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {periodHabits.map((h) => {
                    const palette = PASTEL_PALETTE[h.color];
                    const evalInfo = habitSummary.evaluations.get(h.id);
                    if (!evalInfo) return null;
                    const defaultPickDate =
                      todayStr >= evalInfo.periodStart && todayStr <= evalInfo.periodEnd
                        ? todayStr
                        : evalInfo.periodStart;
                    const pickedDate = periodDateDrafts[h.id] ?? defaultPickDate;
                    const todayChecked = habitLogSet.has(`${h.id}_${todayStr}`);
                    const todayInPeriod =
                      todayStr >= evalInfo.periodStart && todayStr <= evalInfo.periodEnd;

                    return (
                      <div
                        key={h.id}
                        className="p-4 rounded-2xl border border-[#ECE4DF] dark:border-[#322C42] bg-[#FAF7F5] dark:bg-[#252132] space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <span
                              className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${palette.dot}`}
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-[#1F1929] dark:text-white truncate">
                                {h.name}
                              </p>
                              <p className="text-xs text-[#685E75] dark:text-[#AFA6C2]">
                                {h.category} · {describeHabitFrequency(h)}
                              </p>
                              <p className="text-[11px] text-[#7D728F] dark:text-[#9D94B0] mt-0.5 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                <span>{evalInfo.periodLabel}</span>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => openEditHabit(h)}
                              aria-label={`Edit ${h.name}`}
                              className="p-1.5 rounded-lg text-[#685E75] hover:bg-white dark:text-[#AFA6C2] dark:hover:bg-[#1F1C29]"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteHabitTarget(h)}
                              aria-label={`Delete ${h.name}`}
                              className="p-1.5 rounded-lg text-[#D9385A] hover:bg-[#FFF2F4] dark:text-[#F8A5AE]"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs font-bold tabular-nums">
                            <span>
                              {evalInfo.completed} / {evalInfo.target} completed
                            </span>
                            <span
                              className={
                                evalInfo.pct >= 100
                                  ? 'text-[#1D744E] dark:text-[#9CE4BF]'
                                  : ''
                              }
                            >
                              {evalInfo.pct}%
                            </span>
                          </div>
                          <div className="h-2.5 rounded-full bg-white dark:bg-[#1B1824] overflow-hidden border border-[#EAE2DC] dark:border-[#342F44]">
                            <div
                              className="h-full rounded-full bg-[#28C780] transition-all"
                              style={{width: `${evalInfo.pct}%`}}
                            />
                          </div>
                        </div>

                        {/* Check-in controls for the active period */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {todayInPeriod && (
                            <motion.button
                              type="button"
                              whileTap={{scale: 0.94}}
                              onClick={() => toggleHabitLog(h.id, todayStr)}
                              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                                todayChecked
                                  ? `${palette.bg} ${palette.border} ${palette.text}`
                                  : 'bg-white dark:bg-[#1F1C29] border-[#E4DCD7] dark:border-[#39334B] text-[#2D2638] dark:text-white'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{todayChecked ? 'Completed Today' : 'Log Today'}</span>
                            </motion.button>
                          )}

                          <div className="flex items-center gap-1.5 ml-auto">
                            <input
                              type="date"
                              min={evalInfo.periodStart}
                              max={evalInfo.periodEnd}
                              value={pickedDate}
                              onChange={(e) =>
                                setPeriodDateDrafts((prev) => ({...prev, [h.id]: e.target.value}))
                              }
                              aria-label={`Select date for ${h.name}`}
                              className="px-2.5 py-1 rounded-xl border border-[#E4DCD7] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-xs tabular-nums"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (!pickedDate) return;
                                toggleHabitLog(h.id, pickedDate);
                              }}
                              className="px-3 py-1 rounded-full text-xs font-bold bg-[#EFE8FC] dark:bg-[#2F2547] text-[#4C3482] dark:text-[#DDD0FA]"
                            >
                              {habitLogSet.has(`${h.id}_${pickedDate}`) ? 'Unlog Date' : 'Log Date'}
                            </button>
                          </div>
                        </div>

                        {evalInfo.completedDates.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#685E75] dark:text-[#AFA6C2]">
                            <span>Logged:</span>
                            {evalInfo.completedDates.map((d) => (
                              <button
                                key={d}
                                type="button"
                                onClick={() => toggleHabitLog(h.id, d)}
                                title="Click to remove this check-in"
                                className="px-2.5 py-0.5 rounded-full bg-white dark:bg-[#1F1C29] border border-[#E4DCD7] dark:border-[#39334B] hover:border-[#D9385A] tabular-nums"
                              >
                                {formatShortDate(d)} ×
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* CLUBS, PROJECTS & EVENTS */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-[#1F1929] dark:text-white">
            Clubs, Projects &amp; Events
          </h2>

          <div className="inline-flex flex-wrap p-1 rounded-2xl border border-[#ECE4DF] dark:border-[#322C42] bg-white dark:bg-[#1E1A2A] journal-card self-start sm:self-auto">
            {(
              [
                {key: 'ALL', label: 'All'},
                {key: 'Club', label: 'Clubs'},
                {key: 'Personal Project', label: 'Projects'},
                {key: 'Extracurricular', label: 'Extracurricular'},
                {key: 'One-off Event', label: 'Events'},
              ] as const
            ).map((f) => {
              const active = activityFilter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setActivityFilter(f.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    active
                      ? 'bg-[#FEF9E6] text-[#9A6F0C] border border-[#F7E4A6] dark:bg-[#3F361C] dark:text-[#F8E7B0] dark:border-[#6B5B2C]'
                      : 'text-[#685E75] dark:text-[#AFA6C2] hover:text-[#1F1929] dark:hover:text-white border border-transparent'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {filteredActivities.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="w-6 h-6" />}
            title={activities.length === 0 ? 'No activities recorded yet' : 'No matching activities'}
            description="Track club committees, recurring workshops, personal projects, or one-off campus events."
            actionLabel={activities.length === 0 ? 'Add first activity' : undefined}
            onAction={activities.length === 0 ? openNewActivity : undefined}
            tone="butter"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredActivities.map((act) => (
              <div
                key={act.id}
                className="p-5 rounded-3xl border border-[#ECE4DF] dark:border-[#322C42] bg-white dark:bg-[#1E1A2A] journal-card space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-[#9A6F0C] dark:text-[#F8E7B0]">
                      {act.type} · {act.isRecurring ? 'Recurring' : 'One-Off'} · {act.status}
                    </p>
                    <h3 className="text-base font-bold text-[#1F1929] dark:text-white truncate mt-0.5">
                      {act.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditActivity(act)}
                      aria-label={`Edit ${act.title}`}
                      className="p-1.5 rounded-lg text-[#685E75] hover:bg-[#F5F0F8] dark:text-[#AFA6C2]"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteActTarget(act)}
                      aria-label={`Delete ${act.title}`}
                      className="p-1.5 rounded-lg text-[#D9385A] hover:bg-[#FFF2F4] dark:text-[#F8A5AE]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {act.role && (
                  <p className="text-xs font-semibold text-[#6D4AE2] dark:text-[#DDD0FA]">
                    Role: {act.role}
                  </p>
                )}

                {act.isRecurring && act.cadence && (
                  <p className="text-xs text-[#685E75] dark:text-[#AFA6C2]">
                    Schedule: {act.cadence}
                  </p>
                )}

                {!act.isRecurring && act.date && (
                  <p className="text-xs text-[#685E75] dark:text-[#AFA6C2] tabular-nums">
                    Date: {formatShortDate(act.date)}
                  </p>
                )}

                {act.description && (
                  <p className="text-xs text-[#4A4158] dark:text-[#D5CEE3] leading-relaxed">
                    {act.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Habit Modal */}
      <Modal
        open={habitModalOpen}
        onClose={() => setHabitModalOpen(false)}
        title={editingHabit ? 'Edit Habit' : 'Add Habit'}
      >
        <form onSubmit={handleSaveHabit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
              Habit Name *
            </label>
            <input
              type="text"
              required
              value={habitName}
              onChange={(e) => setHabitName(e.target.value)}
              placeholder="e.g. Guitar practice / Deep clean desk / 5k run"
              className="w-full px-3.5 py-2.5 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                Category
              </label>
              <input
                type="text"
                value={habitCategory}
                onChange={(e) => setHabitCategory(e.target.value)}
                className="w-full px-3 py-2.5 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                Colour
              </label>
              <select
                value={habitColor}
                onChange={(e) => setHabitColor(e.target.value as PastelToken)}
                className="w-full px-2.5 py-2.5 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-xs font-semibold"
              >
                {PASTEL_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {PASTEL_PALETTE[k].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                Tracking Frequency
              </label>
              <select
                value={habitFrequency}
                onChange={(e) => handleFrequencyChange(e.target.value as HabitFrequency)}
                className="w-full px-3 py-2.5 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
              >
                {HABIT_FREQUENCY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                Target ({selectedFreqOption.unitLabel})
              </label>
              <input
                type="number"
                min={1}
                max={habitFrequency === 'daily' ? 7 : 60}
                disabled={!selectedFreqOption.allowTargetEdit}
                value={habitTarget}
                onChange={(e) => setHabitTarget(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#16141D] disabled:opacity-60 text-sm tabular-nums"
              />
            </div>
          </div>

          {habitFrequency === 'custom_interval' && (
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-[#FAF7F5] dark:bg-[#262233] border border-[#EFE8E3] dark:border-[#332E45]">
              <div>
                <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                  Repeat Every (days)
                </label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={habitIntervalDays}
                  onChange={(e) => setHabitIntervalDays(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                  Schedule Label (optional)
                </label>
                <input
                  type="text"
                  value={habitCustomLabel}
                  onChange={(e) => setHabitCustomLabel(e.target.value)}
                  placeholder="e.g. Every 10 days"
                  className="w-full px-3 py-2 rounded-xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setHabitModalOpen(false)}
              className="px-4 py-2 rounded-full text-sm font-semibold border border-[#E4DCD7] dark:border-[#39334B]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-full text-sm font-bold bg-[#7B4CE2] hover:bg-[#6A3CD1] text-white"
            >
              {editingHabit ? 'Save Habit' : 'Add Habit'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Activity Modal */}
      <Modal
        open={actModalOpen}
        onClose={() => setActModalOpen(false)}
        title={editingAct ? 'Edit Activity' : 'Add Activity'}
      >
        <form onSubmit={handleSaveActivity} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
              Title *
            </label>
            <input
              type="text"
              required
              value={actTitle}
              onChange={(e) => setActTitle(e.target.value)}
              placeholder="e.g. Entrepreneurship Cell / Portfolio Website"
              className="w-full px-3.5 py-2.5 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                Type
              </label>
              <select
                value={actType}
                onChange={(e) => setActType(e.target.value as ActivityType)}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
              >
                {ACTIVITY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                Status
              </label>
              <select
                value={actStatus}
                onChange={(e) => setActStatus(e.target.value as ActivityStatus)}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
              >
                <option value="Active">Active</option>
                <option value="Paused">Paused</option>
                <option value="Upcoming">Upcoming</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={actRecurring}
                onChange={() => setActRecurring(true)}
                className="accent-[#7B4CE2]"
              />
              <span>Recurring</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={!actRecurring}
                onChange={() => setActRecurring(false)}
                className="accent-[#7B4CE2]"
              />
              <span>One-off Event</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {actRecurring ? (
              <div>
                <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                  Cadence (optional)
                </label>
                <input
                  type="text"
                  value={actCadence}
                  onChange={(e) => setActCadence(e.target.value)}
                  placeholder="e.g. Every Wednesday"
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                  Date (optional)
                </label>
                <input
                  type="date"
                  value={actDate}
                  onChange={(e) => setActDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm tabular-nums"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                Role (optional)
              </label>
              <input
                type="text"
                value={actRole}
                onChange={(e) => setActRole(e.target.value)}
                placeholder="e.g. Core Coordinator"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
              Description
            </label>
            <textarea
              rows={2}
              value={actDesc}
              onChange={(e) => setActDesc(e.target.value)}
              placeholder="Responsibilities, notes, or milestones..."
              className="w-full px-3.5 py-2.5 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setActModalOpen(false)}
              className="px-4 py-2 rounded-full text-sm font-semibold border border-[#E4DCD7] dark:border-[#39334B]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-full text-sm font-bold bg-[#7B4CE2] hover:bg-[#6A3CD1] text-white"
            >
              {editingAct ? 'Save Activity' : 'Add Activity'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteHabitTarget)}
        onClose={() => setDeleteHabitTarget(null)}
        onConfirm={async () => {
          if (!deleteHabitTarget) return;
          await deleteHabit(deleteHabitTarget.id);
          showToast('Habit deleted.');
        }}
        title="Delete Habit"
        description={`Delete "${deleteHabitTarget?.name ?? ''}" and all its check-in history?`}
        confirmLabel="Delete Habit"
      />

      <ConfirmDialog
        open={Boolean(deleteActTarget)}
        onClose={() => setDeleteActTarget(null)}
        onConfirm={async () => {
          if (!deleteActTarget) return;
          await deleteActivity(deleteActTarget.id);
          showToast('Activity deleted.');
        }}
        title="Delete Activity"
        description={`Delete "${deleteActTarget?.title ?? ''}"?`}
        confirmLabel="Delete Activity"
      />
    </div>
  );
};
