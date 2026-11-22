import 'fake-indexeddb/auto';
import {IDBFactory} from 'fake-indexeddb';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {
  DB_NAME,
  DB_VERSION,
  closeDatabaseConnection,
  getAllRecords,
  openDatabase,
} from '../src/db/database';
import {DEFAULT_SETTINGS, repository} from '../src/db/repository';
import {Goal, Subject} from '../src/types/models';
import {createSyntheticLegacyV3Backup} from './fixtures/syntheticLegacyV3Backup';

function readSyntheticV3JsonString(): string {
  return JSON.stringify(createSyntheticLegacyV3Backup());
}

describe('backupRepository (inspectBackupFile, mergeBackup, replaceWithBackup)', () => {
  beforeEach(async () => {
    await closeDatabaseConnection();
    globalThis.indexedDB = new IDBFactory();
  });

  it('keeps DB_VERSION at 1 and inspects legacy v3 backup JSON cleanly', async () => {
    expect(DB_VERSION).toBe(1);
    const db = await openDatabase();
    expect(db.name).toBe(DB_NAME);
    expect(db.version).toBe(1);

    const raw = readSyntheticV3JsonString();
    const summary = await repository.inspectBackupFile(raw);

    expect(summary.valid).toBe(true);
    expect(summary.convertedFromLegacyV3).toBe(true);
    expect(summary.schemaVersion).toBe(3);
    expect(summary.counts.goals).toBe(5);
    expect(summary.counts.subjects).toBe(5);
    expect(summary.counts.assignments).toBe(5);
    expect(summary.counts.timetable_events).toBe(8);
    expect(summary.counts.internship_applications).toBe(4);
    expect(summary.counts.activities).toBe(1);
    expect(summary.counts.habits).toBe(4);
    expect(summary.counts.habit_logs).toBe(14);
    expect(summary.beforeAfterCounts?.eventCategoriesCount).toBe(6);
    expect(summary.warnings?.length).toBeGreaterThan(0);
  });

  it('rejects corrupted JSON and duplicate converted habit_log IDs in inspectBackupFile', async () => {
    const badJson = await repository.inspectBackupFile('{invalid');
    expect(badJson.valid).toBe(false);

    const parsed = createSyntheticLegacyV3Backup() as {
      stores: {habit_logs: Array<Record<string, unknown>>};
    };
    parsed.stores.habit_logs.push({
      id: 'hab_synthetic_1_2026-11-16',
      habitId: 'hab_synthetic_1',
      date: '2026-11-16',
      completed: true,
      createdAt: '2026-11-21T15:05:00.000Z',
      updatedAt: '2026-11-21T15:05:00.000Z',
    });

    const dupSummary = await repository.inspectBackupFile(JSON.stringify(parsed));
    expect(dupSummary.valid).toBe(false);
    expect(dupSummary.validationErrors?.some((e) => e.includes('duplicate record id'))).toBe(true);
  });

  it('mergeBackup never overwrites existing records or user preferences and merges missing eventCategories without duplicates', async () => {
    const existingGoal: Goal = {
      id: 'goal_synthetic_1',
      title: 'My local customized goal title',
      description: 'Keep this intact',
      category: 'Career',
      priority: 'Low',
      status: 'Completed',
      createdAt: '2026-11-20T10:00:00.000Z',
      updatedAt: '2026-11-20T10:00:00.000Z',
    };
    await repository.saveGoal(existingGoal);

    await repository.saveSettings({
      ...DEFAULT_SETTINGS,
      userName: 'Existing User',
      semesterLabel: 'Fall 2026',
      theme: 'dark',
      showSundayInTimetable: true,
      timetableExpandedHours: true,
      updatedAt: '2026-11-20T10:00:00.000Z',
    });

    const summary = await repository.inspectBackupFile(readSyntheticV3JsonString());
    expect(summary.valid).toBe(true);
    expect(summary.conflictingIdsCount).toBe(1);

    const mergeResult1 = await repository.mergeBackup(summary.payload!);
    expect(mergeResult1.updated).toBe(0);
    expect(mergeResult1.skipped).toBe(2); // 1 conflicting goal + 1 existing app_settings
    expect(mergeResult1.addedCategories).toBe(6); // 6 legacy cat_* added alongside 7 defaults
    expect(mergeResult1.added).toBe(45); // 46 non-settings records - 1 existing goal

    const allData = await repository.loadAllData();
    // Existing goal must NOT be overwritten even though v3 backup had newer updatedAt
    const preservedGoal = allData.goals.find((g) => g.id === existingGoal.id);
    expect(preservedGoal).toEqual(existingGoal);
    expect(allData.goals).toHaveLength(5);

    // Existing user preferences must NOT be overwritten
    expect(allData.settings.userName).toBe('Existing User');
    expect(allData.settings.semesterLabel).toBe('Fall 2026');
    expect(allData.settings.theme).toBe('dark');
    expect(allData.settings.showSundayInTimetable).toBe(true);
    expect(allData.settings.timetableExpandedHours).toBe(true);

    // Existing + missing categories present without duplicates
    expect(allData.settings.eventCategories).toHaveLength(13);
    expect(allData.settings.eventCategories.some((c) => c.id === 'cat_academic')).toBe(true);
    expect(allData.settings.eventCategories.some((c) => c.id === 'academic_class')).toBe(true);

    // Second merge must not duplicate categories or overwrite records
    const mergeResult2 = await repository.mergeBackup(summary.payload!);
    expect(mergeResult2.added).toBe(0);
    expect(mergeResult2.updated).toBe(0);
    expect(mergeResult2.addedCategories).toBe(0);
    const afterSecondMerge = await repository.loadAllData();
    expect(afterSecondMerge.settings.eventCategories).toHaveLength(13);
  });

  it('replaceWithBackup replaces all stores cleanly from converted v3 payload', async () => {
    const preExistingSubject: Subject = {
      id: 'subj_old_only',
      name: 'Old Subject To Remove',
      code: 'OLD101',
      instructor: 'Prof. Old',
      color: 'mint',
      targetAttendance: 80,
      createdAt: '2026-11-01T10:00:00.000Z',
      updatedAt: '2026-11-01T10:00:00.000Z',
    };
    await repository.saveSubject(preExistingSubject);

    const summary = await repository.inspectBackupFile(readSyntheticV3JsonString());
    expect(summary.valid).toBe(true);

    await repository.replaceWithBackup(summary.payload!);

    const all = await repository.loadAllData();
    expect(all.subjects.some((s) => s.id === 'subj_old_only')).toBe(false);
    expect(all.subjects).toHaveLength(5);
    expect(all.goals).toHaveLength(5);
    expect(all.assignments).toHaveLength(5);
    expect(all.timetableEvents).toHaveLength(8);
    expect(all.internshipApplications).toHaveLength(4);
    expect(all.activities).toHaveLength(1);
    expect(all.habits).toHaveLength(4);
    expect(all.habitLogs).toHaveLength(14);
    expect(all.settings.userName).toBe('Alex Student');
    expect(all.settings.eventCategories).toHaveLength(6);
  });

  it('replaceWithBackup is transactional and leaves existing data intact if a write fails mid-transaction', async () => {
    const existingGoal: Goal = {
      id: 'goal_safe_existing',
      title: 'Must survive failed replace',
      description: 'Existing data stays intact',
      category: 'Academics',
      priority: 'High',
      status: 'In progress',
      createdAt: '2026-11-20T10:00:00.000Z',
      updatedAt: '2026-11-20T10:00:00.000Z',
    };
    await repository.saveGoal(existingGoal);

    const summary = await repository.inspectBackupFile(readSyntheticV3JsonString());
    expect(summary.valid).toBe(true);
    const payload = summary.payload!;

    const originalOpen = await openDatabase();
    const txSpy = vi.spyOn(originalOpen, 'transaction').mockImplementationOnce((...args) => {
      const tx = IDBDatabase.prototype.transaction.apply(
        originalOpen,
        args as [string[], IDBTransactionMode]
      );
      const origObjectStore = tx.objectStore.bind(tx);
      vi.spyOn(tx, 'objectStore').mockImplementation((name: string) => {
        const store = origObjectStore(name);
        if (name === 'subjects') {
          vi.spyOn(store, 'put').mockImplementationOnce(() => {
            throw new Error('Simulated IDB write failure mid-transaction');
          });
        }
        return store;
      });
      return tx;
    });

    await expect(repository.replaceWithBackup(payload)).rejects.toThrow(
      'Simulated IDB write failure mid-transaction'
    );
    txSpy.mockRestore();

    // Existing goal must NOT have been wiped by the failed replacement
    const goalsAfterFailure = await getAllRecords<Goal>('goals');
    expect(goalsAfterFailure).toEqual([existingGoal]);
  });
});
