import React, {createContext, useCallback, useContext, useEffect, useState} from 'react';
import {DEFAULT_SETTINGS, repository} from '../db/repository';
import {
  areAllStoresEmpty,
  replaceAllStoresTransactional,
  STORE_NAMES,
  type StoreName,
} from '../db/database';
import {DEMO_BACKUP} from '../db/demoData';
import {
  Activity,
  AppSettings,
  Assignment,
  AttendanceRecord,
  FullBackupPayload,
  Goal,
  GoalWeeklyCheckin,
  Habit,
  HabitLog,
  InternshipApplication,
  NavPage,
  Subject,
  TimetableEvent,
  TimetableException,
  WeeklyReview,
} from '../types/models';
import {generateId} from '../utils/id';

export interface ToastItem {
  id: string;
  message: string;
  variant: 'success' | 'error' | 'info';
}

interface AppContextValue {
  loading: boolean;
  activePage: NavPage;
  setActivePage: (page: NavPage) => void;
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
  toasts: ToastItem[];
  showToast: (message: string, variant?: 'success' | 'error' | 'info') => void;
  dismissToast: (id: string) => void;
  refreshAll: () => Promise<void>;

  // Mutations
  saveGoal: (goal: Goal) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  saveGoalCheckin: (checkin: GoalWeeklyCheckin) => Promise<void>;
  saveWeeklyReview: (review: WeeklyReview) => Promise<void>;

  saveSubject: (subject: Subject) => Promise<void>;
  deleteSubject: (id: string) => Promise<void>;
  saveAssignment: (assignment: Assignment) => Promise<void>;
  deleteAssignment: (id: string) => Promise<void>;
  saveAttendance: (record: AttendanceRecord) => Promise<void>;
  deleteAttendance: (id: string) => Promise<void>;

  saveTimetableEvent: (event: TimetableEvent) => Promise<void>;
  deleteTimetableEvent: (id: string) => Promise<void>;
  saveTimetableException: (ex: TimetableException) => Promise<void>;
  deleteTimetableException: (id: string) => Promise<void>;
  cancelTimetableOccurrence: (eventId: string, originalDate: string) => Promise<TimetableException>;
  restoreTimetableOccurrence: (eventId: string, originalDate: string) => Promise<void>;

  saveInternship: (app: InternshipApplication) => Promise<void>;
  deleteInternship: (id: string) => Promise<void>;

  saveActivity: (activity: Activity) => Promise<void>;
  deleteActivity: (id: string) => Promise<void>;
  saveHabit: (habit: Habit) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;
  toggleHabitLog: (habitId: string, date: string) => Promise<void>;

  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  mergeBackup: (
    payload: FullBackupPayload
  ) => Promise<{added: number; updated: number; skipped: number; addedCategories: number}>;
  replaceWithBackup: (payload: FullBackupPayload) => Promise<void>;
  resetAllData: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);
const DEMO_INITIALIZED_KEY = 'little-life-hq-demo-initialized-v1';

let demoInitializationPromise: Promise<void> | null = null;

const initializeDemoData = (): Promise<void> => {
  if (!demoInitializationPromise) {
    demoInitializationPromise = (async () => {
      if (localStorage.getItem(DEMO_INITIALIZED_KEY) === 'true') {
        return;
      }

      const isEmpty = await areAllStoresEmpty();

      if (!isEmpty) {
        localStorage.setItem(DEMO_INITIALIZED_KEY, 'true');
        return;
      }

      const recordsByStore = Object.fromEntries(
        STORE_NAMES.map((name) => [
          name,
          [...DEMO_BACKUP.data[name]],
        ])
      ) as Record<StoreName, unknown[]>;

      await replaceAllStoresTransactional(recordsByStore);

      localStorage.setItem(DEMO_INITIALIZED_KEY, 'true');
    })().catch((error) => {
      demoInitializationPromise = null;
      throw error;
    });
  }

  return demoInitializationPromise;
};

