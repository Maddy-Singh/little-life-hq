import {
  Activity,
  ActivityStatus,
  ActivityType,
  AppSettings,
  Assignment,
  AssignmentPriority,
  AssignmentStatus,
  AttendanceRecord,
  AttendanceStatus,
  BackupBeforeAfterCounts,
  BackupDataBundle,
  BackupFieldAudit,
  EventCategoryConfig,
  FullBackupPayload,
  Goal,
  GoalCategory,
  GoalPriority,
  GoalStatus,
  GoalWeeklyCheckin,
  Habit,
  HabitFrequency,
  HabitLog,
  InternshipApplication,
  InternshipHistoryEntry,
  InternshipSource,
  InternshipStatus,
  PastelToken,
  Subject,
  TimetableEvent,
  TimetableException,
  WeeklyReview,
} from '../types/models';
import {DB_VERSION} from './database';

export interface LegacyConversionResult {
  valid: boolean;
  payload?: FullBackupPayload;
  warnings: string[];
  errors: string[];
  beforeAfterCounts: BackupBeforeAfterCounts;
  fieldAudit: BackupFieldAudit;
}

export interface PayloadValidationResult {
  valid: boolean;
  errors: string[];
}

const VALID_PASTEL_TOKENS: ReadonlySet<PastelToken> = new Set([
  'lavender',
  'pink',
  'mint',
  'butter',
  'peach',
  'sky',
]);

const VALID_GOAL_CATEGORIES: ReadonlySet<GoalCategory> = new Set([
  'Academics',
  'Career',
  'Personal',
  'Extracurricular',
  'Music',
  'Fitness',
]);

const VALID_PRIORITIES: ReadonlySet<GoalPriority> = new Set(['Low', 'Medium', 'High']);

const VALID_GOAL_STATUSES: ReadonlySet<GoalStatus> = new Set([
  'Not started',
  'In progress',
  'Completed',
  'Paused',
]);

const VALID_ASSIGNMENT_STATUSES: ReadonlySet<AssignmentStatus> = new Set([
  'Not started',
  'In progress',
  'Submitted',
]);

const VALID_ATTENDANCE_STATUSES: ReadonlySet<AttendanceStatus> = new Set([
  'Present',
  'Absent',
  'Cancelled',
]);

const VALID_INTERNSHIP_SOURCES: ReadonlySet<InternshipSource> = new Set([
  'LinkedIn',
  'Indeed',
  'Internshala',
  'Company Website',
  'Referral',
  'Other',
]);

const VALID_INTERNSHIP_STATUSES: ReadonlySet<InternshipStatus> = new Set([
  'Saved',
  'Applied',
  'Under Consideration',
  'Assessment',
  'Interview Scheduled',
  'Interview Completed',
  'Offer Received',
  'Rejected',
  'Withdrawn',
]);

const VALID_ACTIVITY_TYPES: ReadonlySet<ActivityType> = new Set([
  'Extracurricular',
  'Club',
  'Personal Project',
  'One-off Event',
]);

const VALID_ACTIVITY_STATUSES: ReadonlySet<ActivityStatus> = new Set([
  'Active',
  'Upcoming',
  'Completed',
  'Paused',
]);

const VALID_HABIT_FREQUENCIES: ReadonlySet<HabitFrequency> = new Set([
  'daily',
  'weekly',
  'twice_a_week',
  'custom_weekly',
  'every_2_weeks',
  'monthly',
  'custom_monthly',
  'every_2_months',
  'custom_interval',
]);

const LEGACY_ACTIVITY_KIND_MAP: Record<string, ActivityType> = {
  extracurricular: 'Extracurricular',
  club: 'Club',
  project: 'Personal Project',
  event: 'One-off Event',
};

const LEGACY_ATTENDANCE_STATUS_MAP: Record<string, AttendanceStatus> = {
  present: 'Present',
  absent: 'Absent',
  cancelled: 'Cancelled',
  Present: 'Present',
  Absent: 'Absent',
  Cancelled: 'Cancelled',
};

const LEGACY_V3_STORE_KEYS = [
  'goals',
  'goal_weekly_checkins',
  'weekly_reviews',
  'subjects',
  'timetable_events',
  'timetable_exceptions',
  'timetable_categories',
  'assignments',
  'attendance_records',
  'activities',
  'habits',
  'habit_logs',
  'internships',
  'settings',
] as const;

