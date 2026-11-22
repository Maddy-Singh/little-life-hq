import React, {useEffect, useMemo, useState} from 'react';
import {
  BookOpen,
  Briefcase,
  Check,
  ChevronLeft,
  ChevronRight,
  CopyCheck,
  Dumbbell,
  Edit3,
  ListChecks,
  Music,
  Plus,
  Search,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react';
import {motion} from 'motion/react';
import {useApp} from '../context/AppContext';
import {ConfirmDialog} from '../components/ui/ConfirmDialog';
import {EmptyState} from '../components/ui/EmptyState';
import {Modal} from '../components/ui/Modal';
import {
  Goal,
  GoalCategory,
  GoalPriority,
  GoalStatus,
  GoalWeeklyCheckin,
  WeeklyReview,
} from '../types/models';
import {
  addDays,
  formatShortDate,
  formatWeekRange,
  getTodayStr,
  getWeekStartMonday,
} from '../utils/date';
import {generateId} from '../utils/id';

const CATEGORIES: GoalCategory[] = [
  'Academics',
  'Career',
  'Personal',
  'Extracurricular',
  'Music',
  'Fitness',
];
const PRIORITIES: GoalPriority[] = ['Low', 'Medium', 'High'];
const STATUSES: GoalStatus[] = ['Not started', 'In progress', 'Completed', 'Paused'];

const CATEGORY_META: Record<
  GoalCategory,
  {icon: React.ComponentType<{className?: string}>; color: string}
> = {
  Academics: {icon: BookOpen, color: 'text-[#1D67A8] dark:text-[#93C5FD]'},
  Career: {icon: Briefcase, color: 'text-[#BD5728] dark:text-[#FAD8C5]'},
  Personal: {icon: User, color: 'text-[#6D4AE2] dark:text-[#DDD0FA]'},
  Extracurricular: {icon: Sparkles, color: 'text-[#9A6F0C] dark:text-[#F8E7B0]'},
  Music: {icon: Music, color: 'text-[#C43C7B] dark:text-[#F8BBD6]'},
  Fitness: {icon: Dumbbell, color: 'text-[#1D744E] dark:text-[#9CE4BF]'},
};

export const MyWeekPage: React.FC = () => {
  const {
    goals,
    goalWeeklyCheckins,
    weeklyReviews,
    saveGoal,
    deleteGoal,
    saveGoalCheckin,
    saveWeeklyReview,
    showToast,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'goals' | 'review' | 'past'>('goals');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterPriority, setFilterPriority] = useState<string>('ALL');

  // Goal modal state
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<GoalCategory>('Academics');
  const [priority, setPriority] = useState<GoalPriority>('Medium');
  const [status, setStatus] = useState<GoalStatus>('Not started');
  const [targetDate, setTargetDate] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Goal | null>(null);

  // Weekly review state
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>(() =>
    getWeekStartMonday(getTodayStr())
  );
  const [wins, setWins] = useState('');
  const [challenges, setChallenges] = useState('');
  const [reflections, setReflections] = useState('');
  const [nextWeekPriorities, setNextWeekPriorities] = useState('');

  const [checkinDrafts, setCheckinDrafts] = useState<
    Record<string, {note: string; percent: number}>
  >({});

  useEffect(() => {
    const rev = weeklyReviews.find((r) => r.weekStart === selectedWeekStart);
    setWins(rev?.wins ?? '');
    setChallenges(rev?.challenges ?? '');
    setReflections(rev?.reflections ?? '');
    setNextWeekPriorities(rev?.nextWeekPriorities ?? '');
  }, [selectedWeekStart, weeklyReviews]);

  useEffect(() => {
    const drafts: Record<string, {note: string; percent: number}> = {};
    for (const g of goals) {
      const existing = goalWeeklyCheckins.find(
        (c) => c.goalId === g.id && c.weekStart === selectedWeekStart
      );
      drafts[g.id] = {
        note: existing?.progressNote ?? '',
        percent: existing?.progressPercent ?? (g.status === 'Completed' ? 100 : 0),
      };
    }
    setCheckinDrafts(drafts);
  }, [goals, goalWeeklyCheckins, selectedWeekStart]);

  const filteredGoals = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return goals
      .filter((g) => {
        if (
          q &&
          !g.title.toLowerCase().includes(q) &&
          !g.description.toLowerCase().includes(q)
        ) {
          return false;
        }
        if (filterCategory !== 'ALL' && g.category !== filterCategory) return false;
        if (filterStatus !== 'ALL' && g.status !== filterStatus) return false;
        if (filterPriority !== 'ALL' && g.priority !== filterPriority) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.status === 'Completed' && b.status !== 'Completed') return 1;
        if (a.status !== 'Completed' && b.status === 'Completed') return -1;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [goals, searchQuery, filterCategory, filterStatus, filterPriority]);

  const openNewGoal = () => {
    setEditingGoal(null);
    setTitle('');
    setDescription('');
    setCategory('Academics');
    setPriority('Medium');
    setStatus('Not started');
    setTargetDate('');
    setGoalModalOpen(true);
  };

  const openEditGoal = (g: Goal) => {
    setEditingGoal(g);
    setTitle(g.title);
    setDescription(g.description);
    setCategory(g.category);
    setPriority(g.priority);
    setStatus(g.status);
    setTargetDate(g.targetDate ?? '');
    setGoalModalOpen(true);
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const now = new Date().toISOString();
    const record: Goal = {
      id: editingGoal?.id ?? generateId(),
      title: title.trim(),
      description: description.trim(),
      category,
      priority,
      status,
      targetDate: targetDate || undefined,
      createdAt: editingGoal?.createdAt ?? now,
      updatedAt: now,
      completedAt: status === 'Completed' ? editingGoal?.completedAt ?? now : undefined,
    };
    await saveGoal(record);
    showToast(editingGoal ? 'Goal updated.' : 'Goal created.');
    setGoalModalOpen(false);
  };

  const toggleGoalComplete = async (g: Goal) => {
    const now = new Date().toISOString();
    const nextStatus: GoalStatus = g.status === 'Completed' ? 'In progress' : 'Completed';
    await saveGoal({
      ...g,
      status: nextStatus,
      completedAt: nextStatus === 'Completed' ? now : undefined,
      updatedAt: now,
    });
    showToast(nextStatus === 'Completed' ? `Goal completed: "${g.title}"` : 'Goal reopened.');
  };

  const handleSaveCheckin = async (goal: Goal) => {
    const draft = checkinDrafts[goal.id] ?? {note: '', percent: 0};
    const existing = goalWeeklyCheckins.find(
      (c) => c.goalId === goal.id && c.weekStart === selectedWeekStart
    );
    const now = new Date().toISOString();
    const record: GoalWeeklyCheckin = {
      id: existing?.id ?? generateId(),
      goalId: goal.id,
      weekStart: selectedWeekStart,
      progressNote: draft.note.trim(),
      progressPercent: Math.max(0, Math.min(100, Number(draft.percent) || 0)),
      statusSnapshot: goal.status,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await saveGoalCheckin(record);
    showToast(`Saved weekly check-in for "${goal.title}".`);
  };

  const handleCopyForwardUnfinished = async () => {
    const prevWeek = addDays(selectedWeekStart, -7);
    const unfinished = goals.filter((g) => g.status !== 'Completed');
    if (unfinished.length === 0) {
      showToast('All goals are already completed.', 'info');
      return;
    }
    let copied = 0;
    const now = new Date().toISOString();
    for (const g of unfinished) {
      const alreadyHas = goalWeeklyCheckins.some(
        (c) => c.goalId === g.id && c.weekStart === selectedWeekStart
      );
      if (alreadyHas) continue;
      const prevCheckin = goalWeeklyCheckins.find(
        (c) => c.goalId === g.id && c.weekStart === prevWeek
      );
      await saveGoalCheckin({
        id: generateId(),
        goalId: g.id,
        weekStart: selectedWeekStart,
        progressNote: prevCheckin?.progressNote
          ? `Carried forward (prev: ${prevCheckin.progressNote})`
          : 'Carried forward for focus this week.',
        progressPercent: prevCheckin?.progressPercent ?? 0,
        statusSnapshot: g.status,
        createdAt: now,
        updatedAt: now,
      });
      copied++;
    }
    showToast(
      copied > 0
        ? `Carried forward ${copied} unfinished ${copied === 1 ? 'goal' : 'goals'} into this week.`
        : 'All unfinished goals already have check-ins for this week.',
      copied > 0 ? 'success' : 'info'
    );
  };

  const handleSaveWeeklyReview = async (e: React.FormEvent) => {
    e.preventDefault();
    const existing = weeklyReviews.find((r) => r.weekStart === selectedWeekStart);
    const now = new Date().toISOString();
    const record: WeeklyReview = {
      id: existing?.id ?? generateId(),
      weekStart: selectedWeekStart,
      wins: wins.trim(),
      challenges: challenges.trim(),
      reflections: reflections.trim(),
      nextWeekPriorities: nextWeekPriorities.trim(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await saveWeeklyReview(record);
    showToast('Weekly review saved.');
  };

  const previousReviews = useMemo(() => {
    return [...weeklyReviews].sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  }, [weeklyReviews]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1F1929] dark:text-white">
            My Week
          </h1>
          <p className="text-sm text-[#6B617A] dark:text-[#B0A6C4] mt-0.5">
            Maintain your continuous list of goals and record weekly reflections without losing goal
            history.
          </p>
        </div>

        <button
          type="button"
          onClick={openNewGoal}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-bold bg-[#7B4CE2] hover:bg-[#6A3CD1] text-white shadow-sm shadow-[#7B4CE2]/25 whitespace-nowrap self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add goal</span>
        </button>
      </div>

      {/* Segmented Tab Pill Bar */}
      <div className="inline-flex flex-wrap p-1.5 rounded-2xl border border-[#ECE4DF] dark:border-[#322C42] bg-white dark:bg-[#1E1A2A] journal-card gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('goals')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
            activeTab === 'goals'
              ? 'bg-[#FDF0F6] text-[#C43C7B] dark:bg-[#462535] dark:text-[#FAD0E3]'
              : 'text-[#6B617A] dark:text-[#B0A6C4] hover:text-[#1F1929] dark:hover:text-white'
          }`}
        >
          Continuous Goals ({goals.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('review')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
            activeTab === 'review'
              ? 'bg-[#FDF0F6] text-[#C43C7B] dark:bg-[#462535] dark:text-[#FAD0E3]'
              : 'text-[#6B617A] dark:text-[#B0A6C4] hover:text-[#1F1929] dark:hover:text-white'
          }`}
        >
          Weekly Review &amp; Check-ins
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('past')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
            activeTab === 'past'
              ? 'bg-[#FDF0F6] text-[#C43C7B] dark:bg-[#462535] dark:text-[#FAD0E3]'
              : 'text-[#6B617A] dark:text-[#B0A6C4] hover:text-[#1F1929] dark:hover:text-white'
          }`}
        >
          Past Reviews ({weeklyReviews.length})
        </button>
      </div>

      {activeTab === 'goals' && (
        <div className="space-y-4">
          {/* Search & Dropdown Filter Bar */}
          <div className="flex flex-wrap items-center gap-3 p-3.5 rounded-2xl border border-[#ECE4DF] dark:border-[#322C42] bg-white dark:bg-[#1E1A2A] journal-card">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-[#8C829C] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search goals..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E6DDD8] dark:border-[#39334B] bg-[#FAF7F5] dark:bg-[#15121D] text-sm"
              />
            </div>

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              aria-label="Filter by category"
              className="px-3.5 py-2 rounded-xl border border-[#E6DDD8] dark:border-[#39334B] bg-white dark:bg-[#15121D] text-xs font-semibold"
            >
              <option value="ALL">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              aria-label="Filter by status"
              className="px-3.5 py-2 rounded-xl border border-[#E6DDD8] dark:border-[#39334B] bg-white dark:bg-[#15121D] text-xs font-semibold"
            >
              <option value="ALL">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              aria-label="Filter by priority"
              className="px-3.5 py-2 rounded-xl border border-[#E6DDD8] dark:border-[#39334B] bg-white dark:bg-[#15121D] text-xs font-semibold"
            >
              <option value="ALL">All priorities</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {filteredGoals.length === 0 ? (
            <EmptyState
              icon={<ListChecks className="w-6 h-6" />}
              title={goals.length === 0 ? 'No goals yet' : 'No matching goals'}
              description={
                goals.length === 0
                  ? 'Keep one continuous list of your academic, career, music, fitness, and personal goals here.'
                  : 'Try adjusting your search or filter selections.'
              }
              actionLabel={goals.length === 0 ? 'Add Your First Goal' : undefined}
              onAction={goals.length === 0 ? openNewGoal : undefined}
              tone="pink"
            />
          ) : (
            <div className="rounded-3xl border border-[#ECE4DF] dark:border-[#322C42] bg-white dark:bg-[#1E1A2A] journal-card divide-y divide-[#F1EBE7] dark:divide-[#2E293D] px-5 sm:px-6">
              {filteredGoals.map((goal) => {
                const isDone = goal.status === 'Completed';
                const catMeta = CATEGORY_META[goal.category];
                const CatIcon = catMeta?.icon;
                return (
                  <motion.div
                    layout
                    key={goal.id}
                    initial={{opacity: 0}}
                    animate={{opacity: 1}}
                    className="py-4 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <motion.button
                        type="button"
                        whileTap={{scale: 0.85}}
                        onClick={() => toggleGoalComplete(goal)}
                        aria-label={isDone ? 'Reopen goal' : 'Complete goal'}
                        className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${
                          isDone
                            ? 'bg-[#28C780] border-[#28C780] text-white'
                            : 'border-[#D7CEE4] dark:border-[#4F4766] hover:border-[#7B4CE2]'
                        }`}
                      >
                        {isDone && <Check className="w-3.5 h-3.5" />}
                      </motion.button>

                      <div className="min-w-0">
                        <h3
                          className={`text-base font-bold leading-snug ${
                            isDone
                              ? 'line-through text-[#8B819B] dark:text-[#8E84A2]'
                              : 'text-[#1F1929] dark:text-white'
                          }`}
                        >
                          {goal.title}
                        </h3>
                        {goal.description && (
                          <p className="text-xs text-[#6B617A] dark:text-[#B0A6C4] mt-0.5 leading-relaxed">
                            {goal.description}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#6B617A] dark:text-[#B0A6C4] mt-1">
                          <span className={`inline-flex items-center gap-1 font-semibold ${catMeta?.color ?? ''}`}>
                            {CatIcon && <CatIcon className="w-3.5 h-3.5" />}
                            <span>{goal.category}</span>
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{goal.priority} priority</span>
                          <span aria-hidden="true">·</span>
                          <span>{goal.status}</span>
                          {goal.targetDate && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="tabular-nums">
                                Target {formatShortDate(goal.targetDate)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditGoal(goal)}
                        aria-label={`Edit ${goal.title}`}
                        className="p-2 rounded-xl border border-[#ECE4DF] dark:border-[#39334B] text-[#5A506B] hover:text-[#1F1929] hover:bg-[#FAF7F5] dark:text-[#AFA6C2] dark:hover:bg-[#2A2538]"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(goal)}
                        aria-label={`Delete ${goal.title}`}
                        className="p-2 rounded-xl border border-[#FAD5DC] dark:border-[#5E3038] text-[#D9385A] hover:bg-[#FFF0F3] dark:text-[#F8A5AE] dark:hover:bg-[#3F2227]"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'review' && (
        <div className="space-y-5">
          {/* Week Selector Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-[#ECE4DF] dark:border-[#322C42] bg-white dark:bg-[#1E1A2A] journal-card">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedWeekStart(addDays(selectedWeekStart, -7))}
                aria-label="Previous week"
                className="p-2 rounded-xl border border-[#E6DDD8] dark:border-[#39334B] hover:bg-[#FAF7F5] dark:hover:bg-[#292536]"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-bold text-[#1F1929] dark:text-white px-2 tabular-nums">
                Week of {formatWeekRange(selectedWeekStart, true)}
              </span>
              <button
                type="button"
                onClick={() => setSelectedWeekStart(addDays(selectedWeekStart, 7))}
                aria-label="Next week"
                className="p-2 rounded-xl border border-[#E6DDD8] dark:border-[#39334B] hover:bg-[#FAF7F5] dark:hover:bg-[#292536]"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setSelectedWeekStart(getWeekStartMonday(getTodayStr()))}
                className="ml-1 px-3 py-1.5 rounded-full text-xs font-bold bg-[#F4EFFE] dark:bg-[#2F2547] text-[#6D4AE2] dark:text-[#DDD0FA]"
              >
                This week
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopyForwardUnfinished}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold bg-[#EBF9F2] dark:bg-[#1E3B2E] text-[#1D744E] dark:text-[#BFEFD9] border border-[#BCEAD3] dark:border-[#32634D] whitespace-nowrap"
            >
              <CopyCheck className="w-4 h-4" />
              <span>Copy forward unfinished goals</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Ongoing Goal Check-ins */}
            <div className="lg:col-span-7 p-5 sm:p-6 rounded-3xl border border-[#ECE4DF] dark:border-[#322C42] bg-white dark:bg-[#1E1A2A] journal-card space-y-4">
              <div>
                <h2 className="text-lg font-bold text-[#1F1929] dark:text-white">
                  Weekly Progress Check-ins
                </h2>
                <p className="text-xs text-[#6B617A] dark:text-[#B0A6C4]">
                  Record progress for this week without erasing your continuous goals.
                </p>
              </div>

              {goals.length === 0 ? (
                <p className="text-sm text-[#6B617A] dark:text-[#B0A6C4]">
                  Add goals first to record weekly check-ins.
                </p>
              ) : (
                <div className="space-y-3.5">
                  {goals.map((g) => {
                    const draft = checkinDrafts[g.id] ?? {note: '', percent: 0};
                    const saved = goalWeeklyCheckins.find(
                      (c) => c.goalId === g.id && c.weekStart === selectedWeekStart
                    );
                    return (
                      <div
                        key={g.id}
                        className="p-4 rounded-2xl bg-[#FAF7F5] dark:bg-[#262233] border border-[#ECE4DF] dark:border-[#332E45] space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-bold text-[#1F1929] dark:text-white">
                              {g.title}
                            </h3>
                            <p className="text-xs text-[#6B617A] dark:text-[#B0A6C4]">
                              {g.category} · {g.status}
                            </p>
                          </div>
                          <span className="text-xs font-mono font-bold tabular-nums text-[#7B4CE2] dark:text-[#C5B2F7]">
                            {draft.percent}%
                          </span>
                        </div>

                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={draft.percent}
                          onChange={(e) =>
                            setCheckinDrafts((prev) => ({
                              ...prev,
                              [g.id]: {...draft, percent: Number(e.target.value)},
                            }))
                          }
                          aria-label={`Weekly progress percentage for ${g.title}`}
                          className="w-full accent-[#7B4CE2]"
                        />

                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value={draft.note}
                            onChange={(e) =>
                              setCheckinDrafts((prev) => ({
                                ...prev,
                                [g.id]: {...draft, note: e.target.value},
                              }))
                            }
                            placeholder="What progress did you make this week?"
                            className="flex-1 px-3 py-2 rounded-xl border border-[#E6DDD8] dark:border-[#39334B] bg-white dark:bg-[#15121D] text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveCheckin(g)}
                            className="px-4 py-2 rounded-full text-xs font-bold bg-[#7B4CE2] hover:bg-[#6A3CD1] text-white whitespace-nowrap"
                          >
                            {saved ? 'Update Check-in' : 'Save Check-in'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Weekly Reflection Journal */}
            <form
              onSubmit={handleSaveWeeklyReview}
              className="lg:col-span-5 p-5 sm:p-6 rounded-3xl border border-[#ECE4DF] dark:border-[#322C42] bg-white dark:bg-[#1E1A2A] journal-card space-y-4"
            >
              <h2 className="text-lg font-bold text-[#1F1929] dark:text-white">
                Weekly Reflection
              </h2>

              <div>
                <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                  Weekly Wins
                </label>
                <textarea
                  rows={2}
                  value={wins}
                  onChange={(e) => setWins(e.target.value)}
                  placeholder="Small or big wins to celebrate..."
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E6DDD8] dark:border-[#39334B] bg-white dark:bg-[#15121D] text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                  Challenges
                </label>
                <textarea
                  rows={2}
                  value={challenges}
                  onChange={(e) => setChallenges(e.target.value)}
                  placeholder="What got in the way?"
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E6DDD8] dark:border-[#39334B] bg-white dark:bg-[#15121D] text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                  Reflections
                </label>
                <textarea
                  rows={2}
                  value={reflections}
                  onChange={(e) => setReflections(e.target.value)}
                  placeholder="How are you feeling about your pace?"
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E6DDD8] dark:border-[#39334B] bg-white dark:bg-[#15121D] text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                  Next-Week Priorities
                </label>
                <textarea
                  rows={2}
                  value={nextWeekPriorities}
                  onChange={(e) => setNextWeekPriorities(e.target.value)}
                  placeholder="Top 2–3 things to focus on next week..."
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E6DDD8] dark:border-[#39334B] bg-white dark:bg-[#15121D] text-sm"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-full text-sm font-bold bg-[#7B4CE2] hover:bg-[#6A3CD1] text-white transition-colors"
              >
                Save Weekly Review
              </button>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'past' && (
        <div className="space-y-4">
          {previousReviews.length === 0 ? (
            <EmptyState
              icon={<ListChecks className="w-6 h-6" />}
              title="No past weekly reviews yet"
              description="Save reflections in Weekly Review & Check-ins to build your weekly archive."
              actionLabel="Write This Week's Review"
              onAction={() => setActiveTab('review')}
              tone="lavender"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {previousReviews.map((rev) => (
                <div
                  key={rev.id}
                  className="p-5 rounded-3xl border border-[#ECE4DF] dark:border-[#322C42] bg-white dark:bg-[#1E1A2A] journal-card space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#7B4CE2] dark:text-[#C5B2F7] tabular-nums">
                      Week of {formatWeekRange(rev.weekStart, true)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedWeekStart(rev.weekStart);
                        setActiveTab('review');
                      }}
                      className="text-xs font-bold underline text-[#6B617A] dark:text-[#B0A6C4]"
                    >
                      Open week
                    </button>
                  </div>
                  {rev.wins && (
                    <p className="text-xs text-[#4A4158] dark:text-[#D5CEE3]">
                      <strong>Wins:</strong> {rev.wins}
                    </p>
                  )}
                  {rev.challenges && (
                    <p className="text-xs text-[#4A4158] dark:text-[#D5CEE3]">
                      <strong>Challenges:</strong> {rev.challenges}
                    </p>
                  )}
                  {rev.reflections && (
                    <p className="text-xs text-[#4A4158] dark:text-[#D5CEE3]">
                      <strong>Reflections:</strong> {rev.reflections}
                    </p>
                  )}
                  {rev.nextWeekPriorities && (
                    <p className="text-xs text-[#4A4158] dark:text-[#D5CEE3]">
                      <strong>Next priorities:</strong> {rev.nextWeekPriorities}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Goal Create/Edit Modal */}
      <Modal
        open={goalModalOpen}
        onClose={() => setGoalModalOpen(false)}
        title={editingGoal ? 'Edit Goal' : 'Create Goal'}
      >
        <form onSubmit={handleSaveGoal} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g. Practice flute scales / 5km morning run"
              className="w-full px-3.5 py-2 rounded-xl border border-[#E4DCD7] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as GoalCategory)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#E4DCD7] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as GoalPriority)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#E4DCD7] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as GoalStatus)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#E4DCD7] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                Target Date (optional)
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#E4DCD7] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
              Description (optional)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Milestones, resources, or notes..."
              className="w-full px-3.5 py-2 rounded-xl border border-[#E4DCD7] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setGoalModalOpen(false)}
              className="px-4 py-2 rounded-full text-sm font-semibold border border-[#E4DCD7] dark:border-[#39334B]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-full text-sm font-bold bg-[#7B4CE2] hover:bg-[#6A3CD1] text-white"
            >
              {editingGoal ? 'Save Changes' : 'Create Goal'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteGoal(deleteTarget.id);
          showToast('Goal deleted.');
        }}
        title="Delete Goal"
        description={`Delete "${deleteTarget?.title ?? ''}" and its weekly check-in history?`}
        confirmLabel="Delete Goal"
      />
    </div>
  );
};
