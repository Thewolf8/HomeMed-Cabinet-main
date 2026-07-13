import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type ActionPerformed } from '@capacitor/local-notifications';
import type { DoseReminder, Medication, MedicineForm } from '@/types/medication';
import { doseCategoryForForm, SPOON_ML, DROP_VOLUME_ML } from '@/types/medication';
import { getSettings } from '@/hooks/useSettings';
import { hashToInt } from './notificationService';

const isNative = Capacitor.isNativePlatform();
const CHANNEL_ID = 'homemed-dose';
const ACTION_TYPE_ID = 'homemed-dose-confirm';

// Dose-reminder notification ids live in their own numeric band, well clear
// of the expiry-notification band in notificationService.ts (which tops out
// just under 1,000,000,000), so the two systems can never collide.
const DOSE_ID_OFFSET = 1_200_000_000;
const SNOOZE_SLOT = 100; // a dedicated slot per medication, clear of any realistic timesPerDay count

function doseNotificationId(medId: string, timeIndex: number): number {
  return DOSE_ID_OFFSET + hashToInt(medId) + timeIndex;
}

// Weekly/interval reminders are scheduled as one-off dated notifications
// (rather than relying on native "repeat weekly" triggers, whose weekday
// numbering conventions differ across platforms and are easy to get
// backwards) — each occurrence gets its own id in a sub-band starting at
// +1000, well clear of the daily per-time slots (0-3) and the snooze slot
// (100) used above.
const OCCURRENCE_SLOT_BASE = 1000;
const MAX_WEEKLY_OCCURRENCES = 16; // ~lookahead window; refreshed on every app open

function occurrenceNotificationId(medId: string, occurrenceIndex: number): number {
  return DOSE_ID_OFFSET + hashToInt(medId) + OCCURRENCE_SLOT_BASE + occurrenceIndex;
}

/**
 * Computes the next `count` upcoming (date, time) occurrences for a set of
 * weekdays + daily times, starting from now. Pure JS Date arithmetic — no
 * reliance on native "weekday" trigger numbering, which is easy to get
 * backwards between platforms.
 */
function computeUpcomingWeeklyOccurrences(daysOfWeek: number[], times: string[], count: number): Date[] {
  const occurrences: Date[] = [];
  const now = new Date();
  for (let dayOffset = 0; occurrences.length < count && dayOffset < 70; dayOffset++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);
    if (!daysOfWeek.includes(day.getDay())) continue;
    for (const time of times) {
      const [h, m] = time.split(':').map(Number);
      const occurrence = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0, 0);
      if (occurrence.getTime() <= now.getTime()) continue; // skip times already passed today
      occurrences.push(occurrence);
      if (occurrences.length >= count) break;
    }
  }
  return occurrences;
}

function snoozeNotificationId(medId: string): number {
  return DOSE_ID_OFFSET + hashToInt(medId) + SNOOZE_SLOT;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Self-contained strings, same rationale as notificationService.ts — this
// can run outside the React tree.
const STRINGS = {
  en: {
    title: 'Did you take your medicine?',
    body: (name: string) => `Time for your dose of ${name}.`,
    yes: 'Yes, taken',
    no: 'Not yet',
    snoozeBody: (name: string) => `Reminder: have you taken ${name} yet?`,
  },
  ar: {
    title: 'هل تناولت دواءك؟',
    body: (name: string) => `حان وقت جرعة ${name}.`,
    yes: 'نعم، تناولته',
    no: 'ليس بعد',
    snoozeBody: (name: string) => `تذكير: هل تناولت ${name} بعد؟`,
  },
  fr: {
    title: 'Avez-vous pris votre médicament ?',
    body: (name: string) => `C'est l'heure de votre dose de ${name}.`,
    yes: 'Oui, pris',
    no: 'Pas encore',
    snoozeBody: (name: string) => `Rappel : avez-vous pris ${name} ?`,
  },
} as const;

function strings() {
  let lang = getSettings().language;
  if (lang === 'system') {
    const nav = (typeof navigator !== 'undefined' && navigator.language) || 'en';
    lang = nav.startsWith('ar') ? 'ar' : nav.startsWith('fr') ? 'fr' : 'en';
  }
  if (lang === 'ar' || lang === 'fr') return STRINGS[lang];
  return STRINGS.en;
}

/**
 * One-time (per app session) setup: notification channel + the Yes/No
 * action type. Re-running this is cheap and safe, so it's also called
 * before every scheduling operation to pick up a language change.
 */
async function ensureReady(): Promise<boolean> {
  if (!isNative) return false;
  const s = strings();

  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Dose Reminders',
      description: 'Reminders to take your medicine, with quick Yes/No confirmation',
      importance: 5, // MAX — these are time-sensitive and expected to alert immediately
      visibility: 1,
    });
  } catch {
    // Android-only; ignore elsewhere.
  }

  try {
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: ACTION_TYPE_ID,
          actions: [
            { id: 'yes', title: s.yes },
            { id: 'no', title: s.no },
          ],
        },
      ],
    });
  } catch {
    // If this fails the notification still shows, just without the buttons.
  }

  return true;
}

