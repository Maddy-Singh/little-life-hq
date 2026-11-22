import React from 'react';
import {SidebarLayout} from './components/layout/SidebarLayout';
import {ToastContainer} from './components/ui/ToastContainer';
import {AppProvider, useApp} from './context/AppContext';
import {AcademicsPage} from './pages/AcademicsPage';
import {ActivitiesPage} from './pages/ActivitiesPage';
import {HomePage} from './pages/HomePage';
import {InternshipsPage} from './pages/InternshipsPage';
import {MyWeekPage} from './pages/MyWeekPage';
import {SettingsPage} from './pages/SettingsPage';
import {TimetablePage} from './pages/TimetablePage';

const PageRouter: React.FC = () => {
  const {activePage, loading} = useApp();

  if (loading) {
    return (
      <div className="py-20 text-center text-sm font-semibold text-[#685E75] dark:text-[#AFA6C2]">
        Opening your local journal...
      </div>
    );
  }

  switch (activePage) {
    case 'home':
      return <HomePage />;
    case 'week':
      return <MyWeekPage />;
    case 'timetable':
      return <TimetablePage />;
    case 'academics':
      return <AcademicsPage />;
    case 'internships':
      return <InternshipsPage />;
    case 'activities':
      return <ActivitiesPage />;
    case 'settings':
      return <SettingsPage />;
    default:
      return <HomePage />;
  }
};

export default function App() {
  return (
    <AppProvider>
      <SidebarLayout>
        <PageRouter />
      </SidebarLayout>
      <ToastContainer />
    </AppProvider>
  );
}
