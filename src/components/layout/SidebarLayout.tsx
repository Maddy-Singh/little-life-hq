import React, {useState} from 'react';
import {
  BookOpen,
  Briefcase,
  CalendarDays,
  Home,
  ListChecks,
  Menu,
  Moon,
  Settings,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import {useApp} from '../../context/AppContext';
import {NavPage} from '../../types/models';
import {JournalBrandDoodle} from '../ui/JournalIllustrations';

interface NavItem {
  id: NavPage;
  label: string;
  icon: React.ComponentType<{className?: string}>;
  activeClass: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'home',
    label: 'Home',
    icon: Home,
    activeClass:
      'bg-[#F4EFFE] text-[#6D4AE2] border-[#DFD2FC] dark:bg-[#2F2547] dark:text-[#DDD0FA] dark:border-[#4D3D75]',
  },
  {
    id: 'week',
    label: 'My Week',
    icon: ListChecks,
    activeClass:
      'bg-[#FDF0F6] text-[#C43C7B] border-[#F8CFE2] dark:bg-[#462535] dark:text-[#FAD0E3] dark:border-[#733D58]',
  },
  {
    id: 'timetable',
    label: 'Timetable',
    icon: CalendarDays,
    activeClass:
      'bg-[#EBF9F2] text-[#1D744E] border-[#BCEAD3] dark:bg-[#1E3B2E] dark:text-[#BFEFD9] dark:border-[#32634D]',
  },
  {
    id: 'academics',
    label: 'Academics',
    icon: BookOpen,
    activeClass:
      'bg-[#EFF7FE] text-[#1D67A8] border-[#C3E2FC] dark:bg-[#1F3447] dark:text-[#C4E2FC] dark:border-[#365B7D]',
  },
  {
    id: 'internships',
    label: 'Internships',
    icon: Briefcase,
    activeClass:
      'bg-[#FEF3EC] text-[#BD5728] border-[#FAD5C0] dark:bg-[#452B20] dark:text-[#FAD8C5] dark:border-[#754936]',
  },
  {
    id: 'activities',
    label: 'My Activities',
    icon: Sparkles,
    activeClass:
      'bg-[#FEF9E6] text-[#9A6F0C] border-[#F7E4A6] dark:bg-[#3F361C] dark:text-[#F8E7B0] dark:border-[#6B5B2C]',
  },
  {
    id: 'settings',
    label: 'Settings & Backups',
    icon: Settings,
    activeClass:
      'bg-[#F5F2F8] text-[#352E44] border-[#E0D9EB] dark:bg-[#2B2738] dark:text-[#E5DEF2] dark:border-[#463F5B]',
  },
];

export const SidebarLayout: React.FC<{children: React.ReactNode}> = ({children}) => {
  const {activePage, setActivePage, settings, updateSettings} = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleTheme = () => {
    updateSettings({theme: settings.theme === 'dark' ? 'light' : 'dark'});
  };

  const renderNav = (closeAfter = false) => (
    <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto" aria-label="Main navigation">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = activePage === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setActivePage(item.id);
              if (closeAfter) setMobileOpen(false);
            }}
            aria-current={active ? 'page' : undefined}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-semibold border transition-all whitespace-nowrap ${
              active
                ? item.activeClass
                : 'border-transparent text-[#493F59] dark:text-[#B9B0CA] hover:bg-[#F8F5FB] dark:hover:bg-[#272334] hover:text-[#1F1929] dark:hover:text-white'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );

  const renderFooter = () => (
    <div className="p-3.5 space-y-2.5 border-t border-[#F0EAE6] dark:border-[#2E293D]">
      <button
        type="button"
        onClick={toggleTheme}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl border border-[#ECE4DF] dark:border-[#342F44] bg-[#FCF9F7] dark:bg-[#242030] hover:bg-[#F5F0FA] dark:hover:bg-[#2D283B] transition-colors"
      >
        <span className="flex items-center gap-2 text-xs font-bold text-[#2D2638] dark:text-[#F3EFFA]">
          {settings.theme === 'dark' ? (
            <Moon className="w-4 h-4 text-[#C5B2F7]" />
          ) : (
            <Sun className="w-4 h-4 text-[#E6A817]" />
          )}
          <span>{settings.theme === 'dark' ? 'Dark Journal' : 'Light Journal'}</span>
        </span>
        <span className="text-xs font-semibold text-[#6B617A] dark:text-[#AFA6C2]">Switch</span>
      </button>
      <p className="px-1 text-[11px] leading-snug text-[#7A7089] dark:text-[#968DAB]">
        Stored privately in your browser via IndexedDB.
      </p>
    </div>
  );

  return (
    <div className="min-h-screen flex journal-canvas text-[#1F1929] dark:text-[#F4F0FA]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:shrink-0 border-r border-[#ECE4DF] dark:border-[#2E293D] bg-white dark:bg-[#191622] sticky top-0 h-screen">
        <div className="flex items-center gap-3 px-4 py-5">
          <JournalBrandDoodle className="w-9 h-9 shrink-0" />
          <div className="min-w-0">
            <span className="block font-display text-base font-bold tracking-tight text-[#1F1929] dark:text-white truncate">
              Little Life HQ
            </span>
            <span className="block text-[11px] font-medium text-[#7A7089] dark:text-[#9E95B3] truncate">
              {settings.semesterLabel || 'Current Semester'}
            </span>
          </div>
        </div>

        {renderNav(false)}
        {renderFooter()}
      </aside>

      {/* Mobile Header + Drawer */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between gap-4 px-4 py-3 border-b border-[#ECE4DF] dark:border-[#2E293D] bg-white/95 dark:bg-[#191622]/95 backdrop-blur-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <JournalBrandDoodle className="w-7 h-7 shrink-0" />
            <div className="min-w-0">
              <span className="block font-display text-sm font-bold truncate">Little Life HQ</span>
              <span className="block text-[10px] text-[#7A7089] dark:text-[#9E95B3] truncate">
                {settings.semesterLabel || 'Current Semester'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle color theme"
              className="p-2 rounded-xl border border-[#ECE4DF] dark:border-[#342F44] text-[#5A506B] dark:text-[#C5BDD4]"
            >
              {settings.theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              className="p-2 rounded-xl border border-[#ECE4DF] dark:border-[#342F44] text-[#1F1929] dark:text-white"
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
        </header>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-[1px]"
            />
            <div className="relative z-10 w-72 max-w-[85vw] bg-white dark:bg-[#191622] h-full flex flex-col border-r border-[#ECE4DF] dark:border-[#2E293D] shadow-xl">
              <div className="flex items-center justify-between px-4 py-4 border-b border-[#F0EAE6] dark:border-[#2E293D]">
                <div className="flex items-center gap-2.5">
                  <JournalBrandDoodle className="w-7 h-7" />
                  <div>
                    <span className="block font-display font-bold text-sm">Little Life HQ</span>
                    <span className="block text-[10px] text-[#7A7089] dark:text-[#9E95B3]">
                      {settings.semesterLabel || 'Current Semester'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close navigation menu"
                  className="p-2 rounded-xl hover:bg-[#F5F0F8] dark:hover:bg-[#292536]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {renderNav(true)}
              {renderFooter()}
            </div>
          </div>
        )}

        <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
};