/**
 * Computes the new quantity/accumulator after one confirmed dose.
 *  - 'volume' mode: doseVolumeMl is deducted from currentQuantity directly
 *    (both already expressed in the same unit — ml), no fractional
 *    accumulator needed since ml deductions don't need whole-unit rounding.
 *  - 'units' mode (default, for backward compatibility with reminders that
 *    predate doseMode): dose-as-a-fraction-of-one-unit (e.g. 500mg dose /
 *    1000mg per tablet = 0.5). Quantity only ever drops by whole units —
 *    partial consumption is carried in `consumedFraction` until it
 *    accumulates to a full unit or more.
 */
export function computeDoseDeduction(
  reminder: Pick<DoseReminder, 'doseMode' | 'doseMg' | 'unitConcentrationMg' | 'consumedFraction' | 'doseVolumeMl'>,
  currentQuantity: number
): { newQuantity: number; newConsumedFraction: number } {
  const mode = reminder.doseMode ?? 'units';

  if (mode === 'volume') {
    const vol = reminder.doseVolumeMl ?? 0;
    return {
      newQuantity: Math.max(0, currentQuantity - vol),
      newConsumedFraction: 0,
    };
  }

  if (!reminder.unitConcentrationMg || reminder.unitConcentrationMg <= 0) {
    return { newQuantity: currentQuantity, newConsumedFraction: reminder.consumedFraction };
  }
  const doseFraction = reminder.doseMg / reminder.unitConcentrationMg;
  const total = reminder.consumedFraction + doseFraction;
  const wholeUnits = Math.floor(total);
  const remainder = total - wholeUnits;
  return {
    newQuantity: Math.max(0, currentQuantity - wholeUnits),
    newConsumedFraction: remainder,
  };
}

/**
 * Best-effort suggestion for unitConcentrationMg, parsed from the medicine's
 * existing free-text `dosage` field (e.g. "500mg" → 500, "1g" → 1000).
 * This is only ever shown as an editable suggestion, never applied silently
 * — dosage text is too inconsistent (ml, mg/5ml, etc.) to trust blindly for
 * a calculation that affects stock counts.
 */
export function suggestUnitConcentrationMg(dosage: string): number | undefined {
  const match = dosage.match(/([\d.]+)\s*(mcg|mg|g)\b/i);
  if (!match) return undefined;
  const value = parseFloat(match[1]);
  if (!isFinite(value) || value <= 0) return undefined;
  const unit = match[2].toLowerCase();
  if (unit === 'g') return value * 1000;
  if (unit === 'mcg') return value / 1000;
  return value; // mg
}


