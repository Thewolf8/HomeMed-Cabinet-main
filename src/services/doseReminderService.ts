import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type ActionPerformed } from '@capacitor/local-notifications';
import type { DoseReminder, Medication } from '@/types/medication';
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
 * Computes the dose-as-a-fraction-of-one-unit (e.g. 500mg dose / 1000mg per
 * tablet = 0.5), and the new quantity/accumulator after one confirmed dose.
 * Quantity only ever drops by whole units — partial consumption is carried
 * in `consumedFraction` until it accumulates to a full unit or more.
 */
export function computeDoseDeduction(
  reminder: Pick<DoseReminder, 'doseMg' | 'unitConcentrationMg' | 'consumedFraction'>,
  currentQuantity: number
): { newQuantity: number; newConsumedFraction: number } {
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


/**
 * Converts an editable draft (from DoseReminderEditor) into a real
 * DoseReminder, preserving bookkeeping fields from the previous reminder
 * (if any) like consumedFraction and today's confirmations. Returns
 * undefined if the draft is disabled or invalid (so callers can treat that
 * as "no reminder").
 */
export function draftToReminder(
  draft: { enabled: boolean; doseMg: string; unitConcentrationMg: string; timesPerDay: number; times: string[] },
  previous?: DoseReminder | null
): DoseReminder | undefined {
  if (!draft.enabled) return undefined;
  const doseMg = parseFloat(draft.doseMg);
  const unitConcentrationMg = parseFloat(draft.unitConcentrationMg);
  if (!isFinite(doseMg) || doseMg <= 0 || !isFinite(unitConcentrationMg) || unitConcentrationMg <= 0) {
    return undefined;
  }
  const times = draft.times.filter(Boolean);
  if (times.length === 0) return undefined;

  return {
    enabled: true,
    doseMg,
    unitConcentrationMg,
    timesPerDay: times.length,
    times,
    consumedFraction: previous?.consumedFraction ?? 0,
    notificationIds: previous?.notificationIds ?? [],
    snoozeNotificationId: previous?.snoozeNotificationId,
    confirmedToday: previous?.confirmedToday ?? [],
    confirmedDate: previous?.confirmedDate ?? todayStr(),
  };
}

/** Converts a real DoseReminder (or none) into an editable draft. */
export function reminderToDraft(reminder?: DoseReminder | null): {
  enabled: boolean;
  doseMg: string;
  unitConcentrationMg: string;
  timesPerDay: number;
  times: string[];
} {
  if (!reminder) {
    return { enabled: false, doseMg: '', unitConcentrationMg: '', timesPerDay: 2, times: defaultTimesForFrequency(2) };
  }
  return {
    enabled: reminder.enabled,
    doseMg: String(reminder.doseMg),
    unitConcentrationMg: String(reminder.unitConcentrationMg),
    timesPerDay: reminder.timesPerDay,
    times: reminder.times,
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
 * Schedules one daily-repeating notification per entry in reminder.times.
 * Returns the notification ids that were scheduled (to store on the
 * medication for later cancellation).
 */
export async function scheduleDoseReminders(med: Pick<Medication, 'id' | 'name'>, reminder: DoseReminder): Promise<number[]> {
  if (!reminder.enabled || reminder.times.length === 0) return [];
  const ready = await ensureReady();
  if (!ready) return [];

  const s = strings();
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
 */
export function reconcileReminderDay(reminder: DoseReminder): DoseReminder {
  const today = todayStr();
  if (reminder.confirmedDate === today) return reminder;
  return { ...reminder, confirmedDate: today, confirmedToday: [] };
}

/** Which of today's scheduled times are currently due (time has passed) and not yet confirmed. */
export function getDueTimes(reminder: DoseReminder): string[] {
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
