import React, {useMemo, useState} from 'react';
import {
  ArrowUpDown,
  Briefcase,
  Columns3,
  Edit3,
  ExternalLink,
  History,
  PieChart,
  Plus,
  Search,
  Table2,
  Trash2,
} from 'lucide-react';
import {useApp} from '../context/AppContext';
import {ConfirmDialog} from '../components/ui/ConfirmDialog';
import {EmptyState} from '../components/ui/EmptyState';
import {Modal} from '../components/ui/Modal';
import {
  InternshipApplication,
  InternshipSource,
  InternshipStatus,
} from '../types/models';
import {daysBetween, formatShortDate, getTodayStr} from '../utils/date';
import {generateId} from '../utils/id';
import {INTERNSHIP_STATUS_STYLE, INTERNSHIP_STATUSES} from '../utils/theme';

const SOURCES: InternshipSource[] = [
  'LinkedIn',
  'Indeed',
  'Internshala',
  'Company Website',
  'Referral',
  'Other',
];

type SortField = 'updatedAt' | 'company' | 'position' | 'dateApplied' | 'status' | 'followUpDate';

export const InternshipsPage: React.FC = () => {
  const {internshipApplications, saveInternship, deleteInternship, showToast} = useApp();
  const todayStr = getTodayStr();

  const [viewMode, setViewMode] = useState<'table' | 'kanban' | 'analytics'>('table');
  const [search, setSearch] = useState('');
  const [filterSource, setFilterSource] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<SortField>('updatedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Add / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<InternshipApplication | null>(null);
  const [company, setCompany] = useState('');
  const [position, setPosition] = useState('');
  const [source, setSource] = useState<InternshipSource>('LinkedIn');
  const [dateApplied, setDateApplied] = useState('');
  const [status, setStatus] = useState<InternshipStatus>('Saved');
  const [jobUrl, setJobUrl] = useState('');
  const [location, setLocation] = useState('');
  const [contactDetails, setContactDetails] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [notes, setNotes] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<InternshipApplication | null>(null);
  const [historyTarget, setHistoryTarget] = useState<InternshipApplication | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const filteredApps = useMemo(() => {
    const q = search.trim().toLowerCase();
    return internshipApplications
      .filter((a) => {
        if (q && !a.company.toLowerCase().includes(q) && !a.position.toLowerCase().includes(q)) {
          return false;
        }
        if (filterSource !== 'ALL' && a.source !== filterSource) return false;
        if (filterStatus !== 'ALL' && a.status !== filterStatus) return false;
        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortBy === 'company') cmp = a.company.localeCompare(b.company);
        else if (sortBy === 'position') cmp = a.position.localeCompare(b.position);
        else if (sortBy === 'status') cmp = a.status.localeCompare(b.status);
        else if (sortBy === 'dateApplied') {
          cmp = (a.dateApplied ?? '').localeCompare(b.dateApplied ?? '');
        } else if (sortBy === 'followUpDate') {
          cmp = (a.followUpDate ?? '').localeCompare(b.followUpDate ?? '');
        } else {
          cmp = a.updatedAt.localeCompare(b.updatedAt);
        }
        return sortDir === 'asc' ? cmp : -cmp;
      });
  }, [internshipApplications, search, filterSource, filterStatus, sortBy, sortDir]);

  const analytics = useMemo(() => {
    const total = internshipApplications.length;
    const byStatus = new Map<InternshipStatus, number>();
    const bySource = new Map<InternshipSource, number>();
    for (const st of INTERNSHIP_STATUSES) byStatus.set(st, 0);
    for (const src of SOURCES) bySource.set(src, 0);

    let underConsideration = 0;
    let assessments = 0;
    let interviews = 0;
    let offers = 0;
    let followUpsDue = 0;
    const monthCounts = new Map<string, number>();

    for (const app of internshipApplications) {
      byStatus.set(app.status, (byStatus.get(app.status) ?? 0) + 1);
      bySource.set(app.source, (bySource.get(app.source) ?? 0) + 1);
      if (app.status === 'Under Consideration') underConsideration++;
      if (app.status === 'Assessment') assessments++;
      if (app.status === 'Interview Scheduled') interviews++;
      if (app.status === 'Offer Received') offers++;
      if (
        app.followUpDate &&
        app.status !== 'Rejected' &&
        app.status !== 'Withdrawn' &&
        daysBetween(todayStr, app.followUpDate) <= 7
      ) {
        followUpsDue++;
      }
      if (app.dateApplied && app.dateApplied.length >= 7) {
        const ym = app.dateApplied.slice(0, 7);
        monthCounts.set(ym, (monthCounts.get(ym) ?? 0) + 1);
      }
    }

    const timeline = Array.from(monthCounts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({month, count}));

    return {
      total,
      underConsideration,
      assessments,
      byStatus,
      bySource,
      interviews,
      offers,
      followUpsDue,
      timeline,
    };
  }, [internshipApplications, todayStr]);

  const openCreateModal = () => {
    setEditingApp(null);
    setCompany('');
    setPosition('');
    setSource('LinkedIn');
    setDateApplied('');
    setStatus('Saved');
    setJobUrl('');
    setLocation('');
    setContactDetails('');
    setFollowUpDate('');
    setNotes('');
    setStatusNote('');
    setModalOpen(true);
  };

  const openEditModal = (app: InternshipApplication) => {
    setEditingApp(app);
    setCompany(app.company);
    setPosition(app.position);
    setSource(app.source);
    setDateApplied(app.dateApplied ?? '');
    setStatus(app.status);
    setJobUrl(app.jobUrl ?? '');
    setLocation(app.location ?? '');
    setContactDetails(app.contactDetails ?? '');
    setFollowUpDate(app.followUpDate ?? '');
    setNotes(app.notes);
    setStatusNote('');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim() || !position.trim()) return;
    const now = new Date().toISOString();

    const history = [...(editingApp?.history ?? [])];
    if (!editingApp) {
      history.push({
        id: generateId(),
        timestamp: now,
        toStatus: status,
        note: statusNote.trim() || 'Application created',
      });
    } else if (editingApp.status !== status || statusNote.trim()) {
      history.push({
        id: generateId(),
        timestamp: now,
        fromStatus: editingApp.status,
        toStatus: status,
        note: statusNote.trim() || undefined,
      });
    }

    const record: InternshipApplication = {
      id: editingApp?.id ?? generateId(),
      company: company.trim(),
      position: position.trim(),
      source,
      dateApplied: dateApplied || undefined,
      status,
      jobUrl: jobUrl.trim() || undefined,
      location: location.trim() || undefined,
      contactDetails: contactDetails.trim() || undefined,
      followUpDate: followUpDate || undefined,
      notes: notes.trim(),
      history,
      createdAt: editingApp?.createdAt ?? now,
      updatedAt: now,
    };
    await saveInternship(record);
    showToast(editingApp ? 'Application updated.' : 'Application added.');
    setModalOpen(false);
  };

  const handleQuickStatusChange = async (
    app: InternshipApplication,
    nextStatus: InternshipStatus
  ) => {
    if (app.status === nextStatus) return;
    const now = new Date().toISOString();
    await saveInternship({
      ...app,
      status: nextStatus,
      history: [
        ...app.history,
        {
          id: generateId(),
          timestamp: now,
          fromStatus: app.status,
          toStatus: nextStatus,
        },
      ],
      updatedAt: now,
    });
    showToast(`${app.company}: moved to ${nextStatus}.`);
  };

  const toggleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#1F1929] dark:text-white">
            Internship Tracker
          </h1>
          <p className="text-sm text-[#685E75] dark:text-[#AFA6C2] mt-1">
            Track applications across statuses, follow-ups, recruiter notes, and timeline history.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-xs font-bold bg-[#7B4CE2] hover:bg-[#6A3CD1] text-white shadow-sm shadow-[#7B4CE2]/25 transition-colors self-start sm:self-auto whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add application</span>
        </button>
      </div>

      {/* 6 Pastel KPI Tiles */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="p-4 rounded-2xl border border-[#ECE4DF] dark:border-[#322C42] bg-white dark:bg-[#1E1A2A] journal-card">
          <p className="text-xs font-semibold text-[#685E75] dark:text-[#AFA6C2]">Total</p>
          <p className="text-2xl font-bold text-[#1F1929] dark:text-white tabular-nums mt-1.5">
            {analytics.total}
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-[#DFD2FC] dark:border-[#4D3D75] bg-[#F4EFFE] dark:bg-[#2F2547]">
          <p className="text-xs font-semibold text-[#6D4AE2] dark:text-[#DDD0FA]">
            Under consideration
          </p>
          <p className="text-2xl font-bold text-[#1F1929] dark:text-white tabular-nums mt-1.5">
            {analytics.underConsideration}
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-[#F7E4A6] dark:border-[#6B5B2C] bg-[#FEF9E6] dark:bg-[#3F361C]">
          <p className="text-xs font-semibold text-[#9A6F0C] dark:text-[#F8E7B0]">Assessments</p>
          <p className="text-2xl font-bold text-[#1F1929] dark:text-white tabular-nums mt-1.5">
            {analytics.assessments}
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-[#FAD5C0] dark:border-[#754936] bg-[#FEF3EC] dark:bg-[#452B20]">
          <p className="text-xs font-semibold text-[#BD5728] dark:text-[#FAD8C5]">
            Interviews scheduled
          </p>
          <p className="text-2xl font-bold text-[#1F1929] dark:text-white tabular-nums mt-1.5">
            {analytics.interviews}
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-[#BCEAD3] dark:border-[#32634D] bg-[#EBF9F2] dark:bg-[#1E3B2E]">
          <p className="text-xs font-semibold text-[#1D744E] dark:text-[#BFEFD9]">
            Offers received
          </p>
          <p className="text-2xl font-bold text-[#1F1929] dark:text-white tabular-nums mt-1.5">
            {analytics.offers}
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-[#C3E2FC] dark:border-[#365B7D] bg-[#EFF7FE] dark:bg-[#1F3447]">
          <p className="text-xs font-semibold text-[#1D67A8] dark:text-[#C4E2FC]">
            Upcoming follow-ups
          </p>
          <p className="text-2xl font-bold text-[#1F1929] dark:text-white tabular-nums mt-1.5">
            {analytics.followUpsDue}
          </p>
        </div>
      </section>

      {/* View Switcher & Filters Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="inline-flex flex-wrap p-1.5 rounded-2xl border border-[#ECE4DF] dark:border-[#322C42] bg-white dark:bg-[#1E1A2A] journal-card self-start">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
              viewMode === 'table'
                ? 'bg-[#FDECE2] text-[#BD5728] dark:bg-[#452B20] dark:text-[#FAD8C5]'
                : 'text-[#685E75] dark:text-[#AFA6C2] hover:text-[#1F1929] dark:hover:text-white'
            }`}
          >
            <Table2 className="w-3.5 h-3.5" />
            <span>Table View</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('kanban')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
              viewMode === 'kanban'
                ? 'bg-[#FDECE2] text-[#BD5728] dark:bg-[#452B20] dark:text-[#FAD8C5]'
                : 'text-[#685E75] dark:text-[#AFA6C2] hover:text-[#1F1929] dark:hover:text-white'
            }`}
          >
            <Columns3 className="w-3.5 h-3.5" />
            <span>Kanban Board</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('analytics')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
              viewMode === 'analytics'
                ? 'bg-[#FDECE2] text-[#BD5728] dark:bg-[#452B20] dark:text-[#FAD8C5]'
                : 'text-[#685E75] dark:text-[#AFA6C2] hover:text-[#1F1929] dark:hover:text-white'
            }`}
          >
            <PieChart className="w-3.5 h-3.5" />
            <span>Analytics</span>
          </button>
        </div>

        {viewMode !== 'analytics' && (
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 text-[#7D728F] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search company or pos..."
                className="w-full pl-9 pr-3.5 py-2 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#1E1A2A] text-xs font-medium"
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              aria-label="Filter by status"
              className="px-3.5 py-2 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#1E1A2A] text-xs font-semibold text-[#2D2638] dark:text-white"
            >
              <option value="ALL">All statuses</option>
              {INTERNSHIP_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>

            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              aria-label="Filter by source"
              className="px-3.5 py-2 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#1E1A2A] text-xs font-semibold text-[#2D2638] dark:text-white"
            >
              <option value="ALL">All sources</option>
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Main Content */}
      {internshipApplications.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="w-6 h-6" />}
          title="No internship applications yet"
          description="Keep track of every role you apply to, recruiter follow-ups, assessment rounds, and interview notes—all stored privately in your browser."
          actionLabel="Add first application"
          onAction={openCreateModal}
          tone="peach"
        />
      ) : viewMode === 'analytics' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="p-6 rounded-3xl border border-[#ECE4DF] dark:border-[#322C42] bg-white dark:bg-[#1E1A2A] journal-card space-y-3">
            <h3 className="text-sm font-bold text-[#1F1929] dark:text-white">
              Applications by Status
            </h3>
            <div className="space-y-2.5">
              {INTERNSHIP_STATUSES.map((st) => {
                const count = analytics.byStatus.get(st) ?? 0;
                if (count === 0) return null;
                const pct = Math.round((count / analytics.total) * 100);
                return (
                  <div key={st} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-[#2D2638] dark:text-white">{st}</span>
                      <span className="tabular-nums text-[#685E75] dark:text-[#AFA6C2]">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[#F4EFF8] dark:bg-[#2B263B] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#9D7CE8]"
                        style={{width: `${pct}%`}}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-6 rounded-3xl border border-[#ECE4DF] dark:border-[#322C42] bg-white dark:bg-[#1E1A2A] journal-card space-y-3">
            <h3 className="text-sm font-bold text-[#1F1929] dark:text-white">
              Applications by Source
            </h3>
            <div className="space-y-2.5">
              {SOURCES.map((src) => {
                const count = analytics.bySource.get(src) ?? 0;
                if (count === 0) return null;
                const pct = Math.round((count / analytics.total) * 100);
                return (
                  <div key={src} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-[#2D2638] dark:text-white">{src}</span>
                      <span className="tabular-nums text-[#685E75] dark:text-[#AFA6C2]">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[#EBF7F1] dark:bg-[#1F332A] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#30C283]"
                        style={{width: `${pct}%`}}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-6 rounded-3xl border border-[#ECE4DF] dark:border-[#322C42] bg-white dark:bg-[#1E1A2A] journal-card space-y-3">
            <h3 className="text-sm font-bold text-[#1F1929] dark:text-white">
              Application Activity Over Time
            </h3>
            {analytics.timeline.length === 0 ? (
              <p className="text-xs text-[#7D728F] dark:text-[#9D94B0] py-4">
                Add application dates to see monthly application activity here.
              </p>
            ) : (
              <div className="pt-2">
                <svg
                  viewBox="0 0 260 110"
                  className="w-full h-32 overflow-visible"
                  role="img"
                  aria-label="Applications over time bar chart"
                >
                  {analytics.timeline.map((item, idx) => {
                    const maxVal = Math.max(...analytics.timeline.map((t) => t.count), 1);
                    const barW = Math.min(36, 200 / analytics.timeline.length);
                    const gap = 12;
                    const x = idx * (barW + gap) + 8;
                    const h = Math.max(8, (item.count / maxVal) * 70);
                    const y = 80 - h;
                    return (
                      <g key={item.month}>
                        <rect
                          x={x}
                          y={y}
                          width={barW}
                          height={h}
                          rx={6}
                          fill="#EA8C5F"
                          opacity={0.9}
                        />
                        <text
                          x={x + barW / 2}
                          y={y - 4}
                          textAnchor="middle"
                          fontSize="10"
                          fill="currentColor"
                          className="tabular-nums font-bold"
                        >
                          {item.count}
                        </text>
                        <text
                          x={x + barW / 2}
                          y={98}
                          textAnchor="middle"
                          fontSize="9"
                          fill="currentColor"
                          opacity={0.7}
                        >
                          {item.month.slice(2)}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}
          </div>
        </div>
      ) : viewMode === 'table' ? (
        <div className="rounded-3xl border border-[#ECE4DF] dark:border-[#322C42] bg-white dark:bg-[#1E1A2A] journal-card overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[780px]">
            <thead>
              <tr className="border-b border-[#F2ECE8] dark:border-[#2C273B] text-xs font-bold text-[#685E75] dark:text-[#AFA6C2]">
                <th className="py-4 px-5">
                  <button
                    type="button"
                    onClick={() => toggleSort('company')}
                    className="inline-flex items-center gap-1 hover:text-[#1F1929] dark:hover:text-white"
                  >
                    <span>Company</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </button>
                </th>
                <th className="py-4 px-4">
                  <button
                    type="button"
                    onClick={() => toggleSort('position')}
                    className="inline-flex items-center gap-1 hover:text-[#1F1929] dark:hover:text-white"
                  >
                    <span>Position</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </button>
                </th>
                <th className="py-4 px-4">Source</th>
                <th className="py-4 px-4">
                  <button
                    type="button"
                    onClick={() => toggleSort('status')}
                    className="inline-flex items-center gap-1 hover:text-[#1F1929] dark:hover:text-white"
                  >
                    <span>Status</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </button>
                </th>
                <th className="py-4 px-4">
                  <button
                    type="button"
                    onClick={() => toggleSort('dateApplied')}
                    className="inline-flex items-center gap-1 hover:text-[#1F1929] dark:hover:text-white"
                  >
                    <span>Date Applied</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </button>
                </th>
                <th className="py-4 px-4">
                  <button
                    type="button"
                    onClick={() => toggleSort('followUpDate')}
                    className="inline-flex items-center gap-1 hover:text-[#1F1929] dark:hover:text-white"
                  >
                    <span>Follow-up</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </button>
                </th>
                <th className="py-4 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2ECE8] dark:divide-[#2C273B] text-sm">
              {filteredApps.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-10 text-center text-sm text-[#685E75] dark:text-[#AFA6C2]"
                  >
                    No applications match your current search or filters.
                  </td>
                </tr>
              ) : (
                filteredApps.map((app) => {
                  const stStyle = INTERNSHIP_STATUS_STYLE[app.status];
                  return (
                    <tr
                      key={app.id}
                      className="hover:bg-[#FCF9F7] dark:hover:bg-[#242031] transition-colors"
                    >
                      <td className="py-4 px-5 font-bold text-[#1F1929] dark:text-white">
                        <div className="flex items-center gap-1.5">
                          <span>{app.company}</span>
                          {app.jobUrl && (
                            <a
                              href={app.jobUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Open listing for ${app.company}`}
                              className="text-[#7B4CE2] hover:opacity-80"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                        {app.location && (
                          <p className="text-xs font-normal text-[#685E75] dark:text-[#AFA6C2]">
                            {app.location}
                          </p>
                        )}
                      </td>
                      <td className="py-4 px-4 text-[#4A4158] dark:text-[#D5CEE3]">
                        {app.position}
                      </td>
                      <td className="py-4 px-4 text-xs text-[#685E75] dark:text-[#AFA6C2]">
                        {app.source}
                      </td>
                      <td className="py-4 px-4">
                        <select
                          value={app.status}
                          onChange={(e) =>
                            handleQuickStatusChange(app, e.target.value as InternshipStatus)
                          }
                          aria-label={`Status for ${app.company}`}
                          className={`px-3 py-1.5 rounded-full border text-xs font-bold ${stStyle.bg} ${stStyle.text} ${stStyle.border}`}
                        >
                          {INTERNSHIP_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-4 px-4 text-xs tabular-nums text-[#685E75] dark:text-[#AFA6C2]">
                        {app.dateApplied ? formatShortDate(app.dateApplied) : '—'}
                      </td>
                      <td className="py-4 px-4 text-xs tabular-nums text-[#685E75] dark:text-[#AFA6C2]">
                        {app.followUpDate ? formatShortDate(app.followUpDate) : '—'}
                      </td>
                      <td className="py-4 px-5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setHistoryTarget(app)}
                            aria-label={`View history for ${app.company}`}
                            title="Timeline history"
                            className="p-1.5 rounded-lg text-[#685E75] hover:bg-[#F5F0F8] dark:text-[#AFA6C2] dark:hover:bg-[#2B263B]"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(app)}
                            aria-label={`Edit ${app.company}`}
                            className="p-1.5 rounded-lg text-[#685E75] hover:bg-[#F5F0F8] dark:text-[#AFA6C2] dark:hover:bg-[#2B263B]"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(app)}
                            aria-label={`Delete ${app.company}`}
                            className="p-1.5 rounded-lg text-[#D9385A] hover:bg-[#FFF2F4] dark:text-[#F8A5AE] dark:hover:bg-[#3F2227]"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Kanban View */
        <div className="flex gap-4 overflow-x-auto pb-4">
          {INTERNSHIP_STATUSES.map((colStatus) => {
            const items = filteredApps.filter((a) => a.status === colStatus);
            const stStyle = INTERNSHIP_STATUS_STYLE[colStatus];
            return (
              <div
                key={colStatus}
                onDragOver={(e) => e.preventDefault()}
                onDrop={async () => {
                  if (!draggedId) return;
                  const app = internshipApplications.find((a) => a.id === draggedId);
                  setDraggedId(null);
                  if (app) await handleQuickStatusChange(app, colStatus);
                }}
                className="w-72 shrink-0 rounded-3xl border border-[#ECE4DF] dark:border-[#322C42] bg-[#FAF7F5] dark:bg-[#1B1824] p-3.5 flex flex-col gap-3"
              >
                <div
                  className={`flex items-center justify-between px-3.5 py-2 rounded-2xl border ${stStyle.bg} ${stStyle.border} ${stStyle.text}`}
                >
                  <span className="text-xs font-bold truncate">{colStatus}</span>
                  <span className="text-xs font-mono font-bold tabular-nums">{items.length}</span>
                </div>

                <div className="space-y-2.5 min-h-[120px]">
                  {items.map((app) => (
                    <div
                      key={app.id}
                      draggable
                      onDragStart={() => setDraggedId(app.id)}
                      className="p-3.5 rounded-2xl border border-[#ECE4DF] dark:border-[#322C42] bg-white dark:bg-[#1E1A2A] journal-card space-y-2 cursor-grab active:cursor-grabbing"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-[#1F1929] dark:text-white truncate">
                            {app.company}
                          </h4>
                          <p className="text-xs text-[#5A506B] dark:text-[#C5BDD4] truncate">
                            {app.position}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openEditModal(app)}
                          aria-label={`Edit ${app.company}`}
                          className="p-1.5 rounded-lg text-[#685E75] hover:bg-[#F5F0F8] dark:text-[#AFA6C2]"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="text-[11px] text-[#685E75] dark:text-[#AFA6C2]">
                        {app.source}
                        {app.dateApplied ? ` · Applied ${formatShortDate(app.dateApplied)}` : ''}
                      </div>

                      <div>
                        <label className="sr-only">Move status</label>
                        <select
                          value={app.status}
                          onChange={(e) =>
                            handleQuickStatusChange(app, e.target.value as InternshipStatus)
                          }
                          className="w-full px-2.5 py-1.5 rounded-xl border border-[#ECE4DF] dark:border-[#39334B] bg-[#FAF7F5] dark:bg-[#262233] text-[11px] font-semibold"
                        >
                          {INTERNSHIP_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              Move to: {st}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Timeline History Modal */}
      <Modal
        open={Boolean(historyTarget)}
        onClose={() => setHistoryTarget(null)}
        title={historyTarget ? `${historyTarget.company} — Timeline` : 'Timeline'}
        subtitle={historyTarget?.position}
      >
        {historyTarget && (
          <div className="space-y-4">
            {historyTarget.history.length === 0 ? (
              <p className="text-sm text-[#685E75] dark:text-[#AFA6C2]">
                No status updates logged yet.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {[...historyTarget.history].reverse().map((h) => (
                  <div
                    key={h.id}
                    className="p-3 rounded-2xl bg-[#FAF7F5] dark:bg-[#262233] border border-[#EFE8E3] dark:border-[#332E45] text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[#1F1929] dark:text-white">
                        {h.fromStatus ? `${h.fromStatus} → ${h.toStatus}` : h.toStatus}
                      </span>
                      <span className="font-mono text-[11px] text-[#7D728F] tabular-nums">
                        {new Date(h.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    {h.note && <p className="text-[#5A506B] dark:text-[#C5BDD4]">{h.note}</p>}
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const app = historyTarget;
                  setHistoryTarget(null);
                  openEditModal(app);
                }}
                className="px-4 py-2 rounded-full text-xs font-bold border border-[#E4DCD7] dark:border-[#39334B]"
              >
                Edit Application
              </button>
              <button
                type="button"
                onClick={() => setHistoryTarget(null)}
                className="px-5 py-2 rounded-full text-xs font-bold bg-[#7B4CE2] hover:bg-[#6A3CD1] text-white"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingApp ? `Edit ${editingApp.company}` : 'Add Internship Application'}
        maxWidthClass="max-w-xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                Company Name *
              </label>
              <input
                type="text"
                required
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Acme Capital"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                Position / Role *
              </label>
              <input
                type="text"
                required
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="e.g. Data Analyst Intern"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                Source
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as InternshipSource)}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
              >
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as InternshipStatus)}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
              >
                {INTERNSHIP_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                Date Applied (optional)
              </label>
              <input
                type="date"
                value={dateApplied}
                onChange={(e) => setDateApplied(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                Follow-up Date (optional)
              </label>
              <input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                Location (optional)
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Mumbai / Remote"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                Job Listing URL (optional)
              </label>
              <input
                type="url"
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3.5 py-2.5 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                Contact / Recruiter Details (optional)
              </label>
              <input
                type="text"
                value={contactDetails}
                onChange={(e) => setContactDetails(e.target.value)}
                placeholder="Recruiter name or email..."
                className="w-full px-3.5 py-2.5 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                Notes
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Interview prep, assessment topics, or feedback..."
                className="w-full px-3.5 py-2.5 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
              />
            </div>

            {editingApp && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-[#5A506B] dark:text-[#C5BDD4] mb-1">
                  Log Update Note (optional)
                </label>
                <input
                  type="text"
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="e.g. Completed HireVue assessment"
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-[#ECE4DF] dark:border-[#39334B] bg-white dark:bg-[#16141D] text-sm"
                />
              </div>
            )}
          </div>

          {editingApp && editingApp.history.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-[#FAF7F5] dark:bg-[#262233] border border-[#EFE8E3] dark:border-[#332E45] space-y-1.5 max-h-36 overflow-y-auto">
              <p className="text-xs font-bold text-[#685E75] dark:text-[#AFA6C2]">
                Status &amp; Update History
              </p>
              {[...editingApp.history].reverse().map((h) => (
                <div key={h.id} className="text-xs text-[#4A4158] dark:text-[#D5CEE3]">
                  <span className="font-mono text-[11px] text-[#7D728F] tabular-nums mr-1.5">
                    {new Date(h.timestamp).toLocaleDateString()}
                  </span>
                  {h.fromStatus ? `${h.fromStatus} -> ${h.toStatus}` : h.toStatus}
                  {h.note ? ` — ${h.note}` : ''}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-full text-sm font-semibold border border-[#E4DCD7] dark:border-[#39334B]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-full text-sm font-bold bg-[#7B4CE2] hover:bg-[#6A3CD1] text-white"
            >
              {editingApp ? 'Save Changes' : 'Add Application'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteInternship(deleteTarget.id);
          showToast('Application deleted.');
        }}
        title="Delete Application"
        description={`Remove "${deleteTarget?.company ?? ''} — ${deleteTarget?.position ?? ''}" from your tracker?`}
        confirmLabel="Delete Application"
      />
    </div>
  );
};
