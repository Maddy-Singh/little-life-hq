import React, {useMemo, useState} from 'react';
import {
  ArrowRight,
  Briefcase,
  CalendarCheck2,
  Check,
  CheckCircle2,
  Plus,
  Sparkles,
  Target,
} from 'lucide-react';
import {useApp} from '../context/AppContext';
import {TimetableEventModal} from '../components/timetable/TimetableEventModal';
import {HeroDeskDoodle} from '../components/ui/JournalIllustrations';
import {Modal} from '../components/ui/Modal';
import {
  GoalCategory,
  GoalPriority,
} from '../types/models';
import {
  addDays,
  daysBetween,
  formatLongDate,
  formatShortDate,
  formatTime12h,
  getCurrentTimeHHMM,
  getGreeting,
  getTodayStr,
  getWeekStartMonday,
  timeToMinutes,
} from '../utils/date';
import {computeOverallHabitSummary} from '../utils/habits';
import {generateId} from '../utils/id';
import {resolveOccurrencesForRange} from '../utils/timetable';

export const HomePage: React.FC = () => {
  const {
    settings,
    goals,
    assignments,
    subjects,
    timetableEvents,
    timetableExceptions,
    internshipApplications,
    habits,
    habitLogs,
    setActivePage,
    saveGoal,
    saveAssignment,
    showToast,
  } = useApp();

  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [quickGoalOpen, setQuickGoalOpen] = useState(false);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalCategory, setGoalCategory] = useState<GoalCategory>('Academics');
  const [goalPriority, setGoalPriority] = useState<GoalPriority>('Medium');
  const [goalTargetDate, setGoalTargetDate] = useState('');

  const todayStr = getTodayStr();
  const weekStartStr = getWeekStartMonday(todayStr);
  const nowMinutes = timeToMinutes(getCurrentTimeHHMM());

  // Timetable today + next 3 days
  const todayOccurrences = useMemo(
    () => resolveOccurrencesForRange(timetableEvents, timetableExceptions, todayStr, todayStr),
    [timetableEvents, timetableExceptions, todayStr]
  );

  const activeTodayOccurrences = useMemo(
    () => todayOccurrences.filter((o) => !o.isCancelled),
    [todayOccurrences]
  );

  const nextOrCurrentEvent = useMemo(() => {
    return activeTodayOccurrences.find((o) => timeToMinutes(o.endTime) > nowMinutes) ?? null;
  }, [activeTodayOccurrences, nowMinutes]);

  const upcomingDaysOccurrences = useMemo(() => {
    const start = addDays(todayStr, 1);
    const end = addDays(todayStr, 3);
    return resolveOccurrencesForRange(timetableEvents, timetableExceptions, start, end).filter(
      (o) => !o.isCancelled
    );
  }, [timetableEvents, timetableExceptions, todayStr]);

  // Goals summary
  const activeGoals = useMemo(
    () => goals.filter((g) => g.status === 'In progress' || g.status === 'Not started'),
    [goals]
  );
  const completedGoalsCount = useMemo(
    () => goals.filter((g) => g.status === 'Completed').length,
    [goals]
  );
  const goalCompletionPct =
    goals.length > 0 ? Math.round((completedGoalsCount / goals.length) * 100) : 0;

  // Upcoming assignments
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const openAssignments = useMemo(
    () =>
      assignments
        .filter((a) => a.status !== 'Submitted')
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [assignments]
  );
  const upcomingAssignments = useMemo(() => openAssignments.slice(0, 4), [openAssignments]);

  // Habit target-based progress + today's check-ins
  const habitStats = useMemo(
    () => computeOverallHabitSummary(habits, habitLogs, weekStartStr),
    [habits, habitLogs, weekStartStr]
  );

  const habitsCheckedToday = useMemo(() => {
    if (habits.length === 0) return 0;
    const todaySet = new Set(
      habitLogs.filter((l) => l.completed && l.date === todayStr).map((l) => l.habitId)
    );
    return habits.filter((h) => todaySet.has(h.id)).length;
  }, [habits, habitLogs, todayStr]);

  // Combined weekly progress indicator (matching screenshot)
  const combinedWeeklyPct = useMemo(() => {
    if (goals.length === 0 && habits.length === 0) return 0;
    if (goals.length === 0) return habitStats.overallPct;
    if (habits.length === 0) return goalCompletionPct;
    return Math.round((goalCompletionPct + habitStats.overallPct) / 2);
  }, [goals.length, habits.length, goalCompletionPct, habitStats.overallPct]);

  // Internship overview
  const internshipSummary = useMemo(() => {
    const total = internshipApplications.length;
    const underConsideration = internshipApplications.filter(
      (a) => a.status === 'Under Consideration'
    ).length;
    const assessments = internshipApplications.filter((a) => a.status === 'Assessment').length;
    const interviews = internshipApplications.filter(
      (a) => a.status === 'Interview Scheduled'
    ).length;
    const offers = internshipApplications.filter((a) => a.status === 'Offer Received').length;
    const followUps = internshipApplications
      .filter(
        (a) =>
          a.followUpDate &&
          a.status !== 'Rejected' &&
          a.status !== 'Withdrawn' &&
          daysBetween(todayStr, a.followUpDate) <= 7
      )
      .sort((a, b) => (a.followUpDate ?? '').localeCompare(b.followUpDate ?? ''))
      .slice(0, 3);
    return {total, underConsideration, assessments, interviews, offers, followUps};
  }, [internshipApplications, todayStr]);

  const getCatName = (catId: string) =>
    settings.eventCategories.find((c) => c.id === catId)?.name ?? 'Event';

  const handleQuickGoalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle.trim()) return;
    const now = new Date().toISOString();
    await saveGoal({
      id: generateId(),
      title: goalTitle.trim(),
      description: '',
      category: goalCategory,
      priority: goalPriority,
      targetDate: goalTargetDate || undefined,
      status: 'In progress',
      createdAt: now,
      updatedAt: now,
    });
    setGoalTitle('');
    setGoalTargetDate('');
    setQuickGoalOpen(false);
    showToast('Goal added to My Week.');
  };

  const handleCompleteGoal = async (goalId: string) => {
    const g = goals.find((item) => item.id === goalId);
    if (!g) return;
    const now = new Date().toISOString();
    await saveGoal({
      ...g,
      status: 'Completed',
      completedAt: now,
      updatedAt: now,
    });
    showToast(`Completed "${g.title}"!`);
  };

  const handleMarkSubmitted = async (assignmentId: string) => {
    const a = assignments.find((item) => item.id === assignmentId);
    if (!a) return;
    await saveAssignment({
      ...a,
      status: 'Submitted',
      updatedAt: new Date().toISOString(),
    });
    showToast(`Marked "${a.title}" submitted.`);
  };

  return (
    <div className="space-y-5">
      {/* Hero Greeting Card */}
      <section className="p-6 sm:p-8 rounded-3xl border border-[#ECE4DF] dark:border-[#322C42] bg-white dark:bg-[#1E1A2A] journal-card flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2.5">
          <p className="text-xs font-bold text-[#7B4CE2] dark:text-[#C5B2F7]">
            {formatLongDate(todayStr)} · {settings.semesterLabel || 'Current Semester'}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1F1929] dark:text-white">
            {getGreeting()}, {settings.userName || 'Friend'}
          </h1>
          <p className="text-sm text-[#6B617A] dark:text-[#B0A6C4] max-w-xl leading-relaxed">
            Here is your daily snapshot: {activeTodayOccurrences.length} scheduled{' '}
            {activeTodayOccurrences.length === 1 ? 'event' : 'events'} today,{' '}
            {openAssignments.length} upcoming{' '}
            {openAssignments.length === 1 ? 'deadline' : 'deadlines'}, and {activeGoals.length}{' '}
            active {activeGoals.length === 1 ? 'goal' : 'goals'}.
          </p>
          <div className="pt-1.5 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setQuickGoalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-[#7B4CE2] hover:bg-[#6A3CD1] text-white shadow-sm shadow-[#7B4CE2]/25 transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Quick-add task</span>
            </button>
            <button
              type="button"
              onClick={() => setEventModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold border border-[#E6DDD8] dark:border-[#39334B] bg-[#FAF7F5] dark:bg-[#272236] text-[#3A314A] dark:text-[#E5DEF2] hover:bg-[#F3EEF9] dark:hover:bg-[#312B42] transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 text-[#7B4CE2]" />
              <span>Add class / event</span>
            </button>
          </div>
        </div>

        <HeroDeskDoodle className="w-48 h-28 shrink-0 hidden sm:block" />
      </section>

      {/* 3 Pastel KPI Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl border border-[#DFD2FC] dark:border-[#4D3D75] bg-[#F6F1FE] dark:bg-[#2A2240]">
          <div className="flex items-center justify-between text-xs font-bold text-[#6D4AE2] dark:text-[#D1C1FA]">
            <span>Goals in progress</span>
            <Target className="w-4 h-4" />
          </div>
          <p className="mt-2.5 text-3xl font-bold tabular-nums text-[#1F1929] dark:text-white">
            {activeGoals.length}
          </p>
          <p className="mt-1 text-xs text-[#6B617A] dark:text-[#B9B0CA] tabular-nums">
            {completedGoalsCount} completed overall
          </p>
        </div>

        <div className="p-5 rounded-3xl border border-[#F8CFE2] dark:border-[#733D58] bg-[#FDF2F7] dark:bg-[#3B212E]">
          <div className="flex items-center justify-between text-xs font-bold text-[#C43C7B] dark:text-[#F8BBD6]">
            <span>Pending deadlines</span>
            <CalendarCheck2 className="w-4 h-4" />
          </div>
          <p className="mt-2.5 text-3xl font-bold tabular-nums text-[#1F1929] dark:text-white">
            {openAssignments.length}
          </p>
          <p className="mt-1 text-xs text-[#6B617A] dark:text-[#B9B0CA] tabular-nums">
            {subjects.length} {subjects.length === 1 ? 'subject' : 'subjects'} tracked
          </p>
        </div>

        <div className="p-5 rounded-3xl border border-[#F6E2A2] dark:border-[#6B5B2C] bg-[#FEF9E6] dark:bg-[#38301B]">
          <div className="flex items-center justify-between text-xs font-bold text-[#9A6F0C] dark:text-[#F8E2A0]">
            <span>Habits today</span>
            <Sparkles className="w-4 h-4" />
          </div>
          <p className="mt-2.5 text-3xl font-bold tabular-nums text-[#1F1929] dark:text-white">
            {habitsCheckedToday}/{habits.length}
          </p>
          <p className="mt-1 text-xs text-[#6B617A] dark:text-[#B9B0CA] tabular-nums">
            {habitStats.overallPct}% target pace ({habitStats.onTargetCount}/{habitStats.totalHabits}{' '}
            on target)
          </p>
        </div>
      </section>

      {/* Weekly Progress Indicator */}
      <section className="p-5 sm:p-6 rounded-3xl border border-[#ECE4DF] dark:border-[#322C42] bg-white dark:bg-[#1E1A2A] journal-card space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-[#1F1929] dark:text-white">
              Weekly Progress Indicator
            </h2>
            <p className="text-xs text-[#6B617A] dark:text-[#B0A6C4] mt-0.5 tabular-nums">
              Combines your active goals completion ({goalCompletionPct}%) and target-based habit
              progress ({habitStats.overallPct}%).
            </p>
          </div>
          <span className="text-2xl font-bold tabular-nums text-[#7B4CE2] dark:text-[#C5B2F7]">
            {combinedWeeklyPct}%
          </span>
        </div>

        <div className="h-3 rounded-full bg-[#F2EFF4] dark:bg-[#2A2538] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#A484F7] via-[#F26AB6] to-[#44CE93] transition-all duration-300"
            style={{width: `${combinedWeeklyPct}%`}}
          />
        </div>
      </section>

      {/* 2-Column Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column */}
        <section className="lg:col-span-7 space-y-5">
          {/* Goals in Progress */}
          <div className="p-5 sm:p-6 rounded-3xl border border-[#ECE4DF] dark:border-[#322C42] bg-white dark:bg-[#1E1A2A] journal-card space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#1F1929] dark:text-white">
                  Goals in Progress
                </h2>
                <p className="text-xs text-[#6B617A] dark:text-[#B0A6C4]">
                  Check off goals as you finish them
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActivePage('week')}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#7B4CE2] dark:text-[#C5B2F7] hover:underline whitespace-nowrap"
              >
                <span>Open My Week</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {activeGoals.length === 0 ? (
              <div className="py-7 text-center rounded-2xl border border-dashed border-[#E2D8D2] dark:border-[#39334B]">
                <p className="text-sm text-[#6B617A] dark:text-[#B0A6C4]">
                  No active goals yet. Add one to start tracking your week!
                </p>
                <button
                  type="button"
                  onClick={() => setQuickGoalOpen(true)}
                  className="mt-2 text-xs font-bold text-[#7B4CE2] dark:text-[#C5B2F7] hover:underline"
                >
                  Create a goal
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[#F1EBE7] dark:divide-[#2E293D]">
                {activeGoals.slice(0, 5).map((g) => (
                  <div
                    key={g.id}
                    className="py-3 first:pt-1 last:pb-1 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleCompleteGoal(g.id)}
                        title="Mark goal complete"
                        aria-label={`Mark ${g.title} complete`}
                        className="mt-0.5 w-5 h-5 rounded-full border-2 border-[#D7CEE4] dark:border-[#4F4766] hover:border-[#44CE93] hover:bg-[#E4F7EE] flex items-center justify-center transition-colors shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#1F1929] dark:text-white truncate">
                          {g.title}
                        </p>
                        <p className="text-xs text-[#6B617A] dark:text-[#B0A6C4]">
                          {g.category} · {g.priority} priority
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-[#6B617A] dark:text-[#B0A6C4] shrink-0">
                      {g.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Deadlines */}
          <div className="p-5 sm:p-6 rounded-3xl border border-[#ECE4DF] dark:border-[#322C42] bg-white dark:bg-[#1E1A2A] journal-card space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#1F1929] dark:text-white">
                  Upcoming Deadlines
                </h2>
                <p className="text-xs text-[#6B617A] dark:text-[#B0A6C4]">
                  Assignments due soon across your subjects
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActivePage('academics')}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#1D67A8] dark:text-[#93C5FD] hover:underline whitespace-nowrap"
              >
                <span>Open Academics</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {upcomingAssignments.length === 0 ? (
              <p className="text-sm text-[#6B617A] dark:text-[#B0A6C4]">
                No pending academic deadlines right now.
              </p>
            ) : (
              <div className="divide-y divide-[#F1EBE7] dark:divide-[#2E293D]">
                {upcomingAssignments.map((a) => {
                  const sub = subjectMap.get(a.subjectId);
                  const diff = daysBetween(todayStr, a.dueDate);
                  return (
                    <div
                      key={a.id}
                      className="py-3 first:pt-1 last:pb-1 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#1F1929] dark:text-white truncate">
                          {a.title}
                        </p>
                        <p className="text-xs text-[#6B617A] dark:text-[#B0A6C4] mt-0.5 tabular-nums">
                          {sub?.name ?? 'General'} · {a.priority} · {formatShortDate(a.dueDate)}
                          {diff < 0
                            ? ` (Overdue by ${Math.abs(diff)}d)`
                            : diff === 0
                              ? ' (Due today)'
                              : ` (In ${diff}d)`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleMarkSubmitted(a.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-[#E4DCD7] dark:border-[#39334B] bg-white dark:bg-[#262233] text-[#3A314A] dark:text-[#E5DEF2] hover:bg-[#E4F7EE] hover:border-[#B8E8D2] hover:text-[#1D6344] transition-colors shrink-0 whitespace-nowrap"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Mark submitted</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Right Column */}
        <section className="lg:col-span-5 space-y-5">
          {/* Today's Timetable */}
          <div className="p-5 sm:p-6 rounded-3xl border border-[#ECE4DF] dark:border-[#322C42] bg-white dark:bg-[#1E1A2A] journal-card space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#1F1929] dark:text-white">
                  Today&apos;s Timetable
                </h2>
                <p className="text-xs text-[#6B617A] dark:text-[#B0A6C4]">
                  {activeTodayOccurrences.length} active{' '}
                  {activeTodayOccurrences.length === 1 ? 'event' : 'events'} scheduled today
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActivePage('timetable')}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#1D67A8] dark:text-[#93C5FD] hover:underline whitespace-nowrap"
              >
                <span>Open timetable</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {nextOrCurrentEvent && (
              <div className="p-4 rounded-2xl bg-[#EFF7FE] dark:bg-[#1F3447] border border-[#C5E2FA] dark:border-[#365B7D] flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#1D67A8] dark:text-[#93C5FD]">
                    {timeToMinutes(nextOrCurrentEvent.startTime) <= nowMinutes
                      ? 'Happening now'
                      : 'Next upcoming event'}{' '}
                    · {formatShortDate(nextOrCurrentEvent.date)}
                  </p>
                  <p className="text-sm font-bold text-[#1F1929] dark:text-white truncate mt-0.5">
                    {nextOrCurrentEvent.title}
                  </p>
                </div>
                <span className="text-xs font-mono font-semibold tabular-nums text-[#34495E] dark:text-[#C4E2FC] shrink-0">
                  {formatTime12h(nextOrCurrentEvent.startTime)} –{' '}
                  {formatTime12h(nextOrCurrentEvent.endTime)}
                </span>
              </div>
            )}

            {todayOccurrences.length === 0 ? (
              <div className="py-6 text-center rounded-2xl border border-dashed border-[#E2D8D2] dark:border-[#39334B]">
                <p className="text-xs text-[#6B617A] dark:text-[#B0A6C4]">
                  No classes or events scheduled for today.
                </p>
                <button
                  type="button"
                  onClick={() => setEventModalOpen(true)}
                  className="mt-1.5 text-xs font-bold text-[#7B4CE2] dark:text-[#C5B2F7] hover:underline"
                >
                  Schedule an event
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {todayOccurrences.map((occ) => (
                  <div
                    key={occ.occurrenceKey}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                      occ.isCancelled
                        ? 'bg-[#F5F3F7] dark:bg-[#262330] border-dashed border-[#CFC7DA] dark:border-[#49425B] opacity-70'
                        : 'bg-[#F6FAFE] dark:bg-[#1B2C3B] border-[#D4E9FC] dark:border-[#2F4E6A]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-sm font-bold truncate ${
                            occ.isCancelled
                              ? 'line-through text-[#6B617A] dark:text-[#968DAB]'
                              : 'text-[#1F1929] dark:text-white'
                          }`}
                        >
                          {occ.title}
                        </span>
                        {occ.isCancelled && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/80 dark:bg-black/30 text-[#7D728F]">
                            CANCELLED
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#6B617A] dark:text-[#B0A6C4] mt-0.5 truncate">
                        {occ.subjectName || getCatName(occ.categoryId)}
                        {occ.location ? ` · ${occ.location}` : ''}
                      </p>
                    </div>
                    <span className="text-xs font-mono tabular-nums text-[#4A4158] dark:text-[#C4E2FC] shrink-0">
                      {formatTime12h(occ.startTime)} – {formatTime12h(occ.endTime)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {upcomingDaysOccurrences.length > 0 && (
              <div className="pt-3 border-t border-[#F1EBE7] dark:border-[#2E293D] space-y-2">
                <p className="text-xs font-bold text-[#6B617A] dark:text-[#B0A6C4]">
                  Upcoming over the next few days
                </p>
                <div className="divide-y divide-[#F5F0EC] dark:divide-[#2A2538]">
                  {upcomingDaysOccurrences.slice(0, 4).map((occ) => (
                    <div
                      key={occ.occurrenceKey}
                      className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-[#1F1929] dark:text-white truncate">
                          {occ.title}
                        </p>
                        <p className="text-[#6B617A] dark:text-[#B0A6C4] tabular-nums">
                          {formatShortDate(occ.date)} · {occ.subjectName || getCatName(occ.categoryId)}
                        </p>
                      </div>
                      <span className="font-mono tabular-nums text-[#6B617A] dark:text-[#B0A6C4] shrink-0">
                        {formatTime12h(occ.startTime)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Internship Applications */}
          <div className="p-5 sm:p-6 rounded-3xl border border-[#ECE4DF] dark:border-[#322C42] bg-white dark:bg-[#1E1A2A] journal-card space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#1F1929] dark:text-white">
                  Internship Applications
                </h2>
                <p className="text-xs text-[#6B617A] dark:text-[#B0A6C4]">
                  Pipeline status &amp; follow-up summary
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActivePage('internships')}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#BD5728] dark:text-[#FAD8C5] hover:underline whitespace-nowrap"
              >
                <span>Open Tracker</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {internshipSummary.total === 0 ? (
              <div className="py-5 text-center rounded-2xl border border-dashed border-[#E2D8D2] dark:border-[#39334B]">
                <Briefcase className="w-5 h-5 mx-auto text-[#EA8C5F] mb-1.5" />
                <p className="text-xs text-[#6B617A] dark:text-[#B0A6C4]">
                  No internship applications logged yet.
                </p>
                <button
                  type="button"
                  onClick={() => setActivePage('internships')}
                  className="mt-1.5 text-xs font-bold text-[#BD5728] dark:text-[#FAD8C5] hover:underline"
                >
                  Open Internship Tracker
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2.5 text-center">
                  <div className="p-3 rounded-2xl bg-[#F6F4F2] dark:bg-[#262233] border border-[#EBE6E2] dark:border-[#363147]">
                    <p className="text-xl font-bold tabular-nums">{internshipSummary.total}</p>
                    <p className="text-[11px] font-semibold text-[#6B617A] dark:text-[#B0A6C4]">
                      Total
                    </p>
                  </div>
                  <div className="p-3 rounded-2xl bg-[#F6F1FE] dark:bg-[#2B2240] border border-[#E2D6FA] dark:border-[#4D3D75]">
                    <p className="text-xl font-bold tabular-nums text-[#6D4AE2] dark:text-[#DDD0FA]">
                      {internshipSummary.underConsideration}
                    </p>
                    <p className="text-[11px] font-semibold text-[#6D4AE2] dark:text-[#DDD0FA]">
                      Considering
                    </p>
                  </div>
                  <div className="p-3 rounded-2xl bg-[#FEF9E6] dark:bg-[#383019] border border-[#F6E4A7] dark:border-[#6B5B2C]">
                    <p className="text-xl font-bold tabular-nums text-[#9A6F0C] dark:text-[#F8E7B0]">
                      {internshipSummary.assessments}
                    </p>
                    <p className="text-[11px] font-semibold text-[#9A6F0C] dark:text-[#F8E7B0]">
                      Assessments
                    </p>
                  </div>
                  <div className="p-3 rounded-2xl bg-[#FEF3EC] dark:bg-[#3B251B] border border-[#FAD5C0] dark:border-[#754936]">
                    <p className="text-xl font-bold tabular-nums text-[#BD5728] dark:text-[#FAD8C5]">
                      {internshipSummary.interviews}
                    </p>
                    <p className="text-[11px] font-semibold text-[#BD5728] dark:text-[#FAD8C5]">
                      Interviews
                    </p>
                  </div>
                  <div className="p-3 rounded-2xl bg-[#EBF9F2] dark:bg-[#1B3328] border border-[#BCEAD3] dark:border-[#32634D]">
                    <p className="text-xl font-bold tabular-nums text-[#1D744E] dark:text-[#BFEFD9]">
                      {internshipSummary.offers}
                    </p>
                    <p className="text-[11px] font-semibold text-[#1D744E] dark:text-[#BFEFD9]">
                      Offers
                    </p>
                  </div>
                  <div className="p-3 rounded-2xl bg-[#EFF7FE] dark:bg-[#1F3447] border border-[#C3E2FC] dark:border-[#365B7D]">
                    <p className="text-xl font-bold tabular-nums text-[#1D67A8] dark:text-[#C4E2FC]">
                      {internshipSummary.followUps.length}
                    </p>
                    <p className="text-[11px] font-semibold text-[#1D67A8] dark:text-[#C4E2FC]">
                      Follow-ups
                    </p>
                  </div>
                </div>

                {internshipSummary.followUps.length > 0 && (
                  <div className="pt-2 border-t border-[#F1EBE7] dark:border-[#2E293D] space-y-1.5">
                    <p className="text-xs font-bold text-[#6B617A] dark:text-[#B0A6C4]">
                      Upcoming Follow-ups
                    </p>
                    {internshipSummary.followUps.map((app) => (
                      <div key={app.id} className="flex items-center justify-between text-xs gap-2">
                        <span className="font-semibold truncate">
                          {app.company} — {app.position}
                        </span>
                        <span className="tabular-nums text-[#BD5728] dark:text-[#FAD8C5] shrink-0">
                          {app.followUpDate ? formatShortDate(app.followUpDate) : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      {/* Quick Goal Modal */}
      <Modal
        open={quickGoalOpen}
        onClose={() => setQuickGoalOpen(false)}
        title="Quick-add task / goal"
        subtitle="Creates a goal in My Week"
      >
        <form onSubmit={handleQuickGoalSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
              Goal Title *
            </label>
            <input
              type="text"
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
              placeholder="e.g. Finish econometrics problem set"
              required
              className="w-full px-3.5 py-2 rounded-xl border border-[#E4DCD7] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                Category
              </label>
              <select
                value={goalCategory}
                onChange={(e) => setGoalCategory(e.target.value as GoalCategory)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#E4DCD7] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
              >
                <option value="Academics">Academics</option>
                <option value="Career">Career</option>
                <option value="Personal">Personal</option>
                <option value="Extracurricular">Extracurricular</option>
                <option value="Music">Music</option>
                <option value="Fitness">Fitness</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                Priority
              </label>
              <select
                value={goalPriority}
                onChange={(e) => setGoalPriority(e.target.value as GoalPriority)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#E4DCD7] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
              Target Date (optional)
            </label>
            <input
              type="date"
              value={goalTargetDate}
              onChange={(e) => setGoalTargetDate(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-[#E4DCD7] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm tabular-nums"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setQuickGoalOpen(false)}
              className="px-4 py-2 rounded-full text-sm font-semibold border border-[#E4DCD7] dark:border-[#39334B]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-bold bg-[#7B4CE2] hover:bg-[#6A3CD1] text-white"
            >
              <Check className="w-4 h-4" />
              <span>Add Goal</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Quick Add Timetable Event Modal */}
      <TimetableEventModal
        open={eventModalOpen}
        onClose={() => setEventModalOpen(false)}
        initialIsRecurring={false}
        initialDate={todayStr}
      />
    </div>
  );
};
