import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/i18n/I18nContext';
import { suggestUnitConcentrationMg, defaultTimesForFrequency } from '@/services/doseReminderService';
import { cn } from '@/lib/utils';

/** Lightweight draft shape used while editing — numeric fields stay as
 * strings so the user can type freely, and are parsed/validated on save. */
export interface DoseReminderDraft {
  enabled: boolean;
  doseMg: string;
  unitConcentrationMg: string;
  timesPerDay: number;
  times: string[];
}

export function emptyReminderDraft(): DoseReminderDraft {
  return { enabled: false, doseMg: '', unitConcentrationMg: '', timesPerDay: 2, times: defaultTimesForFrequency(2) };
}

interface DoseReminderEditorProps {
  draft: DoseReminderDraft;
  onChange: (draft: DoseReminderDraft) => void;
  /** The medicine's existing free-text `dosage` field, used only to suggest a starting concentration. */
  dosageHint?: string;
}

export default function DoseReminderEditor({ draft, onChange, dosageHint }: DoseReminderEditorProps) {
  const { t } = useI18n();
  const suggestion = dosageHint ? suggestUnitConcentrationMg(dosageHint) : undefined;

  const patch = (p: Partial<DoseReminderDraft>) => onChange({ ...draft, ...p });

  const setTimesPerDay = (n: number) => {
    patch({ timesPerDay: n, times: defaultTimesForFrequency(n) });
  };

  const setTimeAt = (index: number, value: string) => {
    const times = [...draft.times];
    times[index] = value;
    patch({ times });
  };

  const doseNum = parseFloat(draft.doseMg);
  const concNum = parseFloat(draft.unitConcentrationMg);
  const showMathHint = draft.enabled && doseNum > 0 && concNum > 0;
  const fraction = showMathHint ? doseNum / concNum : 0;
  const perDay = showMathHint ? fraction * draft.timesPerDay : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <Checkbox
          id="reminder-enabled"
          checked={draft.enabled}
          onCheckedChange={(checked) => patch({ enabled: !!checked })}
          className="mt-0.5"
        />
        <div>
          <Label htmlFor="reminder-enabled" className="cursor-pointer font-medium">
            {t('reminderEnable')}
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">{t('reminderEnableDesc')}</p>
        </div>
      </div>

      {draft.enabled && (
        <div className="space-y-4 ps-0 sm:ps-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t('reminderDoseMg')}</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={draft.doseMg}
                onChange={(e) => patch({ doseMg: e.target.value.replace(/[^0-9.]/g, '') })}
                placeholder="500"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t('reminderUnitConcentration')}</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={draft.unitConcentrationMg}
                onChange={(e) => patch({ unitConcentrationMg: e.target.value.replace(/[^0-9.]/g, '') })}
                placeholder={suggestion ? String(suggestion) : '1000'}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t('reminderTimesPerDay')}</Label>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setTimesPerDay(n)}
                  className={cn(
                    'flex-1 py-1.5 rounded-md border text-sm transition-colors',
                    draft.timesPerDay === n
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border text-muted-foreground hover:bg-accent'
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{t('reminderTimesLabel')}</Label>
            <div className="grid grid-cols-2 gap-2">
              {draft.times.map((time, i) => (
                <Input key={i} type="time" value={time} onChange={(e) => setTimeAt(i, e.target.value)} />
              ))}
            </div>
          </div>

          {showMathHint && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2.5 leading-relaxed">
              {t('reminderMathHint')
                .replace('{fraction}', fraction.toFixed(2))
                .replace('{perDay}', perDay.toFixed(2))}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
