import {describe, expect, it} from 'vitest';
import {
  convertLegacyV3Backup,
  isLegacyV3Backup,
  validateBackupPayload,
} from '../src/db/legacyBackupConverter';
import {DB_VERSION} from '../src/db/database';
import {createSyntheticLegacyV3Backup} from './fixtures/syntheticLegacyV3Backup';

function deepClone<T>(val: T): T {
  return JSON.parse(JSON.stringify(val)) as T;
}

describe('legacyBackupConverter', () => {
  it('converts a legacy v3 backup without mutating input and preserves every field and relationship', () => {
    const original = createSyntheticLegacyV3Backup();
    const snapshot = JSON.stringify(original);

    expect(isLegacyV3Backup(original)).toBe(true);
    const result = convertLegacyV3Backup(original);

    // Safeguard 3: original input object remains completely unchanged
    expect(JSON.stringify(original)).toBe(snapshot);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.payload).toBeDefined();
    expect(result.payload!.schemaVersion).toBe(DB_VERSION);
    expect(result.payload!.schemaVersion).toBe(1);

    // Exact before/after counts
    expect(result.beforeAfterCounts.before).toEqual({
      goals: 5,
      goal_weekly_checkins: 0,
      weekly_reviews: 0,
      subjects: 5,
      timetable_events: 8,
      timetable_exceptions: 0,
      timetable_categories: 6,
      assignments: 5,
      attendance_records: 0,
      activities: 1,
      habits: 4,
      habit_logs: 14,
      internships: 4,
      settings: 1,
    });
    expect(result.beforeAfterCounts.totalBefore).toBe(53);
    expect(result.beforeAfterCounts.totalAfterRecords).toBe(47);
    expect(result.beforeAfterCounts.eventCategoriesCount).toBe(6);
    expect(result.beforeAfterCounts.totalAfterItemsIncludingCategories).toBe(53);

    const data = result.payload!.data;

    // Goals field-level verification
    const goalWithoutDesc = data.goals.find((g) => g.id === 'goal_synthetic_1');
    expect(goalWithoutDesc).toMatchObject({
      title: 'Finish core database practice problems',
      description: '',
      category: 'Academics',
      priority: 'Medium',
      status: 'Not started',
    });
    const pausedGoal = data.goals.find((g) => g.id === 'goal_synthetic_3');
    expect(pausedGoal?.status).toBe('Paused');
    expect(pausedGoal?.description).toBe('To upskill for internship opportunities');

    // Subjects field-level verification
    const dbSubj = data.subjects.find((s) => s.id === 'subj_synthetic_1');
    expect(dbSubj).toMatchObject({
      name: 'Database Systems',
      code: 'CS204',
      instructor: '',
      color: 'sky',
      targetAttendance: 75,
    });

    // Timetable events & categories verification
    const clubCategory = data.settings[0].eventCategories.find((c) => c.id === 'cat_club');
    expect(clubCategory).toEqual({
      id: 'cat_club',
      name: 'Committee/club work',
      color: 'butter',
    });
    const oneOffEvent = data.timetable_events.find((e) => e.id === 'tt_synthetic_3');
    expect(oneOffEvent).toMatchObject({
      title: 'Campus Club General Meeting',
      isRecurring: false,
      date: '2026-11-17',
      dayOfWeek: 2,
      startTime: '10:30',
      endTime: '11:00',
      categoryId: 'cat_meeting',
    });
    expect('color' in (oneOffEvent as unknown as Record<string, unknown>)).toBe(false);

    // Internships field-level verification
    expect(data.internship_applications).toHaveLength(4);
    const northbridge = data.internship_applications.find((a) => a.id === 'intern_synthetic_1');
    expect(northbridge).toMatchObject({
      company: 'Northbridge Labs',
      position: 'Data Analyst Intern',
      source: 'LinkedIn',
      status: 'Applied',
      notes: '',
    });
    expect(northbridge?.history).toEqual([
      {
        id: 'ihist_synthetic_1',
        timestamp: '2026-11-21T14:59:33.589Z',
        toStatus: 'Applied',
        note: 'Created application (Applied) via LinkedIn.',
      },
    ]);

    // Activity field-level verification
    expect(data.activities[0]).toMatchObject({
      id: 'act_synthetic_1',
      title: 'Coordinate annual symposium outreach',
      type: 'Club',
      isRecurring: false,
      date: '2026-11-21',
      description: '',
      status: 'Active',
    });

    // Habits & habit_logs field-level verification
    const planning = data.habits.find((h) => h.id === 'hab_synthetic_1');
    expect(planning).toMatchObject({
      name: 'Daily Planning',
      category: 'General',
      frequency: 'daily',
      targetCount: 7,
      targetDaysPerWeek: 7,
      color: 'butter',
    });

    expect(data.habit_logs.every((l) => !l.id.includes('__') && l.id === `${l.habitId}_${l.date}`)).toBe(
      true
    );
    const falseLog = data.habit_logs.find((l) => l.id === 'hab_synthetic_1_2026-11-22');
    expect(falseLog?.completed).toBe(false);
    expect(data.habit_logs.filter((l) => l.completed)).toHaveLength(13);

    // Settings field-level verification
    expect(data.settings[0]).toMatchObject({
      id: 'app_settings',
      userName: 'Alex Student',
      semesterLabel: 'Current Semester',
      theme: 'light',
      showSundayInTimetable: false,
      timetableExpandedHours: false,
    });

    // Warnings & field audit reported
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes('"yellow" → "butter"'))).toBe(true);
    expect(result.warnings.some((w) => w.includes('defaulted missing "description"'))).toBe(true);
    expect(result.warnings.some((w) => w.includes('weekStartsOn'))).toBe(true);
    expect(result.fieldAudit.preserved.length).toBeGreaterThan(0);
    expect(result.fieldAudit.transformed.length).toBeGreaterThan(0);
    expect(result.fieldAudit.defaulted.length).toBeGreaterThan(0);
    expect(result.fieldAudit.dropped.length).toBeGreaterThan(0);
  });

  it('preserves Paused activities natively without mapping to Active, and rejects unsupported activity statuses', () => {
    const fixture = createSyntheticLegacyV3Backup();
    const stores = fixture.stores as Record<string, unknown[]>;
    (stores.activities[0] as Record<string, unknown>).status = 'Paused';

    const pausedRes = convertLegacyV3Backup(fixture);
    expect(pausedRes.valid).toBe(true);
    expect(pausedRes.payload!.data.activities[0].status).toBe('Paused');

    const badFixture = deepClone(fixture);
    ((badFixture.stores as Record<string, unknown[]>).activities[0] as Record<string, unknown>).status =
      'Archived';
    const badRes = convertLegacyV3Backup(badFixture);
    expect(badRes.valid).toBe(false);
    expect(badRes.errors.some((e) => e.includes('unsupported status "Archived"'))).toBe(true);
  });

  it('handles internship jobUrlOrDescription and non-status history entries without inventing status transitions', () => {
    const fixture = createSyntheticLegacyV3Backup();
    const stores = fixture.stores as Record<string, unknown[]>;
    const app0 = stores.internships[0] as Record<string, unknown>;
    app0.jobUrlOrDescription = 'https://example.com/jobs/123';

    const app1 = stores.internships[1] as Record<string, unknown>;
    app1.jobUrlOrDescription = 'Data analyst role covering SQL & dashboards';
    (app1.history as Array<Record<string, unknown>>).push({
      id: 'ihist_note_1',
      timestamp: '2026-11-21T16:00:00.000Z',
      kind: 'note',
      note: 'Sent thank-you email to recruiter.',
    });

    const res = convertLegacyV3Backup(fixture);
    expect(res.valid).toBe(true);
    expect(res.payload!.data.internship_applications[0].jobUrl).toBe('https://example.com/jobs/123');
    expect(res.payload!.data.internship_applications[1].jobUrl).toBeUndefined();
    expect(res.payload!.data.internship_applications[1].notes).toContain(
      'Data analyst role covering SQL & dashboards'
    );
    expect(res.payload!.data.internship_applications[1].notes).toContain(
      'Sent thank-you email to recruiter.'
    );
    expect(res.payload!.data.internship_applications[1].history).toHaveLength(1);
    expect(res.warnings.some((w) => w.includes('non-URL "jobUrlOrDescription"'))).toBe(true);
    expect(res.warnings.some((w) => w.includes('lacked "toStatus"'))).toBe(true);

    // Created entry missing toStatus must be rejected
    const badFixture = deepClone(fixture);
    const badApp = (badFixture.stores as Record<string, unknown[]>).internships[0] as Record<
      string,
      unknown
    >;
    delete (badApp.history as Array<Record<string, unknown>>)[0].toStatus;
    const badRes = convertLegacyV3Backup(badFixture);
    expect(badRes.valid).toBe(false);
    expect(badRes.errors.some((e) => e.includes('missing required "toStatus"'))).toBe(true);
  });

  it('rejects missing required fields, invalid dates/times, invalid enums, and broken foreign keys', () => {
    const fixture = createSyntheticLegacyV3Backup();
    const stores = fixture.stores as Record<string, unknown[]>;

    // Remove required goal title
    delete (stores.goals[0] as Record<string, unknown>).title;
    // Invalid calendar date on assignment
    (stores.assignments[0] as Record<string, unknown>).dueDate = '2026-02-30';
    // Broken foreign key on assignment
    (stores.assignments[1] as Record<string, unknown>).subjectId = 'subj_missing';
    // Invalid time range on timetable event
    (stores.timetable_events[0] as Record<string, unknown>).startTime = '14:00';
    (stores.timetable_events[0] as Record<string, unknown>).endTime = '13:00';
    // Broken categoryId on timetable event
    (stores.timetable_events[1] as Record<string, unknown>).categoryId = 'cat_missing';
    // Broken overrideSubjectId on timetable exception
    stores.timetable_exceptions.push({
      id: 'ttexc_1',
      seriesId: 'tt_synthetic_1',
      originalDate: '2026-11-23',
      exceptionType: 'modified',
      overrideSubjectId: 'subj_nonexistent',
      createdAt: '2026-11-21T15:00:00.000Z',
      updatedAt: '2026-11-21T15:00:00.000Z',
    });

    const res = convertLegacyV3Backup(fixture);
    expect(res.valid).toBe(false);
    expect(res.payload).toBeUndefined();
    expect(res.errors.some((e) => e.includes('missing required "title"'))).toBe(true);
    expect(res.errors.some((e) => e.includes('invalid dueDate "2026-02-30"'))).toBe(true);
    expect(res.errors.some((e) => e.includes('subj_missing'))).toBe(true);
    expect(res.errors.some((e) => e.includes('must be earlier than endTime'))).toBe(true);
    expect(res.errors.some((e) => e.includes('cat_missing'))).toBe(true);
    expect(res.errors.some((e) => e.includes('subj_nonexistent'))).toBe(true);
  });

  it('detects duplicate IDs after normalizing habit_logs IDs (__ -> _) and duplicate store IDs', () => {
    const fixture = createSyntheticLegacyV3Backup();
    const stores = fixture.stores as Record<string, unknown[]>;

    // Duplicate habit_log after normalization: one with __ and one already with _
    stores.habit_logs.push({
      id: 'hab_synthetic_1_2026-11-16',
      habitId: 'hab_synthetic_1',
      date: '2026-11-16',
      completed: false,
      createdAt: '2026-11-21T15:05:00.000Z',
      updatedAt: '2026-11-21T15:05:00.000Z',
    });

    // Duplicate goal ID
    stores.goals.push(deepClone(stores.goals[0]));

    const res = convertLegacyV3Backup(fixture);
    expect(res.valid).toBe(false);
    expect(
      res.errors.some(
        (e) =>
          e.includes('habit_logs: duplicate record id') &&
          e.includes('hab_synthetic_1_2026-11-16')
      )
    ).toBe(true);
    expect(res.errors.some((e) => e.includes('goals: duplicate record id'))).toBe(true);
  });

  it('validates native v1 payloads strictly via validateBackupPayload', () => {
    const fixture = createSyntheticLegacyV3Backup();
    const converted = convertLegacyV3Backup(fixture);
    expect(converted.valid).toBe(true);

    const payload = deepClone(converted.payload!);
    expect(validateBackupPayload(payload).valid).toBe(true);

    payload.data.habit_logs[0].id = 'wrong_format_id';
    const bad = validateBackupPayload(payload);
    expect(bad.valid).toBe(false);
    expect(bad.errors.some((e) => e.includes('canonical format'))).toBe(true);
  });
});
