import React, {useEffect, useMemo, useState} from 'react';
import {AlertTriangle, Ban, RotateCcw} from 'lucide-react';
import {useApp} from '../../context/AppContext';
import {
  ResolvedTimetableOccurrence,
  TimetableEvent,
  TimetableException,
} from '../../types/models';
import {
  WEEKDAY_NAMES,
  addDays,
  formatShortDate,
  formatTime12h,
  getDayOfWeekFromStr,
  getTodayStr,
  timeToMinutes,
} from '../../utils/date';
import {generateId} from '../../utils/id';
import {detectScheduleConflicts} from '../../utils/timetable';
import {Modal} from '../ui/Modal';

export type EditScope = 'this' | 'future' | 'series';

interface TimetableEventModalProps {
  open: boolean;
  onClose: () => void;
  initialIsRecurring?: boolean;
  initialDate?: string;
  editingOccurrence?: ResolvedTimetableOccurrence | null;
}

export const TimetableEventModal: React.FC<TimetableEventModalProps> = ({
  open,
  onClose,
  initialIsRecurring = true,
  initialDate,
  editingOccurrence = null,
}) => {
  const {
    subjects,
    settings,
    timetableEvents,
    timetableExceptions,
    saveTimetableEvent,
    saveTimetableException,
    cancelTimetableOccurrence,
    restoreTimetableOccurrence,
    showToast,
  } = useApp();

  const isEditing = Boolean(editingOccurrence);
  const isEditingRecurring = Boolean(editingOccurrence?.isRecurring);

  const [editScope, setEditScope] = useState<EditScope>('this');
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [categoryId, setCategoryId] = useState('academic_class');
  const [isRecurring, setIsRecurring] = useState(initialIsRecurring);
  const [dayOfWeek, setDayOfWeek] = useState<number>(1);
  const [date, setDate] = useState(getTodayStr());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [location, setLocation] = useState('');
  const [instructor, setInstructor] = useState('');
  const [recurrenceStartDate, setRecurrenceStartDate] = useState(getTodayStr());
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [acknowledgeConflict, setAcknowledgeConflict] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    setAcknowledgeConflict(false);

    if (editingOccurrence) {
      const src = editingOccurrence.sourceEvent;
      setEditScope(editingOccurrence.isRecurring ? 'this' : 'series');
      setTitle(editingOccurrence.title);
      setSubjectId(editingOccurrence.subjectId ?? '');
      setCustomSubject(editingOccurrence.subjectId ? '' : editingOccurrence.subjectName ?? '');
      setCategoryId(editingOccurrence.categoryId);
      setIsRecurring(editingOccurrence.isRecurring);
      setDayOfWeek(src.dayOfWeek ?? getDayOfWeekFromStr(editingOccurrence.date));
      setDate(editingOccurrence.date);
      setStartTime(editingOccurrence.startTime);
      setEndTime(editingOccurrence.endTime);
      setLocation(editingOccurrence.location ?? '');
      setInstructor(src.instructor ?? '');
      setRecurrenceStartDate(src.recurrenceStartDate ?? editingOccurrence.originalDate);
      setRecurrenceEndDate(src.recurrenceEndDate ?? '');
      setNotes(editingOccurrence.notes ?? '');
    } else {
      const defaultDate = initialDate ?? getTodayStr();
      setEditScope('series');
      setTitle('');
      setSubjectId('');
      setCustomSubject('');
      setCategoryId(
        initialIsRecurring
          ? settings.eventCategories[0]?.id ?? 'academic_class'
          : 'committee_club'
      );
      setIsRecurring(initialIsRecurring);
      setDayOfWeek(getDayOfWeekFromStr(defaultDate));
      setDate(defaultDate);
      setStartTime('09:00');
      setEndTime('10:00');
      setLocation('');
      setInstructor('');
      setRecurrenceStartDate(defaultDate);
      setRecurrenceEndDate('');
      setNotes('');
    }
  }, [open, editingOccurrence, initialIsRecurring, initialDate, settings.eventCategories]);

  // Conflict check for target date (for recurring creation/series edit, check nearest matching date on/after start)
  const targetCheckDate = useMemo(() => {
    if (!isRecurring || (isEditingRecurring && editScope === 'this')) {
      return date;
    }
    const base = recurrenceStartDate || getTodayStr();
    const baseDow = getDayOfWeekFromStr(base);
    const offset = (dayOfWeek - baseDow + 7) % 7;
    return addDays(base, offset);
  }, [isRecurring, isEditingRecurring, editScope, date, recurrenceStartDate, dayOfWeek]);

  const conflicts = useMemo(() => {
    if (!open || !startTime || !endTime || timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      return [];
    }
    return detectScheduleConflicts(
      {
        date: targetCheckDate,
        startTime,
        endTime,
        ignoreEventId: editingOccurrence?.eventId,
        ignoreOccurrenceOriginalDate:
          editingOccurrence && editScope === 'this' ? editingOccurrence.originalDate : undefined,
      },
      timetableEvents,
      timetableExceptions
    );
  }, [
    open,
    targetCheckDate,
    startTime,
    endTime,
    editingOccurrence,
    editScope,
    timetableEvents,
    timetableExceptions,
  ]);

  useEffect(() => {
    setAcknowledgeConflict(false);
  }, [targetCheckDate, startTime, endTime]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Please enter an event or class title.');
      return;
    }
    if (!startTime || !endTime || timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      setError('End time must be after start time.');
      return;
    }
    if (isRecurring && recurrenceEndDate && recurrenceEndDate < recurrenceStartDate) {
      setError('Recurrence end date cannot be before start date.');
      return;
    }
    if (conflicts.length > 0 && !acknowledgeConflict) {
      setError('Please acknowledge the schedule conflict or adjust the time.');
      return;
    }

    const selectedSubject = subjects.find((s) => s.id === subjectId);
    const resolvedSubjectName = selectedSubject?.name || customSubject.trim() || undefined;
    const now = new Date().toISOString();

    if (!editingOccurrence) {
      const newEvent: TimetableEvent = {
        id: generateId(),
        title: title.trim(),
        subjectId: selectedSubject?.id,
        subjectName: resolvedSubjectName,
        categoryId,
        isRecurring,
        dayOfWeek: isRecurring ? dayOfWeek : undefined,
        date: isRecurring ? undefined : date,
        startTime,
        endTime,
        location: location.trim() || undefined,
        instructor: instructor.trim() || undefined,
        notes: notes.trim() || undefined,
        recurrenceStartDate: isRecurring ? recurrenceStartDate : undefined,
        recurrenceEndDate: isRecurring && recurrenceEndDate ? recurrenceEndDate : undefined,
        createdAt: now,
        updatedAt: now,
      };
      await saveTimetableEvent(newEvent);
      showToast(isRecurring ? 'Recurring class added to timetable.' : 'Event added to timetable.');
      onClose();
      return;
    }

    const src = editingOccurrence.sourceEvent;

    if (!src.isRecurring) {
      await saveTimetableEvent({
        ...src,
        title: title.trim(),
        subjectId: selectedSubject?.id,
        subjectName: resolvedSubjectName,
        categoryId,
        date,
        startTime,
        endTime,
        location: location.trim() || undefined,
        instructor: instructor.trim() || undefined,
        notes: notes.trim() || undefined,
        updatedAt: now,
      });
      showToast('Event updated.');
      onClose();
      return;
    }

    // Editing a recurring occurrence
    if (editScope === 'this') {
      const existingEx = timetableExceptions.find(
        (ex) => ex.eventId === src.id && ex.originalDate === editingOccurrence.originalDate
      );
      const ex: TimetableException = {
        id: existingEx?.id ?? generateId(),
        eventId: src.id,
        originalDate: editingOccurrence.originalDate,
        type: 'modified',
        overrideDate: date !== editingOccurrence.originalDate ? date : undefined,
        overrideStartTime: startTime,
        overrideEndTime: endTime,
        overrideTitle: title.trim(),
        overrideLocation: location.trim() || undefined,
        overrideCategoryId: categoryId,
        overrideNotes: notes.trim() || undefined,
        overrideSubjectName: resolvedSubjectName,
        createdAt: existingEx?.createdAt ?? now,
        updatedAt: now,
      };
      await saveTimetableException(ex);
      showToast(`Updated only ${formatShortDate(editingOccurrence.originalDate)} occurrence.`);
      onClose();
      return;
    }

    if (editScope === 'future') {
      const occDate = editingOccurrence.originalDate;
      const srcStart = src.recurrenceStartDate ?? occDate;
      if (occDate <= srcStart) {
        // Equivalent to entire series
        await saveTimetableEvent({
          ...src,
          title: title.trim(),
          subjectId: selectedSubject?.id,
          subjectName: resolvedSubjectName,
          categoryId,
          dayOfWeek,
          startTime,
          endTime,
          location: location.trim() || undefined,
          instructor: instructor.trim() || undefined,
          notes: notes.trim() || undefined,
          recurrenceStartDate: recurrenceStartDate || srcStart,
          recurrenceEndDate: recurrenceEndDate || undefined,
          updatedAt: now,
        });
      } else {
        // End old series the day before this occurrence, create new series from this occurrence onward
        await saveTimetableEvent({
          ...src,
          recurrenceEndDate: addDays(occDate, -1),
          updatedAt: now,
        });
        const newSeriesId = generateId();
        await saveTimetableEvent({
          id: newSeriesId,
          title: title.trim(),
          subjectId: selectedSubject?.id,
          subjectName: resolvedSubjectName,
          categoryId,
          isRecurring: true,
          dayOfWeek,
          startTime,
          endTime,
          location: location.trim() || undefined,
          instructor: instructor.trim() || undefined,
          notes: notes.trim() || undefined,
          recurrenceStartDate: occDate,
          recurrenceEndDate: recurrenceEndDate || undefined,
          createdAt: now,
          updatedAt: now,
        });
        // Preserve any cancelled/modified future occurrence exceptions on the split series
        const futureExceptions = timetableExceptions.filter(
          (ex) => ex.eventId === src.id && ex.originalDate >= occDate
        );
        for (const ex of futureExceptions) {
          await saveTimetableException({
            ...ex,
            eventId: newSeriesId,
            updatedAt: now,
          });
        }
      }
      showToast('Updated this and all future occurrences.');
      onClose();
      return;
    }

    // Entire series
    await saveTimetableEvent({
      ...src,
      title: title.trim(),
      subjectId: selectedSubject?.id,
      subjectName: resolvedSubjectName,
      categoryId,
      dayOfWeek,
      startTime,
      endTime,
      location: location.trim() || undefined,
      instructor: instructor.trim() || undefined,
      notes: notes.trim() || undefined,
      recurrenceStartDate: recurrenceStartDate || src.recurrenceStartDate,
      recurrenceEndDate: recurrenceEndDate || undefined,
      updatedAt: now,
    });
    showToast('Updated entire recurring series.');
    onClose();
  };

  const handleCancelOrRestoreOccurrence = async () => {
    if (!editingOccurrence || !editingOccurrence.isRecurring) return;
    if (editingOccurrence.isCancelled) {
      await restoreTimetableOccurrence(editingOccurrence.eventId, editingOccurrence.originalDate);
      showToast(
        `Restored "${editingOccurrence.title}" on ${formatShortDate(editingOccurrence.originalDate)}.`
      );
      onClose();
      return;
    }

    await cancelTimetableOccurrence(editingOccurrence.eventId, editingOccurrence.originalDate);
    showToast(
      `Cancelled "${editingOccurrence.title}" for ${formatShortDate(editingOccurrence.originalDate)} only.`
    );
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Edit Timetable Entry' : 'Add Timetable Event'}
      subtitle={
        isEditingRecurring
          ? `Selected date: ${formatShortDate(editingOccurrence!.originalDate)}`
          : 'Schedule a recurring class or a one-time event'
      }
      maxWidthClass="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {isEditingRecurring && (
          <div className="p-3.5 rounded-xl bg-[#F6F1FE] dark:bg-[#251E38] border border-[#DDD1F8] dark:border-[#443668] space-y-2">
            <p className="text-xs font-bold text-[#4C3482] dark:text-[#DDD0FA]">
              How would you like to apply these changes?
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                {value: 'this' as EditScope, label: 'Only this occurrence'},
                {value: 'future' as EditScope, label: 'This & future classes'},
                {value: 'series' as EditScope, label: 'Entire series'},
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setEditScope(opt.value)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border text-left transition-colors ${
                    editScope === opt.value
                      ? 'bg-[#7F63D8] text-white border-[#7F63D8]'
                      : 'bg-white dark:bg-[#1F1C29] border-[#E4DCF5] dark:border-[#393152] text-[#4C425E] dark:text-[#CFC7DF]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {editingOccurrence?.isCancelled && (
              <p className="text-xs font-semibold text-[#8C2D36] dark:text-[#F8C8CE] pt-1">
                This occurrence is currently cancelled for{' '}
                {formatShortDate(editingOccurrence.originalDate)}. Use &ldquo;Restore this
                occurrence&rdquo; below to reinstate it, or save changes to override this date.
              </p>
            )}
          </div>
        )}

        {!isEditing && (
          <div className="flex items-center gap-2 p-1 rounded-xl bg-[#F4EFF8] dark:bg-[#282435]">
            <button
              type="button"
              onClick={() => setIsRecurring(true)}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${
                isRecurring
                  ? 'bg-white dark:bg-[#1F1C29] text-[#2D2638] dark:text-white shadow-xs'
                  : 'text-[#685E75] dark:text-[#AFA6C2]'
              }`}
            >
              Recurring Weekly Class
            </button>
            <button
              type="button"
              onClick={() => setIsRecurring(false)}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${
                !isRecurring
                  ? 'bg-white dark:bg-[#1F1C29] text-[#2D2638] dark:text-white shadow-xs'
                  : 'text-[#685E75] dark:text-[#AFA6C2]'
              }`}
            >
              One-Time Event
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isRecurring ? 'e.g. Corporate Finance Lecture' : 'e.g. Placement Committee Meeting'}
              className="w-full px-3.5 py-2 rounded-xl border border-[#E4DCD7] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
              Category
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-[#E4DCD7] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
            >
              {settings.eventCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
              Subject (optional)
            </label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-[#E4DCD7] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
            >
              <option value="">Custom / None</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name} {sub.code ? `(${sub.code})` : ''}
                </option>
              ))}
            </select>
          </div>

          {!subjectId && (
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                Subject or Tag Label (optional)
              </label>
              <input
                type="text"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                placeholder="e.g. Statistics 201 or Finance Club"
                className="w-full px-3.5 py-2 rounded-xl border border-[#E4DCD7] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
              />
            </div>
          )}

          {isRecurring && editScope !== 'this' ? (
            <div>
              <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                Day of the Week
              </label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                className="w-full px-3.5 py-2 rounded-xl border border-[#E4DCD7] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
              >
                {WEEKDAY_NAMES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                Date {isEditingRecurring && editScope === 'this' ? '(reschedule if needed)' : '*'}
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#E4DCD7] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm tabular-nums"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                Start Time *
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E4DCD7] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                End Time *
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E4DCD7] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
              Location / Room
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Room 304 / Auditorium"
              className="w-full px-3.5 py-2 rounded-xl border border-[#E4DCD7] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
              Faculty / Organizer (optional)
            </label>
            <input
              type="text"
              value={instructor}
              onChange={(e) => setInstructor(e.target.value)}
              placeholder="e.g. Prof. Sharma"
              className="w-full px-3.5 py-2 rounded-xl border border-[#E4DCD7] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
            />
          </div>

          {isRecurring && editScope !== 'this' && (
            <>
              <div>
                <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                  Recurrence Start Date
                </label>
                <input
                  type="date"
                  value={recurrenceStartDate}
                  onChange={(e) => setRecurrenceStartDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E4DCD7] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                  Recurrence End Date (optional)
                </label>
                <input
                  type="date"
                  value={recurrenceEndDate}
                  onChange={(e) => setRecurrenceEndDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E4DCD7] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm tabular-nums"
                />
              </div>
            </>
          )}

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
              Notes (optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any syllabus notes, reminders, or prep links..."
              className="w-full px-3.5 py-2 rounded-xl border border-[#E4DCD7] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm resize-none"
            />
          </div>
        </div>

        {conflicts.length > 0 && (
          <div className="p-3.5 rounded-xl bg-[#FDF5D7] dark:bg-[#3F361C] border border-[#F3DF9B] dark:border-[#6B5B2C] text-[#735714] dark:text-[#F8E7B0] space-y-2">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold">
                  Schedule conflict detected on {formatShortDate(targetCheckDate)}:
                </p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {conflicts.map((c) => (
                    <li key={c.occurrenceKey}>
                      {c.title} ({formatTime12h(c.startTime)} – {formatTime12h(c.endTime)})
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={acknowledgeConflict}
                onChange={(e) => setAcknowledgeConflict(e.target.checked)}
                className="rounded border-[#C5A753]"
              />
              <span>I understand there is an overlap — save this event anyway</span>
            </label>
          </div>
        )}

        {error && (
          <p className="text-xs font-semibold text-[#C34251] dark:text-[#F8A5AE]">{error}</p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2">
          {isEditingRecurring && editingOccurrence ? (
            <button
              type="button"
              onClick={handleCancelOrRestoreOccurrence}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                editingOccurrence.isCancelled
                  ? 'bg-[#E4F7EE] text-[#1D6344] dark:bg-[#1E3B2E] dark:text-[#BFEFD9]'
                  : 'bg-[#FDF5D7] text-[#735714] dark:bg-[#3F361C] dark:text-[#F8E7B0]'
              }`}
            >
              {editingOccurrence.isCancelled ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore this occurrence</span>
                </>
              ) : (
                <>
                  <Ban className="w-3.5 h-3.5" />
                  <span>Cancel this occurrence</span>
                </>
              )}
            </button>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-semibold border border-[#E4DCD7] dark:border-[#39334B] text-[#5A506B] dark:text-[#CFC7DF] hover:bg-[#F7F3FA] dark:hover:bg-[#2A2538]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#7F63D8] hover:bg-[#6D52C4] text-white transition-colors"
            >
              {isEditing ? 'Save Changes' : 'Save Event'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
