import {
  ResolvedTimetableOccurrence,
  TimetableEvent,
  TimetableException,
} from '../types/models';
import {addDays, getDayOfWeekFromStr, timeToMinutes} from './date';

export function resolveOccurrencesForRange(
  events: TimetableEvent[],
  exceptions: TimetableException[],
  startDateStr: string,
  endDateStr: string
): ResolvedTimetableOccurrence[] {
  const results: ResolvedTimetableOccurrence[] = [];

  // Index exceptions by (eventId, originalDate)
  const exceptionByOrig = new Map<string, TimetableException>();
  const exceptionsByOverrideDate = new Map<string, TimetableException[]>();

  for (const ex of exceptions) {
    exceptionByOrig.set(`${ex.eventId}::${ex.originalDate}`, ex);
    if (ex.overrideDate && ex.overrideDate !== ex.originalDate && ex.type !== 'cancelled') {
      const list = exceptionsByOverrideDate.get(ex.overrideDate) ?? [];
      list.push(ex);
      exceptionsByOverrideDate.set(ex.overrideDate, list);
    }
  }

  const eventsById = new Map(events.map((e) => [e.id, e]));

  // Walk each day in [startDateStr .. endDateStr]
  let currentDate = startDateStr;
  let guard = 0;
  while (currentDate <= endDateStr && guard < 100) {
    guard++;
    const dow = getDayOfWeekFromStr(currentDate);

    // 1. One-time events on currentDate
    for (const ev of events) {
      if (!ev.isRecurring && ev.date === currentDate) {
        results.push({
          occurrenceKey: `${ev.id}::${currentDate}`,
          eventId: ev.id,
          isRecurring: false,
          originalDate: currentDate,
          date: currentDate,
          startTime: ev.startTime,
          endTime: ev.endTime,
          title: ev.title,
          subjectId: ev.subjectId,
          subjectName: ev.subjectName,
          categoryId: ev.categoryId,
          location: ev.location,
          instructor: ev.instructor,
          notes: ev.notes,
          isCancelled: false,
          isModified: false,
          isRescheduled: false,
          sourceEvent: ev,
        });
      }
    }

    // 2. Recurring events falling on currentDate's weekday
    for (const ev of events) {
      if (!ev.isRecurring || ev.dayOfWeek !== dow) continue;
      if (ev.recurrenceStartDate && currentDate < ev.recurrenceStartDate) continue;
      if (ev.recurrenceEndDate && currentDate > ev.recurrenceEndDate) continue;

      const ex = exceptionByOrig.get(`${ev.id}::${currentDate}`);
      if (ex) {
        // If rescheduled to another date, skip rendering on originalDate
        if (ex.type === 'modified' && ex.overrideDate && ex.overrideDate !== currentDate) {
          continue;
        }
        const isCancelled = ex.type === 'cancelled';
        results.push({
          occurrenceKey: `${ev.id}::${currentDate}`,
          eventId: ev.id,
          isRecurring: true,
          originalDate: currentDate,
          date: currentDate,
          startTime: ex.overrideStartTime ?? ev.startTime,
          endTime: ex.overrideEndTime ?? ev.endTime,
          title: ex.overrideTitle ?? ev.title,
          subjectId: ev.subjectId,
          subjectName: ex.overrideSubjectName ?? ev.subjectName,
          categoryId: ex.overrideCategoryId ?? ev.categoryId,
          location: ex.overrideLocation ?? ev.location,
          instructor: ev.instructor,
          notes: ex.overrideNotes ?? ev.notes,
          isCancelled,
          isModified: ex.type === 'modified',
          isRescheduled: false,
          exceptionId: ex.id,
          sourceEvent: ev,
        });
      } else {
        results.push({
          occurrenceKey: `${ev.id}::${currentDate}`,
          eventId: ev.id,
          isRecurring: true,
          originalDate: currentDate,
          date: currentDate,
          startTime: ev.startTime,
          endTime: ev.endTime,
          title: ev.title,
          subjectId: ev.subjectId,
          subjectName: ev.subjectName,
          categoryId: ev.categoryId,
          location: ev.location,
          instructor: ev.instructor,
          notes: ev.notes,
          isCancelled: false,
          isModified: false,
          isRescheduled: false,
          sourceEvent: ev,
        });
      }
    }

    // 3. Recurring occurrences rescheduled INTO currentDate from another date
    const incoming = exceptionsByOverrideDate.get(currentDate) ?? [];
    for (const ex of incoming) {
      const ev = eventsById.get(ex.eventId);
      if (!ev) continue;
      results.push({
        occurrenceKey: `${ev.id}::${ex.originalDate}::moved`,
        eventId: ev.id,
        isRecurring: true,
        originalDate: ex.originalDate,
        date: currentDate,
        startTime: ex.overrideStartTime ?? ev.startTime,
        endTime: ex.overrideEndTime ?? ev.endTime,
        title: ex.overrideTitle ?? ev.title,
        subjectId: ev.subjectId,
        subjectName: ex.overrideSubjectName ?? ev.subjectName,
        categoryId: ex.overrideCategoryId ?? ev.categoryId,
        location: ex.overrideLocation ?? ev.location,
        instructor: ev.instructor,
        notes: ex.overrideNotes ?? ev.notes,
        isCancelled: false,
        isModified: true,
        isRescheduled: true,
        exceptionId: ex.id,
        sourceEvent: ev,
      });
    }

    currentDate = addDays(currentDate, 1);
  }

  return results.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
  });
}

export function detectScheduleConflicts(
  candidate: {
    date: string;
    startTime: string;
    endTime: string;
    ignoreEventId?: string;
    ignoreOccurrenceOriginalDate?: string;
  },
  events: TimetableEvent[],
  exceptions: TimetableException[]
): ResolvedTimetableOccurrence[] {
  const dayOccurrences = resolveOccurrencesForRange(
    events,
    exceptions,
    candidate.date,
    candidate.date
  );
  const startA = timeToMinutes(candidate.startTime);
  const endA = timeToMinutes(candidate.endTime);

  return dayOccurrences.filter((occ) => {
    if (occ.isCancelled) return false;
    if (
      candidate.ignoreEventId &&
      occ.eventId === candidate.ignoreEventId &&
      (!candidate.ignoreOccurrenceOriginalDate ||
        occ.originalDate === candidate.ignoreOccurrenceOriginalDate)
    ) {
      return false;
    }
    const startB = timeToMinutes(occ.startTime);
    const endB = timeToMinutes(occ.endTime);
    return startA < endB && startB < endA;
  });
}

export function findOccurrenceException(
  exceptions: TimetableException[],
  eventId: string,
  originalDate: string
): TimetableException | undefined {
  return exceptions.find((ex) => ex.eventId === eventId && ex.originalDate === originalDate);
}

export function buildCancelledOccurrenceException(params: {
  eventId: string;
  originalDate: string;
  existingException?: TimetableException;
  newId: string;
  nowISO?: string;
}): TimetableException {
  const now = params.nowISO ?? new Date().toISOString();
  return {
    id: params.existingException?.id ?? params.newId,
    eventId: params.eventId,
    originalDate: params.originalDate,
    type: 'cancelled',
    createdAt: params.existingException?.createdAt ?? now,
    updatedAt: now,
  };
}

