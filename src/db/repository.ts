import {
  Activity,
  AppSettings,
  Assignment,
  AttendanceRecord,
  BackupDataBundle,
  BackupPreviewSummary,
  EventCategoryConfig,
  FullBackupPayload,
  Goal,
  GoalWeeklyCheckin,
  Habit,
  HabitLog,
  InternshipApplication,
  Subject,
  TimetableEvent,
  TimetableException,
  WeeklyReview,
} from '../types/models';
import {
  DB_VERSION,
  STORE_NAMES,
  StoreName,
  clearAllStores,
  deleteRecord,
  getAllRecords,
  getRecordById,
  putManyRecords,
  putRecord,
  replaceAllStoresTransactional,
} from './database';
import {
  convertLegacyV3Backup,
  isLegacyV3Backup,
  validateBackupPayload,
} from './legacyBackupConverter';
import {generateId} from '../utils/id';
import {
  buildCancelledOccurrenceException,
  findOccurrenceException,
} from '../utils/timetable';

export const DEFAULT_EVENT_CATEGORIES: EventCategoryConfig[] = [
  {id: 'academic_class', name: 'Academic Classes', color: 'sky'},
  {id: 'extra_lecture', name: 'Extra Lectures', color: 'butter'},
  {id: 'committee_club', name: 'Committee / Club Work', color: 'lavender'},
  {id: 'study_session', name: 'Study Sessions', color: 'mint'},
  {id: 'meeting', name: 'Meetings', color: 'pink'},
  {id: 'personal', name: 'Personal Commitments', color: 'peach'},
  {id: 'other', name: 'Other', color: 'lavender'},
];

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'app_settings',
  userName: 'Friend',
  semesterLabel: 'Current Semester',
  theme: 'light',
  showSundayInTimetable: false,
  timetableExpandedHours: false,
  eventCategories: DEFAULT_EVENT_CATEGORIES,
  updatedAt: new Date().toISOString(),
};

export interface AllAppData extends BackupDataBundle {}

