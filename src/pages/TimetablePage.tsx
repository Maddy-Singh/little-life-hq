import React, {useMemo, useState} from 'react';
import {
  Ban,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit3,
  List,
  MapPin,
  Palette,
  Plus,
  RotateCcw,
  Trash2,
  User,
} from 'lucide-react';
import {useApp} from '../context/AppContext';
import {TimetableEventModal} from '../components/timetable/TimetableEventModal';
import {ConfirmDialog} from '../components/ui/ConfirmDialog';
import {EmptyState} from '../components/ui/EmptyState';
import {Modal} from '../components/ui/Modal';
import {
  EventCategoryConfig,
  PastelToken,
  ResolvedTimetableOccurrence,
  TimetableException,
} from '../types/models';
import {
  addDays,
  formatShortDate,
  formatTime12h,
  formatWeekRange,
  formatWeekdayShort,
  getTodayStr,
  getWeekDates,
  getWeekStartMonday,
  timeToMinutes,
} from '../utils/date';
import {generateId} from '../utils/id';
import {PASTEL_KEYS, PASTEL_PALETTE} from '../utils/theme';
import {resolveOccurrencesForRange} from '../utils/timetable';

const START_MIN = 6 * 60 + 30; // 6:30 AM = 390
const DEFAULT_END_MIN = 14 * 60; // 2:00 PM = 840
const FULL_END_MIN = 22 * 60; // 10:00 PM = 1320
const PX_PER_MIN = 1.25; // 75px per hour

interface PositionedOccurrence {
  occ: ResolvedTimetableOccurrence;
  lane: number;
  totalLanes: number;
}

function layoutDayOccurrences(items: ResolvedTimetableOccurrence[]): PositionedOccurrence[] {
  const sorted = [...items].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  );
  const placed: Array<{occ: ResolvedTimetableOccurrence; lane: number; endMin: number}> = [];
  const laneEnds: number[] = [];

  for (const occ of sorted) {
    const startMin = timeToMinutes(occ.startTime);
    const endMin = Math.max(startMin + 20, timeToMinutes(occ.endTime));
    let laneIdx = laneEnds.findIndex((end) => end <= startMin);
    if (laneIdx === -1) {
      laneIdx = laneEnds.length;
      laneEnds.push(endMin);
    } else {
      laneEnds[laneIdx] = endMin;
    }
    placed.push({occ, lane: laneIdx, endMin});
  }

  // Compute cluster lane count per item
  return placed.map((item) => {
    const sA = timeToMinutes(item.occ.startTime);
    const eA = item.endMin;
    let maxLane = item.lane;
    for (const other of placed) {
      const sB = timeToMinutes(other.occ.startTime);
      const eB = other.endMin;
      if (sA < eB && sB < eA) {
        maxLane = Math.max(maxLane, other.lane);
      }
    }
    return {
      occ: item.occ,
      lane: item.lane,
      totalLanes: maxLane + 1,
    };
  });
}

