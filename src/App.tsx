import { useState, useEffect } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { I18nProvider, useI18n } from '@/i18n/I18nContext';
import { useSettings } from '@/hooks/useSettings';
import { useMedications } from '@/hooks/useMedications';
import { useToast } from '@/hooks/use-toast';
import { registerHomeMedFileListener } from '@/services/deepLinkService';
import type { HomeMedPayload } from '@/services/homemedFormat';

import MobileNav from '@/components/MobileNav';
import Header from '@/components/Header';
import DashboardPage from '@/pages/DashboardPage';
import MedicinesPage from '@/pages/MedicinesPage';
import AddMedicinePage from '@/pages/AddMedicinePage';
import EditMedicinePage from '@/pages/EditMedicinePage';
import ExportPage from '@/pages/ExportPage';
import SettingsPage from '@/pages/SettingsPage';
import ImportConflictModal from '@/components/ImportConflictModal';

import './App.css';

export type Page = 'dashboard' | 'medicines' | 'add' | 'export' | 'settings' | 'edit';

function AppContent() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [editId, setEditId] = useState<string | null>(null);
  const [pendingHomeMedImport, setPendingHomeMedImport] = useState<HomeMedPayload | null>(null);
  const { t, dir } = useI18n();
  const { settings, setLanguage, setTheme, updateExportPreference, setAnimationsEnabled } = useSettings();
  const medHook = useMedications();
  const { toast } = useToast();

  // Listen for .homemed files opened from outside the app (file manager, WhatsApp, etc.)
  useEffect(() => {
    const unsubscribe = registerHomeMedFileListener(
      (payload) => setPendingHomeMedImport(payload),
      () => toast(t('homemedImportError'))
    );
    return unsubscribe;
  }, []);

  const handleHomeMedMerge = () => {
    if (!pendingHomeMedImport) return;
    medHook.importData(pendingHomeMedImport.medications, true);
    toast(t('homemedImportSuccess'));
    setPendingHomeMedImport(null);
  };

  const handleHomeMedReplace = () => {
    if (!pendingHomeMedImport) return;
    medHook.importData(pendingHomeMedImport.medications, false);
    toast(t('homemedImportSuccess'));
    setPendingHomeMedImport(null);
  };

  const handleHomeMedCancel = () => {
    setPendingHomeMedImport(null);
  };

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
            onToggleEmergencyItem={medHook.toggleEmergencyOverride}
            showDeleteExpired={!settings.autoDeleteExpired && medHook.stats.expired > 0}
            onDeleteExpired={() => {
              const count = medHook.deleteExpired();
              if (count > 0) toast(t('deleteExpiredSuccess'));
            }}
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
              const { merged } = medHook.add(med);
              toast(merged ? t('mergedToast') : 'Medicine added successfully');
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
              toast(t('updateMedicine'));
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
              setAnimationsEnabled,
            }}
            onResetData={medHook.reset}
            onImport={medHook.importData}
            onRescheduleNotifications={medHook.rescheduleAllNotifications}
            toast={toast}
          />
        );
      default:
        return null;
    }
  };

  return (
    <MotionConfig reducedMotion={settings.animationsEnabled !== false ? 'never' : 'always'}>
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

        <ImportConflictModal
          open={!!pendingHomeMedImport}
          medications={pendingHomeMedImport?.medications ?? null}
          onMerge={handleHomeMedMerge}
          onReplace={handleHomeMedReplace}
          onCancel={handleHomeMedCancel}
        />
      </div>
    </MotionConfig>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  );
}
