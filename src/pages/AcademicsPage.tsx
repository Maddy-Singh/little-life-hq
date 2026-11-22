import React, {useMemo, useState} from 'react';
import {
  AlertCircle,
  BookOpen,
  CalendarCheck2,
  ClipboardList,
  Clock,
  Edit3,
  Plus,
  Trash2,
} from 'lucide-react';
import {useApp} from '../context/AppContext';
import {ConfirmDialog} from '../components/ui/ConfirmDialog';
import {EmptyState} from '../components/ui/EmptyState';
import {Modal} from '../components/ui/Modal';
import {
  Assignment,
  AssignmentPriority,
  AssignmentStatus,
  AttendanceRecord,
  AttendanceStatus,
  PastelToken,
  Subject,
} from '../types/models';
import {daysBetween, formatShortDate, getTodayStr, parseLocalDate} from '../utils/date';
import {generateId} from '../utils/id';
import {PASTEL_KEYS, PASTEL_PALETTE} from '../utils/theme';

function formatFullShortDate(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export const AcademicsPage: React.FC = () => {
  const {
    subjects,
    assignments,
    attendanceRecords,
    saveSubject,
    deleteSubject,
    saveAssignment,
    deleteAssignment,
    saveAttendance,
    deleteAttendance,
    showToast,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'assignments' | 'subjects' | 'attendance'>(
    'assignments'
  );
  const [assignmentFilter, setAssignmentFilter] = useState<string>('ALL');
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');
  const todayStr = getTodayStr();

  // Subject Modal
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [subName, setSubName] = useState('');
  const [subCode, setSubCode] = useState('');
  const [subInstructor, setSubInstructor] = useState('');
  const [subColor, setSubColor] = useState<PastelToken>('sky');
  const [subTarget, setSubTarget] = useState(75);
  const [deleteSubTarget, setDeleteSubTarget] = useState<Subject | null>(null);

  // Assignment Modal
  const [assnModalOpen, setAssnModalOpen] = useState(false);
  const [editingAssn, setEditingAssn] = useState<Assignment | null>(null);
  const [assnTitle, setAssnTitle] = useState('');
  const [assnSubjectId, setAssnSubjectId] = useState('');
  const [assnDesc, setAssnDesc] = useState('');
  const [assnDue, setAssnDue] = useState(todayStr);
  const [assnPriority, setAssnPriority] = useState<AssignmentPriority>('Medium');
  const [assnStatus, setAssnStatus] = useState<AssignmentStatus>('Not started');
  const [deleteAssnTarget, setDeleteAssnTarget] = useState<Assignment | null>(null);

  // Attendance quick logger
  const [attSubjectId, setAttSubjectId] = useState('');
  const [attDate, setAttDate] = useState(todayStr);
  const [attStatus, setAttStatus] = useState<AttendanceStatus>('Present');
  const [attNote, setAttNote] = useState('');

  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);

  const upcomingDeadlines = useMemo(() => {
    return assignments
      .filter((a) => a.status !== 'Submitted')
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 4);
  }, [assignments]);

  const filteredAssignments = useMemo(() => {
    return assignments
      .filter((a) => {
        if (subjectFilter !== 'ALL' && a.subjectId !== subjectFilter) return false;
        if (assignmentFilter === 'OPEN') return a.status !== 'Submitted';
        if (assignmentFilter === 'ALL') return true;
        return a.status === assignmentFilter;
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [assignments, assignmentFilter, subjectFilter]);

  const attendanceBySubject = useMemo(() => {
    return subjects.map((sub) => {
      const logs = attendanceRecords.filter((r) => r.subjectId === sub.id);
      const present = logs.filter((r) => r.status === 'Present').length;
      const absent = logs.filter((r) => r.status === 'Absent').length;
      const cancelled = logs.filter((r) => r.status === 'Cancelled').length;
      const totalHeld = present + absent;
      const pct = totalHeld > 0 ? Math.round((present / totalHeld) * 100) : null;
      return {sub, present, absent, cancelled, totalHeld, pct};
    });
  }, [subjects, attendanceRecords]);

  const openNewSubject = () => {
    setEditingSubject(null);
    setSubName('');
    setSubCode('');
    setSubInstructor('');
    setSubColor('sky');
    setSubTarget(75);
    setSubModalOpen(true);
  };

  const openEditSubject = (s: Subject) => {
    setEditingSubject(s);
    setSubName(s.name);
    setSubCode(s.code);
    setSubInstructor(s.instructor);
    setSubColor(s.color);
    setSubTarget(s.targetAttendance);
    setSubModalOpen(true);
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subName.trim()) return;
    const now = new Date().toISOString();
    await saveSubject({
      id: editingSubject?.id ?? generateId(),
      name: subName.trim(),
      code: subCode.trim(),
      instructor: subInstructor.trim(),
      color: subColor,
      targetAttendance: Math.max(0, Math.min(100, Number(subTarget) || 75)),
      createdAt: editingSubject?.createdAt ?? now,
      updatedAt: now,
    });
    showToast(editingSubject ? 'Subject updated.' : 'Subject added.');
    setSubModalOpen(false);
  };

  const openNewAssignment = () => {
    setEditingAssn(null);
    setAssnTitle('');
    setAssnSubjectId(subjects[0]?.id ?? '');
    setAssnDesc('');
    setAssnDue(todayStr);
    setAssnPriority('Medium');
    setAssnStatus('Not started');
    setAssnModalOpen(true);
  };

  const openEditAssignment = (a: Assignment) => {
    setEditingAssn(a);
    setAssnTitle(a.title);
    setAssnSubjectId(a.subjectId);
    setAssnDesc(a.description);
    setAssnDue(a.dueDate);
    setAssnPriority(a.priority);
    setAssnStatus(a.status);
    setAssnModalOpen(true);
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assnTitle.trim() || !assnDue) return;
    const now = new Date().toISOString();
    await saveAssignment({
      id: editingAssn?.id ?? generateId(),
      subjectId: assnSubjectId,
      title: assnTitle.trim(),
      description: assnDesc.trim(),
      dueDate: assnDue,
      priority: assnPriority,
      status: assnStatus,
      createdAt: editingAssn?.createdAt ?? now,
      updatedAt: now,
    });
    showToast(editingAssn ? 'Assignment updated.' : 'Assignment added.');
    setAssnModalOpen(false);
  };

  const handleStatusChange = async (a: Assignment, nextStatus: AssignmentStatus) => {
    await saveAssignment({
      ...a,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    });
    showToast(`Marked "${a.title}" as ${nextStatus}.`);
  };

  const handleLogAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetSubId = attSubjectId || subjects[0]?.id;
    if (!targetSubId) {
      showToast('Please create a subject first.', 'error');
      return;
    }
    const now = new Date().toISOString();
    const record: AttendanceRecord = {
      id: generateId(),
      subjectId: targetSubId,
      date: attDate,
      status: attStatus,
      note: attNote.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };
    await saveAttendance(record);
    setAttNote('');
    showToast('Attendance logged.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#1F1929] dark:text-white">
            Academics
          </h1>
          <p className="text-sm text-[#685E75] dark:text-[#AFA6C2] mt-1">
            Subjects, assignments, upcoming deadlines, and class attendance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={openNewSubject}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold border border-[#E4DCD7] dark:border-[#39334B] bg-white dark:bg-[#1E1A2A] text-[#2D2638] dark:text-white hover:bg-[#FAF7F5] dark:hover:bg-[#292438] shadow-2xs transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 text-[#3B82F6]" />
            <span>Add subject</span>
          </button>
          <button
            type="button"
            onClick={openNewAssignment}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-xs font-bold bg-[#7B4CE2] hover:bg-[#6A3CD1] text-white shadow-sm shadow-[#7B4CE2]/25 transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add assignment</span>
          </button>
        </div>
      </div>

      {/* Sub-Navigation */}
      <div className="inline-flex flex-wrap p-1.5 rounded-2xl border border-[#ECE4DF] dark:border-[#322C42] bg-white dark:bg-[#1E1A2A] journal-card">
        {[
          {id: 'assignments' as const, label: `Assignments (${assignments.length})`, icon: ClipboardList},
          {id: 'subjects' as const, label: `Subjects (${subjects.length})`, icon: BookOpen},
          {id: 'attendance' as const, label: 'Attendance Tracker', icon: CalendarCheck2},
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                active
                  ? 'bg-[#E5F2FD] text-[#1D5482] dark:bg-[#1F3447] dark:text-[#C4E2FC]'
                  : 'text-[#685E75] dark:text-[#AFA6C2] hover:text-[#1F1929] dark:hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: ASSIGNMENTS */}
      {activeTab === 'assignments' && (
        <div className="space-y-5">
          {/* Next Upcoming Deadlines Banner */}
          {upcomingDeadlines.length > 0 && (
            <div className="p-5 rounded-3xl border border-[#C3E2FC] dark:border-[#365B7D] bg-[#EFF7FE] dark:bg-[#192B3B] space-y-3.5">
              <div className="flex items-center gap-2 text-sm font-bold text-[#1D5482] dark:text-[#C4E2FC]">
                <Clock className="w-4 h-4" />
                <span>Next Upcoming Deadlines</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {upcomingDeadlines.map((a) => {
                  const sub = subjectMap.get(a.subjectId);
                  const diff = daysBetween(todayStr, a.dueDate);
                  const overdue = diff < 0;
                  const dueToday = diff === 0;
                  return (
                    <div
                      key={a.id}
                      className="p-4 rounded-2xl border border-[#DDECFB] dark:border-[#2C4A66] bg-white dark:bg-[#1E1A2A] shadow-2xs space-y-1.5"
                    >
                      <h3 className="text-sm font-bold text-[#1F1929] dark:text-white truncate">
                        {a.title}
                      </h3>
                      <p className="text-xs text-[#685E75] dark:text-[#AFA6C2] truncate">
                        {sub?.name ?? 'General'} · {a.priority}
                      </p>
                      <p
                        className={`text-xs font-semibold tabular-nums flex items-center gap-1 pt-0.5 ${
                          overdue
                            ? 'text-[#D9385A] dark:text-[#F8A5AE]'
                            : dueToday
                              ? 'text-[#B57B14] dark:text-[#F8E7B0]'
                              : 'text-[#4A4158] dark:text-[#D5CEE3]'
                        }`}
                      >
                        {overdue && <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                        <span>
                          {formatFullShortDate(a.dueDate)}{' '}
                          {overdue
                            ? `(${Math.abs(diff)}d overdue)`
                            : dueToday
                              ? '(Today)'
                              : `(${diff}d left)`}
                        </span>
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* All Assignments Card */}
          <div className="rounded-3xl border border-[#ECE4DF] dark:border-[#322C42] bg-white dark:bg-[#1E1A2A] journal-card overflow-hidden">
            <div className="p-5 sm:px-6 border-b border-[#F2ECE8] dark:border-[#2C273B] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-[#1F1929] dark:text-white">
                All Assignments
              </h2>

              <div className="flex flex-wrap items-center gap-2.5">
                <select
                  value={subjectFilter}
                  onChange={(e) => setSubjectFilter(e.target.value)}
                  aria-label="Filter by subject"
                  className="px-3.5 py-2 rounded-2xl border border-[#ECE4DF] dark:border-[#383249] bg-white dark:bg-[#16141D] text-xs font-semibold text-[#2D2638] dark:text-white"
                >
                  <option value="ALL">All subjects</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>

                <select
                  value={assignmentFilter}
                  onChange={(e) => setAssignmentFilter(e.target.value)}
                  aria-label="Filter by status"
                  className="px-3.5 py-2 rounded-2xl border border-[#ECE4DF] dark:border-[#383249] bg-white dark:bg-[#16141D] text-xs font-semibold text-[#2D2638] dark:text-white"
                >
                  <option value="ALL">All statuses</option>
                  <option value="OPEN">Upcoming / Open</option>
                  <option value="Not started">Not started</option>
                  <option value="In progress">In progress</option>
                  <option value="Submitted">Submitted</option>
                </select>
              </div>
            </div>

            {filteredAssignments.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<ClipboardList className="w-6 h-6" />}
                  title={assignments.length === 0 ? 'No assignments yet' : 'No matching assignments'}
                  description="Add assignments linked to your subjects so upcoming deadlines stay visible on your Home dashboard."
                  actionLabel={assignments.length === 0 ? 'Add assignment' : undefined}
                  onAction={assignments.length === 0 ? openNewAssignment : undefined}
                  tone="sky"
                />
              </div>
            ) : (
              <div className="divide-y divide-[#F2ECE8] dark:divide-[#2C273B]">
                {filteredAssignments.map((a) => {
                  const sub = subjectMap.get(a.subjectId);
                  const diff = daysBetween(todayStr, a.dueDate);
                  return (
                    <div
                      key={a.id}
                      className="p-5 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#FCF9F7] dark:hover:bg-[#242031] transition-colors"
                    >
                      <div className="min-w-0 space-y-1">
                        <h3
                          className={`text-sm sm:text-base font-bold ${
                            a.status === 'Submitted'
                              ? 'line-through text-[#9A8FA8] dark:text-[#7F7692]'
                              : 'text-[#1F1929] dark:text-white'
                          }`}
                        >
                          {a.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#685E75] dark:text-[#AFA6C2]">
                          <span>{sub?.name ?? 'General'}</span>
                          <span aria-hidden="true">·</span>
                          <span
                            className={`tabular-nums font-semibold ${
                              a.status !== 'Submitted' && diff < 0
                                ? 'text-[#D9385A] dark:text-[#F8A5AE]'
                                : a.status !== 'Submitted' && diff <= 2
                                  ? 'text-[#B57B14] dark:text-[#F8E7B0]'
                                  : ''
                            }`}
                          >
                            Due {formatFullShortDate(a.dueDate)}
                            {a.status !== 'Submitted' && diff === 0 ? ' (Today)' : ''}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{a.priority} priority</span>
                        </div>
                        {a.description && (
                          <p className="text-xs text-[#5A506B] dark:text-[#C5BDD4] pt-0.5">
                            {a.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          value={a.status}
                          onChange={(e) =>
                            handleStatusChange(a, e.target.value as AssignmentStatus)
                          }
                          aria-label={`Status for ${a.title}`}
                          className="px-3 py-1.5 rounded-2xl border border-[#E4DCD7] dark:border-[#39334B] bg-[#FAF7F5] dark:bg-[#262233] text-xs font-bold text-[#2D2638] dark:text-white"
                        >
                          <option value="Not started">Not started</option>
                          <option value="In progress">In progress</option>
                          <option value="Submitted">Submitted</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => openEditAssignment(a)}
                          aria-label={`Edit ${a.title}`}
                          className="w-8 h-8 rounded-xl border border-[#ECE4DF] dark:border-[#362F48] bg-white dark:bg-[#262233] text-[#5A506B] dark:text-[#C5BDD4] hover:bg-[#FAF7F5] dark:hover:bg-[#312C40] inline-flex items-center justify-center transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteAssnTarget(a)}
                          aria-label={`Delete ${a.title}`}
                          className="w-8 h-8 rounded-xl border border-[#FCE1E6] dark:border-[#5C313A] bg-white dark:bg-[#262233] text-[#D9385A] dark:text-[#F8A5AE] hover:bg-[#FFF2F4] dark:hover:bg-[#3F2227] inline-flex items-center justify-center transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SUBJECTS */}
      {activeTab === 'subjects' && (
        <div>
          {subjects.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="w-6 h-6" />}
              title="No subjects added yet"
              description="Add your semester subjects to link assignments, timetable lectures, and attendance percentages."
              actionLabel="Add First Subject"
              onAction={openNewSubject}
              tone="sky"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {subjects.map((sub) => {
                const palette = PASTEL_PALETTE[sub.color];
                const subAssignments = assignments.filter((a) => a.subjectId === sub.id);
                const att = attendanceBySubject.find((x) => x.sub.id === sub.id);
                return (
                  <div
                    key={sub.id}
                    className="p-5 rounded-3xl border border-[#ECE4DF] dark:border-[#322C42] bg-white dark:bg-[#1E1A2A] journal-card space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-3.5 h-3.5 rounded-full shrink-0 ${palette.dot}`} />
                        <div className="min-w-0">
                          <h3 className="text-base font-bold text-[#1F1929] dark:text-white truncate">
                            {sub.name}
                          </h3>
                          <p className="text-xs text-[#685E75] dark:text-[#AFA6C2] truncate">
                            {sub.code || 'No code'}
                            {sub.instructor ? ` · ${sub.instructor}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditSubject(sub)}
                          aria-label={`Edit ${sub.name}`}
                          className="w-8 h-8 rounded-xl border border-[#ECE4DF] dark:border-[#362F48] bg-white dark:bg-[#262233] text-[#5A506B] dark:text-[#C5BDD4] hover:bg-[#FAF7F5] inline-flex items-center justify-center transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteSubTarget(sub)}
                          aria-label={`Delete ${sub.name}`}
                          className="w-8 h-8 rounded-xl border border-[#FCE1E6] dark:border-[#5C313A] bg-white dark:bg-[#262233] text-[#D9385A] dark:text-[#F8A5AE] hover:bg-[#FFF2F4] inline-flex items-center justify-center transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-[#F2ECE8] dark:border-[#2C273B] flex items-center justify-between text-xs text-[#685E75] dark:text-[#AFA6C2] tabular-nums">
                      <span>{subAssignments.length} assignments</span>
                      <span>
                        Attendance:{' '}
                        <strong className="text-[#1F1929] dark:text-white">
                          {att?.pct !== null && att?.pct !== undefined ? `${att.pct}%` : '—'}
                        </strong>{' '}
                        (target {sub.targetAttendance}%)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ATTENDANCE TRACKER */}
      {activeTab === 'attendance' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 p-6 rounded-3xl border border-[#ECE4DF] dark:border-[#322C42] bg-white dark:bg-[#1E1A2A] journal-card space-y-4">
            <h2 className="font-display text-lg font-bold text-[#1F1929] dark:text-white">
              Log Attendance
            </h2>
            {subjects.length === 0 ? (
              <p className="text-sm text-[#685E75] dark:text-[#AFA6C2]">
                Add at least one subject first before logging attendance.
              </p>
            ) : (
              <form onSubmit={handleLogAttendance} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                    Subject
                  </label>
                  <select
                    value={attSubjectId || subjects[0]?.id}
                    onChange={(e) => setAttSubjectId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={attDate}
                      onChange={(e) => setAttDate(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                      Status
                    </label>
                    <select
                      value={attStatus}
                      onChange={(e) => setAttStatus(e.target.value as AttendanceStatus)}
                      className="w-full px-3 py-2.5 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
                    >
                      <option value="Present">Present</option>
                      <option value="Absent">Absent</option>
                      <option value="Cancelled">Cancelled (not counted)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                    Note (optional)
                  </label>
                  <input
                    type="text"
                    value={attNote}
                    onChange={(e) => setAttNote(e.target.value)}
                    placeholder="e.g. Lab session / medical leave"
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-5 rounded-full text-sm font-bold bg-[#7B4CE2] hover:bg-[#6A3CD1] text-white shadow-sm shadow-[#7B4CE2]/25 transition-colors"
                >
                  Save Attendance Record
                </button>
              </form>
            )}
          </div>

          <div className="lg:col-span-7 space-y-4">
            <div className="p-6 rounded-3xl border border-[#ECE4DF] dark:border-[#322C42] bg-white dark:bg-[#1E1A2A] journal-card space-y-4">
              <h2 className="font-display text-lg font-bold text-[#1F1929] dark:text-white">
                Attendance by Subject
              </h2>

              {attendanceBySubject.length === 0 ? (
                <p className="text-sm text-[#685E75] dark:text-[#AFA6C2]">
                  No subjects found yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {attendanceBySubject.map(({sub, present, absent, cancelled, pct}) => {
                    const meetsTarget = pct === null || pct >= sub.targetAttendance;
                    return (
                      <div
                        key={sub.id}
                        className="p-4 rounded-2xl bg-[#FAF7F5] dark:bg-[#262233] border border-[#EFE8E3] dark:border-[#332E45] space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-bold text-[#1F1929] dark:text-white">
                              {sub.name}
                            </h3>
                            <p className="text-xs text-[#685E75] dark:text-[#AFA6C2] tabular-nums">
                              {present} present · {absent} absent · {cancelled} cancelled
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-base font-bold tabular-nums">
                              {pct !== null ? `${pct}%` : '—'}
                            </p>
                            <p
                              className={`text-[11px] font-bold ${
                                meetsTarget
                                  ? 'text-[#1D6344] dark:text-[#9CE4BF]'
                                  : 'text-[#D9385A] dark:text-[#F8A5AE]'
                              }`}
                            >
                              {pct === null
                                ? 'No classes logged'
                                : meetsTarget
                                  ? `On track (target ${sub.targetAttendance}%)`
                                  : `Below ${sub.targetAttendance}% target`}
                            </p>
                          </div>
                        </div>

                        <div className="h-2.5 rounded-full bg-[#EAE2DC] dark:bg-[#352F47] overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              meetsTarget ? 'bg-[#30C283]' : 'bg-[#E5536B]'
                            }`}
                            style={{width: `${pct ?? 0}%`}}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {attendanceRecords.length > 0 && (
              <div className="p-6 rounded-3xl border border-[#ECE4DF] dark:border-[#322C42] bg-white dark:bg-[#1E1A2A] journal-card space-y-3">
                <h3 className="text-base font-bold text-[#1F1929] dark:text-white">
                  Recent Attendance Log
                </h3>
                <div className="divide-y divide-[#F2ECE8] dark:divide-[#2C273B] max-h-64 overflow-y-auto">
                  {[...attendanceRecords]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((rec) => (
                      <div
                        key={rec.id}
                        className="py-2.5 flex items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <span className="font-bold text-[#1F1929] dark:text-white">
                            {subjectMap.get(rec.subjectId)?.name ?? 'Subject'}
                          </span>
                          <span className="mx-1.5 text-[#7D728F]">·</span>
                          <span className="tabular-nums text-[#685E75] dark:text-[#AFA6C2]">
                            {formatShortDate(rec.date)}
                          </span>
                          <span className="mx-1.5 text-[#7D728F]">·</span>
                          <span className="font-semibold">{rec.status}</span>
                          {rec.note && (
                            <span className="text-[#685E75] dark:text-[#AFA6C2]"> ({rec.note})</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteAttendance(rec.id);
                            showToast('Attendance log removed.');
                          }}
                          className="p-1.5 rounded-lg text-[#7D728F] hover:text-[#D9385A]"
                          aria-label="Delete attendance record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Subject Modal */}
      <Modal
        open={subModalOpen}
        onClose={() => setSubModalOpen(false)}
        title={editingSubject ? 'Edit Subject' : 'Add Subject'}
      >
        <form onSubmit={handleSaveSubject} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
              Subject Name *
            </label>
            <input
              type="text"
              required
              value={subName}
              onChange={(e) => setSubName(e.target.value)}
              placeholder="e.g. Financial Accounting"
              className="w-full px-3.5 py-2.5 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                Course Code
              </label>
              <input
                type="text"
                value={subCode}
                onChange={(e) => setSubCode(e.target.value)}
                placeholder="e.g. FIN-204"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                Target Attendance (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={subTarget}
                onChange={(e) => setSubTarget(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm tabular-nums"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                Instructor
              </label>
              <input
                type="text"
                value={subInstructor}
                onChange={(e) => setSubInstructor(e.target.value)}
                placeholder="e.g. Dr. Mehta"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                Colour Tag
              </label>
              <select
                value={subColor}
                onChange={(e) => setSubColor(e.target.value as PastelToken)}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
              >
                {PASTEL_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {PASTEL_PALETTE[k].label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setSubModalOpen(false)}
              className="px-4 py-2 rounded-full text-sm font-semibold border border-[#E4DCD7] dark:border-[#39334B]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-full text-sm font-bold bg-[#7B4CE2] hover:bg-[#6A3CD1] text-white"
            >
              {editingSubject ? 'Save Subject' : 'Add Subject'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Assignment Modal */}
      <Modal
        open={assnModalOpen}
        onClose={() => setAssnModalOpen(false)}
        title={editingAssn ? 'Edit Assignment' : 'Add Assignment'}
      >
        <form onSubmit={handleSaveAssignment} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
              Title *
            </label>
            <input
              type="text"
              required
              value={assnTitle}
              onChange={(e) => setAssnTitle(e.target.value)}
              placeholder="e.g. Case study presentation"
              className="w-full px-3.5 py-2.5 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                Subject
              </label>
              <select
                value={assnSubjectId}
                onChange={(e) => setAssnSubjectId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
              >
                <option value="">General / Unassigned</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                Due Date *
              </label>
              <input
                type="date"
                required
                value={assnDue}
                onChange={(e) => setAssnDue(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                Priority
              </label>
              <select
                value={assnPriority}
                onChange={(e) => setAssnPriority(e.target.value as AssignmentPriority)}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                Status
              </label>
              <select
                value={assnStatus}
                onChange={(e) => setAssnStatus(e.target.value as AssignmentStatus)}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
              >
                <option value="Not started">Not started</option>
                <option value="In progress">In progress</option>
                <option value="Submitted">Submitted</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
              Description (optional)
            </label>
            <textarea
              rows={2}
              value={assnDesc}
              onChange={(e) => setAssnDesc(e.target.value)}
              placeholder="Submission guidelines, rubric details..."
              className="w-full px-3.5 py-2.5 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAssnModalOpen(false)}
              className="px-4 py-2 rounded-full text-sm font-semibold border border-[#E4DCD7] dark:border-[#39334B]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-full text-sm font-bold bg-[#7B4CE2] hover:bg-[#6A3CD1] text-white"
            >
              {editingAssn ? 'Save Changes' : 'Add Assignment'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteSubTarget)}
        onClose={() => setDeleteSubTarget(null)}
        onConfirm={async () => {
          if (!deleteSubTarget) return;
          await deleteSubject(deleteSubTarget.id);
          showToast('Subject and linked assignments/attendance deleted.');
        }}
        title="Delete Subject"
        description={`Delete "${deleteSubTarget?.name ?? ''}" along with its linked assignments and attendance logs?`}
        confirmLabel="Delete Subject"
      />

      <ConfirmDialog
        open={Boolean(deleteAssnTarget)}
        onClose={() => setDeleteAssnTarget(null)}
        onConfirm={async () => {
          if (!deleteAssnTarget) return;
          await deleteAssignment(deleteAssnTarget.id);
          showToast('Assignment deleted.');
        }}
        title="Delete Assignment"
        description={`Delete "${deleteAssnTarget?.title ?? ''}"?`}
        confirmLabel="Delete Assignment"
      />
    </div>
  );
};
