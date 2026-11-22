export type NavPage =
  | 'home'
  | 'week'
  | 'timetable'
  | 'academics'
  | 'internships'
  | 'activities'
  | 'settings';

export type PastelToken =
  | 'lavender'
  | 'pink'
  | 'mint'
  | 'butter'
  | 'peach'
  | 'sky';

export type GoalCategory =
  | 'Academics'
  | 'Career'
  | 'Personal'
  | 'Extracurricular'
  | 'Music'
  | 'Fitness';
export type GoalPriority = 'Low' | 'Medium' | 'High';
export type GoalStatus = 'Not started' | 'In progress' | 'Completed' | 'Paused';

export interface Goal {
  id: string;
  title: string;
  description: string;
  category: GoalCategory;
  priority: GoalPriority;
  targetDate?: string; // YYYY-MM-DD
  status: GoalStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface GoalWeeklyCheckin {
  id: string;
  goalId: string;
  weekStart: string; // YYYY-MM-DD (Monday)
  progressNote: string;
  progressPercent: number; // 0 - 100
  statusSnapshot: GoalStatus;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyReview {
  id: string;
  weekStart: string; // YYYY-MM-DD (Monday)
  wins: string;
  challenges: string;
  reflections: string;
  nextWeekPriorities: string;
  createdAt: string;
  updatedAt: string;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  instructor: string;
  color: PastelToken;
  targetAttendance: number; // percentage e.g. 75
  createdAt: string;
  updatedAt: string;
}

export type AssignmentPriority = 'Low' | 'Medium' | 'High';
export type AssignmentStatus = 'Not started' | 'In progress' | 'Submitted';

export interface Assignment {
  id: string;
  subjectId: string;
  title: string;
  description: string;
  dueDate: string; // YYYY-MM-DD
  priority: AssignmentPriority;
  status: AssignmentStatus;
  createdAt: string;
  updatedAt: string;
}

export type AttendanceStatus = 'Present' | 'Absent' | 'Cancelled';

export interface AttendanceRecord {
  id: string;
  subjectId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventCategoryConfig {
  id: string;
  name: string;
  color: PastelToken;
}

export interface TimetableEvent {
  id: string;
  title: string;
  subjectId?: string;
  subjectName?: string;
  categoryId: string;
  isRecurring: boolean;
  dayOfWeek?: number; // 0 = Sunday .. 6 = Saturday
  date?: string; // YYYY-MM-DD for one-time events
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  location?: string;
  instructor?: string;
  notes?: string;
  recurrenceStartDate?: string; // YYYY-MM-DD
  recurrenceEndDate?: string; // YYYY-MM-DD
  createdAt: string;
  updatedAt: string;
}

export interface TimetableException {
  id: string;
  eventId: string;
  originalDate: string; // YYYY-MM-DD
  type: 'cancelled' | 'modified';
  overrideDate?: string; // YYYY-MM-DD if rescheduled
  overrideStartTime?: string; // HH:mm
  overrideEndTime?: string; // HH:mm
  overrideTitle?: string;
  overrideLocation?: string;
  overrideCategoryId?: string;
  overrideNotes?: string;
  overrideSubjectName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResolvedTimetableOccurrence {
  occurrenceKey: string; // unique per date+event
  eventId: string;
  isRecurring: boolean;
  originalDate: string; // YYYY-MM-DD
  date: string; // effective YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  title: string;
  subjectId?: string;
  subjectName?: string;
  categoryId: string;
  location?: string;
  instructor?: string;
  notes?: string;
  isCancelled: boolean;
  isModified: boolean;
  isRescheduled: boolean;
  exceptionId?: string;
  sourceEvent: TimetableEvent;
}

export type InternshipSource =
  | 'LinkedIn'
  | 'Indeed'
  | 'Internshala'
  | 'Company Website'
  | 'Referral'
  | 'Other';

export type InternshipStatus =
  | 'Saved'
  | 'Applied'
  | 'Under Consideration'
  | 'Assessment'
  | 'Interview Scheduled'
  | 'Interview Completed'
  | 'Offer Received'
  | 'Rejected'
  | 'Withdrawn';

export interface InternshipHistoryEntry {
  id: string;
  timestamp: string;
  fromStatus?: InternshipStatus;
  toStatus: InternshipStatus;
  note?: string;
}

export interface InternshipApplication {
  id: string;
  company: string;
  position: string;
  source: InternshipSource;
  dateApplied?: string; // YYYY-MM-DD
  status: InternshipStatus;
  jobUrl?: string;
  location?: string;
  contactDetails?: string;
  followUpDate?: string; // YYYY-MM-DD
  notes: string;
  history: InternshipHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export type ActivityType =
  | 'Extracurricular'
  | 'Club'
  | 'Personal Project'
  | 'One-off Event';

export type ActivityStatus = 'Active' | 'Upcoming' | 'Completed' | 'Paused';

export interface Activity {
  id: string;
  title: string;
  type: ActivityType;
  isRecurring: boolean;
  cadence?: string;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:mm
  role?: string;
  description: string;
  status: ActivityStatus;
  createdAt: string;
  updatedAt: string;
}

export type HabitFrequency =
  | 'daily'
  | 'weekly'
  | 'twice_a_week'
  | 'custom_weekly'
  | 'every_2_weeks'
  | 'monthly'
  | 'custom_monthly'
  | 'every_2_months'
  | 'custom_interval';

export interface Habit {
  id: string;
  name: string;
  category: string;
  frequency?: HabitFrequency; // defaults to 'daily' for backward compatibility
  targetCount?: number; // target completions per period
  intervalDays?: number; // used when frequency === 'custom_interval'
  customLabel?: string; // optional label for custom schedule
  targetDaysPerWeek: number; // legacy field kept for compatibility
  color: PastelToken;
  createdAt: string;
  updatedAt: string;
}

export interface HabitLog {
  id: string; // `${habitId}_${date}`
  habitId: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
  updatedAt: string;
}

export interface AppSettings {
  id: 'app_settings';
  userName: string;
  semesterLabel?: string;
  theme: 'light' | 'dark';
  showSundayInTimetable: boolean;
  timetableExpandedHours: boolean;
  eventCategories: EventCategoryConfig[];
  updatedAt: string;
}

export interface BackupDataBundle {
  goals: Goal[];
  goal_weekly_checkins: GoalWeeklyCheckin[];
  weekly_reviews: WeeklyReview[];
  subjects: Subject[];
  assignments: Assignment[];
  attendance_records: AttendanceRecord[];
  timetable_events: TimetableEvent[];
  timetable_exceptions: TimetableException[];
  internship_applications: InternshipApplication[];
  activities: Activity[];
  habits: Habit[];
  habit_logs: HabitLog[];
  settings: AppSettings[];
}

export interface FullBackupPayload {
  app: 'Little Life HQ';
  backupFormatVersion: '1.0';
  schemaVersion: number;
  exportedAt: string;
  data: BackupDataBundle;
}

export interface BackupBeforeAfterCounts {
  before: Record<string, number>;
  after: Record<keyof BackupDataBundle, number>;
  eventCategoriesCount: number;
  totalBefore: number;
  totalAfterRecords: number;
  totalAfterItemsIncludingCategories: number;
}

export interface BackupFieldAudit {
  preserved: string[];
  transformed: string[];
  defaulted: string[];
  dropped: string[];
}

export interface BackupPreviewSummary {
  valid: boolean;
  error?: string;
  validationErrors?: string[];
  payload?: FullBackupPayload;
  exportedAt?: string;
  schemaVersion?: number;
  convertedFromLegacyV3?: boolean;
  warnings?: string[];
  beforeAfterCounts?: BackupBeforeAfterCounts;
  fieldAudit?: BackupFieldAudit;
  counts: Record<keyof BackupDataBundle, number>;
  conflictingIdsCount: number;
  hasExistingData: boolean;
}
