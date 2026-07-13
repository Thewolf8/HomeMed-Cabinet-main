import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/i18n/I18nContext';
import { suggestUnitConcentrationMg, defaultTimesForFrequency } from '@/services/doseReminderService';
import { doseCategoryForForm, SPOON_ML, DROP_VOLUME_ML } from '@/types/medication';
import type { MedicineForm } from '@/types/medication';
import { cn } from '@/lib/utils';

/** Lightweight draft shape used while editing — numeric fields stay as
 * strings so the user can type freely, and are parsed/validated on save.
 * Structurally matches ReminderDraftShape in doseReminderService.ts. */
export interface DoseReminderDraft {
  enabled: boolean;
  timesPerDay: number;
  times: string[];
  // Recurrence pattern
  frequency: 'daily' | 'weekly' | 'interval';
  daysOfWeek: number[];    // for 'weekly'
  intervalDays: string;    // for 'interval'
  // 'units' mode (tablets/capsules/etc.)
  doseMg: string;
  unitConcentrationMg: string;
  // 'volume' mode (syrup/solution/suspension)
  volumeInputMode: 'ml' | 'spoon';
  doseVolumeMl: string;
  spoonCount: string;
  spoonType: 'tablespoon' | 'teaspoon';
  // 'drops' mode
  doseDrops: string;
}

export function emptyReminderDraft(): DoseReminderDraft {
  return {
    enabled: false,
    timesPerDay: 2,
    times: defaultTimesForFrequency(2),
    frequency: 'daily',
    daysOfWeek: [],
    intervalDays: '2',
    doseMg: '',
    unitConcentrationMg: '',
    volumeInputMode: 'ml',
    doseVolumeMl: '',
    spoonCount: '',
    spoonType: 'teaspoon',
    doseDrops: '',
  };
}

/** Short day-name translation keys, indexed 0=Sunday..6=Saturday to match JS Date.getDay(). */
const DAY_LABELS_KEYS = [
  'dayShortSun', 'dayShortMon', 'dayShortTue', 'dayShortWed', 'dayShortThu', 'dayShortFri', 'dayShortSat',
] as const;

interface DoseReminderEditorProps {
  draft: DoseReminderDraft;
  onChange: (draft: DoseReminderDraft) => void;
  /** The medicine's existing free-text `dosage` field, used only to suggest a starting concentration in 'units' mode. */
  dosageHint?: string;
  /** The medicine's form — determines which dosing input (units/volume/drops/none) is shown. */
  medicineForm: MedicineForm;
}