/** The full editable-draft shape, structurally matching DoseReminderDraft in DoseReminderEditor.tsx. */
interface ReminderDraftShape {
  enabled: boolean;
  timesPerDay: number;
  times: string[];
  // Recurrence pattern
  frequency: 'daily' | 'weekly' | 'interval';
  daysOfWeek: number[];    // for 'weekly'
  intervalDays: string;    // for 'interval' — string so it can be freely typed, parsed on save
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

/** Resolves a volume-category draft's various input styles down to one final ml amount. */
function resolveVolumeMl(draft: ReminderDraftShape, category: 'volume' | 'drops'): number {
  if (category === 'drops') {
    const drops = parseFloat(draft.doseDrops);
    return isFinite(drops) && drops > 0 ? drops * DROP_VOLUME_ML : 0;
  }
  if (draft.volumeInputMode === 'spoon') {
    const count = parseFloat(draft.spoonCount);
    return isFinite(count) && count > 0 ? count * SPOON_ML[draft.spoonType] : 0;
  }
  const ml = parseFloat(draft.doseVolumeMl);
  return isFinite(ml) && ml > 0 ? ml : 0;
}

/**
 * Converts an editable draft (from DoseReminderEditor) into a real
 * DoseReminder, preserving bookkeeping fields from the previous reminder
 * (if any) like consumedFraction and today's confirmations. `form` decides
 * which dosing model applies (see doseCategoryForForm). Returns undefined
 * if the draft is disabled or invalid (so callers can treat that as "no
 * reminder").
 */
export function draftToReminder(
  draft: ReminderDraftShape,
  form: MedicineForm,
  previous?: DoseReminder | null
): DoseReminder | undefined {
  if (!draft.enabled) return undefined;
  const times = draft.times.filter(Boolean);
  if (times.length === 0) return undefined;

  // Validate frequency-specific fields before proceeding.
  if (draft.frequency === 'weekly' && draft.daysOfWeek.length === 0) return undefined;
  let intervalDays: number | undefined;
  if (draft.frequency === 'interval') {
    intervalDays = parseInt(draft.intervalDays, 10);
    if (!isFinite(intervalDays) || intervalDays < 1) return undefined;
  }

  const category = doseCategoryForForm(form);

  // Switching frequency starts fresh rather than carrying over confirmation
  // progress that no longer makes sense under the new schedule (e.g. a
  // half-confirmed daily reminder becoming weekly).
  const previousFrequency = previous?.frequency ?? 'daily';
  const frequencyChanged = previousFrequency !== draft.frequency;

  const nextDueDate =
    draft.frequency === 'interval'
      ? (!frequencyChanged && previous?.nextDueDate) || todayStr()
      : undefined;

  const base = {
    enabled: true as const,
    timesPerDay: times.length,
    times,
    frequency: draft.frequency,
    daysOfWeek: draft.frequency === 'weekly' ? draft.daysOfWeek : undefined,
    intervalDays: draft.frequency === 'interval' ? intervalDays : undefined,
    nextDueDate,
    notificationIds: frequencyChanged ? [] : previous?.notificationIds ?? [],
    snoozeNotificationId: frequencyChanged ? undefined : previous?.snoozeNotificationId,
    confirmedToday: frequencyChanged ? [] : previous?.confirmedToday ?? [],
    confirmedDate:
      draft.frequency === 'interval'
        ? nextDueDate!
        : frequencyChanged
        ? todayStr()
        : previous?.confirmedDate ?? todayStr(),
  };

  if (category === 'none') {
    // Cream/ointment/gel — the reminder fires and can be confirmed as a
    // simple "remember to apply" nudge, but never touches stock.
    return { ...base, doseMode: 'none', doseMg: 0, unitConcentrationMg: 0, consumedFraction: 0 };
  }

  if (category === 'volume' || category === 'drops') {
    const doseVolumeMl = resolveVolumeMl(draft, category);
    if (doseVolumeMl <= 0) return undefined;
    return {
      ...base,
      doseMode: 'volume',
      doseMg: 0,
      unitConcentrationMg: 0,
      consumedFraction: 0,
      doseVolumeMl,
    };
  }

  // 'units' — original tablet/capsule fraction-based model, unchanged.
  const doseMg = parseFloat(draft.doseMg);
  const unitConcentrationMg = parseFloat(draft.unitConcentrationMg);
  if (!isFinite(doseMg) || doseMg <= 0 || !isFinite(unitConcentrationMg) || unitConcentrationMg <= 0) {
    return undefined;
  }
  return {
    ...base,
    doseMode: 'units',
    doseMg,
    unitConcentrationMg,
    consumedFraction: frequencyChanged ? 0 : previous?.consumedFraction ?? 0,
  };
}

/**
 * Converts a real DoseReminder (or none) into an editable draft. `form`
 * decides which stored fields map into which draft inputs — e.g. a
 * volume-mode reminder on a 'drops' medication reconstructs a drop count
 * (dividing the stored ml by the standard drop size) rather than showing
 * the raw ml value.
 */
export function reminderToDraft(
  reminder: DoseReminder | null | undefined,
  form: MedicineForm = 'tablets'
): ReminderDraftShape {
  const emptyBase = {
    volumeInputMode: 'ml' as const,
    doseVolumeMl: '',
    spoonCount: '',
    spoonType: 'teaspoon' as const,
    doseDrops: '',
  };

  if (!reminder) {
    return {
      enabled: false,
      timesPerDay: 2,
      times: defaultTimesForFrequency(2),
      frequency: 'daily',
      daysOfWeek: [],
      intervalDays: '2',
      doseMg: '',
      unitConcentrationMg: '',
      ...emptyBase,
    };
  }

  const frequency = reminder.frequency ?? 'daily';
  const freqBase = {
    frequency,
    daysOfWeek: reminder.daysOfWeek ?? [],
    intervalDays: reminder.intervalDays != null ? String(reminder.intervalDays) : '2',
  };

  const mode = reminder.doseMode ?? 'units';
  const category = doseCategoryForForm(form);

  if (mode === 'volume' && category === 'drops') {
    const ml = reminder.doseVolumeMl ?? 0;
    const drops = ml > 0 ? Math.round(ml / DROP_VOLUME_ML) : 0;
    return {
      enabled: reminder.enabled,
      timesPerDay: reminder.timesPerDay,
      times: reminder.times,
      ...freqBase,
      doseMg: '',
      unitConcentrationMg: '',
      ...emptyBase,
      doseDrops: drops > 0 ? String(drops) : '',
    };
  }

  if (mode === 'volume') {
    return {
      enabled: reminder.enabled,
      timesPerDay: reminder.timesPerDay,
      times: reminder.times,
      ...freqBase,
      doseMg: '',
      unitConcentrationMg: '',
      ...emptyBase,
      doseVolumeMl: reminder.doseVolumeMl != null && reminder.doseVolumeMl > 0 ? String(reminder.doseVolumeMl) : '',
    };
  }

  // 'units', 'none', or a legacy reminder with no doseMode at all.
  return {
    enabled: reminder.enabled,
    timesPerDay: reminder.timesPerDay,
    times: reminder.times,
    ...freqBase,
    doseMg: mode === 'units' ? String(reminder.doseMg) : '',
    unitConcentrationMg: mode === 'units' ? String(reminder.unitConcentrationMg) : '',
    ...emptyBase,
  };
}

/** A fresh, empty reminder skeleton for a given dose/time configuration. */
export function buildReminder(params: {
  doseMg: number;
  unitConcentrationMg: number;
  times: string[];
}): DoseReminder {
  return {
    enabled: true,
    doseMg: params.doseMg,
    unitConcentrationMg: params.unitConcentrationMg,
    timesPerDay: params.times.length,
    times: params.times,
    consumedFraction: 0,
    notificationIds: [],
    confirmedToday: [],
    confirmedDate: todayStr(),
  };
}

/** Evenly-spaced sensible default times for a given number of daily doses. */
export function defaultTimesForFrequency(timesPerDay: number): string[] {
  const presets: Record<number, string[]> = {
    1: ['09:00'],
    2: ['09:00', '21:00'],
    3: ['08:00', '14:00', '20:00'],
    4: ['06:00', '12:00', '18:00', '00:00'],
  };
  if (presets[timesPerDay]) return presets[timesPerDay];
  // Fallback: spread evenly across 24h starting at 8 AM.
  const times: string[] = [];
  const stepMinutes = Math.floor((24 * 60) / Math.max(1, timesPerDay));
  let cursor = 8 * 60;
  for (let i = 0; i < timesPerDay; i++) {
    const h = Math.floor((cursor % (24 * 60)) / 60);
    const m = (cursor % (24 * 60)) % 60;
    times.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    cursor += stepMinutes;
  }
  return times;
}

/**
 * Schedules notifications for a reminder, shaped by its frequency:
 *  - 'daily'    — one daily-repeating notification per entry in `times`
 *                 (unchanged from the original model).
 *  - 'weekly'   — a rolling lookahead window of one-off dated notifications
 *                 (one per upcoming matching weekday × time), refreshed on
 *                 every app open so the window keeps extending forward.
 *  - 'interval' — one-off dated notifications for just the current
 *                 `nextDueDate`, rescheduled to the new date each time the
 *                 reminder fully advances (see useMedications.ts).
 * Returns the notification ids that were scheduled (to store on the
 * medication for later cancellation).
 */
export async function scheduleDoseReminders(med: Pick<Medication, 'id' | 'name'>, reminder: DoseReminder): Promise<number[]> {
  if (!reminder.enabled || reminder.times.length === 0) return [];
  const ready = await ensureReady();
  if (!ready) return [];

  const frequency = reminder.frequency ?? 'daily';
  const s = strings();

  if (frequency === 'weekly') {
    if (!reminder.daysOfWeek || reminder.daysOfWeek.length === 0) return [];
    const occurrences = computeUpcomingWeeklyOccurrences(reminder.daysOfWeek, reminder.times, MAX_WEEKLY_OCCURRENCES);
    if (occurrences.length === 0) return [];

    const notifications = occurrences.map((date, index) => ({
      id: occurrenceNotificationId(med.id, index),
      title: s.title,
      body: s.body(med.name),
      schedule: {
        on: {
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          day: date.getDate(),
          hour: date.getHours(),
          minute: date.getMinutes(),
        },
        allowWhileIdle: true,
      },
      channelId: CHANNEL_ID,
      smallIcon: 'ic_stat_homemed',
      actionTypeId: ACTION_TYPE_ID,
      extra: {
        medId: med.id,
        doseTime: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
      },
    }));

    try {
      await LocalNotifications.schedule({ notifications });
      return notifications.map((n) => n.id);
    } catch {
      return [];
    }
  }

  if (frequency === 'interval') {
    if (!reminder.nextDueDate) return [];
    const [year, month, day] = reminder.nextDueDate.split('-').map(Number);

    const notifications = reminder.times.map((time, index) => {
      const [hour, minute] = time.split(':').map(Number);
      return {
        // Interval reminders only ever have ONE active due date at a time,
        // so reusing the time-index slot (0..timesPerDay-1) is safe here —
        // it naturally overwrites the previous due date's notifications.
        id: occurrenceNotificationId(med.id, index),
        title: s.title,
        body: s.body(med.name),
        schedule: { on: { year, month, day, hour, minute }, allowWhileIdle: true },
        channelId: CHANNEL_ID,
        smallIcon: 'ic_stat_homemed',
        actionTypeId: ACTION_TYPE_ID,
        extra: { medId: med.id, doseTime: time },
      };
    });

    try {
      await LocalNotifications.schedule({ notifications });
      return notifications.map((n) => n.id);
    } catch {
      return [];
    }
  }

  // 'daily' — unchanged original model.
  const notifications = reminder.times.map((time, index) => {
    const [hour, minute] = time.split(':').map(Number);
    return {
      id: doseNotificationId(med.id, index),
      title: s.title,
      body: s.body(med.name),
      // `on: { hour, minute }` (without day/month) repeats every day at that local time.
      schedule: { on: { hour, minute }, allowWhileIdle: true },
      channelId: CHANNEL_ID,
      smallIcon: 'ic_stat_homemed',
      actionTypeId: ACTION_TYPE_ID,
      extra: { medId: med.id, doseTime: time },
    };
  });

  try {
    await LocalNotifications.schedule({ notifications });
    return notifications.map((n) => n.id);
  } catch {
    return [];
  }
}

/** Cancels every scheduled notification (daily reminders + any pending snooze) for a reminder. */
export async function cancelDoseReminders(reminder?: DoseReminder | null): Promise<void> {
  if (!isNative || !reminder) return;
  const toCancel = [...(reminder.notificationIds ?? [])];
  if (reminder.snoozeNotificationId) toCancel.push(reminder.snoozeNotificationId);
  if (toCancel.length === 0) return;
  try {
    await LocalNotifications.cancel({ notifications: toCancel.map((id) => ({ id })) });
  } catch {
    // Already fired/cleared — nothing to do.
  }
}

/**
 * Schedules a one-off follow-up reminder ~45 minutes later, for when the
 * user answers "No" to a specific dose. Carries the same doseTime so that
 * whichever answer eventually confirms it marks the correct dose. Returns
 * the notification id, or undefined if it couldn't be scheduled.
 */
export async function scheduleSnoozeReminder(
  med: Pick<Medication, 'id' | 'name'>,
  doseTime: string
): Promise<number | undefined> {
  const ready = await ensureReady();
  if (!ready) return undefined;
  const s = strings();
  const id = snoozeNotificationId(med.id);
  const at = new Date(Date.now() + 45 * 60 * 1000);
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title: s.title,
          body: s.snoozeBody(med.name),
          schedule: { at, allowWhileIdle: true },
          channelId: CHANNEL_ID,
          smallIcon: 'ic_stat_homemed',
          actionTypeId: ACTION_TYPE_ID,
          extra: { medId: med.id, doseTime, snooze: true },
        },
      ],
    });
    return id;
  } catch {
    return undefined;
  }
}

