import { motion } from 'framer-motion';
import { LayoutDashboard, Pill, PlusCircle, Download, Settings } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import type { Page } from '@/App';

interface MobileNavProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onAddNew: () => void;
}

export default function MobileNav({ currentPage, onNavigate, onAddNew }: MobileNavProps) {
  const { t } = useI18n();

  const navItems: { page: Page; label: string; icon: typeof LayoutDashboard }[] = [
    { page: 'dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { page: 'medicines', label: t('medicines'), icon: Pill },
    { page: 'add', label: t('add'), icon: PlusCircle },
    { page: 'export', label: t('export'), icon: Download },
    { page: 'settings', label: t('settings'), icon: Settings },
  ];

  return (
    <>
      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border md:hidden">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.page;
            const isAdd = item.page === 'add';

            return (
              <button
                key={item.page}
                onClick={() => {
                  if (isAdd) {
                    onAddNew();
                  } else {
                    onNavigate(item.page);
                  }
                }}
                className={`relative flex flex-col items-center justify-center w-full h-full transition-colors duration-200 ${
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute -top-px left-1/4 right-1/4 h-0.5 bg-primary rounded-full"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
                <div
                  className={`p-1.5 rounded-xl transition-all duration-200 ${
                    isAdd
                      ? 'bg-primary text-primary-foreground -mt-6 shadow-lg shadow-primary/30'
                      : isActive
                      ? 'bg-primary/10'
                      : ''
                  }`}
                >
                  <Icon size={isAdd ? 24 : 20} />
                </div>
                <span className={`text-[10px] mt-0.5 ${isAdd ? 'sr-only' : ''}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Desktop Side Navigation */}
      <nav className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 bg-card border-r border-border flex-col z-40">
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Pill className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">{t('appName')}</h1>
              <p className="text-xs text-muted-foreground">{t('tagline')}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 px-4 space-y-1">
          {navItems
            .filter((item) => item.page !== 'add')
            .map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.page;

              return (
                <button
                  key={item.page}
                  onClick={() => onNavigate(item.page)}
                  className={`relative flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="desktopActiveTab"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                  <Icon size={18} />
                  {item.label}
                </button>
              );
            })}
        </div>

        <div className="p-4">
          <button
            onClick={onAddNew}
            className="flex items-center justify-center gap-2 w-full py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
          >
            <PlusCircle size={18} />
            {t('addMedicine')}
          </button>
        </div>
      </nav>

      {/* Desktop content offset */}
      <div className="hidden md:block w-64" />
    </>
  );
}