export default function DoseReminderEditor({ draft, onChange, dosageHint, medicineForm }: DoseReminderEditorProps) {
  const { t } = useI18n();
  const category = doseCategoryForForm(medicineForm);
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

  // ── 'units' mode math hint (tablets/capsules/etc. — unchanged from before) ──
  const doseNum = parseFloat(draft.doseMg);
  const concNum = parseFloat(draft.unitConcentrationMg);
  const showMathHint = category === 'units' && draft.enabled && doseNum > 0 && concNum > 0;
  const fraction = showMathHint ? doseNum / concNum : 0;
  const perDay = showMathHint ? fraction * draft.timesPerDay : 0;

  // ── 'volume'/'drops' mode computed ml (for the confirmation hint) ──
  const computedMl = (() => {
    if (category === 'drops') {
      const drops = parseFloat(draft.doseDrops);
      return isFinite(drops) && drops > 0 ? drops * DROP_VOLUME_ML : 0;
    }
    if (category === 'volume') {
      if (draft.volumeInputMode === 'spoon') {
        const count = parseFloat(draft.spoonCount);
        return isFinite(count) && count > 0 ? count * SPOON_ML[draft.spoonType] : 0;
      }
      const ml = parseFloat(draft.doseVolumeMl);
      return isFinite(ml) && ml > 0 ? ml : 0;
    }
    return 0;
  })();

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
          <p className="text-xs text-muted-foreground mt-0.5">
            {category === 'none' ? t('reminderEnableDescNoStock') : t('reminderEnableDesc')}
          </p>
        </div>
      </div>

      {draft.enabled && (
        <div className="space-y-4 ps-0 sm:ps-1">
          {/* ── Frequency — when this reminder recurs ─────────────────────── */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{t('reminderFrequency')}</Label>
            <div className="flex gap-2">
              {(['daily', 'weekly', 'interval'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => patch({ frequency: f })}
                  className={cn(
                    'flex-1 py-1.5 rounded-md border text-sm transition-colors',
                    draft.frequency === f
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border text-muted-foreground hover:bg-accent'
                  )}
                >
                  {f === 'daily' ? t('frequencyDaily') : f === 'weekly' ? t('frequencyWeekly') : t('frequencyInterval')}
                </button>
              ))}
            </div>
          </div>

          {/* ── Weekly: pick which day(s) ──────────────────────────────────── */}
          {draft.frequency === 'weekly' && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t('reminderDaysOfWeek')}</Label>
              <div className="grid grid-cols-7 gap-1.5">
                {DAY_LABELS_KEYS.map((key, dayIndex) => {
                  const active = draft.daysOfWeek.includes(dayIndex);
                  return (
                    <button
                      key={dayIndex}
                      type="button"
                      onClick={() => {
                        const next = active
                          ? draft.daysOfWeek.filter((d) => d !== dayIndex)
                          : [...draft.daysOfWeek, dayIndex].sort();
                        patch({ daysOfWeek: next });
                      }}
                      className={cn(
                        'aspect-square rounded-md border text-xs font-medium transition-colors',
                        active
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:bg-accent'
                      )}
                    >
                      {t(key)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Interval: every N days ─────────────────────────────────────── */}
          {draft.frequency === 'interval' && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t('reminderIntervalDays')}</Label>
              <div className="flex items-center gap-2">
                {[2, 3].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => patch({ intervalDays: String(n) })}
                    className={cn(
                      'py-1.5 px-4 rounded-md border text-sm transition-colors',
                      draft.intervalDays === String(n)
                        ? 'border-primary bg-primary/10 text-primary font-medium'
                        : 'border-border text-muted-foreground hover:bg-accent'
                    )}
                  >
                    {n}
                  </button>
                ))}
                <Input
                  type="text"
                  inputMode="numeric"
                  value={draft.intervalDays}
                  onChange={(e) => patch({ intervalDays: e.target.value.replace(/[^0-9]/g, '') })}
                  className="w-20"
                  placeholder="5"
                />
                <span className="text-xs text-muted-foreground">{t('reminderIntervalSuffix')}</span>
              </div>
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2.5 leading-relaxed">
                {t('reminderIntervalHint')}
              </p>
            </div>
          )}

          {/* ── Dose amount section — shape depends on the medicine's form ── */}

          {category === 'units' && (
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
          )}

          {category === 'volume' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => patch({ volumeInputMode: 'ml' })}
                  className={cn(
                    'flex-1 py-1.5 rounded-md border text-sm transition-colors',
                    draft.volumeInputMode === 'ml'
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border text-muted-foreground hover:bg-accent'
                  )}
                >
                  {t('reminderVolumeModeMl')}
                </button>
                <button
                  type="button"
                  onClick={() => patch({ volumeInputMode: 'spoon' })}
                  className={cn(
                    'flex-1 py-1.5 rounded-md border text-sm transition-colors',
                    draft.volumeInputMode === 'spoon'
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border text-muted-foreground hover:bg-accent'
                  )}
                >
                  {t('reminderVolumeModeSpoon')}
                </button>
              </div>

              {draft.volumeInputMode === 'ml' ? (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{t('reminderDoseVolumeMl')}</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={draft.doseVolumeMl}
                    onChange={(e) => patch({ doseVolumeMl: e.target.value.replace(/[^0-9.]/g, '') })}
                    placeholder="5"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">{t('reminderSpoonCount')}</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={draft.spoonCount}
                      onChange={(e) => patch({ spoonCount: e.target.value.replace(/[^0-9.]/g, '') })}
                      placeholder="1"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">{t('reminderSpoonType')}</Label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => patch({ spoonType: 'teaspoon' })}
                        className={cn(
                          'flex-1 py-1.5 rounded-md border text-xs transition-colors',
                          draft.spoonType === 'teaspoon'
                            ? 'border-primary bg-primary/10 text-primary font-medium'
                            : 'border-border text-muted-foreground hover:bg-accent'
                        )}
                      >
                        {t('spoonTeaspoon')}
                      </button>
                      <button
                        type="button"
                        onClick={() => patch({ spoonType: 'tablespoon' })}
                        className={cn(
                          'flex-1 py-1.5 rounded-md border text-xs transition-colors',
                          draft.spoonType === 'tablespoon'
                            ? 'border-primary bg-primary/10 text-primary font-medium'
                            : 'border-border text-muted-foreground hover:bg-accent'
                        )}
                      >
                        {t('spoonTablespoon')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {category === 'drops' && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t('reminderDropsCount')}</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={draft.doseDrops}
                onChange={(e) => patch({ doseDrops: e.target.value.replace(/[^0-9.]/g, '') })}
                placeholder="3"
              />
            </div>
          )}

          {/* ── Times per day + specific times — shared by every dosing mode ── */}
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

          {/* ── Confirmation hints ── */}
          {showMathHint && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2.5 leading-relaxed">
              {t('reminderMathHint')
                .replace('{fraction}', fraction.toFixed(2))
                .replace('{perDay}', perDay.toFixed(2))}
            </p>
          )}

          {(category === 'volume' || category === 'drops') && computedMl > 0 && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2.5 leading-relaxed">
              {t('reminderVolumeHint').replace('{ml}', computedMl.toFixed(2))}
            </p>
          )}

          {category === 'none' && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2.5 leading-relaxed">
              {t('reminderNoStockHint')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