export async function cancelSnoozeReminder(reminder?: DoseReminder | null): Promise<void> {
  if (!isNative || !reminder?.snoozeNotificationId) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: reminder.snoozeNotificationId }] });
  } catch {
    // ignore
  }
}

/**
 * Resets confirmedToday/confirmedDate if the stored date doesn't match
 * today — call this whenever reading a reminder for "is X due now" logic.
 * Interval-mode reminders are deliberately excluded: their confirmedToday
 * tracks progress against `nextDueDate`, not the calendar date, and only
 * resets explicitly when the due date itself advances (in
 * useMedications.ts, on full confirmation) — never here — so a late or
 * missed dose stays visibly due instead of silently disappearing at
 * midnight.
 */
export function reconcileReminderDay(reminder: DoseReminder): DoseReminder {
  if ((reminder.frequency ?? 'daily') === 'interval') return reminder;
  const today = todayStr();
  if (reminder.confirmedDate === today) return reminder;
  return { ...reminder, confirmedDate: today, confirmedToday: [] };
}

/** Which of the reminder's scheduled times are currently due (time has passed, and — for weekly/interval — the day itself is due) and not yet confirmed. */
export function getDueTimes(reminder: DoseReminder): string[] {
  if (!reminder.enabled) return [];
  const frequency = reminder.frequency ?? 'daily';

  if (frequency === 'weekly') {
    const todayWeekday = new Date().getDay();
    if (!reminder.daysOfWeek?.includes(todayWeekday)) return [];
  }

  if (frequency === 'interval') {
    if (!reminder.nextDueDate || todayStr() < reminder.nextDueDate) return [];
  }

  const r = reconcileReminderDay(reminder);
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return r.times.filter((time) => {
    if (r.confirmedToday.includes(time)) return false;
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m <= nowMinutes;
  });
}

