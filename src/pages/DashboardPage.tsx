import { motion } from 'framer-motion';
import {
  Pill,
  AlertTriangle,
  CalendarClock,
  PackageOpen,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Activity,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useI18n } from '@/i18n/I18nContext';
import type { Medication, DashboardStats } from '@/types/medication';
import type { Page } from '@/App';
import { getDaysUntilExpiration } from '@/services/exportService';

interface DashboardPageProps {
  medications: Medication[];
  stats: DashboardStats;
  emergencyReadiness: {
    score: number;
    missing: string[];
    status: string;
    total: number;
    found: number;
  };
  onNavigate: (page: Page) => void;
  onAddNew: () => void;
  onEdit: (id: string) => void;
}

interface StatCard {
  key: 'expired' | 'expiringSoon' | 'lowStock' | 'total';
  icon: typeof Pill;
  color: string;
  bgColor: string;
  borderColor: string;
}

const statCards: StatCard[] = [
  {
    key: 'total',
    icon: Pill,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
  },
  {
    key: 'expiringSoon',
    icon: CalendarClock,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
  },
  {
    key: 'expired',
    icon: AlertTriangle,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
  },
  {
    key: 'lowStock',
    icon: PackageOpen,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/20',
  },
];

export default function DashboardPage({
  medications,
  stats,
  emergencyReadiness,
  onNavigate,
  onAddNew,
  onEdit,
}: DashboardPageProps) {
  const { t, isRTL } = useI18n();

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

  // Get expiring medicines for quick view
  const expiringMedicines = medications
    .filter((m) => {
      const days = getDaysUntilExpiration(m.expirationDate);
      return days >= 0 && days <= 30;
    })
    .sort((a, b) => new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime())
    .slice(0, 5);

  // Get emergency medicines
  const emergencyMedicines = medications
    .filter((m) => m.category === 'emergency')
    .slice(0, 5);

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

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center md:text-left"
      >
        <h1 className="text-2xl md:text-3xl font-bold mb-1">{t('appName')}</h1>
        <p className="text-muted-foreground">{t('tagline')}</p>
      </motion.div>

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

          return (
            <motion.div key={card.key} variants={itemVariants}>
              <Card
                className={`${card.borderColor} border bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-all duration-300 cursor-pointer group`}
                onClick={() => onNavigate('medicines')}
              >
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-start justify-between">
                    <div className={`p-2.5 rounded-xl ${card.bgColor}`}>
                      <Icon className={`w-5 h-5 ${card.color}`} />
                    </div>
                    <ArrowRight
                      className={`w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity transform ${
                        isRTL ? 'rotate-180' : ''
                      }`}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Emergency Readiness */}
        <motion.div variants={itemVariants} initial="hidden" animate="visible">
          <Card className="h-full">
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

              <Progress value={emergencyReadiness.score} className="h-2" />

              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t('readinessWeak')}</span>
                <span>{emergencyReadiness.found}/{emergencyReadiness.total}</span>
                <span>{t('readinessExcellent')}</span>
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
                onClick={() => onNavigate('medicines')}
              >
                <Activity className="w-4 h-4 mr-2" />
                {t('medicines')}
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
                <Pill className="w-4 h-4 mr-2" />
                {t('addMedicine')}
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => onNavigate('export')}
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                {t('exportInventory')}
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => onNavigate('settings')}
              >
                <Activity className="w-4 h-4 mr-2" />
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

      {/* Emergency Medicines */}
      {emergencyMedicines.length > 0 && (
        <motion.div
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-500" />
                {t('emergency')} {t('medicines')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {emergencyMedicines.map((med) => {
                  const days = getDaysUntilExpiration(med.expirationDate);
                  const isExpired = days < 0;
                  const isExpiringSoon = days >= 0 && days <= 30;

                  return (
                    <div
                      key={med.id}
                      onClick={() => onEdit(med.id)}
                      className="p-3 rounded-lg border border-border hover:border-primary/50 cursor-pointer transition-all hover:shadow-md"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium">{med.name}</p>
                          <p className="text-xs text-muted-foreground">{med.dosage}</p>
                        </div>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            isExpired
                              ? 'bg-red-500/10 text-red-500'
                              : isExpiringSoon
                              ? 'bg-amber-500/10 text-amber-500'
                              : 'bg-emerald-500/10 text-emerald-500'
                          }`}
                        >
                          {isExpired ? t('expiredTag') : isExpiringSoon ? `${days}d` : 'OK'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('remaining')}: {med.quantity}
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
