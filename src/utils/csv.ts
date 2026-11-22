import {
  Assignment,
  EventCategoryConfig,
  InternshipApplication,
  Subject,
  TimetableEvent,
} from '../types/models';

function escapeCsvCell(value: string | number | boolean | undefined | null): string {
  const str = value === undefined || value === null ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsv(headers: string[], rows: Array<Array<string | number | boolean | undefined | null>>): string {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];
  return lines.join('\r\n');
}

export function triggerFileDownload(filename: string, content: string, mimeType: string): boolean {
  const blob = new Blob([content], {type: mimeType});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

export function exportInternshipsCsv(apps: InternshipApplication[], dateStr: string): boolean {
  const headers = [
    'Company',
    'Position',
    'Source',
    'Status',
    'Date Applied',
    'Follow-up Date',
    'Location',
    'Job URL',
    'Contact Details',
    'Notes',
    'Last Updated',
  ];
  const rows = apps.map((a) => [
    a.company,
    a.position,
    a.source,
    a.status,
    a.dateApplied ?? '',
    a.followUpDate ?? '',
    a.location ?? '',
    a.jobUrl ?? '',
    a.contactDetails ?? '',
    a.notes,
    a.updatedAt,
  ]);
  return triggerFileDownload(
    `LittleLifeHQ_Internships_${dateStr}.csv`,
    buildCsv(headers, rows),
    'text/csv;charset=utf-8;'
  );
}

export function exportAssignmentsCsv(
  assignments: Assignment[],
  subjects: Subject[],
  dateStr: string
): boolean {
  const subjectMap = new Map(subjects.map((s) => [s.id, s.name]));
  const headers = ['Title', 'Subject', 'Due Date', 'Priority', 'Status', 'Description', 'Last Updated'];
  const rows = assignments.map((a) => [
    a.title,
    subjectMap.get(a.subjectId) ?? 'Unassigned',
    a.dueDate,
    a.priority,
    a.status,
    a.description,
    a.updatedAt,
  ]);
  return triggerFileDownload(
    `LittleLifeHQ_Assignments_${dateStr}.csv`,
    buildCsv(headers, rows),
    'text/csv;charset=utf-8;'
  );
}

export function exportTimetableCsv(
  events: TimetableEvent[],
  categories: EventCategoryConfig[],
  dateStr: string
): boolean {
  const catMap = new Map(categories.map((c) => [c.id, c.name]));
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const headers = [
    'Title',
    'Type',
    'Category',
    'Subject',
    'Day / Date',
    'Start Time',
    'End Time',
    'Location',
    'Instructor',
    'Recurrence Start',
    'Recurrence End',
    'Notes',
  ];
  const rows = events.map((e) => [
    e.title,
    e.isRecurring ? 'Recurring' : 'One-time',
    catMap.get(e.categoryId) ?? e.categoryId,
    e.subjectName ?? '',
    e.isRecurring ? (e.dayOfWeek !== undefined ? dayNames[e.dayOfWeek] : '') : (e.date ?? ''),
    e.startTime,
    e.endTime,
    e.location ?? '',
    e.instructor ?? '',
    e.recurrenceStartDate ?? '',
    e.recurrenceEndDate ?? '',
    e.notes ?? '',
  ]);
  return triggerFileDownload(
    `LittleLifeHQ_Timetable_${dateStr}.csv`,
    buildCsv(headers, rows),
    'text/csv;charset=utf-8;'
  );
}
