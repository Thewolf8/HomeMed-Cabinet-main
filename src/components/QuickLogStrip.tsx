import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '@/i18n/I18nContext';
import { doseCategoryForForm } from '@/types/medication';
import type { Medication } from '@/types/medication';
import type { ToastType } from '@/hooks/use-toast';

interface QuickLogStripProps {
  medications: Medication[];
  onLog: (medId: string, amount: number) => void;
  toast: ToastType;
}

const UNIT_OPTIONS = [0.5, 1, 2, 3];
const VOLUME_OPTIONS = [5, 10, 15, 20];
const DROP_OPTIONS = [1, 2, 3, 5];

/**
 * Dashboard-pinned strip of "as-needed" medicines (period pain relief, PRN
 * painkillers, etc.) for one-tap logging — no schedule, no pre-set dose.
 * Tap the medicine, tap the amount, done. Renders nothing when no medicine
 * has asNeeded enabled.
 */
export default function QuickLogStrip({ medications, onLog, toast }: QuickLogStripProps) {
  const { t } = useI18n();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const asNeededMeds = medications.filter((m) => m.asNeeded);
  if (asNeededMeds.length === 0) return null;

  const expandedMed = asNeededMeds.find((m) => m.id === expandedId) ?? null;
  const expandedCategory = expandedMed ? doseCategoryForForm(expandedMed.form) : null;

  const options =
    expandedCategory === 'units' ? UNIT_OPTIONS
    : expandedCategory === 'volume' ? VOLUME_OPTIONS
    : expandedCategory === 'drops' ? DROP_OPTIONS
    : [];

  const formatOption = (n: number) => {
    if (expandedCategory === 'units') return n === 0.5 ? t('quickLogHalf') : String(n);
    if (expandedCategory === 'volume') return `${n} ml`;
    return String(n);
  };

  const handleTapMed = (med: Medication) => {
    const category = doseCategoryForForm(med.form);
    if (category === 'none') {
      onLog(med.id, 0);
      toast(`${t('quickLogSaved')} — ${med.name}`);
      setExpandedId(null);
      return;
    }
    setExpandedId((prev) => (prev === med.id ? null : med.id));
  };

  const handlePickAmount = (amount: number) => {
    if (!expandedMed) return;
    onLog(expandedMed.id, amount);
    toast(`${t('quickLogSaved')} — ${expandedMed.name}`);
    setExpandedId(null);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground px-1">{t('quickLogTitle')}</p>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {asNeededMeds.map((med) => {
          const isActive = expandedId === med.id;
          return (
            <button
              key={med.id}
              type="button"
              onClick={() => handleTapMed(med)}
              className={`shrink-0 px-3.5 py-2 rounded-full border text-sm font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card hover:bg-accent'
              }`}
            >
              {med.name}
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {expandedMed && expandedCategory !== 'none' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex gap-1.5 flex-wrap px-1 overflow-hidden"
          >
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => handlePickAmount(opt)}
                className="px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold"
              >
                {formatOption(opt)}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