const FALLBACK_EVENT_CATEGORIES: EventCategoryConfig[] = [
  {id: 'academic_class', name: 'Academic Classes', color: 'sky'},
  {id: 'extra_lecture', name: 'Extra Lectures', color: 'butter'},
  {id: 'committee_club', name: 'Committee / Club Work', color: 'lavender'},
  {id: 'study_session', name: 'Study Sessions', color: 'mint'},
  {id: 'meeting', name: 'Meetings', color: 'pink'},
  {id: 'personal', name: 'Personal Commitments', color: 'peach'},
  {id: 'other', name: 'Other', color: 'lavender'},
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidIsoTimestamp(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

export function isValidYyyyMmDd(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function isValidHhMm(value: unknown): value is string {
  return typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function addAudit(set: Set<string>, entry: string) {
  set.add(entry);
}

function mapLegacyColor(
  rawColor: unknown,
  contextLabel: string,
  warnings: string[],
  errors: string[],
  transformedAudit: Set<string>,
  preservedAudit: Set<string>
): PastelToken | null {
  if (rawColor === 'yellow') {
    warnings.push(`${contextLabel}: substituted legacy colour "yellow" → "butter".`);
    addAudit(transformedAudit, 'Pastel colour "yellow" → "butter"');
    return 'butter';
  }
  if (typeof rawColor === 'string' && VALID_PASTEL_TOKENS.has(rawColor as PastelToken)) {
    addAudit(preservedAudit, `${contextLabel.split(' ')[0]} colour (${rawColor})`);
    return rawColor as PastelToken;
  }
  errors.push(`${contextLabel}: unsupported colour "${String(rawColor)}".`);
  return null;
}

export function isLegacyV3Backup(raw: unknown): boolean {
  if (!isPlainObject(raw)) return false;
  return (
    raw.app === 'Little Life HQ' &&
    raw.schemaVersion === 3 &&
    isPlainObject(raw.stores) &&
    !('data' in raw && isPlainObject(raw.data))
  );
}

export function validateBackupPayload(
  payload: FullBackupPayload,
  extraChecks?: {
    rawTimetableExceptionOverrideSubjectIds?: Array<{exceptionId: string; overrideSubjectId: string}>;
  }
): PayloadValidationResult {
  const errors: string[] = [];

  if (!isPlainObject(payload) || payload.app !== 'Little Life HQ' || !isPlainObject(payload.data)) {
    return {valid: false, errors: ['Backup payload header is invalid.']};
  }

  if (!isValidIsoTimestamp(payload.exportedAt)) {
    errors.push(`Invalid top-level exportedAt timestamp: "${String(payload.exportedAt)}".`);
  }

  const d = payload.data;

  // Duplicate ID tracker per store
  const checkDuplicateIds = (storeName: string, items: Array<{id?: unknown}>) => {
    const seen = new Set<string>();
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!isPlainObject(item)) {
        errors.push(`${storeName}[${i}]: record must be an object.`);
        continue;
      }
      if (!isNonEmptyString(item.id)) {
        errors.push(`${storeName}[${i}]: missing or empty required "id".`);
        continue;
      }
      if (seen.has(item.id)) {
        errors.push(`${storeName}: duplicate record id "${item.id}".`);
      } else {
        seen.add(item.id);
      }
    }
    return seen;
  };

  const goalIds = checkDuplicateIds('goals', d.goals);
  checkDuplicateIds('goal_weekly_checkins', d.goal_weekly_checkins);
  checkDuplicateIds('weekly_reviews', d.weekly_reviews);
  const subjectIds = checkDuplicateIds('subjects', d.subjects);
  checkDuplicateIds('assignments', d.assignments);
  checkDuplicateIds('attendance_records', d.attendance_records);
  const eventIds = checkDuplicateIds('timetable_events', d.timetable_events);
  checkDuplicateIds('timetable_exceptions', d.timetable_exceptions);
  checkDuplicateIds('internship_applications', d.internship_applications);
  checkDuplicateIds('activities', d.activities);
  const habitIds = checkDuplicateIds('habits', d.habits);
  checkDuplicateIds('habit_logs', d.habit_logs);
  checkDuplicateIds('settings', d.settings);

  // Settings & eventCategories
  const categoryIds = new Set<string>();
  if (d.settings.length > 1) {
    errors.push(`settings: expected at most 1 settings record, found ${d.settings.length}.`);
  }
  for (let i = 0; i < d.settings.length; i++) {
    const s = d.settings[i];
    if (!isPlainObject(s)) continue;
    if (s.id !== 'app_settings') {
      errors.push(`settings[${i}]: id must be "app_settings", got "${String(s.id)}".`);
    }
    if (!isNonEmptyString(s.userName)) {
      errors.push(`settings[${i}]: missing required "userName".`);
    }
    if (s.theme !== 'light' && s.theme !== 'dark') {
      errors.push(`settings[${i}]: invalid theme "${String(s.theme)}".`);
    }
    if (typeof s.showSundayInTimetable !== 'boolean') {
      errors.push(`settings[${i}]: showSundayInTimetable must be a boolean.`);
    }
    if (typeof s.timetableExpandedHours !== 'boolean') {
      errors.push(`settings[${i}]: timetableExpandedHours must be a boolean.`);
    }
    if (!isValidIsoTimestamp(s.updatedAt)) {
      errors.push(`settings[${i}]: invalid updatedAt timestamp "${String(s.updatedAt)}".`);
    }
    if (!Array.isArray(s.eventCategories)) {
      errors.push(`settings[${i}]: eventCategories must be an array.`);
    } else {
      for (let cIdx = 0; cIdx < s.eventCategories.length; cIdx++) {
        const cat = s.eventCategories[cIdx];
        if (!isPlainObject(cat)) {
          errors.push(`settings.eventCategories[${cIdx}]: must be an object.`);
          continue;
        }
        if (!isNonEmptyString(cat.id)) {
          errors.push(`settings.eventCategories[${cIdx}]: missing or empty "id".`);
          continue;
        }
        if (categoryIds.has(cat.id)) {
          errors.push(`settings.eventCategories: duplicate category id "${cat.id}".`);
        } else {
          categoryIds.add(cat.id);
        }
        if (!isNonEmptyString(cat.name)) {
          errors.push(`settings.eventCategories["${cat.id}"]: missing required "name".`);
        }
        if (!VALID_PASTEL_TOKENS.has(cat.color)) {
          errors.push(
            `settings.eventCategories["${cat.id}"]: invalid colour "${String(cat.color)}".`
          );
        }
      }
    }
  }

  // Goals
  for (const g of d.goals) {
    if (!isPlainObject(g) || !isNonEmptyString(g.id)) continue;
    if (!isNonEmptyString(g.title)) {
      errors.push(`goals["${g.id}"]: missing required "title".`);
    }
    if (typeof g.description !== 'string') {
      errors.push(`goals["${g.id}"]: "description" must be a string.`);
    }
    if (!VALID_GOAL_CATEGORIES.has(g.category)) {
      errors.push(`goals["${g.id}"]: unsupported category "${String(g.category)}".`);
    }
    if (!VALID_PRIORITIES.has(g.priority)) {
      errors.push(`goals["${g.id}"]: unsupported priority "${String(g.priority)}".`);
    }
    if (!VALID_GOAL_STATUSES.has(g.status)) {
      errors.push(`goals["${g.id}"]: unsupported status "${String(g.status)}".`);
    }
    if (g.targetDate !== undefined && !isValidYyyyMmDd(g.targetDate)) {
      errors.push(`goals["${g.id}"]: invalid targetDate "${String(g.targetDate)}".`);
    }
    if (!isValidIsoTimestamp(g.createdAt)) {
      errors.push(`goals["${g.id}"]: invalid createdAt "${String(g.createdAt)}".`);
    }
    if (!isValidIsoTimestamp(g.updatedAt)) {
      errors.push(`goals["${g.id}"]: invalid updatedAt "${String(g.updatedAt)}".`);
    }
    if (g.completedAt !== undefined && !isValidIsoTimestamp(g.completedAt)) {
      errors.push(`goals["${g.id}"]: invalid completedAt "${String(g.completedAt)}".`);
    }
  }

  // Goal weekly checkins
  for (const chk of d.goal_weekly_checkins) {
    if (!isPlainObject(chk) || !isNonEmptyString(chk.id)) continue;
    if (!isNonEmptyString(chk.goalId) || !goalIds.has(chk.goalId)) {
      errors.push(
        `goal_weekly_checkins["${chk.id}"]: goalId "${String(chk.goalId)}" does not match any goal.`
      );
    }
    if (!isValidYyyyMmDd(chk.weekStart)) {
      errors.push(
        `goal_weekly_checkins["${chk.id}"]: invalid weekStart "${String(chk.weekStart)}".`
      );
    }
    if (typeof chk.progressNote !== 'string') {
      errors.push(`goal_weekly_checkins["${chk.id}"]: progressNote must be a string.`);
    }
    if (
      typeof chk.progressPercent !== 'number' ||
      !Number.isFinite(chk.progressPercent) ||
      chk.progressPercent < 0 ||
      chk.progressPercent > 100
    ) {
      errors.push(
        `goal_weekly_checkins["${chk.id}"]: progressPercent must be 0–100, got ${String(chk.progressPercent)}.`
      );
    }
    if (!VALID_GOAL_STATUSES.has(chk.statusSnapshot)) {
      errors.push(
        `goal_weekly_checkins["${chk.id}"]: unsupported statusSnapshot "${String(chk.statusSnapshot)}".`
      );
    }
    if (!isValidIsoTimestamp(chk.createdAt) || !isValidIsoTimestamp(chk.updatedAt)) {
      errors.push(`goal_weekly_checkins["${chk.id}"]: invalid createdAt/updatedAt.`);
    }
  }

  // Weekly reviews
  for (const rev of d.weekly_reviews) {
    if (!isPlainObject(rev) || !isNonEmptyString(rev.id)) continue;
    if (!isValidYyyyMmDd(rev.weekStart)) {
      errors.push(`weekly_reviews["${rev.id}"]: invalid weekStart "${String(rev.weekStart)}".`);
    }
    for (const key of ['wins', 'challenges', 'reflections', 'nextWeekPriorities'] as const) {
      if (typeof rev[key] !== 'string') {
        errors.push(`weekly_reviews["${rev.id}"]: "${key}" must be a string.`);
      }
    }
    if (!isValidIsoTimestamp(rev.createdAt) || !isValidIsoTimestamp(rev.updatedAt)) {
      errors.push(`weekly_reviews["${rev.id}"]: invalid createdAt/updatedAt.`);
    }
  }

  // Subjects
  for (const subj of d.subjects) {
    if (!isPlainObject(subj) || !isNonEmptyString(subj.id)) continue;
    if (!isNonEmptyString(subj.name)) {
      errors.push(`subjects["${subj.id}"]: missing required "name".`);
    }
    if (typeof subj.code !== 'string' || typeof subj.instructor !== 'string') {
      errors.push(`subjects["${subj.id}"]: code and instructor must be strings.`);
    }
    if (!VALID_PASTEL_TOKENS.has(subj.color)) {
      errors.push(`subjects["${subj.id}"]: unsupported colour "${String(subj.color)}".`);
    }
    if (
      typeof subj.targetAttendance !== 'number' ||
      !Number.isFinite(subj.targetAttendance) ||
      subj.targetAttendance < 0 ||
      subj.targetAttendance > 100
    ) {
      errors.push(
        `subjects["${subj.id}"]: targetAttendance must be 0–100, got ${String(subj.targetAttendance)}.`
      );
    }
    if (!isValidIsoTimestamp(subj.createdAt) || !isValidIsoTimestamp(subj.updatedAt)) {
      errors.push(`subjects["${subj.id}"]: invalid createdAt/updatedAt.`);
    }
  }

  // Assignments
  for (const asg of d.assignments) {
    if (!isPlainObject(asg) || !isNonEmptyString(asg.id)) continue;
    if (!isNonEmptyString(asg.title)) {
      errors.push(`assignments["${asg.id}"]: missing required "title".`);
    }
    if (!isNonEmptyString(asg.subjectId) || !subjectIds.has(asg.subjectId)) {
      errors.push(
        `assignments["${asg.id}"]: subjectId "${String(asg.subjectId)}" does not match any subject.`
      );
    }
    if (typeof asg.description !== 'string') {
      errors.push(`assignments["${asg.id}"]: description must be a string.`);
    }
    if (!isValidYyyyMmDd(asg.dueDate)) {
      errors.push(`assignments["${asg.id}"]: invalid dueDate "${String(asg.dueDate)}".`);
    }
    if (!VALID_PRIORITIES.has(asg.priority)) {
      errors.push(`assignments["${asg.id}"]: unsupported priority "${String(asg.priority)}".`);
    }
    if (!VALID_ASSIGNMENT_STATUSES.has(asg.status)) {
      errors.push(`assignments["${asg.id}"]: unsupported status "${String(asg.status)}".`);
    }
    if (!isValidIsoTimestamp(asg.createdAt) || !isValidIsoTimestamp(asg.updatedAt)) {
      errors.push(`assignments["${asg.id}"]: invalid createdAt/updatedAt.`);
    }
  }

  // Attendance records
  for (const att of d.attendance_records) {
    if (!isPlainObject(att) || !isNonEmptyString(att.id)) continue;
    if (!isNonEmptyString(att.subjectId) || !subjectIds.has(att.subjectId)) {
      errors.push(
        `attendance_records["${att.id}"]: subjectId "${String(att.subjectId)}" does not match any subject.`
      );
    }
    if (!isValidYyyyMmDd(att.date)) {
      errors.push(`attendance_records["${att.id}"]: invalid date "${String(att.date)}".`);
    }
    if (!VALID_ATTENDANCE_STATUSES.has(att.status)) {
      errors.push(`attendance_records["${att.id}"]: unsupported status "${String(att.status)}".`);
    }
    if (!isValidIsoTimestamp(att.createdAt) || !isValidIsoTimestamp(att.updatedAt)) {
      errors.push(`attendance_records["${att.id}"]: invalid createdAt/updatedAt.`);
    }
  }

  // Timetable events
  for (const ev of d.timetable_events) {
    if (!isPlainObject(ev) || !isNonEmptyString(ev.id)) continue;
    if (!isNonEmptyString(ev.title)) {
      errors.push(`timetable_events["${ev.id}"]: missing required "title".`);
    }
    if (!isNonEmptyString(ev.categoryId)) {
      errors.push(`timetable_events["${ev.id}"]: missing required "categoryId".`);
    } else if (d.settings.length > 0 && !categoryIds.has(ev.categoryId)) {
      errors.push(
        `timetable_events["${ev.id}"]: categoryId "${ev.categoryId}" does not exist in eventCategories.`
      );
    }
    if (ev.subjectId !== undefined && (!isNonEmptyString(ev.subjectId) || !subjectIds.has(ev.subjectId))) {
      errors.push(
        `timetable_events["${ev.id}"]: subjectId "${String(ev.subjectId)}" does not match any subject.`
      );
    }
    if (typeof ev.isRecurring !== 'boolean') {
      errors.push(`timetable_events["${ev.id}"]: isRecurring must be a boolean.`);
    } else if (ev.isRecurring) {
      if (
        typeof ev.dayOfWeek !== 'number' ||
        !Number.isInteger(ev.dayOfWeek) ||
        ev.dayOfWeek < 0 ||
        ev.dayOfWeek > 6
      ) {
        errors.push(
          `timetable_events["${ev.id}"]: recurring event requires dayOfWeek 0..6, got ${String(ev.dayOfWeek)}.`
        );
      }
    } else {
      if (!isValidYyyyMmDd(ev.date)) {
        errors.push(
          `timetable_events["${ev.id}"]: one-off event requires valid YYYY-MM-DD date, got "${String(ev.date)}".`
        );
      }
    }
    if (!isValidHhMm(ev.startTime) || !isValidHhMm(ev.endTime)) {
      errors.push(
        `timetable_events["${ev.id}"]: startTime ("${String(ev.startTime)}") and endTime ("${String(ev.endTime)}") must be HH:mm.`
      );
    } else if (ev.startTime >= ev.endTime) {
      errors.push(
        `timetable_events["${ev.id}"]: startTime (${ev.startTime}) must be earlier than endTime (${ev.endTime}).`
      );
    }
    if (ev.recurrenceStartDate !== undefined && !isValidYyyyMmDd(ev.recurrenceStartDate)) {
      errors.push(
        `timetable_events["${ev.id}"]: invalid recurrenceStartDate "${String(ev.recurrenceStartDate)}".`
      );
    }
    if (ev.recurrenceEndDate !== undefined && !isValidYyyyMmDd(ev.recurrenceEndDate)) {
      errors.push(
        `timetable_events["${ev.id}"]: invalid recurrenceEndDate "${String(ev.recurrenceEndDate)}".`
      );
    }
    if (
      ev.recurrenceStartDate !== undefined &&
      ev.recurrenceEndDate !== undefined &&
      isValidYyyyMmDd(ev.recurrenceStartDate) &&
      isValidYyyyMmDd(ev.recurrenceEndDate) &&
      ev.recurrenceStartDate > ev.recurrenceEndDate
    ) {
      errors.push(
        `timetable_events["${ev.id}"]: recurrenceStartDate (${ev.recurrenceStartDate}) exceeds recurrenceEndDate (${ev.recurrenceEndDate}).`
      );
    }
    if (!isValidIsoTimestamp(ev.createdAt) || !isValidIsoTimestamp(ev.updatedAt)) {
      errors.push(`timetable_events["${ev.id}"]: invalid createdAt/updatedAt.`);
    }
  }

  // Timetable exceptions
  for (const ex of d.timetable_exceptions) {
    if (!isPlainObject(ex) || !isNonEmptyString(ex.id)) continue;
    if (!isNonEmptyString(ex.eventId) || !eventIds.has(ex.eventId)) {
      errors.push(
        `timetable_exceptions["${ex.id}"]: eventId "${String(ex.eventId)}" does not match any timetable event.`
      );
    }
    if (!isValidYyyyMmDd(ex.originalDate)) {
      errors.push(
        `timetable_exceptions["${ex.id}"]: invalid originalDate "${String(ex.originalDate)}".`
      );
    }
    if (ex.type !== 'cancelled' && ex.type !== 'modified') {
      errors.push(`timetable_exceptions["${ex.id}"]: invalid type "${String(ex.type)}".`);
    }
    if (ex.overrideDate !== undefined && !isValidYyyyMmDd(ex.overrideDate)) {
      errors.push(
        `timetable_exceptions["${ex.id}"]: invalid overrideDate "${String(ex.overrideDate)}".`
      );
    }
    if (ex.overrideStartTime !== undefined && !isValidHhMm(ex.overrideStartTime)) {
      errors.push(
        `timetable_exceptions["${ex.id}"]: invalid overrideStartTime "${String(ex.overrideStartTime)}".`
      );
    }
    if (ex.overrideEndTime !== undefined && !isValidHhMm(ex.overrideEndTime)) {
      errors.push(
        `timetable_exceptions["${ex.id}"]: invalid overrideEndTime "${String(ex.overrideEndTime)}".`
      );
    }
    if (
      ex.overrideStartTime !== undefined &&
      ex.overrideEndTime !== undefined &&
      isValidHhMm(ex.overrideStartTime) &&
      isValidHhMm(ex.overrideEndTime) &&
      ex.overrideStartTime >= ex.overrideEndTime
    ) {
      errors.push(
        `timetable_exceptions["${ex.id}"]: overrideStartTime (${ex.overrideStartTime}) must be earlier than overrideEndTime (${ex.overrideEndTime}).`
      );
    }
    if (
      ex.overrideCategoryId !== undefined &&
      d.settings.length > 0 &&
      !categoryIds.has(ex.overrideCategoryId)
    ) {
      errors.push(
        `timetable_exceptions["${ex.id}"]: overrideCategoryId "${ex.overrideCategoryId}" does not exist in eventCategories.`
      );
    }
    if (!isValidIsoTimestamp(ex.createdAt) || !isValidIsoTimestamp(ex.updatedAt)) {
      errors.push(`timetable_exceptions["${ex.id}"]: invalid createdAt/updatedAt.`);
    }
  }

  if (extraChecks?.rawTimetableExceptionOverrideSubjectIds) {
    for (const ref of extraChecks.rawTimetableExceptionOverrideSubjectIds) {
      if (!subjectIds.has(ref.overrideSubjectId)) {
        errors.push(
          `timetable_exceptions["${ref.exceptionId}"]: overrideSubjectId "${ref.overrideSubjectId}" does not match any subject.`
        );
      }
    }
  }

  // Internship applications
  for (const app of d.internship_applications) {
    if (!isPlainObject(app) || !isNonEmptyString(app.id)) continue;
    if (!isNonEmptyString(app.company) || !isNonEmptyString(app.position)) {
      errors.push(`internship_applications["${app.id}"]: company and position are required.`);
    }
    if (!VALID_INTERNSHIP_SOURCES.has(app.source)) {
      errors.push(`internship_applications["${app.id}"]: unsupported source "${String(app.source)}".`);
    }
    if (!VALID_INTERNSHIP_STATUSES.has(app.status)) {
      errors.push(`internship_applications["${app.id}"]: unsupported status "${String(app.status)}".`);
    }
    if (app.dateApplied !== undefined && !isValidYyyyMmDd(app.dateApplied)) {
      errors.push(
        `internship_applications["${app.id}"]: invalid dateApplied "${String(app.dateApplied)}".`
      );
    }
    if (app.followUpDate !== undefined && !isValidYyyyMmDd(app.followUpDate)) {
      errors.push(
        `internship_applications["${app.id}"]: invalid followUpDate "${String(app.followUpDate)}".`
      );
    }
    if (typeof app.notes !== 'string') {
      errors.push(`internship_applications["${app.id}"]: notes must be a string.`);
    }
    if (!Array.isArray(app.history)) {
      errors.push(`internship_applications["${app.id}"]: history must be an array.`);
    } else {
      const seenHistIds = new Set<string>();
      for (let hIdx = 0; hIdx < app.history.length; hIdx++) {
        const h = app.history[hIdx];
        if (!isPlainObject(h) || !isNonEmptyString(h.id)) {
          errors.push(`internship_applications["${app.id}"].history[${hIdx}]: missing id.`);
          continue;
        }
        if (seenHistIds.has(h.id)) {
          errors.push(`internship_applications["${app.id}"].history: duplicate id "${h.id}".`);
        } else {
          seenHistIds.add(h.id);
        }
        if (!isValidIsoTimestamp(h.timestamp)) {
          errors.push(
            `internship_applications["${app.id}"].history["${h.id}"]: invalid timestamp "${String(h.timestamp)}".`
          );
        }
        if (h.fromStatus !== undefined && !VALID_INTERNSHIP_STATUSES.has(h.fromStatus)) {
          errors.push(
            `internship_applications["${app.id}"].history["${h.id}"]: invalid fromStatus "${String(h.fromStatus)}".`
          );
        }
        if (!VALID_INTERNSHIP_STATUSES.has(h.toStatus)) {
          errors.push(
            `internship_applications["${app.id}"].history["${h.id}"]: invalid toStatus "${String(h.toStatus)}".`
          );
        }
      }
    }
    if (!isValidIsoTimestamp(app.createdAt) || !isValidIsoTimestamp(app.updatedAt)) {
      errors.push(`internship_applications["${app.id}"]: invalid createdAt/updatedAt.`);
    }
  }

  // Activities
  for (const act of d.activities) {
    if (!isPlainObject(act) || !isNonEmptyString(act.id)) continue;
    if (!isNonEmptyString(act.title)) {
      errors.push(`activities["${act.id}"]: missing required "title".`);
    }
    if (!VALID_ACTIVITY_TYPES.has(act.type)) {
      errors.push(`activities["${act.id}"]: unsupported type "${String(act.type)}".`);
    }
    if (!VALID_ACTIVITY_STATUSES.has(act.status)) {
      errors.push(`activities["${act.id}"]: unsupported status "${String(act.status)}".`);
    }
    if (typeof act.isRecurring !== 'boolean') {
      errors.push(`activities["${act.id}"]: isRecurring must be a boolean.`);
    }
    if (act.date !== undefined && !isValidYyyyMmDd(act.date)) {
      errors.push(`activities["${act.id}"]: invalid date "${String(act.date)}".`);
    }
    if (act.time !== undefined && !isValidHhMm(act.time)) {
      errors.push(`activities["${act.id}"]: invalid time "${String(act.time)}".`);
    }
    if (typeof act.description !== 'string') {
      errors.push(`activities["${act.id}"]: description must be a string.`);
    }
    if (!isValidIsoTimestamp(act.createdAt) || !isValidIsoTimestamp(act.updatedAt)) {
      errors.push(`activities["${act.id}"]: invalid createdAt/updatedAt.`);
    }
  }

  // Habits
  for (const hab of d.habits) {
    if (!isPlainObject(hab) || !isNonEmptyString(hab.id)) continue;
    if (!isNonEmptyString(hab.name)) {
      errors.push(`habits["${hab.id}"]: missing required "name".`);
    }
    if (!isNonEmptyString(hab.category)) {
      errors.push(`habits["${hab.id}"]: missing required "category".`);
    }
    if (hab.frequency !== undefined && !VALID_HABIT_FREQUENCIES.has(hab.frequency)) {
      errors.push(`habits["${hab.id}"]: unsupported frequency "${String(hab.frequency)}".`);
    }
    if (
      typeof hab.targetDaysPerWeek !== 'number' ||
      !Number.isInteger(hab.targetDaysPerWeek) ||
      hab.targetDaysPerWeek < 1 ||
      hab.targetDaysPerWeek > 7
    ) {
      errors.push(
        `habits["${hab.id}"]: targetDaysPerWeek must be 1–7, got ${String(hab.targetDaysPerWeek)}.`
      );
    }
    if (
      hab.targetCount !== undefined &&
      (typeof hab.targetCount !== 'number' || !Number.isInteger(hab.targetCount) || hab.targetCount < 1)
    ) {
      errors.push(`habits["${hab.id}"]: targetCount must be a positive integer.`);
    }
    if (!VALID_PASTEL_TOKENS.has(hab.color)) {
      errors.push(`habits["${hab.id}"]: unsupported colour "${String(hab.color)}".`);
    }
    if (!isValidIsoTimestamp(hab.createdAt) || !isValidIsoTimestamp(hab.updatedAt)) {
      errors.push(`habits["${hab.id}"]: invalid createdAt/updatedAt.`);
    }
  }

  // Habit logs (canonical ID + duplicate (habitId, date) collision detection)
  const seenHabitDatePairs = new Set<string>();
  for (const log of d.habit_logs) {
    if (!isPlainObject(log) || !isNonEmptyString(log.id)) continue;
    if (!isNonEmptyString(log.habitId) || !habitIds.has(log.habitId)) {
      errors.push(
        `habit_logs["${log.id}"]: habitId "${String(log.habitId)}" does not match any habit.`
      );
    }
    if (!isValidYyyyMmDd(log.date)) {
      errors.push(`habit_logs["${log.id}"]: invalid date "${String(log.date)}".`);
    }
    if (typeof log.completed !== 'boolean') {
      errors.push(`habit_logs["${log.id}"]: completed must be a boolean.`);
    }
    if (!isValidIsoTimestamp(log.updatedAt)) {
      errors.push(`habit_logs["${log.id}"]: invalid updatedAt "${String(log.updatedAt)}".`);
    }
    const expectedId = `${log.habitId}_${log.date}`;
    if (log.id !== expectedId) {
      errors.push(
        `habit_logs["${log.id}"]: id must match canonical format "${expectedId}".`
      );
    }
    const pairKey = `${log.habitId}::${log.date}`;
    if (seenHabitDatePairs.has(pairKey)) {
      errors.push(
        `habit_logs: duplicate log entry for habit "${log.habitId}" on date "${log.date}" (id "${log.id}").`
      );
    } else {
      seenHabitDatePairs.add(pairKey);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function convertLegacyV3Backup(raw: unknown): LegacyConversionResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const preservedAudit = new Set<string>();
  const transformedAudit = new Set<string>();
  const defaultedAudit = new Set<string>();
  const droppedAudit = new Set<string>();

  const emptyBefore: Record<string, number> = {};
  for (const key of LEGACY_V3_STORE_KEYS) {
    emptyBefore[key] = 0;
  }

  const emptyAfter: Record<keyof BackupDataBundle, number> = {
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

  if (!isLegacyV3Backup(raw)) {
    return {
      valid: false,
      warnings: [],
      errors: ['Input is not a schemaVersion 3 Little Life HQ backup.'],
      beforeAfterCounts: {
        before: emptyBefore,
        after: emptyAfter,
        eventCategoriesCount: 0,
        totalBefore: 0,
        totalAfterRecords: 0,
        totalAfterItemsIncludingCategories: 0,
      },
      fieldAudit: {preserved: [], transformed: [], defaulted: [], dropped: []},
    };
  }

  const root = raw as Record<string, unknown>;
  const stores = root.stores as Record<string, unknown>;

  const beforeCounts: Record<string, number> = {};
  let totalBefore = 0;
  for (const key of LEGACY_V3_STORE_KEYS) {
    const val = stores[key];
    if (val !== undefined && !Array.isArray(val)) {
      errors.push(`stores.${key}: expected an array.`);
      beforeCounts[key] = 0;
    } else {
      const len = Array.isArray(val) ? val.length : 0;
      beforeCounts[key] = len;
      totalBefore += len;
    }
  }

  const readStoreArray = (key: (typeof LEGACY_V3_STORE_KEYS)[number]): unknown[] => {
    const val = stores[key];
    return Array.isArray(val) ? val : [];
  };

  // 1. Subjects (converted early so timetable_events & timetable_exceptions can resolve subjectName)
  const subjectNameById = new Map<string, string>();
  const subjects: Subject[] = [];
  for (let i = 0; i < readStoreArray('subjects').length; i++) {
    const item = readStoreArray('subjects')[i];
    if (!isPlainObject(item)) {
      errors.push(`subjects[${i}]: record must be an object.`);
      continue;
    }
    const id = typeof item.id === 'string' ? item.id : '';
    const name = typeof item.name === 'string' ? item.name : '';
    const color = mapLegacyColor(
      item.color,
      `subjects["${id || i}"]`,
      warnings,
      errors,
      transformedAudit,
      preservedAudit
    );

    let code = '';
    if (typeof item.code === 'string') {
      code = item.code;
      addAudit(preservedAudit, 'subjects.code');
    } else if (item.code === undefined) {
      warnings.push(`Subject "${name || id || i}": defaulted missing "code" to "".`);
      addAudit(defaultedAudit, 'subjects.code → ""');
    } else {
      errors.push(`subjects["${id || i}"]: invalid "code" type.`);
    }

    let instructor = '';
    if (typeof item.instructor === 'string') {
      instructor = item.instructor;
      addAudit(preservedAudit, 'subjects.instructor');
    } else if (item.instructor === undefined) {
      warnings.push(`Subject "${name || id || i}": defaulted missing "instructor" to "".`);
      addAudit(defaultedAudit, 'subjects.instructor → ""');
    } else {
      errors.push(`subjects["${id || i}"]: invalid "instructor" type.`);
    }

    if (typeof item.targetAttendancePercent !== 'number') {
      errors.push(`subjects["${id || i}"]: missing or invalid "targetAttendancePercent".`);
    } else {
      addAudit(transformedAudit, 'subjects.targetAttendancePercent → subjects.targetAttendance');
    }

    addAudit(preservedAudit, 'subjects.{id, name, createdAt, updatedAt}');

    if (id && name) {
      subjectNameById.set(id, name);
    }

    subjects.push({
      id,
      name,
      code,
      instructor,
      color: (color ?? item.color) as PastelToken,
      targetAttendance: item.targetAttendancePercent as number,
      createdAt: item.createdAt as string,
      updatedAt: item.updatedAt as string,
    });
  }

  // 2. Timetable Categories -> settings[0].eventCategories
  const rawCats = readStoreArray('timetable_categories');
  const eventCategories: EventCategoryConfig[] = [];
  const categoryColorById = new Map<string, PastelToken>();

  if (stores.timetable_categories === undefined) {
    warnings.push(
      'stores.timetable_categories was absent; defaulted settings.eventCategories to built-in categories.'
    );
    addAudit(defaultedAudit, 'settings.eventCategories (from defaults)');
    for (const def of FALLBACK_EVENT_CATEGORIES) {
      eventCategories.push({...def});
      categoryColorById.set(def.id, def.color);
    }
  } else {
    for (let i = 0; i < rawCats.length; i++) {
      const cat = rawCats[i];
      if (!isPlainObject(cat)) {
        errors.push(`timetable_categories[${i}]: record must be an object.`);
        continue;
      }
      const id = typeof cat.id === 'string' ? cat.id : '';
      const name = typeof cat.name === 'string' ? cat.name : '';
      const color = mapLegacyColor(
        cat.color,
        `timetable_categories["${id || i}"]`,
        warnings,
        errors,
        transformedAudit,
        preservedAudit
      );
      if ('isDefault' in cat || 'createdAt' in cat || 'updatedAt' in cat) {
        addAudit(droppedAudit, 'timetable_categories.{isDefault, createdAt, updatedAt}');
      }
      addAudit(transformedAudit, 'timetable_categories[] → settings[0].eventCategories[]');
      const resolvedColor = (color ?? cat.color) as PastelToken;
      if (id && VALID_PASTEL_TOKENS.has(resolvedColor)) {
        categoryColorById.set(id, resolvedColor);
      }
      eventCategories.push({
        id,
        name,
        color: resolvedColor,
      });
    }
    if (rawCats.length > 0) {
      warnings.push(
        `timetable_categories (${rawCats.length}): merged into settings[0].eventCategories; dropped metadata fields (isDefault, createdAt, updatedAt).`
      );
    }
  }

  // 3. Goals
  const goals: Goal[] = [];
  for (let i = 0; i < readStoreArray('goals').length; i++) {
    const item = readStoreArray('goals')[i];
    if (!isPlainObject(item)) {
      errors.push(`goals[${i}]: record must be an object.`);
      continue;
    }
    const id = typeof item.id === 'string' ? item.id : '';
    const title = typeof item.title === 'string' ? item.title : '';
    let description = '';
    if (typeof item.description === 'string') {
      description = item.description;
      addAudit(preservedAudit, 'goals.description');
    } else if (item.description === undefined) {
      warnings.push(`Goal "${title || id || i}" (${id || i}): defaulted missing "description" to "".`);
      addAudit(defaultedAudit, 'goals.description → ""');
    } else {
      errors.push(`goals["${id || i}"]: invalid "description" type.`);
    }
    addAudit(preservedAudit, 'goals.{id, title, category, priority, targetDate, status, createdAt, updatedAt, completedAt}');

    goals.push({
      id,
      title,
      description,
      category: item.category as GoalCategory,
      priority: item.priority as GoalPriority,
      ...(item.targetDate !== undefined ? {targetDate: item.targetDate as string} : {}),
      status: item.status as GoalStatus,
      createdAt: item.createdAt as string,
      updatedAt: item.updatedAt as string,
      ...(item.completedAt !== undefined ? {completedAt: item.completedAt as string} : {}),
    });
  }

  // 4. Goal Weekly Checkins
  const goal_weekly_checkins: GoalWeeklyCheckin[] = [];
  for (let i = 0; i < readStoreArray('goal_weekly_checkins').length; i++) {
    const item = readStoreArray('goal_weekly_checkins')[i];
    if (!isPlainObject(item)) {
      errors.push(`goal_weekly_checkins[${i}]: record must be an object.`);
      continue;
    }
    const id = typeof item.id === 'string' ? item.id : '';
    if (!('weekStartDate' in item)) {
      errors.push(`goal_weekly_checkins["${id || i}"]: missing required "weekStartDate".`);
    } else {
      addAudit(transformedAudit, 'goal_weekly_checkins.weekStartDate → weekStart');
    }

    let progressNote = '';
    if (typeof item.progressNote === 'string') {
      progressNote = item.progressNote;
      addAudit(preservedAudit, 'goal_weekly_checkins.progressNote');
    } else if (item.progressNote === undefined) {
      warnings.push(`goal_weekly_checkins["${id || i}"]: defaulted missing "progressNote" to "".`);
      addAudit(defaultedAudit, 'goal_weekly_checkins.progressNote → ""');
    } else {
      errors.push(`goal_weekly_checkins["${id || i}"]: invalid "progressNote" type.`);
    }

    let progressPercent = item.progressPercent as number;
    if (item.progressPercent === undefined) {
      progressPercent = item.statusSnapshot === 'Completed' ? 100 : 0;
      warnings.push(
        `goal_weekly_checkins["${id || i}"]: defaulted missing "progressPercent" to ${progressPercent}.`
      );
      addAudit(defaultedAudit, 'goal_weekly_checkins.progressPercent');
    } else {
      addAudit(preservedAudit, 'goal_weekly_checkins.progressPercent');
    }

    addAudit(preservedAudit, 'goal_weekly_checkins.{id, goalId, statusSnapshot, createdAt, updatedAt}');
    goal_weekly_checkins.push({
      id,
      goalId: item.goalId as string,
      weekStart: item.weekStartDate as string,
      progressNote,
      progressPercent,
      statusSnapshot: item.statusSnapshot as GoalStatus,
      createdAt: item.createdAt as string,
      updatedAt: item.updatedAt as string,
    });
  }

  // 5. Weekly Reviews
  const weekly_reviews: WeeklyReview[] = [];
  for (let i = 0; i < readStoreArray('weekly_reviews').length; i++) {
    const item = readStoreArray('weekly_reviews')[i];
    if (!isPlainObject(item)) {
      errors.push(`weekly_reviews[${i}]: record must be an object.`);
      continue;
    }
    const id = typeof item.id === 'string' ? item.id : '';
    if (!('weekStartDate' in item)) {
      errors.push(`weekly_reviews["${id || i}"]: missing required "weekStartDate".`);
    } else {
      addAudit(transformedAudit, 'weekly_reviews.weekStartDate → weekStart');
    }
    if (Array.isArray(item.copiedForwardGoalIds) && item.copiedForwardGoalIds.length > 0) {
      warnings.push(
        `weekly_reviews["${id || i}"]: dropped "copiedForwardGoalIds" (${item.copiedForwardGoalIds.length} IDs; unsupported in v1 WeeklyReview).`
      );
      addAudit(droppedAudit, 'weekly_reviews.copiedForwardGoalIds');
    } else if ('copiedForwardGoalIds' in item) {
      addAudit(droppedAudit, 'weekly_reviews.copiedForwardGoalIds');
    }
    addAudit(preservedAudit, 'weekly_reviews.{id, wins, challenges, reflections, nextWeekPriorities, createdAt, updatedAt}');
    weekly_reviews.push({
      id,
      weekStart: item.weekStartDate as string,
      wins: item.wins as string,
      challenges: item.challenges as string,
      reflections: item.reflections as string,
      nextWeekPriorities: item.nextWeekPriorities as string,
      createdAt: item.createdAt as string,
      updatedAt: item.updatedAt as string,
    });
  }

  // 6. Assignments
  const assignments: Assignment[] = [];
  for (let i = 0; i < readStoreArray('assignments').length; i++) {
    const item = readStoreArray('assignments')[i];
    if (!isPlainObject(item)) {
      errors.push(`assignments[${i}]: record must be an object.`);
      continue;
    }
    const id = typeof item.id === 'string' ? item.id : '';
    const title = typeof item.title === 'string' ? item.title : '';
    let description = '';
    if (typeof item.description === 'string') {
      description = item.description;
      addAudit(preservedAudit, 'assignments.description');
    } else if (item.description === undefined) {
      warnings.push(
        `Assignment "${title || id || i}" (${id || i}): defaulted missing "description" to "".`
      );
      addAudit(defaultedAudit, 'assignments.description → ""');
    } else {
      errors.push(`assignments["${id || i}"]: invalid "description" type.`);
    }
    addAudit(preservedAudit, 'assignments.{id, subjectId, title, dueDate, priority, status, createdAt, updatedAt}');
    assignments.push({
      id,
      subjectId: item.subjectId as string,
      title,
      description,
      dueDate: item.dueDate as string,
      priority: item.priority as AssignmentPriority,
      status: item.status as AssignmentStatus,
      createdAt: item.createdAt as string,
      updatedAt: item.updatedAt as string,
    });
  }

  // 7. Attendance Records
  const attendance_records: AttendanceRecord[] = [];
  for (let i = 0; i < readStoreArray('attendance_records').length; i++) {
    const item = readStoreArray('attendance_records')[i];
    if (!isPlainObject(item)) {
      errors.push(`attendance_records[${i}]: record must be an object.`);
      continue;
    }
    const id = typeof item.id === 'string' ? item.id : '';
    const rawStatus = item.status;
    const mappedStatus =
      typeof rawStatus === 'string' ? LEGACY_ATTENDANCE_STATUS_MAP[rawStatus] : undefined;
    if (!mappedStatus) {
      errors.push(
        `attendance_records["${id || i}"]: unsupported status "${String(rawStatus)}".`
      );
    } else if (rawStatus !== mappedStatus) {
      warnings.push(
        `attendance_records["${id || i}"]: normalized status "${rawStatus}" → "${mappedStatus}".`
      );
      addAudit(transformedAudit, 'attendance_records.status (capitalized)');
    } else {
      addAudit(preservedAudit, 'attendance_records.status');
    }
    addAudit(preservedAudit, 'attendance_records.{id, subjectId, date, note, createdAt, updatedAt}');
    attendance_records.push({
      id,
      subjectId: item.subjectId as string,
      date: item.date as string,
      status: (mappedStatus ?? rawStatus) as AttendanceStatus,
      ...(item.note !== undefined ? {note: item.note as string} : {}),
      createdAt: item.createdAt as string,
      updatedAt: item.updatedAt as string,
    });
  }

  // 8. Timetable Events
  const timetable_events: TimetableEvent[] = [];
  let droppedMatchingEventColorCount = 0;
  for (let i = 0; i < readStoreArray('timetable_events').length; i++) {
    const item = readStoreArray('timetable_events')[i];
    if (!isPlainObject(item)) {
      errors.push(`timetable_events[${i}]: record must be an object.`);
      continue;
    }
    const id = typeof item.id === 'string' ? item.id : '';
    const title = typeof item.title === 'string' ? item.title : '';

    if (item.scheduleType !== 'recurring' && item.scheduleType !== 'one-off') {
      errors.push(
        `timetable_events["${id || i}"]: unsupported scheduleType "${String(item.scheduleType)}".`
      );
    }
    const isRecurring = item.scheduleType === 'recurring';
    addAudit(transformedAudit, 'timetable_events.scheduleType → isRecurring');

    if ('seriesStartDate' in item) {
      addAudit(transformedAudit, 'timetable_events.seriesStartDate → recurrenceStartDate');
    }
    if ('seriesEndDate' in item) {
      addAudit(transformedAudit, 'timetable_events.seriesEndDate → recurrenceEndDate');
    }

    if (item.color !== undefined) {
      const normalizedEvColor =
        item.color === 'yellow' ? 'butter' : (item.color as PastelToken);
      const catColor =
        typeof item.categoryId === 'string'
          ? categoryColorById.get(item.categoryId)
          : undefined;
      addAudit(droppedAudit, 'timetable_events.color (derived from categoryId)');
      if (!VALID_PASTEL_TOKENS.has(normalizedEvColor)) {
        errors.push(`timetable_events["${id || i}"]: unsupported colour "${String(item.color)}".`);
      } else if (catColor && normalizedEvColor !== catColor) {
        warnings.push(
          `Timetable event "${title || id || i}" (${id || i}): dropped per-event colour "${String(item.color)}" because v1 uses category "${item.categoryId}" colour ("${catColor}").`
        );
      } else {
        droppedMatchingEventColorCount++;
      }
    }

    const resolvedSubjectName =
      typeof item.subjectId === 'string' ? subjectNameById.get(item.subjectId) : undefined;
    if (resolvedSubjectName) {
      addAudit(transformedAudit, 'timetable_events.subjectName (resolved from subjectId)');
    }

    addAudit(
      preservedAudit,
      'timetable_events.{id, title, subjectId, categoryId, dayOfWeek, date, startTime, endTime, location, instructor, notes, createdAt, updatedAt}'
    );

    timetable_events.push({
      id,
      title,
      ...(item.subjectId !== undefined ? {subjectId: item.subjectId as string} : {}),
      ...(resolvedSubjectName !== undefined ? {subjectName: resolvedSubjectName} : {}),
      categoryId: item.categoryId as string,
      isRecurring,
      ...(item.dayOfWeek !== undefined ? {dayOfWeek: item.dayOfWeek as number} : {}),
      ...(item.date !== undefined ? {date: item.date as string} : {}),
      startTime: item.startTime as string,
      endTime: item.endTime as string,
      ...(item.location !== undefined ? {location: item.location as string} : {}),
      ...(item.instructor !== undefined ? {instructor: item.instructor as string} : {}),
      ...(item.notes !== undefined ? {notes: item.notes as string} : {}),
      ...(item.seriesStartDate !== undefined
        ? {recurrenceStartDate: item.seriesStartDate as string}
        : {}),
      ...(item.seriesEndDate !== undefined
        ? {recurrenceEndDate: item.seriesEndDate as string}
        : {}),
      createdAt: item.createdAt as string,
      updatedAt: item.updatedAt as string,
    });
  }
  if (droppedMatchingEventColorCount > 0) {
    warnings.push(
      `timetable_events (${droppedMatchingEventColorCount}): dropped redundant per-event "color" field (matched category colour).`
    );
  }

  // 9. Timetable Exceptions
  const timetable_exceptions: TimetableException[] = [];
  const rawOverrideSubjectRefs: Array<{exceptionId: string; overrideSubjectId: string}> = [];
  for (let i = 0; i < readStoreArray('timetable_exceptions').length; i++) {
    const item = readStoreArray('timetable_exceptions')[i];
    if (!isPlainObject(item)) {
      errors.push(`timetable_exceptions[${i}]: record must be an object.`);
      continue;
    }
    const id = typeof item.id === 'string' ? item.id : '';
    addAudit(transformedAudit, 'timetable_exceptions.seriesId → eventId');
    addAudit(transformedAudit, 'timetable_exceptions.exceptionType → type');

    let overrideSubjectName: string | undefined;
    if (item.overrideSubjectId !== undefined) {
      if (!isNonEmptyString(item.overrideSubjectId)) {
        errors.push(`timetable_exceptions["${id || i}"]: invalid "overrideSubjectId".`);
      } else {
        rawOverrideSubjectRefs.push({
          exceptionId: id || String(i),
          overrideSubjectId: item.overrideSubjectId,
        });
        overrideSubjectName = subjectNameById.get(item.overrideSubjectId);
        addAudit(
          transformedAudit,
          'timetable_exceptions.overrideSubjectId → overrideSubjectName'
        );
      }
    }

    if (item.overrideColor !== undefined) {
      warnings.push(
        `timetable_exceptions["${id || i}"]: dropped "overrideColor" ("${String(item.overrideColor)}"; unsupported in v1 TimetableException).`
      );
      addAudit(droppedAudit, 'timetable_exceptions.overrideColor');
    }

    addAudit(
      preservedAudit,
      'timetable_exceptions.{id, originalDate, overrideDate, overrideStartTime, overrideEndTime, overrideTitle, overrideLocation, overrideCategoryId, overrideNotes, createdAt, updatedAt}'
    );

    timetable_exceptions.push({
      id,
      eventId: item.seriesId as string,
      originalDate: item.originalDate as string,
      type: item.exceptionType as 'cancelled' | 'modified',
      ...(item.overrideDate !== undefined ? {overrideDate: item.overrideDate as string} : {}),
      ...(item.overrideStartTime !== undefined
        ? {overrideStartTime: item.overrideStartTime as string}
        : {}),
      ...(item.overrideEndTime !== undefined
        ? {overrideEndTime: item.overrideEndTime as string}
        : {}),
      ...(item.overrideTitle !== undefined ? {overrideTitle: item.overrideTitle as string} : {}),
      ...(item.overrideLocation !== undefined
        ? {overrideLocation: item.overrideLocation as string}
        : {}),
      ...(item.overrideCategoryId !== undefined
        ? {overrideCategoryId: item.overrideCategoryId as string}
        : {}),
      ...(item.overrideNotes !== undefined ? {overrideNotes: item.overrideNotes as string} : {}),
      ...(overrideSubjectName !== undefined ? {overrideSubjectName} : {}),
      createdAt: item.createdAt as string,
      updatedAt: item.updatedAt as string,
    });
  }

  // 10. Internships -> internship_applications
  const internship_applications: InternshipApplication[] = [];
  for (let i = 0; i < readStoreArray('internships').length; i++) {
    const item = readStoreArray('internships')[i];
    if (!isPlainObject(item)) {
      errors.push(`internships[${i}]: record must be an object.`);
      continue;
    }
    const id = typeof item.id === 'string' ? item.id : '';
    const label =
      typeof item.company === 'string' && item.company.trim()
        ? `${item.company}${typeof item.position === 'string' && item.position ? ` — ${item.position}` : ''}`
        : id || String(i);

    let notes = '';
    if (typeof item.notes === 'string') {
      notes = item.notes;
      addAudit(preservedAudit, 'internship_applications.notes');
    } else if (item.notes === undefined) {
      warnings.push(`Internship "${label}" (${id || i}): defaulted missing "notes" to "".`);
      addAudit(defaultedAudit, 'internship_applications.notes → ""');
    } else {
      errors.push(`internships["${id || i}"]: invalid "notes" type.`);
    }

    let jobUrl: string | undefined;
    if (item.jobUrlOrDescription !== undefined) {
      if (typeof item.jobUrlOrDescription !== 'string') {
        errors.push(`internships["${id || i}"]: invalid "jobUrlOrDescription" type.`);
      } else if (/^https?:\/\//i.test(item.jobUrlOrDescription.trim())) {
        jobUrl = item.jobUrlOrDescription.trim();
        addAudit(transformedAudit, 'internships.jobUrlOrDescription → jobUrl');
      } else if (item.jobUrlOrDescription.trim().length > 0) {
        notes = notes
          ? `${notes}\n\n[Imported description]: ${item.jobUrlOrDescription.trim()}`
          : `[Imported description]: ${item.jobUrlOrDescription.trim()}`;
        warnings.push(
          `Internship "${label}" (${id || i}): moved non-URL "jobUrlOrDescription" text into "notes".`
        );
        addAudit(transformedAudit, 'internships.jobUrlOrDescription (non-URL) → notes');
      }
    }

    const convertedHistory: InternshipHistoryEntry[] = [];
    if (!Array.isArray(item.history)) {
      errors.push(`internships["${id || i}"]: missing or invalid "history" array.`);
    } else {
      for (let hIdx = 0; hIdx < item.history.length; hIdx++) {
        const h = item.history[hIdx];
        if (!isPlainObject(h)) {
          errors.push(`internships["${id || i}"].history[${hIdx}]: must be an object.`);
          continue;
        }
        const hId = typeof h.id === 'string' ? h.id : '';
        const hKind = typeof h.kind === 'string' ? h.kind : undefined;
        if (hKind !== undefined) {
          addAudit(droppedAudit, 'internship.history[].kind');
        }
        if (h.toStatus === undefined) {
          if (hKind === 'created' || hKind === 'status_change') {
            errors.push(
              `internships["${id || i}"].history["${hId || hIdx}"]: "${hKind}" entry is missing required "toStatus".`
            );
          } else {
            const noteText = typeof h.note === 'string' ? h.note : '';
            const ts = typeof h.timestamp === 'string' ? h.timestamp : '';
            notes = notes
              ? `${notes}\n[History ${hKind ?? 'entry'} ${ts}]: ${noteText}`
              : `[History ${hKind ?? 'entry'} ${ts}]: ${noteText}`;
            warnings.push(
              `Internship "${label}" history["${hId || hIdx}"]: non-status "${hKind ?? 'note'}" entry lacked "toStatus"; preserved note inside "notes" instead of inventing a status transition.`
            );
            addAudit(transformedAudit, 'internships.history (non-status without toStatus) → notes');
          }
          continue;
        }

        convertedHistory.push({
          id: hId,
          timestamp: h.timestamp as string,
          ...(h.fromStatus !== undefined ? {fromStatus: h.fromStatus as InternshipStatus} : {}),
          toStatus: h.toStatus as InternshipStatus,
          ...(h.note !== undefined ? {note: h.note as string} : {}),
        });
      }
      if (item.history.some((h) => isPlainObject(h) && 'kind' in h)) {
        warnings.push(
          `Internship "${label}" (${id || i}): stripped legacy "kind" metadata from ${item.history.length} history entr${item.history.length === 1 ? 'y' : 'ies'}.`
        );
      }
    }

    addAudit(transformedAudit, 'stores.internships → data.internship_applications');
    addAudit(
      preservedAudit,
      'internship_applications.{id, company, position, source, dateApplied, status, location, contactDetails, followUpDate, history, createdAt, updatedAt}'
    );

    internship_applications.push({
      id,
      company: item.company as string,
      position: item.position as string,
      source: item.source as InternshipSource,
      ...(item.dateApplied !== undefined ? {dateApplied: item.dateApplied as string} : {}),
      status: item.status as InternshipStatus,
      ...(jobUrl !== undefined ? {jobUrl} : {}),
      ...(item.location !== undefined ? {location: item.location as string} : {}),
      ...(item.contactDetails !== undefined
        ? {contactDetails: item.contactDetails as string}
        : {}),
      ...(item.followUpDate !== undefined ? {followUpDate: item.followUpDate as string} : {}),
      notes,
      history: convertedHistory,
      createdAt: item.createdAt as string,
      updatedAt: item.updatedAt as string,
    });
  }

  // 11. Activities
  const activities: Activity[] = [];
  for (let i = 0; i < readStoreArray('activities').length; i++) {
    const item = readStoreArray('activities')[i];
    if (!isPlainObject(item)) {
      errors.push(`activities[${i}]: record must be an object.`);
      continue;
    }
    const id = typeof item.id === 'string' ? item.id : '';
    const title = typeof item.title === 'string' ? item.title : '';

    const mappedType =
      typeof item.kind === 'string' ? LEGACY_ACTIVITY_KIND_MAP[item.kind] : undefined;
    if (!mappedType) {
      errors.push(`activities["${id || i}"]: unsupported kind "${String(item.kind)}".`);
    } else {
      addAudit(transformedAudit, 'activities.kind → type');
    }

    if (item.scheduleType !== 'recurring' && item.scheduleType !== 'one-off') {
      errors.push(
        `activities["${id || i}"]: unsupported scheduleType "${String(item.scheduleType)}".`
      );
    } else {
      addAudit(transformedAudit, 'activities.scheduleType → isRecurring');
    }

    if ('recurrenceRule' in item) {
      addAudit(transformedAudit, 'activities.recurrenceRule → cadence');
    }

    let description = '';
    if (typeof item.notes === 'string') {
      description = item.notes;
      addAudit(transformedAudit, 'activities.notes → description');
    } else if (item.notes === undefined) {
      warnings.push(
        `Activity "${title || id || i}" (${id || i}): defaulted missing "notes" / "description" to "".`
      );
      addAudit(defaultedAudit, 'activities.description → ""');
    } else {
      errors.push(`activities["${id || i}"]: invalid "notes" type.`);
    }

    if (item.color !== undefined) {
      warnings.push(
        `Activity "${title || id || i}" (${id || i}): dropped per-activity "color" ("${String(item.color)}"; unsupported in v1 Activity).`
      );
      addAudit(droppedAudit, 'activities.color');
    }

    if (item.status === 'Paused') {
      addAudit(preservedAudit, 'activities.status ("Paused" preserved natively)');
    } else {
      addAudit(preservedAudit, 'activities.status');
    }

    addAudit(preservedAudit, 'activities.{id, title, date, time, role, createdAt, updatedAt}');

    activities.push({
      id,
      title,
      type: (mappedType ?? item.kind) as ActivityType,
      isRecurring: item.scheduleType === 'recurring',
      ...(item.recurrenceRule !== undefined ? {cadence: item.recurrenceRule as string} : {}),
      ...(item.date !== undefined ? {date: item.date as string} : {}),
      ...(item.time !== undefined ? {time: item.time as string} : {}),
      ...(item.role !== undefined ? {role: item.role as string} : {}),
      description,
      status: item.status as ActivityStatus,
      createdAt: item.createdAt as string,
      updatedAt: item.updatedAt as string,
    });
  }

  // 12. Habits
  const habits: Habit[] = [];
  for (let i = 0; i < readStoreArray('habits').length; i++) {
    const item = readStoreArray('habits')[i];
    if (!isPlainObject(item)) {
      errors.push(`habits[${i}]: record must be an object.`);
      continue;
    }
    const id = typeof item.id === 'string' ? item.id : '';
    const name = typeof item.title === 'string' ? item.title : '';
    if (!isNonEmptyString(item.title)) {
      errors.push(`habits["${id || i}"]: missing required "title".`);
    } else {
      addAudit(transformedAudit, 'habits.title → name');
    }

    const color = mapLegacyColor(
      item.color,
      `habits["${name || id || i}"]`,
      warnings,
      errors,
      transformedAudit,
      preservedAudit
    );

    if (typeof item.frequencyLabel !== 'string' || item.frequencyLabel.trim().toLowerCase() !== 'daily') {
      errors.push(
        `habits["${id || i}"]: unsupported legacy frequencyLabel "${String(item.frequencyLabel)}" (only "Daily" is defined in v3 schema).`
      );
    } else {
      warnings.push(
        `Habit "${name || id || i}" (${id || i}): mapped legacy frequencyLabel "Daily" → frequency: "daily", targetCount: 7, targetDaysPerWeek: 7; defaulted missing "category" to "General".`
      );
      addAudit(transformedAudit, 'habits.frequencyLabel ("Daily") → frequency/targetCount/targetDaysPerWeek');
      addAudit(defaultedAudit, 'habits.category → "General"');
    }

    if (item.archived === true) {
      warnings.push(
        `Habit "${name || id || i}" (${id || i}): was archived in v3, but "archived" is unsupported in v1 so it will appear as an active habit.`
      );
      addAudit(droppedAudit, 'habits.archived');
    } else if ('archived' in item) {
      addAudit(droppedAudit, 'habits.archived');
    }

    addAudit(preservedAudit, 'habits.{id, createdAt, updatedAt}');

    habits.push({
      id,
      name,
      category: 'General',
      frequency: 'daily',
      targetCount: 7,
      targetDaysPerWeek: 7,
      color: (color ?? item.color) as PastelToken,
      createdAt: item.createdAt as string,
      updatedAt: item.updatedAt as string,
    });
  }

  // 13. Habit Logs
  const habit_logs: HabitLog[] = [];
  let normalizedLogIdCount = 0;
  let droppedLogCreatedAtCount = 0;
  for (let i = 0; i < readStoreArray('habit_logs').length; i++) {
    const item = readStoreArray('habit_logs')[i];
    if (!isPlainObject(item)) {
      errors.push(`habit_logs[${i}]: record must be an object.`);
      continue;
    }
    const rawId = typeof item.id === 'string' ? item.id : '';
    const habitId = typeof item.habitId === 'string' ? item.habitId : '';
    const date = typeof item.date === 'string' ? item.date : '';

    let convertedId = rawId;
    if (isNonEmptyString(habitId) && isNonEmptyString(date)) {
      const doubleUnderscoreExpected = `${habitId}__${date}`;
      const singleUnderscoreExpected = `${habitId}_${date}`;
      if (rawId === doubleUnderscoreExpected) {
        convertedId = singleUnderscoreExpected;
        normalizedLogIdCount++;
        addAudit(transformedAudit, 'habit_logs.id ("__" → "_")');
      } else if (rawId === singleUnderscoreExpected) {
        convertedId = singleUnderscoreExpected;
        addAudit(preservedAudit, 'habit_logs.id');
      } else {
        errors.push(
          `habit_logs[${i}]: raw id "${rawId}" does not match habitId "${habitId}" and date "${date}".`
        );
      }
    }

    if ('createdAt' in item) {
      droppedLogCreatedAtCount++;
      addAudit(droppedAudit, 'habit_logs.createdAt');
    }

    addAudit(preservedAudit, 'habit_logs.{habitId, date, completed, updatedAt}');

    habit_logs.push({
      id: convertedId,
      habitId,
      date,
      completed: item.completed as boolean,
      updatedAt: item.updatedAt as string,
    });
  }
  if (normalizedLogIdCount > 0) {
    warnings.push(
      `habit_logs (${normalizedLogIdCount}): normalized ID separator from "__" to "_" and dropped unsupported "createdAt" (${droppedLogCreatedAtCount} records).`
    );
  }

  // 14. Settings
  const settings: AppSettings[] = [];
  const rawSettings = readStoreArray('settings');
  for (let i = 0; i < rawSettings.length; i++) {
    const item = rawSettings[i];
    if (!isPlainObject(item)) {
      errors.push(`settings[${i}]: record must be an object.`);
      continue;
    }

    let semesterLabel = 'Current Semester';
    if (typeof item.semesterLabel === 'string' && item.semesterLabel.trim()) {
      semesterLabel = item.semesterLabel;
      addAudit(preservedAudit, 'settings.semesterLabel');
    } else {
      warnings.push('settings: defaulted missing "semesterLabel" to "Current Semester".');
      addAudit(defaultedAudit, 'settings.semesterLabel → "Current Semester"');
    }

    warnings.push(
      'settings: defaulted missing "showSundayInTimetable" → false and "timetableExpandedHours" → false.'
    );
    addAudit(defaultedAudit, 'settings.{showSundayInTimetable, timetableExpandedHours} → false');

    if ('weekStartsOn' in item) {
      warnings.push(
        `settings: dropped "weekStartsOn" ("${String(item.weekStartsOn)}"; v1 uses Monday start).`
      );
      addAudit(droppedAudit, 'settings.weekStartsOn');
    }
    if ('seededTimetableCategories' in item) {
      addAudit(droppedAudit, 'settings.seededTimetableCategories');
    }
    addAudit(preservedAudit, 'settings.{id, userName, theme, updatedAt}');

    settings.push({
      id: item.id as 'app_settings',
      userName: item.userName as string,
      semesterLabel,
      theme: item.theme as 'light' | 'dark',
      showSundayInTimetable: false,
      timetableExpandedHours: false,
      eventCategories: eventCategories.map((c) => ({...c})),
      updatedAt: item.updatedAt as string,
    });
  }

  const data: BackupDataBundle = {
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
  };

  const payload: FullBackupPayload = {
    app: 'Little Life HQ',
    backupFormatVersion: '1.0',
    schemaVersion: DB_VERSION,
    exportedAt: root.exportedAt as string,
    data,
  };

  const validation = validateBackupPayload(payload, {
    rawTimetableExceptionOverrideSubjectIds: rawOverrideSubjectRefs,
  });
  errors.push(...validation.errors);

  const afterCounts: Record<keyof BackupDataBundle, number> = {
    goals: goals.length,
    goal_weekly_checkins: goal_weekly_checkins.length,
    weekly_reviews: weekly_reviews.length,
    subjects: subjects.length,
    assignments: assignments.length,
    attendance_records: attendance_records.length,
    timetable_events: timetable_events.length,
    timetable_exceptions: timetable_exceptions.length,
    internship_applications: internship_applications.length,
    activities: activities.length,
    habits: habits.length,
    habit_logs: habit_logs.length,
    settings: settings.length,
  };

  const totalAfterRecords = Object.values(afterCounts).reduce((sum, n) => sum + n, 0);
  const categoriesCount = settings[0]?.eventCategories.length ?? eventCategories.length;

  return {
    valid: errors.length === 0,
    ...(errors.length === 0 ? {payload} : {}),
    warnings,
    errors,
    beforeAfterCounts: {
      before: beforeCounts,
      after: afterCounts,
      eventCategoriesCount: categoriesCount,
      totalBefore,
      totalAfterRecords,
      totalAfterItemsIncludingCategories: totalAfterRecords + categoriesCount,
    },
    fieldAudit: {
      preserved: Array.from(preservedAudit),
      transformed: Array.from(transformedAudit),
      defaulted: Array.from(defaultedAudit),
      dropped: Array.from(droppedAudit),
    },
  };
}
