import React, {useEffect, useRef, useState} from 'react';
import {
  AlertTriangle,
  Download,
  FileSpreadsheet,
  FolderUp,
  Moon,
  ShieldCheck,
  Sun,
  Trash2,
} from 'lucide-react';
import {useApp} from '../context/AppContext';
import {repository} from '../db/repository';
import {ConfirmDialog} from '../components/ui/ConfirmDialog';
import {Modal} from '../components/ui/Modal';
import {BackupPreviewSummary} from '../types/models';
import {
  exportAssignmentsCsv,
  exportInternshipsCsv,
  exportTimetableCsv,
  triggerFileDownload,
} from '../utils/csv';
import {getTodayStr} from '../utils/date';

export const SettingsPage: React.FC = () => {
  const {
    settings,
    updateSettings,
    goals,
    subjects,
    assignments,
    timetableEvents,
    internshipApplications,
    activities,
    habits,
    mergeBackup,
    replaceWithBackup,
    resetAllData,
    showToast,
  } = useApp();

  const [userNameDraft, setUserNameDraft] = useState(settings.userName);
  const [semesterDraft, setSemesterDraft] = useState(settings.semesterLabel ?? 'Current Semester');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<BackupPreviewSummary | null>(null);
  const [replaceConfirmOpen, setReplaceConfirmOpen] = useState(false);

  // Reset confirmation
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');

  useEffect(() => {
    setUserNameDraft(settings.userName);
    setSemesterDraft(settings.semesterLabel ?? 'Current Semester');
  }, [settings.userName, settings.semesterLabel]);

  const handleSavePrefs = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSettings({
      userName: userNameDraft.trim() || 'Friend',
      semesterLabel: semesterDraft.trim() || 'Current Semester',
    });
    showToast('Preferences saved.');
  };

  const handleDownloadFullBackup = async () => {
    try {
      const payload = await repository.createBackupPayload();
      const json = JSON.stringify(payload, null, 2);
      const ok = triggerFileDownload(
        `LittleLifeHQ_Backup_${getTodayStr()}.json`,
        json,
        'application/json'
      );
      if (ok) {
        showToast('Full backup downloaded.');
      }
    } catch {
      showToast('Failed to generate backup file.', 'error');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const summary = await repository.inspectBackupFile(text);
      setPreview(summary);
      if (!summary.valid) {
        showToast(summary.error ?? 'Invalid backup file.', 'error');
      }
    } catch {
      showToast('Could not read the selected file.', 'error');
    } finally {
      e.target.value = '';
    }
  };

  const handleMergeRestore = async () => {
    if (!preview?.valid || !preview.payload) return;
    try {
      const result = await mergeBackup(preview.payload);
      setPreview(null);
      const catNote =
        result.addedCategories > 0 ? `, ${result.addedCategories} categories added` : '';
      showToast(
        `Merged backup: ${result.added} added${catNote}, ${result.skipped} existing preserved.`
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to merge backup.', 'error');
    }
  };

  const handleReplaceRestore = async () => {
    if (!preview?.valid || !preview.payload) return;
    try {
      await replaceWithBackup(preview.payload);
      setPreview(null);
      showToast('Application data replaced from backup.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to replace data from backup.', 'error');
    }
  };

  const handleResetAll = async () => {
    if (resetConfirmText.trim().toUpperCase() !== 'RESET') return;
    await resetAllData();
    setUserNameDraft('Friend');
    setSemesterDraft('Current Semester');
    setResetConfirmText('');
    setResetModalOpen(false);
    showToast('All application data has been cleared.');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#1F1929] dark:text-white">
          Settings &amp; Backups
        </h1>
        <p className="text-sm text-[#685E75] dark:text-[#AFA6C2] mt-1">
          Personalise your journal preferences or back up and restore your local browser storage.
        </p>
      </div>

      {/* Application Preferences */}
      <form
        onSubmit={handleSavePrefs}
        className="p-6 rounded-3xl border border-[#ECE4DF] dark:border-[#322C42] bg-white dark:bg-[#1E1A2A] journal-card space-y-5"
      >
        <h2 className="font-display text-lg font-bold text-[#1F1929] dark:text-white">
          Application Preferences
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1.5">
              Your name (for Home greeting)
            </label>
            <input
              type="text"
              value={userNameDraft}
              onChange={(e) => setUserNameDraft(e.target.value)}
              placeholder="Your name"
              className="w-full px-4 py-2.5 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1.5">
              Current term / semester label
            </label>
            <input
              type="text"
              value={semesterDraft}
              onChange={(e) => setSemesterDraft(e.target.value)}
              placeholder="e.g. Current Semester / Fall 2026"
              className="w-full px-4 py-2.5 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
          <div>
            <span className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1.5">
              Appearance theme
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => updateSettings({theme: 'light'})}
                className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl border text-xs font-bold transition-colors ${
                  settings.theme === 'light'
                    ? 'bg-[#FEF9E6] border-[#F3DF9B] text-[#735714]'
                    : 'bg-white dark:bg-[#16141D] border-[#ECE4DF] dark:border-[#39334B] text-[#5A506B] dark:text-[#C5BDD4] hover:bg-[#FAF7F5]'
                }`}
              >
                <Sun className="w-4 h-4 text-[#E6A817]" />
                <span>Light</span>
              </button>
              <button
                type="button"
                onClick={() => updateSettings({theme: 'dark'})}
                className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl border text-xs font-bold transition-colors ${
                  settings.theme === 'dark'
                    ? 'bg-[#2F2547] border-[#4D3D75] text-[#DDD0FA]'
                    : 'bg-white dark:bg-[#16141D] border-[#ECE4DF] dark:border-[#39334B] text-[#5A506B] dark:text-[#C5BDD4] hover:bg-[#FAF7F5]'
                }`}
              >
                <Moon className="w-4 h-4" />
                <span>Dark</span>
              </button>
            </div>
          </div>

          <div className="space-y-2.5 pt-1 sm:pt-6">
            <label className="flex items-center gap-2 text-xs font-semibold text-[#4A4158] dark:text-[#D5CEE3] cursor-pointer">
              <input
                type="checkbox"
                checked={settings.showSundayInTimetable}
                onChange={(e) => updateSettings({showSundayInTimetable: e.target.checked})}
                className="rounded accent-[#7B4CE2]"
              />
              <span>Show Sunday in Weekly Timetable by default</span>
            </label>

            <label className="flex items-center gap-2 text-xs font-semibold text-[#4A4158] dark:text-[#D5CEE3] cursor-pointer">
              <input
                type="checkbox"
                checked={settings.timetableExpandedHours}
                onChange={(e) => updateSettings({timetableExpandedHours: e.target.checked})}
                className="rounded accent-[#7B4CE2]"
              />
              <span>Show Full Day hours (6:30 AM – 10:00 PM) by default</span>
            </label>
          </div>
        </div>

        <div className="pt-1">
          <button
            type="submit"
            className="px-5 py-2.5 rounded-full text-xs font-bold bg-[#7B4CE2] hover:bg-[#6A3CD1] text-white shadow-sm shadow-[#7B4CE2]/25 transition-colors"
          >
            Save preferences
          </button>
        </div>
      </form>

      {/* Backups & Exports */}
      <section className="p-6 rounded-3xl border border-[#ECE4DF] dark:border-[#322C42] bg-white dark:bg-[#1E1A2A] journal-card space-y-5">
        <div>
          <h2 className="font-display text-lg font-bold text-[#1F1929] dark:text-white">
            Backups &amp; Exports
          </h2>
          <p className="text-xs text-[#685E75] dark:text-[#AFA6C2] mt-1 tabular-nums">
            Currently stored locally: {goals.length} goals · {subjects.length} subjects ·{' '}
            {assignments.length} assignments · {internshipApplications.length} internships ·{' '}
            {activities.length} activities · {habits.length} habits.
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Lavender Export JSON */}
          <button
            type="button"
            onClick={handleDownloadFullBackup}
            className="p-5 rounded-3xl border border-[#DFD2FC] dark:border-[#4D3D75] bg-[#F6F1FE] dark:bg-[#2F2547] hover:brightness-[0.98] text-left transition-all space-y-2"
          >
            <Download className="w-5 h-5 text-[#6D4AE2] dark:text-[#DDD0FA]" />
            <h3 className="text-sm font-bold text-[#1F1929] dark:text-white">
              Export all data (JSON)
            </h3>
            <p className="text-xs text-[#5A506B] dark:text-[#C5BDD4] leading-relaxed">
              Download a full backup of all IndexedDB stores, goals, classes, and preferences.
            </p>
          </button>

          {/* Card 2: Butter Yellow Individual CSV Exports */}
          <div className="p-5 rounded-3xl border border-[#F3DF9B] dark:border-[#6B5B2C] bg-[#FEFBE9] dark:bg-[#3F361C] space-y-3">
            <div className="space-y-1">
              <FileSpreadsheet className="w-5 h-5 text-[#9A6F0C] dark:text-[#F8E7B0]" />
              <h3 className="text-sm font-bold text-[#1F1929] dark:text-white">
                Individual CSV spreadsheets
              </h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  exportInternshipsCsv(internshipApplications, getTodayStr());
                  showToast('Internship applications CSV downloaded.');
                }}
                className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/90 dark:bg-[#262233] border border-[#EBD692] dark:border-[#6B5B2C] text-[#735714] dark:text-[#F8E7B0] hover:bg-white"
              >
                Internships ({internshipApplications.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  exportAssignmentsCsv(assignments, subjects, getTodayStr());
                  showToast('Academic assignments CSV downloaded.');
                }}
                className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/90 dark:bg-[#262233] border border-[#EBD692] dark:border-[#6B5B2C] text-[#735714] dark:text-[#F8E7B0] hover:bg-white"
              >
                Assignments ({assignments.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  exportTimetableCsv(timetableEvents, settings.eventCategories, getTodayStr());
                  showToast('Timetable events CSV downloaded.');
                }}
                className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/90 dark:bg-[#262233] border border-[#EBD692] dark:border-[#6B5B2C] text-[#735714] dark:text-[#F8E7B0] hover:bg-white"
              >
                Timetable ({timetableEvents.length})
              </button>
            </div>
          </div>

          {/* Card 3: Sky Blue Import JSON Backup */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-5 rounded-3xl border border-[#C3E2FC] dark:border-[#365B7D] bg-[#EFF7FE] dark:bg-[#1F3447] hover:brightness-[0.98] text-left transition-all space-y-2"
          >
            <FolderUp className="w-5 h-5 text-[#1D67A8] dark:text-[#C4E2FC]" />
            <h3 className="text-sm font-bold text-[#1F1929] dark:text-white">
              Import JSON backup
            </h3>
            <p className="text-xs text-[#5A506B] dark:text-[#C5BDD4] leading-relaxed">
              Restore or merge a previously exported Little Life HQ backup file.
            </p>
          </button>
        </div>

        {preview && (
          <div className="p-5 rounded-3xl border border-[#D7C6F7] dark:border-[#4D3D75] bg-[#FAF7FF] dark:bg-[#241F33] space-y-3">
            {!preview.valid ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[#D9385A] dark:text-[#F8A5AE]">
                    {preview.error}
                  </p>
                  <button
                    type="button"
                    onClick={() => setPreview(null)}
                    className="text-xs font-semibold underline text-[#685E75]"
                  >
                    Dismiss
                  </button>
                </div>
                {preview.validationErrors && preview.validationErrors.length > 0 && (
                  <div className="p-3 rounded-2xl bg-[#FFF2F4] dark:bg-[#3B1F25] text-xs text-[#8C2D36] dark:text-[#F8C8CE] space-y-1 max-h-48 overflow-y-auto">
                    <p className="font-bold">
                      Rejected due to {preview.validationErrors.length} validation error(s):
                    </p>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {preview.validationErrors.map((errMsg, idx) => (
                        <li key={idx}>{errMsg}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-[#1F1929] dark:text-white">
                        Backup Preview Ready
                      </h3>
                      {preview.convertedFromLegacyV3 && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#EDE3FE] dark:bg-[#3A2E5C] text-[#5B35B5] dark:text-[#DDD0FA]">
                          Converted from Schema v3
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#685E75] dark:text-[#AFA6C2] tabular-nums mt-0.5">
                      Exported:{' '}
                      {preview.exportedAt
                        ? new Date(preview.exportedAt).toLocaleString()
                        : 'Unknown'}{' '}
                      · Schema v{preview.schemaVersion}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreview(null)}
                    className="text-xs font-semibold underline text-[#685E75]"
                  >
                    Dismiss
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs tabular-nums">
                  <div className="p-2.5 rounded-2xl bg-white dark:bg-[#1E1A2A]">
                    Goals: <strong>{preview.counts.goals}</strong>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-white dark:bg-[#1E1A2A]">
                    Timetable: <strong>{preview.counts.timetable_events}</strong>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-white dark:bg-[#1E1A2A]">
                    Exceptions: <strong>{preview.counts.timetable_exceptions}</strong>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-white dark:bg-[#1E1A2A]">
                    Subjects: <strong>{preview.counts.subjects}</strong>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-white dark:bg-[#1E1A2A]">
                    Assignments: <strong>{preview.counts.assignments}</strong>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-white dark:bg-[#1E1A2A]">
                    Internships: <strong>{preview.counts.internship_applications}</strong>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-white dark:bg-[#1E1A2A]">
                    Activities: <strong>{preview.counts.activities}</strong>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-white dark:bg-[#1E1A2A]">
                    Habits / Logs:{' '}
                    <strong>
                      {preview.counts.habits} / {preview.counts.habit_logs}
                    </strong>
                  </div>
                </div>

                {preview.beforeAfterCounts && (
                  <div className="p-3 rounded-2xl bg-white/85 dark:bg-[#1E1A2A] text-xs text-[#4A4158] dark:text-[#D5CEE3] tabular-nums">
                    Before/After record count:{' '}
                    <strong>{preview.beforeAfterCounts.totalBefore}</strong> legacy records (14
                    stores) → <strong>{preview.beforeAfterCounts.totalAfterRecords}</strong> store
                    records + <strong>{preview.beforeAfterCounts.eventCategoriesCount}</strong>{' '}
                    event categories in settings (
                    <strong>
                      {preview.beforeAfterCounts.totalAfterItemsIncludingCategories}
                    </strong>{' '}
                    total preserved items).
                  </div>
                )}

                {preview.warnings && preview.warnings.length > 0 && (
                  <div className="p-3 rounded-2xl bg-[#FEF9E6] dark:bg-[#3F361C] text-xs text-[#735714] dark:text-[#F8E7B0] space-y-1 max-h-48 overflow-y-auto">
                    <p className="font-bold">
                      Conversion notices ({preview.warnings.length}):
                    </p>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {preview.warnings.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {(preview.hasExistingData || preview.conflictingIdsCount > 0) && (
                  <div className="flex items-start gap-2 p-3 rounded-2xl bg-[#FEF9E6] dark:bg-[#3F361C] text-xs text-[#735714] dark:text-[#F8E7B0]">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      You currently have existing records in this browser
                      {preview.conflictingIdsCount > 0
                        ? ` (${preview.conflictingIdsCount} matching IDs found)`
                        : ''}
                      . Choose <strong>Merge</strong> to keep existing records and preferences safe,
                      or <strong>Replace</strong> to overwrite everything transactionally.
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handleMergeRestore}
                    className="px-4 py-2 rounded-full text-xs font-bold bg-[#E4F7EE] dark:bg-[#1E3B2E] text-[#1D6344] dark:text-[#BFEFD9] border border-[#B8E8D2] dark:border-[#32634D]"
                  >
                    Merge with Existing Data
                  </button>
                  <button
                    type="button"
                    onClick={() => setReplaceConfirmOpen(true)}
                    className="px-4 py-2 rounded-full text-xs font-bold bg-[#FDE8E8] dark:bg-[#442327] text-[#8C2D36] dark:text-[#F8C8CE] border border-[#F6C5CA] dark:border-[#703940]"
                  >
                    Replace Existing Data
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </section>

      {/* 100% Private Local Browser Storage Banner */}
      <section className="p-5 sm:p-6 rounded-3xl border border-[#DFD2FC] dark:border-[#4D3D75] bg-[#F6F1FE] dark:bg-[#27203B] flex items-start gap-3.5">
        <div className="p-2 rounded-xl bg-white/80 dark:bg-[#352B4F] text-[#6D4AE2] dark:text-[#DDD0FA] shrink-0">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-[#1F1929] dark:text-white">
            100% Private Local Browser Storage
          </h2>
          <p className="text-xs text-[#5A506B] dark:text-[#C5BDD4] leading-relaxed">
            All goals, academic records, timetable events, internships, activities, and habits stay
            inside IndexedDB in your browser. Little Life HQ sends zero personal data to external
            servers and includes zero analytics or tracking scripts.
          </p>
        </div>
      </section>

      {/* Danger Zone: Clear All Application Data */}
      <section className="p-5 sm:p-6 rounded-3xl border border-[#F6C5CA] dark:border-[#6B333A] bg-[#FFF5F7] dark:bg-[#2B1B1E] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-[#C9184A] dark:text-[#F8C8CE]">
            Clear All Application Data
          </h2>
          <p className="text-xs text-[#733A41] dark:text-[#E5B8BD]">
            Permanently erase all records from IndexedDB in this browser and reset to initial
            defaults.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setResetConfirmText('');
            setResetModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold bg-[#D9043D] hover:bg-[#B80334] text-white shrink-0 self-start sm:self-auto transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear all data</span>
        </button>
      </section>

      <ConfirmDialog
        open={replaceConfirmOpen}
        onClose={() => setReplaceConfirmOpen(false)}
        onConfirm={handleReplaceRestore}
        title="Replace All Existing Data?"
        description="This will overwrite every record currently stored in Little Life HQ with the selected backup file. We strongly recommend downloading a fresh backup first."
        confirmLabel="Yes, Replace All Data"
        extraAction={
          <button
            type="button"
            onClick={handleDownloadFullBackup}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-[#F4EFF8] dark:bg-[#282435] text-[#4C3482] dark:text-[#DDD0FA]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Current Backup First</span>
          </button>
        }
      />

      <Modal
        open={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        title="Confirm Full Data Reset"
        maxWidthClass="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-[#4A4158] dark:text-[#D5CEE3]">
            This action permanently deletes all goals, timetable events, subjects, assignments,
            attendance, internships, activities, and habit logs from IndexedDB. Type{' '}
            <strong>RESET</strong> below to continue.
          </p>
          <input
            type="text"
            value={resetConfirmText}
            onChange={(e) => setResetConfirmText(e.target.value)}
            placeholder="Type RESET"
            className="w-full px-3.5 py-2.5 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm font-mono"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setResetModalOpen(false)}
              className="px-4 py-2 rounded-full text-sm font-semibold border border-[#E4DCD7] dark:border-[#39334B]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={resetConfirmText.trim().toUpperCase() !== 'RESET'}
              onClick={handleResetAll}
              className="px-5 py-2 rounded-full text-sm font-bold bg-[#D9043D] hover:bg-[#B80334] disabled:opacity-40 text-white"
            >
              Erase Everything
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
