import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Pill,
  AlertTriangle,
  CalendarClock,
  PackageOpen,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Activity,
  ShoppingCart,
  X,
  CheckCircle2,
  XCircle,
  Trash2,
  Bell,
  Clock,
  BellOff,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useI18n } from '@/i18n/I18nContext';
import type { Medication, DashboardStats } from '@/types/medication';
import { EMERGENCY_ITEMS } from '@/types/medication';
import type { Page } from '@/App';
import { getDaysUntilExpiration } from '@/services/exportService';

interface DueReminderEntry {
  medication: Medication;
  dueTimes: string[];
}

interface DashboardPageProps {
  medications: Medication[];
  stats: DashboardStats;
  emergencyReadiness: {
    score: number;
    missing: string[];
    status: string;
    total: number;
    found: number;
    inMedications: string[];
    manuallyPresent: string[];
  };
  onNavigate: (page: Page) => void;
  onAddNew: () => void;
  onEdit: (id: string) => void;
  onToggleEmergencyItem: (item: string) => void;
  /** Shown only when auto-delete-expired is OFF and at least one medication has expired. */
  showDeleteExpired?: boolean;
  onDeleteExpired?: () => void;
  /** Medications with a dose currently overdue (time passed, not yet confirmed today). */
  dueReminders?: DueReminderEntry[];
  onConfirmDose?: (medId: string, doseTime: string, taken: boolean) => void;
}

type StatFilter = 'all' | 'total' | 'expiringSoon' | 'expired' | 'lowStock';

interface StatCard {
  key: 'expired' | 'expiringSoon' | 'lowStock' | 'total';
  icon: typeof Pill;
  color: string;
  bgColor: string;
  borderColor: string;
  filter: StatFilter;
}

const statCards: StatCard[] = [
  {
    key: 'total',
    icon: Pill,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    filter: 'total',
  },
  {
    key: 'expiringSoon',
    icon: CalendarClock,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    filter: 'expiringSoon',
  },
  {
    key: 'expired',
    icon: AlertTriangle,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
    filter: 'expired',
  },
  {
    key: 'lowStock',
    icon: PackageOpen,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/20',
    filter: 'lowStock',
  },
];

