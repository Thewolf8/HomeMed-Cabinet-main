import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { I18nProvider, useI18n } from '@/i18n/I18nContext';
import { useSettings } from '@/hooks/useSettings';
import { useMedications } from '@/hooks/useMedications';
import { useToast } from '@/hooks/use-toast';

import MobileNav from '@/components/MobileNav';
import Header from '@/components/Header';
import DashboardPage from '@/pages/DashboardPage';
import MedicinesPage from '@/pages/MedicinesPage';
import AddMedicinePage from '@/pages/AddMedicinePage';
import EditMedicinePage from '@/pages/EditMedicinePage';
import ExportPage from '@/pages/ExportPage';
import SettingsPage from '@/pages/SettingsPage';

import './App.css';

export type Page = 'dashboard' | 'medicines' | 'add' | 'export' | 'settings' | 'edit';

function AppContent() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [editId, setEditId] = useState<string | null>(null);
  const { dir } = useI18n();
  const { settings, setLanguage, setTheme, updateExportPreference } = useSettings();
  const medHook = useMedications();
  const { toast } = useToast();

  // Apply theme class
  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.theme]);

  const navigateTo = (page: Page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEdit = (id: string) => {
    setEditId(id);
    setCurrentPage('edit');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddNew = () => {
    setCurrentPage('add');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const pageVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <DashboardPage
            key="dashboard"
            medications={medHook.medications}
            stats={{...medHook.stats, emergencyReadiness: medHook.emergencyReadiness.score}}
            emergencyReadiness={medHook.emergencyReadiness}
            onNavigate={navigateTo}
            onAddNew={handleAddNew}
            onEdit={handleEdit}
          />
        );
      case 'medicines':
        return (
          <MedicinesPage
            key="medicines"
            medications={medHook.medications}
            onEdit={handleEdit}
            onDelete={medHook.remove}
            onAddNew={handleAddNew}
            toast={toast}
          />
        );
      case 'add':
        return (
          <AddMedicinePage
            key="add"
            onSave={(med) => {
              medHook.add(med);
              toast('Medicine added successfully');
              navigateTo('medicines');
            }}
            onCancel={() => navigateTo('medicines')}
          />
        );
      case 'edit':
        if (!editId) {
          setCurrentPage('medicines');
          return null;
        }
        return (
          <EditMedicinePage
            key="edit"
            medId={editId}
            onSave={(id, updates) => {
              medHook.update(id, updates);
              toast('Medicine updated successfully');
              navigateTo('medicines');
              setEditId(null);
            }}
            onCancel={() => {
              navigateTo('medicines');
              setEditId(null);
            }}
          />
        );
      case 'export':
        return (
          <ExportPage
            key="export"
            settings={settings}
          />
        );
      case 'settings':
        return (
          <SettingsPage
            key="settings"
            settings={settings}
            onSettingsChange={{
              setLanguage,
              setTheme,
              updateExportPreference: (key: string, value: boolean) => updateExportPreference(key as any, value),
            }}
            onResetData={medHook.reset}
            onImport={medHook.importData}
            toast={toast}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div
      className="min-h-screen bg-background text-foreground transition-colors duration-300"
      dir={dir}
    >
      <Header currentPage={currentPage} />
      
      <main className="pb-24 md:pb-8 pt-16 md:pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              {renderPage()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <MobileNav currentPage={currentPage} onNavigate={navigateTo} onAddNew={handleAddNew} />
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  );
}
