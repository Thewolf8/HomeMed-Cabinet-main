import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ClipboardList,
  CheckCircle2,
  Pill,
  Clock,
  Trash2,
  ChevronDown,
  ChevronUp,
  BarChart3,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { getDoseLogs, clearDoseLogs } from '@/services/doseLogService';
import type { DoseLog } from '@/types/doseLog';

// ── Date helpers ───────────────────────────────────────────────────────────

function todayLabel(t: (k: string) => string): string {
  const d = new Date();
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

function yesterdayStart(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateKey(iso: string): string {
  return iso.slice(0, 10); // YYYY-MM-DD
}

function formatGroupLabel(dateKeyStr: string, t: (k: string) => string): string {
  const [year, month, day] = dateKeyStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1); yesterday.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  if (d.getTime() === today.getTime()) return t('historyToday');
  if (d.getTime() === yesterday.getTime()) return t('historyYesterday');
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

// ── Stats ──────────────────────────────────────────────────────────────────

function computeStats(logs: DoseLog[]) {
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const thisWeek = logs.filter((l) => new Date(l.confirmedAt).getTime() >= weekAgo);

  // Very rough adherence: unique (medicationId × scheduledTime × date) combos
  // that were confirmed vs all combinations that should have been taken.
  // We just show the raw count — it's honest and simple.
  return {
    totalThisWeek: thisWeek.length,
    totalAllTime: logs.length,
    uniqueMedicationsThisWeek: new Set(thisWeek.map((l) => l.medicationId)).size,
  };
}

// ── Component ──────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const { t } = useI18n();
  const [logs, setLogs] = useState<DoseLog[]>([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const reload = useCallback(() => setLogs(getDoseLogs()), []);

  useEffect(() => { reload(); }, [reload]);

  // Group logs by date key
  const groups: { key: string; label: string; entries: DoseLog[] }[] = [];
  const seen = new Map<string, DoseLog[]>();
  for (const log of logs) {
    const k = dateKey(log.confirmedAt);
    if (!seen.has(k)) seen.set(k, []);
    seen.get(k)!.push(log);
  }
  // Most recent first
  for (const [k, entries] of seen.entries()) {
    groups.push({ key: k, label: formatGroupLabel(k, t), entries });
  }

  // Initially expand today and yesterday
  useEffect(() => {
    if (groups.length > 0) {
      const auto = new Set<string>();
      const today = dateKey(new Date().toISOString());
      const yesterday = dateKey(new Date(Date.now() - 86400000).toISOString());
      for (const g of groups) {
        if (g.key === today || g.key === yesterday) auto.add(g.key);
      }
      setExpandedGroups(auto);
    }
  }, [logs.length]);

  const toggleGroup = (key: string) =>
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const stats = computeStats(logs);

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.22 } },
  };

  return (
    <div className="space-y-5 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('historyTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('historySubtitle')}</p>
        </div>
        {logs.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setShowClearConfirm(true)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Stats bar */}
      {logs.length > 0 && (
        <motion.div variants={itemVariants} initial="hidden" animate="visible">
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-2xl font-bold text-primary">{stats.totalThisWeek}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t('historyThisWeek')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-2xl font-bold">{stats.totalAllTime}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t('historyTotal')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-2xl font-bold text-emerald-500">{stats.uniqueMedicationsThisWeek}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t('historyMedications')}</p>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      {logs.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <ClipboardList className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-lg font-semibold">{t('historyEmpty')}</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">{t('historyEmptyDesc')}</p>
        </motion.div>
      )}

      {/* Timeline */}
      {groups.map((group, gi) => {
        const isOpen = expandedGroups.has(group.key);
        return (
          <motion.div
            key={group.key}
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            style={{ transitionDelay: `${gi * 40}ms` }}
          >
            {/* Day header */}
            <button
              type="button"
              className="w-full flex items-center justify-between mb-2 group"
              onClick={() => toggleGroup(group.key)}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{group.label}</span>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {group.entries.length}
                </span>
              </div>
              {isOpen ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>

            {/* Entries */}
            {isOpen && (
              <div className="space-y-2">
                {group.entries.map((log) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-start gap-3 rounded-xl border border-border bg-card p-3"
                  >
                    {/* Icon */}
                    <div className="mt-0.5 w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-tight truncate">{log.medicationName}</p>
                        <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(log.confirmedAt)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{log.dosage}</p>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5">
                          {log.doseMg} mg
                        </span>
                        {log.unitsDeducted > 0 && (
                          <span className="text-xs text-muted-foreground">
                            −{log.unitsDeducted} {t('units')}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {t('historyScheduled')}: {log.scheduledTime}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        );
      })}

      {/* Clear confirmation dialog */}
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('historyClearTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('historyClearDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { clearDoseLogs(); reload(); setShowClearConfirm(false); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('historyClearConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