export const TimetablePage: React.FC = () => {
  const {
    timetableEvents,
    timetableExceptions,
    settings,
    updateSettings,
    cancelTimetableOccurrence,
    restoreTimetableOccurrence,
    deleteTimetableEvent,
    showToast,
  } = useApp();

  const todayStr = getTodayStr();
  const [weekStart, setWeekStart] = useState<string>(() => getWeekStartMonday(todayStr));
  const [viewMode, setViewMode] = useState<'grid' | 'agenda'>('grid');

  // Event creation / edit modal
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [modalInitialRecurring, setModalInitialRecurring] = useState(true);
  const [modalInitialDate, setModalInitialDate] = useState<string | undefined>(todayStr);
  const [editingOcc, setEditingOcc] = useState<ResolvedTimetableOccurrence | null>(null);

  // Occurrence inspection drawer/modal
  const [selectedOcc, setSelectedOcc] = useState<ResolvedTimetableOccurrence | null>(null);
  const [deleteSeriesTarget, setDeleteSeriesTarget] = useState<ResolvedTimetableOccurrence | null>(
    null
  );

  // Category editor modal
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catDraft, setCatDraft] = useState<EventCategoryConfig[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState<PastelToken>('mint');

  const weekDates = useMemo(
    () => getWeekDates(weekStart, settings.showSundayInTimetable),
    [weekStart, settings.showSundayInTimetable]
  );

  const weekOccurrences = useMemo(() => {
    const endStr = weekDates[weekDates.length - 1];
    return resolveOccurrencesForRange(timetableEvents, timetableExceptions, weekStart, endStr);
  }, [timetableEvents, timetableExceptions, weekStart, weekDates]);

  const hasLaterEvents = useMemo(() => {
    return weekOccurrences.some((o) => timeToMinutes(o.endTime) > DEFAULT_END_MIN);
  }, [weekOccurrences]);

  const endMin = settings.timetableExpandedHours ? FULL_END_MIN : DEFAULT_END_MIN;
  const gridHeightPx = (endMin - START_MIN) * PX_PER_MIN;

  const hourMarks = useMemo(() => {
    const marks: number[] = [START_MIN];
    for (let m = 7 * 60; m <= endMin; m += 60) {
      marks.push(m);
    }
    return marks;
  }, [endMin]);

  const getCategory = (catId: string): EventCategoryConfig => {
    return (
      settings.eventCategories.find((c) => c.id === catId) ?? {
        id: catId,
        name: 'Other',
        color: 'lavender',
      }
    );
  };

  const openAddModal = (recurring: boolean, date?: string) => {
    setEditingOcc(null);
    setModalInitialRecurring(recurring);
    setModalInitialDate(date ?? todayStr);
    setEventModalOpen(true);
  };

  const handleCancelOrReinstate = async (occ: ResolvedTimetableOccurrence) => {
    if (occ.isCancelled) {
      await restoreTimetableOccurrence(occ.eventId, occ.originalDate);
      showToast(`Restored "${occ.title}" on ${formatShortDate(occ.originalDate)}.`);
      setSelectedOcc(null);
      return;
    }

    await cancelTimetableOccurrence(occ.eventId, occ.originalDate);
    showToast(`Cancelled "${occ.title}" for ${formatShortDate(occ.originalDate)} only.`);
    setSelectedOcc(null);
  };

  const openCategoryEditor = () => {
    setCatDraft(settings.eventCategories.map((c) => ({...c})));
    setNewCatName('');
    setCatModalOpen(true);
  };

  const saveCategories = async () => {
    await updateSettings({eventCategories: catDraft});
    showToast('Event categories updated.');
    setCatModalOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#1F1929] dark:text-white">
            Weekly Timetable
          </h1>
          <p className="text-sm text-[#685E75] dark:text-[#AFA6C2] mt-1">
            Recurring college lectures, one-off meetings, and date-specific cancellations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openCategoryEditor}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold border border-[#E4DCD7] dark:border-[#39334B] bg-white dark:bg-[#1E1A2A] hover:bg-[#FAF7F5] dark:hover:bg-[#292536] shadow-2xs transition-colors whitespace-nowrap"
          >
            <Palette className="w-3.5 h-3.5 text-[#7B4CE2]" />
            <span>Categories</span>
          </button>

          <button
            type="button"
            onClick={() => openAddModal(false)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold border border-[#DFD2FC] dark:border-[#4D3D75] bg-[#F4EFFE] dark:bg-[#2F2547] text-[#6D4AE2] dark:text-[#DDD0FA] hover:opacity-90 transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Quick-Add One-Off Event</span>
          </button>

          <button
            type="button"
            onClick={() => openAddModal(true)}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-xs font-bold bg-[#7B4CE2] hover:bg-[#6A3CD1] text-white shadow-sm shadow-[#7B4CE2]/25 transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Recurring Class</span>
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-3xl border border-[#ECE4DF] dark:border-[#322C42] bg-white dark:bg-[#1E1A2A] journal-card">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            aria-label="Previous week"
            className="w-8 h-8 rounded-full border border-[#E4DCD7] dark:border-[#39334B] hover:bg-[#FAF7F5] dark:hover:bg-[#292536] inline-flex items-center justify-center"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-[#1F1929] dark:text-white px-2 tabular-nums">
            {formatWeekRange(weekStart, settings.showSundayInTimetable)}
          </span>
          <button
            type="button"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            aria-label="Next week"
            className="w-8 h-8 rounded-full border border-[#E4DCD7] dark:border-[#39334B] hover:bg-[#FAF7F5] dark:hover:bg-[#292536] inline-flex items-center justify-center"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(getWeekStartMonday(todayStr))}
            className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#EBF9F2] dark:bg-[#1E3B2E] text-[#1D744E] dark:text-[#BFEFD9]"
          >
            Current Week
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#5A506B] dark:text-[#C5BDD4] cursor-pointer px-2.5 py-1.5 rounded-xl bg-[#FAF7F5] dark:bg-[#262233]">
            <input
              type="checkbox"
              checked={settings.showSundayInTimetable}
              onChange={(e) => updateSettings({showSundayInTimetable: e.target.checked})}
              className="rounded accent-[#7F63D8]"
            />
            <span>Include Sunday</span>
          </label>

          <button
            type="button"
            onClick={() =>
              updateSettings({timetableExpandedHours: !settings.timetableExpandedHours})
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#E4DCD7] dark:border-[#39334B] hover:bg-[#F7F3FA] dark:hover:bg-[#292536] whitespace-nowrap"
          >
            <Clock className="w-3.5 h-3.5 text-[#5BA4E6]" />
            <span>
              {settings.timetableExpandedHours ? 'Full Day (6:30 AM – 10 PM)' : '6:30 AM – 2:00 PM'}
            </span>
          </button>

          <div className="inline-flex p-1 rounded-xl bg-[#F4EFF8] dark:bg-[#282435]">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-[#1F1C29] text-[#2D2638] dark:text-white shadow-xs'
                  : 'text-[#685E75] dark:text-[#AFA6C2]'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Grid</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('agenda')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                viewMode === 'agenda'
                  ? 'bg-white dark:bg-[#1F1C29] text-[#2D2638] dark:text-white shadow-xs'
                  : 'text-[#685E75] dark:text-[#AFA6C2]'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Agenda</span>
            </button>
          </div>
        </div>
      </div>

      {!settings.timetableExpandedHours && hasLaterEvents && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-[#FDF5D7] dark:bg-[#3F361C] border border-[#F3DF9B] dark:border-[#6B5B2C] text-xs font-semibold text-[#735714] dark:text-[#F8E7B0]">
          <span>You have events scheduled after 2:00 PM this week.</span>
          <button
            type="button"
            onClick={() => updateSettings({timetableExpandedHours: true})}
            className="underline font-bold whitespace-nowrap"
          >
            Show Full Day Hours
          </button>
        </div>
      )}

      {timetableEvents.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="w-6 h-6" />}
          title="Your weekly timetable is empty"
          description="Add your recurring college lectures or schedule one-off committee meetings, extra lectures, and study sessions."
          actionLabel="Add First Recurring Class"
          onAction={() => openAddModal(true)}
          tone="sky"
        />
      ) : viewMode === 'agenda' ? (
        <div className="space-y-3">
          {weekDates.map((d) => {
            const dayItems = weekOccurrences.filter((o) => o.date === d);
            const isToday = d === todayStr;
            return (
              <div
                key={d}
                className={`p-5 rounded-3xl border bg-white dark:bg-[#1E1A2A] journal-card ${
                  isToday
                    ? 'border-[#9D7CE8] dark:border-[#7B4CE2]'
                    : 'border-[#ECE4DF] dark:border-[#322C42]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-display font-bold text-sm text-[#2D2638] dark:text-white">
                      {formatWeekdayShort(d)} · {formatShortDate(d)}
                    </span>
                    {isToday && (
                      <span className="text-[11px] font-bold text-[#7F63D8] dark:text-[#C5B2F7]">
                        Today
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => openAddModal(false, d)}
                    className="text-xs font-semibold text-[#7F63D8] dark:text-[#C5B2F7] hover:underline"
                  >
                    + Add on {formatWeekdayShort(d)}
                  </button>
                </div>

                {dayItems.length === 0 ? (
                  <p className="text-xs text-[#7D728F] dark:text-[#9D94B0]">No events scheduled.</p>
                ) : (
                  <div className="space-y-2">
                    {dayItems.map((occ) => {
                      const cat = getCategory(occ.categoryId);
                      const palette = PASTEL_PALETTE[cat.color];
                      return (
                        <button
                          key={occ.occurrenceKey}
                          type="button"
                          onClick={() => setSelectedOcc(occ)}
                          className={`w-full text-left p-3 rounded-xl border transition-opacity flex items-center justify-between gap-3 ${
                            occ.isCancelled
                              ? 'bg-[#F5F3F7] dark:bg-[#262330] border-dashed border-[#CFC7DA] dark:border-[#49425B] opacity-70'
                              : `${palette.bg} ${palette.border} ${palette.text}`
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`text-sm font-bold ${
                                  occ.isCancelled ? 'line-through' : ''
                                }`}
                              >
                                {occ.title}
                              </span>
                              {occ.isCancelled && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/80 dark:bg-black/30">
                                  CANCELLED
                                </span>
                              )}
                              {occ.isRescheduled && !occ.isCancelled && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/70 dark:bg-black/25">
                                  RESCHEDULED
                                </span>
                              )}
                            </div>
                            <p className="text-xs opacity-85 mt-0.5">
                              {occ.subjectName || cat.name}
                              {occ.location ? ` · ${occ.location}` : ''}
                            </p>
                          </div>
                          <span className="text-xs font-mono tabular-nums shrink-0">
                            {formatTime12h(occ.startTime)} – {formatTime12h(occ.endTime)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Weekly Time Grid */
        <div className="rounded-3xl border border-[#ECE4DF] dark:border-[#322C42] bg-white dark:bg-[#1E1A2A] journal-card overflow-x-auto">
          <div className="min-w-[820px]">
            {/* Day Header Row */}
            <div
              className="grid border-b border-[#EFE8E3] dark:border-[#2E293D] bg-[#FAF7F5] dark:bg-[#242030]"
              style={{
                gridTemplateColumns: `76px repeat(${weekDates.length}, minmax(0, 1fr))`,
              }}
            >
              <div className="py-3 px-2 text-[11px] font-bold text-[#7D728F] dark:text-[#9D94B0] text-center">
                Time
              </div>
              {weekDates.map((d) => {
                const isToday = d === todayStr;
                return (
                  <div
                    key={d}
                    className={`py-3 px-2 text-center border-l border-[#EFE8E3] dark:border-[#2E293D] ${
                      isToday ? 'bg-[#EFE8FC]/60 dark:bg-[#2F2547]/60' : ''
                    }`}
                  >
                    <p
                      className={`text-xs font-bold ${
                        isToday
                          ? 'text-[#5B3EA8] dark:text-[#DDD0FA]'
                          : 'text-[#2D2638] dark:text-white'
                      }`}
                    >
                      {formatWeekdayShort(d)}
                    </p>
                    <p className="text-[11px] text-[#685E75] dark:text-[#AFA6C2] tabular-nums">
                      {formatShortDate(d)}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Grid Body */}
            <div
              className="grid relative"
              style={{
                gridTemplateColumns: `76px repeat(${weekDates.length}, minmax(0, 1fr))`,
                height: `${gridHeightPx}px`,
              }}
            >
              {/* Left Time Axis */}
              <div className="relative border-r border-[#EFE8E3] dark:border-[#2E293D]">
                {hourMarks.map((m) => {
                  const top = (m - START_MIN) * PX_PER_MIN;
                  const hh = String(Math.floor(m / 60)).padStart(2, '0');
                  const mm = String(m % 60).padStart(2, '0');
                  return (
                    <div
                      key={m}
                      className="absolute left-0 right-1 text-right pr-2 -translate-y-1/2 text-[11px] font-mono tabular-nums text-[#7D728F] dark:text-[#9D94B0]"
                      style={{top: `${top}px`}}
                    >
                      {formatTime12h(`${hh}:${mm}`).replace(':00 ', ' ')}
                    </div>
                  );
                })}
              </div>

              {/* Day Columns */}
              {weekDates.map((d) => {
                const dayItems = weekOccurrences.filter((o) => {
                  if (o.date !== d) return false;
                  const s = timeToMinutes(o.startTime);
                  const e = timeToMinutes(o.endTime);
                  return e > START_MIN && s < endMin;
                });
                const positioned = layoutDayOccurrences(dayItems);
                const isToday = d === todayStr;

                return (
                  <div
                    key={d}
                    className={`relative border-l border-[#EFE8E3] dark:border-[#2E293D] ${
                      isToday ? 'bg-[#FBF9FF] dark:bg-[#221E2E]' : ''
                    }`}
                  >
                    {/* Horizontal Hour Lines */}
                    {hourMarks.map((m) => (
                      <div
                        key={m}
                        className="absolute left-0 right-0 border-t border-[#F3ECE8] dark:border-[#2A2638]"
                        style={{top: `${(m - START_MIN) * PX_PER_MIN}px`}}
                      />
                    ))}

                    {/* Positioned Event Blocks */}
                    {positioned.map(({occ, lane, totalLanes}) => {
                      const sMin = Math.max(START_MIN, timeToMinutes(occ.startTime));
                      const eMin = Math.min(endMin, Math.max(sMin + 22, timeToMinutes(occ.endTime)));
                      const topPx = (sMin - START_MIN) * PX_PER_MIN + 1;
                      const heightPx = Math.max(26, (eMin - sMin) * PX_PER_MIN - 2);
                      const widthPct = 100 / totalLanes;
                      const leftPct = lane * widthPct;

                      const cat = getCategory(occ.categoryId);
                      const palette = PASTEL_PALETTE[cat.color];

                      return (
                        <button
                          key={occ.occurrenceKey}
                          type="button"
                          onClick={() => setSelectedOcc(occ)}
                          style={{
                            top: `${topPx}px`,
                            height: `${heightPx}px`,
                            left: `calc(${leftPct}% + 2px)`,
                            width: `calc(${widthPct}% - 4px)`,
                          }}
                          className={`absolute rounded-xl border px-2 py-1.5 text-left overflow-hidden transition-transform hover:scale-[1.01] hover:z-20 focus:z-20 ${
                            occ.isCancelled
                              ? 'bg-[#F4F2F6] dark:bg-[#272432] border-dashed border-[#C9C1D4] dark:border-[#49425B] text-[#766C87] dark:text-[#A49BB6] opacity-75'
                              : `${palette.bg} ${palette.border} ${palette.text}`
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={`text-xs font-bold leading-tight truncate ${
                                occ.isCancelled ? 'line-through' : ''
                              }`}
                            >
                              {occ.title}
                            </span>
                            {occ.isCancelled && (
                              <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-white/80 dark:bg-black/30 shrink-0">
                                CANCELLED
                              </span>
                            )}
                          </div>

                          {heightPx >= 44 && (
                            <p className="text-[11px] opacity-85 truncate leading-tight mt-0.5">
                              {occ.subjectName || cat.name}
                            </p>
                          )}

                          {heightPx >= 60 && (
                            <p className="text-[10px] font-mono tabular-nums opacity-80 truncate mt-0.5">
                              {formatTime12h(occ.startTime)} – {formatTime12h(occ.endTime)}
                              {occ.location ? ` · ${occ.location}` : ''}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Occurrence Detail & Action Modal */}
      <Modal
        open={Boolean(selectedOcc)}
        onClose={() => setSelectedOcc(null)}
        title={selectedOcc?.title ?? ''}
        subtitle={
          selectedOcc
            ? `${selectedOcc.isRecurring ? 'Recurring weekly entry' : 'One-time event'} · ${formatShortDate(selectedOcc.date)}`
            : undefined
        }
      >
        {selectedOcc && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#FAF7F5] dark:bg-[#262233] border border-[#EFE8E3] dark:border-[#332E45] space-y-2 text-sm">
              <div className="flex items-center gap-2 text-[#4A4158] dark:text-[#D5CEE3]">
                <Clock className="w-4 h-4 text-[#7F63D8]" />
                <span className="font-mono tabular-nums">
                  {formatTime12h(selectedOcc.startTime)} – {formatTime12h(selectedOcc.endTime)}
                </span>
                {selectedOcc.isCancelled && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#FDE8E8] text-[#8C2D36] dark:bg-[#442327] dark:text-[#F8C8CE]">
                    CANCELLED
                  </span>
                )}
                {selectedOcc.isRescheduled && !selectedOcc.isCancelled && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#FDF5D7] text-[#735714]">
                    Rescheduled from {formatShortDate(selectedOcc.originalDate)}
                  </span>
                )}
              </div>

              <div className="text-xs text-[#685E75] dark:text-[#AFA6C2]">
                Category: <strong>{getCategory(selectedOcc.categoryId).name}</strong>
                {selectedOcc.subjectName ? ` · Subject: ${selectedOcc.subjectName}` : ''}
              </div>

              {selectedOcc.location && (
                <div className="flex items-center gap-2 text-xs text-[#685E75] dark:text-[#AFA6C2]">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{selectedOcc.location}</span>
                </div>
              )}

              {selectedOcc.instructor && (
                <div className="flex items-center gap-2 text-xs text-[#685E75] dark:text-[#AFA6C2]">
                  <User className="w-3.5 h-3.5" />
                  <span>{selectedOcc.instructor}</span>
                </div>
              )}

              {selectedOcc.notes && (
                <p className="text-xs text-[#4A4158] dark:text-[#D5CEE3] pt-1 border-t border-[#EAE2DC] dark:border-[#342F44]">
                  {selectedOcc.notes}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {selectedOcc.isRecurring && (
                <button
                  type="button"
                  onClick={() => handleCancelOrReinstate(selectedOcc)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                    selectedOcc.isCancelled
                      ? 'bg-[#E4F7EE] text-[#1D6344] dark:bg-[#1E3B2E] dark:text-[#BFEFD9]'
                      : 'bg-[#FDF5D7] text-[#735714] dark:bg-[#3F361C] dark:text-[#F8E7B0]'
                  }`}
                >
                  {selectedOcc.isCancelled ? (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restore this occurrence</span>
                    </>
                  ) : (
                    <>
                      <Ban className="w-3.5 h-3.5" />
                      <span>Cancel this occurrence</span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  const occ = selectedOcc;
                  setSelectedOcc(null);
                  setEditingOcc(occ);
                  setEventModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#EFE8FC] text-[#4C3482] dark:bg-[#2F2547] dark:text-[#DDD0FA]"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{selectedOcc.isRecurring ? 'Edit / Reschedule' : 'Edit Event'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const occ = selectedOcc;
                  setSelectedOcc(null);
                  setDeleteSeriesTarget(occ);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#FDE8E8] text-[#8C2D36] dark:bg-[#442327] dark:text-[#F8C8CE] ml-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{selectedOcc.isRecurring ? 'Delete Series' : 'Delete Event'}</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create / Edit Event Modal */}
      <TimetableEventModal
        open={eventModalOpen}
        onClose={() => {
          setEventModalOpen(false);
          setEditingOcc(null);
        }}
        initialIsRecurring={modalInitialRecurring}
        initialDate={modalInitialDate}
        editingOccurrence={editingOcc}
      />

      {/* Category Palette Editor Modal */}
      <Modal
        open={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        title="Edit Timetable Categories"
        subtitle="Customize event category labels and pastel colours"
      >
        <div className="space-y-4">
          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {catDraft.map((cat, idx) => (
              <div key={cat.id} className="flex items-center gap-2">
                <input
                  type="text"
                  value={cat.name}
                  onChange={(e) => {
                    const next = [...catDraft];
                    next[idx] = {...cat, name: e.target.value};
                    setCatDraft(next);
                  }}
                  className="flex-1 px-3 py-1.5 rounded-xl border border-[#E4DCD7] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
                />
                <select
                  value={cat.color}
                  onChange={(e) => {
                    const next = [...catDraft];
                    next[idx] = {...cat, color: e.target.value as PastelToken};
                    setCatDraft(next);
                  }}
                  className="px-2.5 py-1.5 rounded-xl border border-[#E4DCD7] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-xs font-semibold"
                >
                  {PASTEL_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {PASTEL_PALETTE[k].label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-[#EFE8E3] dark:border-[#2E293D] flex items-center gap-2">
            <input
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="New category name..."
              className="flex-1 px-3 py-1.5 rounded-xl border border-[#E4DCD7] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
            />
            <select
              value={newCatColor}
              onChange={(e) => setNewCatColor(e.target.value as PastelToken)}
              className="px-2.5 py-1.5 rounded-xl border border-[#E4DCD7] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-xs font-semibold"
            >
              {PASTEL_KEYS.map((k) => (
                <option key={k} value={k}>
                  {PASTEL_PALETTE[k].label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                if (!newCatName.trim()) return;
                setCatDraft((prev) => [
                  ...prev,
                  {id: generateId(), name: newCatName.trim(), color: newCatColor},
                ]);
                setNewCatName('');
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#EFE8FC] text-[#4C3482] dark:bg-[#2F2547] dark:text-[#DDD0FA]"
            >
              Add
            </button>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setCatModalOpen(false)}
              className="px-4 py-2 rounded-xl text-sm font-semibold border border-[#E4DCD7] dark:border-[#39334B]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveCategories}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#7F63D8] hover:bg-[#6D52C4] text-white"
            >
              Save Categories
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Series / Event Confirmation */}
      <ConfirmDialog
        open={Boolean(deleteSeriesTarget)}
        onClose={() => setDeleteSeriesTarget(null)}
        onConfirm={async () => {
          if (!deleteSeriesTarget) return;
          await deleteTimetableEvent(deleteSeriesTarget.eventId);
          showToast(
            deleteSeriesTarget.isRecurring
              ? 'Deleted recurring class series.'
              : 'Deleted event.'
          );
        }}
        title={
          deleteSeriesTarget?.isRecurring ? 'Delete Recurring Series' : 'Delete Timetable Event'
        }
        description={
          deleteSeriesTarget?.isRecurring
            ? `Are you sure you want to permanently delete "${deleteSeriesTarget.title}" and all its recurring dates? To cancel just one day instead, choose "Cancel this occurrence" from the event card.`
            : `Delete "${deleteSeriesTarget?.title ?? ''}" from your timetable?`
        }
        confirmLabel="Delete"
      />
    </div>
  );
};