/**
 * Registers the listener for Yes/No taps on dose-reminder notifications.
 * `onConfirm` is called with the medication id, the dose time, and whether
 * the dose was confirmed taken. NOTE: like any notification-action handling
 * in a hybrid app, tapping a button briefly wakes/foregrounds the app to
 * process the event — there is no way to mutate app data while fully closed
 * without native background code, which is out of scope here. Returns an
 * unsubscribe function.
 */
export function registerDoseActionListener(
  onConfirm: (medId: string, taken: boolean, doseTime?: string) => void
): () => void {
  if (!isNative) return () => {};
  let cancelled = false;
  const listenerPromise = LocalNotifications.addListener(
    'localNotificationActionPerformed',
    (action: ActionPerformed) => {
      const extra = action.notification?.extra as { medId?: string; doseTime?: string } | undefined;
      if (!extra?.medId) return;
      if (action.actionId === 'yes') onConfirm(extra.medId, true, extra.doseTime);
      else if (action.actionId === 'no') onConfirm(extra.medId, false, extra.doseTime);
      // Any other actionId (e.g. the default "tap") is ignored — opening the
      // app to look at the medicine is not the same as confirming a dose.
    }
  );
  return () => {
    cancelled = true;
    void listenerPromise.then((handle) => {
      if (!cancelled) return;
      void handle.remove();
    });
  };
}