export default function DashboardPage({
  medications,
  stats,
  emergencyReadiness,
  onNavigate,
  onAddNew,
  onEdit,
  onToggleEmergencyItem,
  showDeleteExpired,
  onDeleteExpired,
  dueReminders = [],
  onConfirmDose,
}: DashboardPageProps) {
  const { t, isRTL } = useI18n();
  const [activeFilter, setActiveFilter] = useState<StatFilter | null>(null);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [showDeleteExpiredConfirm, setShowDeleteExpiredConfirm] = useState(false);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  };

  const statValues = {
    total: stats.total,
    expiringSoon: stats.expiringSoon,
    expired: stats.expired,
    lowStock: stats.lowStock,
  };

  // Filtered medicines based on active stat card
  const filteredMedicines = (() => {
    if (!activeFilter || activeFilter === 'all') return [];
    if (activeFilter === 'total') return medications;
    if (activeFilter === 'expired')
      return medications.filter((m) => getDaysUntilExpiration(m.expirationDate) < 0);
    if (activeFilter === 'expiringSoon')
      return medications.filter((m) => {
        const d = getDaysUntilExpiration(m.expirationDate);
        return d >= 0 && d <= 30;
      });
    if (activeFilter === 'lowStock')
      return medications.filter((m) => m.quantity <= 5);
    return [];
  })();

  // Get expiring medicines for quick view
  const expiringMedicines = medications
    .filter((m) => {
      const days = getDaysUntilExpiration(m.expirationDate);
      return days >= 0 && days <= 30;
    })
    .sort((a, b) => new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime())
    .slice(0, 5);

  // Medicines that need renewal: quantity = 0 OR expired
  const renewalMedicines = medications.filter(
    (m) => m.quantity === 0 || getDaysUntilExpiration(m.expirationDate) < 0
  );

  // Emergency medicines with category — still used for navigation context

  const readinessLabel =
    emergencyReadiness.status === 'excellent'
      ? t('readinessExcellent')
      : emergencyReadiness.status === 'moderate'
      ? t('readinessModerate')
      : t('readinessWeak');

  const readinessColor =
    emergencyReadiness.status === 'excellent'
      ? 'text-emerald-500'
      : emergencyReadiness.status === 'moderate'
      ? 'text-amber-500'
      : 'text-red-500';

  const handleStatCardClick = (filter: StatFilter) => {
    setActiveFilter((prev) => (prev === filter ? null : filter));
  };

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center md:text-start"
      >
        <h1 className="text-2xl md:text-3xl font-bold mb-1">{t('appName')}</h1>
        <p className="text-muted-foreground">{t('tagline')}</p>
      </motion.div>

      {/* Dynamic "Delete Expired Medications" banner — only appears when
          auto-delete is off and the app has detected expired medications. */}
      <AnimatePresence>
        {showDeleteExpired && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="border-red-500/30 bg-red-500/5">
              <CardContent className="p-4 flex items-center gap-3 flex-wrap sm:flex-nowrap">
                <div className="p-2 rounded-lg bg-red-500/10 shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
                <p className="text-sm flex-1 min-w-[200px]">{t('expiredDetectedBanner')}</p>
                <Button
                  variant="destructive"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setShowDeleteExpiredConfirm(true)}
                >
                  <Trash2 className="w-4 h-4 me-1.5" />
                  {t('deleteExpiredButton')}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {statCards.map((card) => {
          const Icon = card.icon;
          const value = statValues[card.key];
          const isActive = activeFilter === card.filter;

          return (
            <motion.div key={card.key} variants={itemVariants}>
              <Card
                className={`${card.borderColor} border bg-card/50 backdrop-blur-sm transition-all duration-300 cursor-pointer group ${
                  isActive ? 'ring-2 ring-primary/50 bg-card/90' : 'hover:bg-card/80'
                }`}
                onClick={() => handleStatCardClick(card.filter)}
              >
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-start justify-between">
                    <div className={`p-2.5 rounded-xl ${card.bgColor}`}>
                      <Icon className={`w-5 h-5 ${card.color}`} />
                    </div>
                    <ArrowRight
                      className={`w-4 h-4 text-muted-foreground transition-all transform ${
                        isActive ? 'opacity-100 rotate-90' : 'opacity-0 group-hover:opacity-100'
                      } ${isRTL ? 'rotate-180' : ''}`}
                    />
                  </div>
                  <div className="mt-4">
                    <p className="text-2xl md:text-3xl font-bold">{value}</p>
                    <p className="text-xs md:text-sm text-muted-foreground mt-1">
                      {card.key === 'total' ? t('totalMedicines') :
                       card.key === 'expiringSoon' ? t('expiringSoon') :
                       card.key === 'expired' ? t('expired') :
                       t('lowStock')}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Filtered Medicines Panel */}
      <AnimatePresence>
        {activeFilter && filteredMedicines.length >= 0 && (
          <motion.div
            key="filter-panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-primary/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {activeFilter === 'total' ? t('totalMedicines') :
                     activeFilter === 'expiringSoon' ? t('expiringSoon') :
                     activeFilter === 'expired' ? t('expired') :
                     t('lowStock')}
                    <span className="ms-2 text-sm font-normal text-muted-foreground">
                      ({filteredMedicines.length})
                    </span>
                  </CardTitle>
                  <button
                    onClick={() => setActiveFilter(null)}
                    className="p-1 rounded-lg hover:bg-accent"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                {filteredMedicines.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">{t('noMedicines')}</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {filteredMedicines.map((med) => {
                      const days = getDaysUntilExpiration(med.expirationDate);
                      const isExpired = days < 0;
                      return (
                        <div
                          key={med.id}
                          onClick={() => onEdit(med.id)}
                          className="flex items-center justify-between p-3 rounded-lg bg-accent/50 hover:bg-accent cursor-pointer transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{med.name}</p>
                            <p className="text-xs text-muted-foreground">{med.dosage}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-muted-foreground">x{med.quantity}</span>
                            {isExpired ? (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-500">
                                {t('expiredTag')}
                              </span>
                            ) : activeFilter === 'expiringSoon' ? (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500">
                                {days}d
                              </span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Dose Reminders Widget ─────────────────────────────────── */}
      {dueReminders.length > 0 ? (
        <motion.div variants={itemVariants} initial="hidden" animate="visible">
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" />
                {t('reminderWidgetTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {dueReminders.map(({ medication, dueTimes }) => (
                <div key={medication.id} className="space-y-2">
                  <p className="text-sm font-medium">{medication.name} · {medication.dosage}</p>
                  <div className="flex flex-wrap gap-2">
                    {dueTimes.map((time) => (
                      <div key={time} className="flex items-center gap-1.5 bg-background rounded-lg border border-border px-3 py-1.5">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs text-muted-foreground">{time}</span>
                        <Button
                          size="sm"
                          className="h-6 text-xs px-2"
                          onClick={() => onConfirmDose?.(medication.id, time, true)}
                        >
                          <CheckCircle2 className="w-3 h-3 me-1" />
                          {t('doseTaken')}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs px-2"
                          onClick={() => onConfirmDose?.(medication.id, time, false)}
                        >
                          {t('doseSnooze')}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        medications.some((m) => m.reminder?.enabled) && (
          <motion.div variants={itemVariants} initial="hidden" animate="visible">
            <Card className="border-border/50">
              <CardContent className="flex items-center gap-3 py-4">
                <BellOff className="w-4 h-4 text-muted-foreground shrink-0" />
                <p className="text-sm text-muted-foreground">{t('reminderWidgetAllDone')}</p>
              </CardContent>
            </Card>
          </motion.div>
        )
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Emergency Readiness */}
        <motion.div variants={itemVariants} initial="hidden" animate="visible">
          <Card className="h-full cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShowEmergencyModal(true)}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-primary" />
                {t('emergencyReadiness')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className={`text-4xl font-bold ${readinessColor}`}>
                  {emergencyReadiness.score}%
                </div>
                <p className={`text-sm font-medium mt-1 ${readinessColor}`}>{readinessLabel}</p>
              </div>

              <Progress value={emergencyReadiness.score} className={`h-2 transition-transform${isRTL ? ' [transform:scaleX(-1)]' : ''}`} />

              {/* RTL-safe labels: always Weak on start, Excellent on end regardless of language */}
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="text-red-400">{t('readinessWeak')}</span>
                <span className="text-muted-foreground">{emergencyReadiness.found}/{emergencyReadiness.total}</span>
                <span className="text-emerald-500">{t('readinessExcellent')}</span>
              </div>

              {emergencyReadiness.missing.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    {t('missingItems')}:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {emergencyReadiness.missing.slice(0, 4).map((item) => (
                      <span
                        key={item}
                        className="px-2 py-0.5 bg-destructive/10 text-destructive text-xs rounded-full"
                      >
                        {item}
                      </span>
                    ))}
                    {emergencyReadiness.missing.length > 4 && (
                      <span className="px-2 py-0.5 text-xs text-muted-foreground">
                        +{emergencyReadiness.missing.length - 4}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={(e) => { e.stopPropagation(); setShowEmergencyModal(true); }}
              >
                <Activity className="w-4 h-4 me-2" />
                {t('viewEmergencyDetails')}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.1 }}
        >
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t('exportInventory')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full justify-start" onClick={onAddNew}>
                <Pill className="w-4 h-4 me-2" />
                {t('addMedicine')}
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => onNavigate('export')}
              >
                <TrendingUp className="w-4 h-4 me-2" />
                {t('exportInventory')}
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => onNavigate('settings')}
              >
                <Activity className="w-4 h-4 me-2" />
                {t('settings')}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Expiring Soon */}
        <motion.div
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.2 }}
        >
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-amber-500" />
                {t('expiringSoon')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {expiringMedicines.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t('noMedicines')}
                </p>
              ) : (
                <div className="space-y-2">
                  {expiringMedicines.map((med) => {
                    const days = getDaysUntilExpiration(med.expirationDate);
                    return (
                      <div
                        key={med.id}
                        onClick={() => onEdit(med.id)}
                        className="flex items-center justify-between p-3 rounded-lg bg-accent/50 hover:bg-accent cursor-pointer transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{med.name}</p>
                          <p className="text-xs text-muted-foreground">{med.dosage}</p>
                        </div>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                            days <= 7
                              ? 'bg-red-500/10 text-red-500'
                              : 'bg-amber-500/10 text-amber-500'
                          }`}
                        >
                          {days}d
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Needs Renewal / Out of Stock Section */}
      <motion.div
        variants={itemVariants}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.25 }}
      >
        <Card className="border-orange-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-orange-500" />
              {t('needsRenewal')}
              {renewalMedicines.length > 0 && (
                <span className="ms-auto text-xs font-normal px-2 py-0.5 bg-orange-500/10 text-orange-500 rounded-full">
                  {renewalMedicines.length}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {renewalMedicines.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-4 text-emerald-500">
                <CheckCircle2 className="w-4 h-4" />
                <p className="text-sm font-medium">{t('noRenewalNeeded')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {renewalMedicines.map((med) => {
                  const days = getDaysUntilExpiration(med.expirationDate);
                  const isExpired = days < 0;
                  const isOutOfStock = med.quantity === 0;
                  return (
                    <div
                      key={med.id}
                      onClick={() => onEdit(med.id)}
                      className="flex items-center justify-between p-3 rounded-lg bg-accent/50 hover:bg-accent cursor-pointer transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{med.name}</p>
                        <p className="text-xs text-muted-foreground">{med.dosage}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isOutOfStock && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-500">
                            {t('outOfStock')}
                          </span>
                        )}
                        {isExpired && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-500">
                            {t('expiredTag')}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Emergency Medicines Detail Modal */}
      <AnimatePresence>
        {showEmergencyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 pb-[84px] sm:pb-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowEmergencyModal(false)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 20 }}
              className="w-full max-w-md bg-card rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-primary" />
                  <h2 className="font-bold text-lg">{t('emergencyMedicinesList')}</h2>
                </div>
                <button
                  onClick={() => setShowEmergencyModal(false)}
                  className="p-1.5 rounded-lg hover:bg-accent"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Readiness bar in modal */}
              <div className="px-5 pt-4 pb-2">
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-sm font-medium ${readinessColor}`}>{readinessLabel}</span>
                  <span className={`text-2xl font-bold ${readinessColor}`}>{emergencyReadiness.score}%</span>
                </div>
                <Progress value={emergencyReadiness.score} className={`h-2 mb-1 transition-transform${isRTL ? ' [transform:scaleX(-1)]' : ''}`} />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span className="text-red-400">{t('readinessWeak')}</span>
                  <span>{emergencyReadiness.found}/{emergencyReadiness.total}</span>
                  <span className="text-emerald-500">{t('readinessExcellent')}</span>
                </div>
              </div>

              {/* Unified Emergency Items List — tap missing items to mark as present */}
              <div className="px-5 py-3 max-h-72 overflow-y-auto space-y-2">
                {EMERGENCY_ITEMS.map((item) => {
                  const inMeds = emergencyReadiness.inMedications.includes(item);
                  const manually = emergencyReadiness.manuallyPresent.includes(item);
                  const isPresent = inMeds || manually;

                  // Find ALL matching medications and sum their quantities
                  const matchedMeds = inMeds
                    ? medications.filter((m) => {
                        const low = item.toLowerCase();
                        return m.name.toLowerCase().includes(low) || m.activeIngredient.toLowerCase().includes(low);
                      })
                    : [];
                  const totalQty = matchedMeds.reduce((sum, m) => sum + m.quantity, 0);

                  return (
                    <div
                      key={item}
                      onClick={() => { if (!inMeds) onToggleEmergencyItem(item); }}
                      className={`flex items-center gap-2.5 p-2.5 rounded-lg border transition-all ${
                        isPresent
                          ? 'bg-emerald-500/5 border-emerald-500/20'
                          : 'bg-destructive/5 border-destructive/20 cursor-pointer hover:bg-destructive/10 active:scale-[0.98]'
                      } ${!inMeds ? 'cursor-pointer' : ''}`}
                    >
                      {isPresent ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-destructive shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{item}</p>
                        {inMeds && totalQty > 0 && (
                          <p className="text-xs text-muted-foreground">x{totalQty}</p>
                        )}
                      </div>
                      {inMeds && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500 shrink-0">
                          {t('inMedications')}
                        </span>
                      )}
                      {manually && !inMeds && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 shrink-0">
                          {t('manualMark')}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-border flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowEmergencyModal(false)}>
                  {t('closeDetails')}
                </Button>
                <Button className="flex-1" onClick={() => { setShowEmergencyModal(false); onNavigate('medicines'); }}>
                  {t('medicines')}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Expired Medicines — confirmation */}
      <AlertDialog open={showDeleteExpiredConfirm} onOpenChange={setShowDeleteExpiredConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteExpiredConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteExpiredConfirmDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDeleteExpired?.();
                setShowDeleteExpiredConfirm(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('deleteExpiredButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