export const AppProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState<NavPage>('home');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalWeeklyCheckins, setGoalWeeklyCheckins] = useState<GoalWeeklyCheckin[]>([]);
  const [weeklyReviews, setWeeklyReviews] = useState<WeeklyReview[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [timetableEvents, setTimetableEvents] = useState<TimetableEvent[]>([]);
  const [timetableExceptions, setTimetableExceptions] = useState<TimetableException[]>([]);
  const [internshipApplications, setInternshipApplications] = useState<InternshipApplication[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: 'success' | 'error' | 'info' = 'success') => {
      const id = generateId();
      setToasts((prev) => [...prev, {id, message, variant}]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3600);
    },
    []
  );

  const refreshAll = useCallback(async () => {
    try {
      const data = await repository.loadAllData();
      setGoals(data.goals);
      setGoalWeeklyCheckins(data.goalWeeklyCheckins);
      setWeeklyReviews(data.weeklyReviews);
      setSubjects(data.subjects);
      setAssignments(data.assignments);
      setAttendanceRecords(data.attendanceRecords);
      setTimetableEvents(data.timetableEvents);
      setTimetableExceptions(data.timetableExceptions);
      setInternshipApplications(data.internshipApplications);
      setActivities(data.activities);
      setHabits(data.habits);
      setHabitLogs(data.habitLogs);
      setSettings(data.settings);
    } catch {
      showToast('Could not read local IndexedDB storage.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

useEffect(() => {
  const startApp = async () => {
    try {
      await initializeDemoData();
    } catch {
      showToast('Could not initialize demo data.', 'error');
    }

    await refreshAll();
  };

  startApp();
}, [refreshAll, showToast]);
  useEffect(() => {
    const isDark = settings.theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
  }, [settings.theme]);

  const upsertById = <T extends {id: string}>(list: T[], item: T): T[] => {
    const exists = list.some((x) => x.id === item.id);
    return exists ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];
  };

  const saveGoal = async (goal: Goal) => {
    await repository.saveGoal(goal);
    setGoals((prev) => upsertById(prev, goal));
  };

  const deleteGoal = async (id: string) => {
    await repository.deleteGoal(id);
    setGoals((prev) => prev.filter((g) => g.id !== id));
    setGoalWeeklyCheckins((prev) => prev.filter((c) => c.goalId !== id));
  };

  const saveGoalCheckin = async (checkin: GoalWeeklyCheckin) => {
    await repository.saveGoalCheckin(checkin);
    setGoalWeeklyCheckins((prev) => upsertById(prev, checkin));
  };

  const saveWeeklyReview = async (review: WeeklyReview) => {
    await repository.saveWeeklyReview(review);
    setWeeklyReviews((prev) => upsertById(prev, review));
  };

  const saveSubject = async (subject: Subject) => {
    await repository.saveSubject(subject);
    setSubjects((prev) => upsertById(prev, subject));
  };

  const deleteSubject = async (id: string) => {
    await repository.deleteSubject(id);
    setSubjects((prev) => prev.filter((s) => s.id !== id));
    setAssignments((prev) => prev.filter((a) => a.subjectId !== id));
    setAttendanceRecords((prev) => prev.filter((r) => r.subjectId !== id));
  };

  const saveAssignment = async (assignment: Assignment) => {
    await repository.saveAssignment(assignment);
    setAssignments((prev) => upsertById(prev, assignment));
  };

  const deleteAssignment = async (id: string) => {
    await repository.deleteAssignment(id);
    setAssignments((prev) => prev.filter((a) => a.id !== id));
  };

  const saveAttendance = async (record: AttendanceRecord) => {
    await repository.saveAttendance(record);
    setAttendanceRecords((prev) => upsertById(prev, record));
  };

  const deleteAttendance = async (id: string) => {
    await repository.deleteAttendance(id);
    setAttendanceRecords((prev) => prev.filter((r) => r.id !== id));
  };

  const saveTimetableEvent = async (event: TimetableEvent) => {
    await repository.saveTimetableEvent(event);
    setTimetableEvents((prev) => upsertById(prev, event));
  };

  const deleteTimetableEvent = async (id: string) => {
    await repository.deleteTimetableEvent(id);
    setTimetableEvents((prev) => prev.filter((e) => e.id !== id));
    setTimetableExceptions((prev) => prev.filter((ex) => ex.eventId !== id));
  };

  const saveTimetableException = async (ex: TimetableException) => {
    await repository.saveTimetableException(ex);
    setTimetableExceptions((prev) => upsertById(prev, ex));
  };

  const deleteTimetableException = async (id: string) => {
    await repository.deleteTimetableException(id);
    setTimetableExceptions((prev) => prev.filter((ex) => ex.id !== id));
  };

  const cancelTimetableOccurrence = async (eventId: string, originalDate: string) => {
    const record = await repository.cancelTimetableOccurrence(eventId, originalDate);
    setTimetableExceptions((prev) => upsertById(prev, record));
    return record;
  };

  const restoreTimetableOccurrence = async (eventId: string, originalDate: string) => {
    await repository.restoreTimetableOccurrence(eventId, originalDate);
    setTimetableExceptions((prev) =>
      prev.filter((ex) => !(ex.eventId === eventId && ex.originalDate === originalDate))
    );
  };

  const saveInternship = async (app: InternshipApplication) => {
    await repository.saveInternship(app);
    setInternshipApplications((prev) => upsertById(prev, app));
  };

  const deleteInternship = async (id: string) => {
    await repository.deleteInternship(id);
    setInternshipApplications((prev) => prev.filter((a) => a.id !== id));
  };

  const saveActivity = async (activity: Activity) => {
    await repository.saveActivity(activity);
    setActivities((prev) => upsertById(prev, activity));
  };

  const deleteActivity = async (id: string) => {
    await repository.deleteActivity(id);
    setActivities((prev) => prev.filter((a) => a.id !== id));
  };

  const saveHabit = async (habit: Habit) => {
    await repository.saveHabit(habit);
    setHabits((prev) => upsertById(prev, habit));
  };

  const deleteHabit = async (id: string) => {
    await repository.deleteHabit(id);
    setHabits((prev) => prev.filter((h) => h.id !== id));
    setHabitLogs((prev) => prev.filter((l) => l.habitId !== id));
  };

  const toggleHabitLog = async (habitId: string, date: string) => {
    const id = `${habitId}_${date}`;
    const existing = habitLogs.find((l) => l.id === id);
    const updated: HabitLog = {
      id,
      habitId,
      date,
      completed: !(existing?.completed ?? false),
      updatedAt: new Date().toISOString(),
    };
    await repository.saveHabitLog(updated);
    setHabitLogs((prev) => upsertById(prev, updated));
  };

  const updateSettings = async (partial: Partial<AppSettings>) => {
    const next: AppSettings = {
      ...settings,
      ...partial,
      id: 'app_settings',
      updatedAt: new Date().toISOString(),
    };
    await repository.saveSettings(next);
    setSettings(next);
  };

  const mergeBackup = async (payload: FullBackupPayload) => {
    const summary = await repository.mergeBackup(payload);
    await refreshAll();
    return summary;
  };

  const replaceWithBackup = async (payload: FullBackupPayload) => {
    await repository.replaceWithBackup(payload);
    await refreshAll();
  };

const resetAllData = async () => {
  await repository.resetAllData();
  localStorage.setItem(DEMO_INITIALIZED_KEY, 'true');
  await refreshAll();
};

  return (
    <AppContext.Provider
      value={{
        loading,
        activePage,
        setActivePage,
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
        toasts,
        showToast,
        dismissToast,
        refreshAll,
        saveGoal,
        deleteGoal,
        saveGoalCheckin,
        saveWeeklyReview,
        saveSubject,
        deleteSubject,
        saveAssignment,
        deleteAssignment,
        saveAttendance,
        deleteAttendance,
        saveTimetableEvent,
        deleteTimetableEvent,
        saveTimetableException,
        deleteTimetableException,
        cancelTimetableOccurrence,
        restoreTimetableOccurrence,
        saveInternship,
        deleteInternship,
        saveActivity,
        deleteActivity,
        saveHabit,
        deleteHabit,
        toggleHabitLog,
        updateSettings,
        mergeBackup,
        replaceWithBackup,
        resetAllData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used inside AppProvider');
  }
  return ctx;
}
