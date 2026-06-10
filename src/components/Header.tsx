import { Pill } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import type { Page } from '@/App';

interface HeaderProps {
  currentPage: Page;
}

const pageTitles: Record<Page, string> = {
  dashboard: 'dashboard',
  medicines: 'medicines',
  add: 'addMedicine',
  export: 'exportInventory',
  settings: 'settings',
  edit: 'editMedicine',
};

export default function Header({ currentPage }: HeaderProps) {
  const { t } = useI18n();

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border md:ml-64">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Mobile logo */}
          <div className="md:hidden flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Pill className="w-4 h-4 text-primary" />
            </div>
            <span className="font-bold text-sm">{t('appName')}</span>
          </div>
          
          {/* Page title */}
          <h2 className="text-lg font-semibold hidden md:block">
            {t(pageTitles[currentPage] as any)}
          </h2>
        </div>
      </div>
    </header>
  );
}
