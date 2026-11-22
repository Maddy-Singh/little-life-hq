import 'fake-indexeddb/auto';
import {IDBFactory} from 'fake-indexeddb';
import {beforeEach, describe, expect, it} from 'vitest';
import {
  DB_NAME,
  DB_VERSION,
  STORE_NAMES,
  closeDatabaseConnection,
  openDatabase,
} from '../src/db/database';
import {
  DEFAULT_EVENT_CATEGORIES,
  DEFAULT_SETTINGS,
  repository,
} from '../src/db/repository';
import {createSyntheticLegacyV3Backup} from './fixtures/syntheticLegacyV3Backup';

describe('clean initial state & resetAllData preservation', () => {
  beforeEach(async () => {
    await closeDatabaseConnection();
    globalThis.indexedDB = new IDBFactory();
  });

  it('opens a fresh database with DB_VERSION 1, all 13 stores, empty personal records, and sensible defaults', async () => {
    expect(DB_NAME).toBe('little_life_hq_db');
    expect(DB_VERSION).toBe(1);

    const db = await openDatabase();
    expect(db.version).toBe(1);
    for (const storeName of STORE_NAMES) {
      expect(db.objectStoreNames.contains(storeName)).toBe(true);
    }

    const tx = db.transaction([...STORE_NAMES], 'readonly');
    expect(Array.from(tx.objectStore('goal_weekly_checkins').indexNames)).toEqual(
      expect.arrayContaining(['by_goalId', 'by_weekStart'])
    );
    expect(Array.from(tx.objectStore('assignments').indexNames)).toEqual(
      expect.arrayContaining(['by_subjectId', 'by_dueDate'])
    );
    expect(Array.from(tx.objectStore('attendance_records').indexNames)).toEqual(
      expect.arrayContaining(['by_subjectId'])
    );
    expect(Array.from(tx.objectStore('timetable_exceptions').indexNames)).toEqual(
      expect.arrayContaining(['by_eventId'])
    );
    expect(Array.from(tx.objectStore('habit_logs').indexNames)).toEqual(
      expect.arrayContaining(['by_habitId', 'by_date'])
    );

    const initial = await repository.loadAllData();
    expect(initial.goals).toEqual([]);
    expect(initial.goalWeeklyCheckins).toEqual([]);
    expect(initial.weeklyReviews).toEqual([]);
    expect(initial.subjects).toEqual([]);
    expect(initial.assignments).toEqual([]);
    expect(initial.attendanceRecords).toEqual([]);
    expect(initial.timetableEvents).toEqual([]);
    expect(initial.timetableExceptions).toEqual([]);
    expect(initial.internshipApplications).toEqual([]);
    expect(initial.activities).toEqual([]);
    expect(initial.habits).toEqual([]);
    expect(initial.habitLogs).toEqual([]);

    expect(initial.settings).toMatchObject({
      id: 'app_settings',
      userName: DEFAULT_SETTINGS.userName,
      semesterLabel: DEFAULT_SETTINGS.semesterLabel,
      theme: 'light',
      showSundayInTimetable: false,
      timetableExpandedHours: false,
      eventCategories: DEFAULT_EVENT_CATEGORIES,
    });
    expect(initial.settings.eventCategories).toHaveLength(7);

    const backup = await repository.createBackupPayload();
    expect(backup.app).toBe('Little Life HQ');
    expect(backup.schemaVersion).toBe(1);
    expect(backup.data.goals).toEqual([]);
    expect(backup.data.subjects).toEqual([]);
    expect(backup.data.timetable_events).toEqual([]);
    expect(backup.data.timetable_exceptions).toEqual([]);
    expect(backup.data.habits).toEqual([]);
    expect(backup.data.habit_logs).toEqual([]);
    expect(backup.data.settings).toHaveLength(1);
    expect(backup.data.settings[0].userName).toBe('Friend');
  });

  it('resetAllData removes personal records while preserving all stores, default settings, and default categories', async () => {
    const raw = JSON.stringify(createSyntheticLegacyV3Backup());
    const summary = await repository.inspectBackupFile(raw);
    expect(summary.valid).toBe(true);
    await repository.replaceWithBackup(summary.payload!);

    const populated = await repository.loadAllData();
    expect(populated.goals.length).toBeGreaterThan(0);
    expect(populated.subjects.length).toBeGreaterThan(0);
    expect(populated.timetableEvents.length).toBeGreaterThan(0);
    expect(populated.settings.userName).not.toBe('Friend');

    await repository.resetAllData();

    await closeDatabaseConnection();
    const reopenedDb = await openDatabase();
    expect(reopenedDb.version).toBe(1);
    for (const storeName of STORE_NAMES) {
      expect(reopenedDb.objectStoreNames.contains(storeName)).toBe(true);
    }

    const cleaned = await repository.loadAllData();
    expect(cleaned.goals).toEqual([]);
    expect(cleaned.goalWeeklyCheckins).toEqual([]);
    expect(cleaned.weeklyReviews).toEqual([]);
    expect(cleaned.subjects).toEqual([]);
    expect(cleaned.assignments).toEqual([]);
    expect(cleaned.attendanceRecords).toEqual([]);
    expect(cleaned.timetableEvents).toEqual([]);
    expect(cleaned.timetableExceptions).toEqual([]);
    expect(cleaned.internshipApplications).toEqual([]);
    expect(cleaned.activities).toEqual([]);
    expect(cleaned.habits).toEqual([]);
    expect(cleaned.habitLogs).toEqual([]);
    expect(cleaned.settings).toMatchObject({
      id: 'app_settings',
      userName: 'Friend',
      semesterLabel: 'Current Semester',
      theme: 'light',
      showSundayInTimetable: false,
      timetableExpandedHours: false,
      eventCategories: DEFAULT_EVENT_CATEGORIES,
    });
  });
});