export const repository = {
  async loadAllData(): Promise<{
    goals: Goal[];
    goalWeeklyCheckins: GoalWeeklyCheckin[];
    weeklyReviews: WeeklyReview[];
    subjects: Subject[];
    assignments: Assignment[];
    attendanceRecords: AttendanceRecord[];
    timetableEvents: TimetableEvent[];
    timetableExceptions: TimetableException[];
    internshipApplications: InternshipApplication[];
    activities: Activity[];
    habits: Habit[];
    habitLogs: HabitLog[];
    settings: AppSettings;
  }> {
    const [
      goals,
      goalWeeklyCheckins,
      weeklyReviews,
      subjects,
      assignments,
      attendanceRecords,
      timetableEvents,
      timetableExceptions,
      internshipApplications,
      activities,
      habits,
      habitLogs,
      settingsArr,
    ] = await Promise.all([
      getAllRecords<Goal>('goals'),
      getAllRecords<GoalWeeklyCheckin>('goal_weekly_checkins'),
      getAllRecords<WeeklyReview>('weekly_reviews'),
      getAllRecords<Subject>('subjects'),
      getAllRecords<Assignment>('assignments'),
      getAllRecords<AttendanceRecord>('attendance_records'),
      getAllRecords<TimetableEvent>('timetable_events'),
      getAllRecords<TimetableException>('timetable_exceptions'),
      getAllRecords<InternshipApplication>('internship_applications'),
      getAllRecords<Activity>('activities'),
      getAllRecords<Habit>('habits'),
      getAllRecords<HabitLog>('habit_logs'),
      getAllRecords<AppSettings>('settings'),
    ]);

    let settings = settingsArr.find((s) => s.id === 'app_settings');
    if (!settings) {
      settings = {
        ...DEFAULT_SETTINGS,
        updatedAt: new Date().toISOString(),
      };
      await putRecord('settings', settings);
    }

    return {
      goals,
      goalWeeklyCheckins,
      weeklyReviews,
      subjects,
      assignments,
      attendanceRecords,
      timetableEvents,
      timetableExceptions,
      internshipApplications,
      activities,
      habits,
      habitLogs,
      settings,
    };
  },

  // Generic save/delete wrappers
  saveGoal: (g: Goal) => putRecord('goals', g),
  deleteGoal: async (id: string) => {
    await deleteRecord('goals', id);
    const checkins = await getAllRecords<GoalWeeklyCheckin>('goal_weekly_checkins');
    await Promise.all(
      checkins.filter((c) => c.goalId === id).map((c) => deleteRecord('goal_weekly_checkins', c.id))
    );
  },

  saveGoalCheckin: (c: GoalWeeklyCheckin) => putRecord('goal_weekly_checkins', c),
  saveWeeklyReview: (r: WeeklyReview) => putRecord('weekly_reviews', r),

  saveSubject: (s: Subject) => putRecord('subjects', s),
  deleteSubject: async (id: string) => {
    await deleteRecord('subjects', id);
    const [assignments, attendance] = await Promise.all([
      getAllRecords<Assignment>('assignments'),
      getAllRecords<AttendanceRecord>('attendance_records'),
    ]);
    await Promise.all([
      ...assignments.filter((a) => a.subjectId === id).map((a) => deleteRecord('assignments', a.id)),
      ...attendance
        .filter((r) => r.subjectId === id)
        .map((r) => deleteRecord('attendance_records', r.id)),
    ]);
  },

  saveAssignment: (a: Assignment) => putRecord('assignments', a),
  deleteAssignment: (id: string) => deleteRecord('assignments', id),

  saveAttendance: (r: AttendanceRecord) => putRecord('attendance_records', r),
  deleteAttendance: (id: string) => deleteRecord('attendance_records', id),

  saveTimetableEvent: (e: TimetableEvent) => putRecord('timetable_events', e),
  deleteTimetableEvent: async (id: string) => {
    await deleteRecord('timetable_events', id);
    const exceptions = await getAllRecords<TimetableException>('timetable_exceptions');
    await Promise.all(
      exceptions.filter((ex) => ex.eventId === id).map((ex) => deleteRecord('timetable_exceptions', ex.id))
    );
  },

  saveTimetableException: (ex: TimetableException) => putRecord('timetable_exceptions', ex),
  deleteTimetableException: (id: string) => deleteRecord('timetable_exceptions', id),
  cancelTimetableOccurrence: async (
    eventId: string,
    originalDate: string
  ): Promise<TimetableException> => {
    const exceptions = await getAllRecords<TimetableException>('timetable_exceptions');
    const existing = findOccurrenceException(exceptions, eventId, originalDate);
    const record = buildCancelledOccurrenceException({
      eventId,
      originalDate,
      existingException: existing,
      newId: generateId(),
    });
    await putRecord('timetable_exceptions', record);
    return record;
  },
  restoreTimetableOccurrence: async (
    eventId: string,
    originalDate: string
  ): Promise<string | null> => {
    const exceptions = await getAllRecords<TimetableException>('timetable_exceptions');
    const matching = exceptions.filter(
      (ex) => ex.eventId === eventId && ex.originalDate === originalDate
    );
    if (matching.length === 0) return null;
    await Promise.all(matching.map((ex) => deleteRecord('timetable_exceptions', ex.id)));
    return matching[0].id;
  },

  saveInternship: (app: InternshipApplication) => putRecord('internship_applications', app),
  deleteInternship: (id: string) => deleteRecord('internship_applications', id),

  saveActivity: (act: Activity) => putRecord('activities', act),
  deleteActivity: (id: string) => deleteRecord('activities', id),

  saveHabit: (h: Habit) => putRecord('habits', h),
  deleteHabit: async (id: string) => {
    await deleteRecord('habits', id);
    const logs = await getAllRecords<HabitLog>('habit_logs');
    await Promise.all(
      logs.filter((l) => l.habitId === id).map((l) => deleteRecord('habit_logs', l.id))
    );
  },

  saveHabitLog: (l: HabitLog) => putRecord('habit_logs', l),
  saveSettings: (s: AppSettings) => putRecord('settings', s),

  async createBackupPayload(): Promise<FullBackupPayload> {
    const [
      goals,
      goal_weekly_checkins,
      weekly_reviews,
      subjects,
      assignments,
      attendance_records,
      timetable_events,
      timetable_exceptions,
      internship_applications,
      activities,
      habits,
      habit_logs,
      settings,
    ] = await Promise.all([
      getAllRecords<Goal>('goals'),
      getAllRecords<GoalWeeklyCheckin>('goal_weekly_checkins'),
      getAllRecords<WeeklyReview>('weekly_reviews'),
      getAllRecords<Subject>('subjects'),
      getAllRecords<Assignment>('assignments'),
      getAllRecords<AttendanceRecord>('attendance_records'),
      getAllRecords<TimetableEvent>('timetable_events'),
      getAllRecords<TimetableException>('timetable_exceptions'),
      getAllRecords<InternshipApplication>('internship_applications'),
      getAllRecords<Activity>('activities'),
      getAllRecords<Habit>('habits'),
      getAllRecords<HabitLog>('habit_logs'),
      getAllRecords<AppSettings>('settings'),
    ]);

    return {
      app: 'Little Life HQ',
      backupFormatVersion: '1.0',
      schemaVersion: DB_VERSION,
      exportedAt: new Date().toISOString(),
      data: {
        goals,
        goal_weekly_checkins,
        weekly_reviews,
        subjects,
        assignments,
        attendance_records,
        timetable_events,
        timetable_exceptions,
        internship_applications,
        activities,
        habits,
        habit_logs,
        settings,
      },
    };
  },

  async inspectBackupFile(rawText: string): Promise<BackupPreviewSummary> {
    const emptyCounts: Record<keyof BackupDataBundle, number> = {
      goals: 0,
      goal_weekly_checkins: 0,
      weekly_reviews: 0,
      subjects: 0,
      assignments: 0,
      attendance_records: 0,
      timetable_events: 0,
      timetable_exceptions: 0,
      internship_applications: 0,
      activities: 0,
      habits: 0,
      habit_logs: 0,
      settings: 0,
    };

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return {
        valid: false,
        error: 'The selected file is not valid JSON.',
        counts: emptyCounts,
        conflictingIdsCount: 0,
        hasExistingData: false,
      };
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        valid: false,
        error: 'Backup file structure is invalid.',
        counts: emptyCounts,
        conflictingIdsCount: 0,
        hasExistingData: false,
      };
    }

    if (isLegacyV3Backup(parsed)) {
      const conversion = convertLegacyV3Backup(parsed);
      if (!conversion.valid || !conversion.payload) {
        return {
          valid: false,
          error: conversion.errors[0] ?? 'Legacy v3 backup validation failed.',
          validationErrors: conversion.errors,
          warnings: conversion.warnings,
          beforeAfterCounts: conversion.beforeAfterCounts,
          fieldAudit: conversion.fieldAudit,
          convertedFromLegacyV3: true,
          counts: conversion.beforeAfterCounts.after,
          conflictingIdsCount: 0,
          hasExistingData: false,
        };
      }

      const payload = conversion.payload;
      let conflictingIdsCount = 0;
      let existingTotal = 0;

      for (const storeName of STORE_NAMES) {
        const incomingList = payload.data[storeName] as Array<{id?: string}>;
        const existing = await getAllRecords<{id: string}>(storeName);
        if (storeName !== 'settings') {
          existingTotal += existing.length;
        }
        const existingIds = new Set(existing.map((r) => r.id));
        for (const item of incomingList) {
          if (item.id && existingIds.has(item.id) && storeName !== 'settings') {
            conflictingIdsCount++;
          }
        }
      }

      return {
        valid: true,
        payload,
        exportedAt: payload.exportedAt,
        schemaVersion: 3,
        convertedFromLegacyV3: true,
        warnings: conversion.warnings,
        beforeAfterCounts: conversion.beforeAfterCounts,
        fieldAudit: conversion.fieldAudit,
        counts: conversion.beforeAfterCounts.after,
        conflictingIdsCount,
        hasExistingData: existingTotal > 0,
      };
    }

    const candidate = parsed as Partial<FullBackupPayload>;
    if (
      candidate.app !== 'Little Life HQ' ||
      !candidate.data ||
      typeof candidate.data !== 'object' ||
      Array.isArray(candidate.data)
    ) {
      return {
        valid: false,
        error: 'This JSON file does not appear to be a Little Life HQ backup.',
        counts: emptyCounts,
        conflictingIdsCount: 0,
        hasExistingData: false,
      };
    }

    const dataObj = candidate.data as unknown as Record<string, unknown>;
    const normalized: BackupDataBundle = {
      goals: Array.isArray(dataObj.goals) ? (dataObj.goals as Goal[]) : [],
      goal_weekly_checkins: Array.isArray(dataObj.goal_weekly_checkins)
        ? (dataObj.goal_weekly_checkins as GoalWeeklyCheckin[])
        : [],
      weekly_reviews: Array.isArray(dataObj.weekly_reviews)
        ? (dataObj.weekly_reviews as WeeklyReview[])
        : [],
      subjects: Array.isArray(dataObj.subjects) ? (dataObj.subjects as Subject[]) : [],
      assignments: Array.isArray(dataObj.assignments) ? (dataObj.assignments as Assignment[]) : [],
      attendance_records: Array.isArray(dataObj.attendance_records)
        ? (dataObj.attendance_records as AttendanceRecord[])
        : [],
      timetable_events: Array.isArray(dataObj.timetable_events)
        ? (dataObj.timetable_events as TimetableEvent[])
        : [],
      timetable_exceptions: Array.isArray(dataObj.timetable_exceptions)
        ? (dataObj.timetable_exceptions as TimetableException[])
        : [],
      internship_applications: Array.isArray(dataObj.internship_applications)
        ? (dataObj.internship_applications as InternshipApplication[])
        : [],
      activities: Array.isArray(dataObj.activities) ? (dataObj.activities as Activity[]) : [],
      habits: Array.isArray(dataObj.habits) ? (dataObj.habits as Habit[]) : [],
      habit_logs: Array.isArray(dataObj.habit_logs) ? (dataObj.habit_logs as HabitLog[]) : [],
      settings: Array.isArray(dataObj.settings) ? (dataObj.settings as AppSettings[]) : [],
    };

    const counts = {...emptyCounts};
    for (const storeName of STORE_NAMES) {
      counts[storeName] = normalized[storeName].length;
    }

    const payload: FullBackupPayload = {
      app: 'Little Life HQ',
      backupFormatVersion: '1.0',
      schemaVersion: typeof candidate.schemaVersion === 'number' ? candidate.schemaVersion : DB_VERSION,
      exportedAt: typeof candidate.exportedAt === 'string' ? candidate.exportedAt : '',
      data: normalized,
    };

    const validation = validateBackupPayload(payload);
    if (!validation.valid) {
      return {
        valid: false,
        error: validation.errors[0] ?? 'Backup payload validation failed.',
        validationErrors: validation.errors,
        counts,
        conflictingIdsCount: 0,
        hasExistingData: false,
      };
    }

    let conflictingIdsCount = 0;
    let existingTotal = 0;

    for (const storeName of STORE_NAMES) {
      const incomingList = normalized[storeName] as Array<{id?: string}>;
      const existing = await getAllRecords<{id: string}>(storeName);
      if (storeName !== 'settings') {
        existingTotal += existing.length;
      }
      const existingIds = new Set(existing.map((r) => r.id));
      for (const item of incomingList) {
        if (item.id && existingIds.has(item.id) && storeName !== 'settings') {
          conflictingIdsCount++;
        }
      }
    }

    return {
      valid: true,
      payload,
      exportedAt: payload.exportedAt,
      schemaVersion: payload.schemaVersion,
      counts,
      conflictingIdsCount,
      hasExistingData: existingTotal > 0,
    };
  },

  async mergeBackup(
    payload: FullBackupPayload
  ): Promise<{added: number; updated: number; skipped: number; addedCategories: number}> {
    const validation = validateBackupPayload(payload);
    if (!validation.valid) {
      throw new Error(`Cannot merge invalid backup: ${validation.errors.join('; ')}`);
    }

    let added = 0;
    const updated = 0;
    let skipped = 0;
    let addedCategories = 0;

    for (const storeName of STORE_NAMES) {
      const incomingItems = payload.data[storeName] as Array<{id: string; updatedAt?: string}>;
      if (!Array.isArray(incomingItems) || incomingItems.length === 0) continue;

      if (storeName === 'settings') {
        const incomingSettingsList = incomingItems as unknown as AppSettings[];
        for (const incomingSettings of incomingSettingsList) {
          if (!incomingSettings || incomingSettings.id !== 'app_settings') continue;
          const existing = await getRecordById<AppSettings>('settings', 'app_settings');
          if (!existing) {
            await putRecord('settings', incomingSettings);
            added++;
          } else {
            // Preserve all existing user preferences and existing categories; only append missing categories by id
            const existingCats = Array.isArray(existing.eventCategories)
              ? existing.eventCategories
              : [];
            const seenCatIds = new Set(existingCats.map((c) => c.id));
            const missingCats: EventCategoryConfig[] = [];
            for (const cat of incomingSettings.eventCategories ?? []) {
              if (cat && cat.id && !seenCatIds.has(cat.id)) {
                seenCatIds.add(cat.id);
                missingCats.push({...cat});
              }
            }
            if (missingCats.length > 0) {
              await putRecord('settings', {
                ...existing,
                eventCategories: [...existingCats, ...missingCats],
                updatedAt: new Date().toISOString(),
              });
              addedCategories += missingCats.length;
            }
            skipped++;
          }
        }
        continue;
      }

      const toWrite: Array<{id: string; updatedAt?: string}> = [];
      for (const item of incomingItems) {
        if (!item || !item.id) continue;
        const existing = await getRecordById<{id: string; updatedAt?: string}>(
          storeName as StoreName,
          item.id
        );
        if (!existing) {
          toWrite.push(item);
          added++;
        } else {
          // Merge never overwrites existing records
          skipped++;
        }
      }
      if (toWrite.length > 0) {
        await putManyRecords(storeName as StoreName, toWrite);
      }
    }

    return {added, updated, skipped, addedCategories};
  },

  async replaceWithBackup(payload: FullBackupPayload): Promise<void> {
    const validation = validateBackupPayload(payload);
    if (!validation.valid) {
      throw new Error(`Cannot replace with invalid backup: ${validation.errors.join('; ')}`);
    }

    const recordsByStore = {} as Record<StoreName, unknown[]>;
    for (const storeName of STORE_NAMES) {
      const items = payload.data[storeName];
      recordsByStore[storeName] = Array.isArray(items) ? [...items] : [];
    }

    const hasAppSettings = (recordsByStore.settings as AppSettings[]).some(
      (s) => s.id === 'app_settings'
    );
    if (!hasAppSettings) {
      recordsByStore.settings = [
        {
          ...DEFAULT_SETTINGS,
          updatedAt: new Date().toISOString(),
        },
      ];
    }

    await replaceAllStoresTransactional(recordsByStore);
  },

  async resetAllData(): Promise<void> {
    await clearAllStores();
    await putRecord('settings', {
      ...DEFAULT_SETTINGS,
      updatedAt: new Date().toISOString(),
    });
  },
};
