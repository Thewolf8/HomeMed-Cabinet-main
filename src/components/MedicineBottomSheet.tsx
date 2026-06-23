import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Pencil,
  Trash2,
  Bell,
  BellOff,
  MapPin,
  CheckCircle2,
  Clock,
  Package,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/I18nContext';
import type { Medication, DoseReminder } from '@/types/medication';
import { getDaysUntilExpiration } from '@/services/exportService';
import DoseReminderEditor from '@/components/DoseReminderEditor';
import { draftToReminder, reminderToDraft, getDueTimes } from '@/services/doseReminderService';

interface MedicineBottomSheetProps {
  medication: Medication | null;
  onClose: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onSetReminder: (id: string, reminder: DoseReminder) => void;
  onRemoveReminder: (id: string) => void;
  onConfirmDose: (id: string, doseTime: string, taken: boolean) => void;
}

export default function MedicineBottomSheet({
  medication,
  onClose,
  onEdit,
  onDelete,
  onSetReminder,
  onRemoveReminder,
  onConfirmDose,
}: MedicineBottomSheetProps) {
  const { t } = useI18n();
  const [showReminderEditor, setShowReminderEditor] = useState(false);
  const [reminderDraft, setReminderDraft] = useState(() =>
    reminderToDraft(medication?.reminder)
  );

  // Sync the reminder draft whenever the medication prop changes — either
  // because a different medication was tapped (id changes) or because the
  // same medication's reminder was just saved/removed (id stays the same
  // but the reminder object itself changes). Using a stable JSON string as
  // the dependency is safe here because the object is small and this only
  // runs when the parent genuinely passes a new reference.
  useEffect(() => {
    setReminderDraft(reminderToDraft(medication?.reminder));
    // Only collapse the editor when switching to a completely different
    // medication — keep it open if the user just saved a new reminder so
    // they can see the result without extra taps.
    if (!medication?.reminder?.enabled) {
      setShowReminderEditor(false);
    }
  }, [medication?.id, JSON.stringify(medication?.reminder)]);

  if (!medication) return null;

  const days = getDaysUntilExpiration(medication.expirationDate);
  const dueTimes = medication.reminder ? getDueTimes(medication.reminder) : [];

  const expiryColor =
    days < 0 ? 'text-red-500' : days <= 30 ? 'text-amber-500' : 'text-emerald-500';

  const handleSaveReminder = () => {
    const reminder = draftToReminder(reminderDraft, medication.reminder);
    if (reminder) {
      onSetReminder(medication.id, reminder);
    } else if (medication.reminder) {
      onRemoveReminder(medication.id);
    }
    setShowReminderEditor(false);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60"
          onClick={onClose}
        />

        {/* Sheet */}
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="relative w-full max-w-2xl bg-background rounded-t-2xl shadow-xl max-h-[85vh] flex flex-col"
        >
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>

          {/* Header */}
          <div className="flex items-start justify-between px-5 py-3 border-b border-border shrink-0">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold leading-tight truncate">{medication.name}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{medication.activeIngredient} · {medication.dosage}</p>
            </div>
            <button
              onClick={onClose}
              className="ms-2 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

            {/* Key info chips */}
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="flex items-center gap-1.5 bg-muted/50 rounded-full px-3 py-1">
                <Package className="w-3.5 h-3.5 shrink-0" />
                {medication.quantity} {t('units')}
              </span>
              <span className={`flex items-center gap-1.5 bg-muted/50 rounded-full px-3 py-1 ${expiryColor}`}>
                {days < 0 ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> : <Clock className="w-3.5 h-3.5 shrink-0" />}
                {days < 0
                  ? t('expired')
                  : days === 0
                  ? t('expiresToday')
                  : `${days} ${t('days')}`}
              </span>
              {medication.storageLocation && (
                <span className="flex items-center gap-1.5 bg-muted/50 rounded-full px-3 py-1">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  {t(`storage_${medication.storageLocation}`)}
                  {medication.storageLocationNote ? ` — ${medication.storageLocationNote}` : ''}
                </span>
              )}
            </div>

            {/* Due doses prompt */}
            {dueTimes.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                  {t('doseDuePrompt')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {dueTimes.map((time) => (
                    <div key={time} className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">{time}</span>
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 text-xs"
                        onClick={() => { onConfirmDose(medication.id, time, true); onClose(); }}
                      >
                        <CheckCircle2 className="w-3 h-3 me-1" />
                        {t('doseTaken')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => { onConfirmDose(medication.id, time, false); onClose(); }}
                      >
                        {t('doseSnooze')}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {(medication.usageInstructions || medication.notes) && (
              <div className="space-y-1">
                {medication.usageInstructions && (
                  <p className="text-sm text-muted-foreground">{medication.usageInstructions}</p>
                )}
                {medication.notes && (
                  <p className="text-xs text-muted-foreground italic">{medication.notes}</p>
                )}
              </div>
            )}

            {/* Dose Reminder section */}
            <div className="border border-border rounded-lg overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors"
                onClick={() => setShowReminderEditor((p) => !p)}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  {medication.reminder?.enabled ? (
                    <Bell className="w-4 h-4 text-primary" />
                  ) : (
                    <BellOff className="w-4 h-4 text-muted-foreground" />
                  )}
                  {medication.reminder?.enabled
                    ? `${t('reminderActive')}: ${medication.reminder.times.join(' · ')}`
                    : t('reminderSetup')}
                </span>
                <span className="text-xs text-muted-foreground">
                  {showReminderEditor ? '▲' : '▼'}
                </span>
              </button>

              {showReminderEditor && (
                <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                  <DoseReminderEditor
                    draft={reminderDraft}
                    onChange={setReminderDraft}
                    dosageHint={medication.dosage}
                  />
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={handleSaveReminder} className="flex-1">
                      {t('reminderSave')}
                    </Button>
                    {medication.reminder?.enabled && (
                      <Button size="sm" variant="outline" onClick={() => { onRemoveReminder(medication.id); setShowReminderEditor(false); }}>
                        {t('reminderRemove')}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex gap-3 px-5 py-4 border-t border-border shrink-0">
            <Button className="flex-1" onClick={() => { onEdit(medication.id); onClose(); }}>
              <Pencil className="w-4 h-4 me-1.5" />
              {t('editMedicine')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => { onDelete(medication.id); onClose(); }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
