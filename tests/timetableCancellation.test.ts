import 'fake-indexeddb/auto';
import {IDBFactory} from 'fake-indexeddb';
import {beforeEach, describe, expect, it} from 'vitest';
import {
  DB_VERSION,
  closeDatabaseConnection,
  getAllRecords,
  openDatabase,
} from '../src/db/database';
import {repository} from '../src/db/repository';
import {TimetableEvent, TimetableException} from '../src/types/models';
import {
  buildCancelledOccurrenceException,
  detectScheduleConflicts,
  findOccurrenceException,
  resolveOccurrencesForRange,
} from '../src/utils/timetable';

function createRecurringEconometricsLecture(): TimetableEvent {
  return {
    id: 'tt_econ_mon',
    title: 'Econometrics Lecture',
    subjectId: 'subj_econ',
    subjectName: 'Econometrics',
    categoryId: 'academic_class',
    isRecurring: true,
    dayOfWeek: 1, // Monday
    startTime: '09:00',
    endTime: '10:00',
    location: 'Room 201',
    instructor: 'Prof. Rao',
    recurrenceStartDate: '2026-11-02',
    createdAt: '2026-11-01T08:00:00.000Z',
    updatedAt: '2026-11-01T08:00:00.000Z',
  };
}

describe('Timetable one-week occurrence cancellation & restoration', () => {
  beforeEach(async () => {
    await closeDatabaseConnection();
    globalThis.indexedDB = new IDBFactory();
  });

  it('cancels only the selected occurrence date, leaves other weeks unaffected, and does not alter the recurring event', async () => {
    const lecture = createRecurringEconometricsLecture();
    await repository.saveTimetableEvent(lecture);

    // Resolve 4 consecutive Mondays: Nov 16, Nov 23, Nov 30, Dec 07
    const initialOccurrences = resolveOccurrencesForRange(
      [lecture],
      [],
      '2026-11-16',
      '2026-12-07'
    );
    expect(initialOccurrences.map((o) => o.date)).toEqual([
      '2026-11-16',
      '2026-11-23',
      '2026-11-30',
      '2026-12-07',
    ]);
    expect(initialOccurrences.every((o) => !o.isCancelled)).toBe(true);

    // Cancel only Nov 23, 2026
    const targetOcc = initialOccurrences.find((o) => o.date === '2026-11-23')!;
    const cancelException = buildCancelledOccurrenceException({
      eventId: targetOcc.eventId,
      originalDate: targetOcc.originalDate,
      newId: 'ttexc_nov23',
      nowISO: '2026-11-21T18:00:00.000Z',
    });

    expect(cancelException).toEqual({
      id: 'ttexc_nov23',
      eventId: 'tt_econ_mon',
      originalDate: '2026-11-23',
      type: 'cancelled',
      createdAt: '2026-11-21T18:00:00.000Z',
      updatedAt: '2026-11-21T18:00:00.000Z',
    });

    await repository.saveTimetableException(cancelException);

    // Original recurring TimetableEvent in IndexedDB must remain untouched
    const storedEvents = await getAllRecords<TimetableEvent>('timetable_events');
    expect(storedEvents).toEqual([lecture]);

    const afterCancel = resolveOccurrencesForRange(
      storedEvents,
      [cancelException],
      '2026-11-16',
      '2026-12-07'
    );
    expect(afterCancel).toHaveLength(4);
    expect(afterCancel.find((o) => o.date === '2026-11-16')?.isCancelled).toBe(false);
    expect(afterCancel.find((o) => o.date === '2026-11-23')?.isCancelled).toBe(true);
    expect(afterCancel.find((o) => o.date === '2026-11-23')?.exceptionId).toBe('ttexc_nov23');
    expect(afterCancel.find((o) => o.date === '2026-11-30')?.isCancelled).toBe(false);
    expect(afterCancel.find((o) => o.date === '2026-12-07')?.isCancelled).toBe(false);

    // Conflict detection ignores cancelled slot on Nov 23, still detects conflict on Nov 30
    expect(
      detectScheduleConflicts(
        {date: '2026-11-23', startTime: '09:00', endTime: '10:00'},
        storedEvents,
        [cancelException]
      )
    ).toHaveLength(0);
    expect(
      detectScheduleConflicts(
        {date: '2026-11-30', startTime: '09:00', endTime: '10:00'},
        storedEvents,
        [cancelException]
      )
    ).toHaveLength(1);
  });

  it('persists cancelled occurrences across app refresh/reopen and restores cleanly', async () => {
    expect(DB_VERSION).toBe(1);
    const lecture = createRecurringEconometricsLecture();
    await repository.saveTimetableEvent(lecture);

    const cancelException = buildCancelledOccurrenceException({
      eventId: lecture.id,
      originalDate: '2026-11-23',
      newId: 'ttexc_persist_1',
    });
    await repository.saveTimetableException(cancelException);

    // Simulate full app refresh / reopening IndexedDB connection
    await closeDatabaseConnection();
    await openDatabase();
    const reloaded = await repository.loadAllData();

    expect(reloaded.timetableEvents).toEqual([lecture]);
    expect(reloaded.timetableExceptions).toHaveLength(1);
    expect(reloaded.timetableExceptions[0]).toMatchObject({
      id: 'ttexc_persist_1',
      eventId: lecture.id,
      originalDate: '2026-11-23',
      type: 'cancelled',
    });

    const resolvedAfterReload = resolveOccurrencesForRange(
      reloaded.timetableEvents,
      reloaded.timetableExceptions,
      '2026-11-16',
      '2026-11-30'
    );
    expect(resolvedAfterReload.find((o) => o.date === '2026-11-16')?.isCancelled).toBe(false);
    expect(resolvedAfterReload.find((o) => o.date === '2026-11-23')?.isCancelled).toBe(true);
    expect(resolvedAfterReload.find((o) => o.date === '2026-11-30')?.isCancelled).toBe(false);

    // Restore the cancelled occurrence
    const foundEx = findOccurrenceException(
      reloaded.timetableExceptions,
      lecture.id,
      '2026-11-23'
    );
    expect(foundEx).toBeDefined();
    await repository.deleteTimetableException(foundEx!.id);

    // Simulate another refresh / reopen after restoration
    await closeDatabaseConnection();
    await openDatabase();
    const afterRestore = await repository.loadAllData();

    expect(afterRestore.timetableExceptions).toEqual([]);
    const restoredOccurrences = resolveOccurrencesForRange(
      afterRestore.timetableEvents,
      afterRestore.timetableExceptions,
      '2026-11-16',
      '2026-11-30'
    );
    expect(restoredOccurrences.every((o) => !o.isCancelled)).toBe(true);
  });

  it('cancelling a previously rescheduled occurrence preserves exception id/createdAt and clears override fields', async () => {
    const lecture = createRecurringEconometricsLecture();
    const modifiedException: TimetableException = {
      id: 'ttexc_mod_1',
      eventId: lecture.id,
      originalDate: '2026-11-23',
      type: 'modified',
      overrideDate: '2026-11-24',
      overrideStartTime: '11:00',
      overrideEndTime: '12:00',
      overrideTitle: 'Econometrics (Moved to Tue)',
      createdAt: '2026-11-20T10:00:00.000Z',
      updatedAt: '2026-11-20T10:00:00.000Z',
    };

    const rescheduled = resolveOccurrencesForRange(
      [lecture],
      [modifiedException],
      '2026-11-23',
      '2026-11-24'
    );
    expect(rescheduled).toHaveLength(1);
    expect(rescheduled[0].date).toBe('2026-11-24');
    expect(rescheduled[0].originalDate).toBe('2026-11-23');

    const cancelled = buildCancelledOccurrenceException({
      eventId: rescheduled[0].eventId,
      originalDate: rescheduled[0].originalDate,
      existingException: modifiedException,
      newId: 'should_not_be_used',
      nowISO: '2026-11-21T19:00:00.000Z',
    });

    expect(cancelled).toEqual({
      id: 'ttexc_mod_1',
      eventId: lecture.id,
      originalDate: '2026-11-23',
      type: 'cancelled',
      createdAt: '2026-11-20T10:00:00.000Z',
      updatedAt: '2026-11-21T19:00:00.000Z',
    });

    const afterCancel = resolveOccurrencesForRange(
      [lecture],
      [cancelled],
      '2026-11-23',
      '2026-11-30'
    );
    expect(afterCancel.find((o) => o.date === '2026-11-24')).toBeUndefined();
    expect(afterCancel.find((o) => o.date === '2026-11-23')?.isCancelled).toBe(true);
    expect(afterCancel.find((o) => o.date === '2026-11-30')?.isCancelled).toBe(false);
  });

  it('repository.cancelTimetableOccurrence & restoreTimetableOccurrence are idempotent and persist cleanly across refresh', async () => {
    const lecture = createRecurringEconometricsLecture();
    await repository.saveTimetableEvent(lecture);

    // Cancel Nov 23 via repository method (matches original cancelTimetableOccurrence flow)
    const firstEx = await repository.cancelTimetableOccurrence(lecture.id, '2026-11-23');
    expect(firstEx.type).toBe('cancelled');
    expect(firstEx.eventId).toBe(lecture.id);
    expect(firstEx.originalDate).toBe('2026-11-23');

    // Calling cancel again for the same date updates in-place without creating duplicate exceptions
    const secondEx = await repository.cancelTimetableOccurrence(lecture.id, '2026-11-23');
    expect(secondEx.id).toBe(firstEx.id);

    await closeDatabaseConnection();
    await openDatabase();
    const afterRefresh = await repository.loadAllData();
    expect(afterRefresh.timetableExceptions).toHaveLength(1);
    expect(afterRefresh.timetableEvents).toEqual([lecture]);

    const resolved = resolveOccurrencesForRange(
      afterRefresh.timetableEvents,
      afterRefresh.timetableExceptions,
      '2026-11-16',
      '2026-12-07'
    );
    expect(resolved.filter((o) => o.isCancelled).map((o) => o.date)).toEqual(['2026-11-23']);
    expect(resolved.filter((o) => !o.isCancelled).map((o) => o.date)).toEqual([
      '2026-11-16',
      '2026-11-30',
      '2026-12-07',
    ]);

    // Restore via repository method and verify persistence after reload
    const deletedId = await repository.restoreTimetableOccurrence(lecture.id, '2026-11-23');
    expect(deletedId).toBe(firstEx.id);

    await closeDatabaseConnection();
    await openDatabase();
    const afterRestoreRefresh = await repository.loadAllData();
    expect(afterRestoreRefresh.timetableExceptions).toHaveLength(0);
    const restored = resolveOccurrencesForRange(
      afterRestoreRefresh.timetableEvents,
      afterRestoreRefresh.timetableExceptions,
      '2026-11-16',
      '2026-12-07'
    );
    expect(restored.every((o) => !o.isCancelled)).toBe(true);
  });
});
