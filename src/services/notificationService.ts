import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { Medication, NotificationPreferences } from '@/types/medication';
import { getSettings } from '@/hooks/useSettings';

const isNative = Capacitor.isNativePlatform();

const CHANNEL_ID = 'homemed-expiry';
let channelReady = false;
let permissionRequested = false;

// Small, self-contained set of strings for the system notification itself —
// kept local (rather than pulled from the main i18n dictionary) since this
// code can run outside the React tree.
const NOTIF_STRINGS = {
  en: {
    expiringSoonTitle: 'Medication expiring soon',
    expiringSoonBody: (name: string, dosage: string, days: number) =>
      `${name} (${dosage}) will expire in ${days} day${days === 1 ? '' : 's'}.`,
    expiredTitle: 'Medication expired',
    expiredBody: (name: string, dosage: string) => `${name} (${dosage}) has reached its expiration date.`,
  },
  ar: {
    expiringSoonTitle: 'دواء تقترب صلاحيته من الانتهاء',
    expiringSoonBody: (name: string, dosage: string, days: number) =>
      `${name} (${dosage}) ستنتهي صلاحيته خلال ${days} يوم.`,
    expiredTitle: 'انتهت صلاحية دواء',
    expiredBody: (name: string, dosage: string) => `${name} (${dosage}) وصل إلى تاريخ انتهاء صلاحيته.`,
  },
  fr: {
    expiringSoonTitle: 'Médicament bientôt expiré',
    expiringSoonBody: (name: string, dosage: string, days: number) =>
      `${name} (${dosage}) expirera dans ${days} jour${days === 1 ? '' : 's'}.`,
    expiredTitle: 'Médicament expiré',
    expiredBody: (name: string, dosage: string) => `${name} (${dosage}) a atteint sa date d'expiration.`,
  },
} as const;

function notifStrings() {
  let lang = getSettings().language;
  if (lang === 'system') {
    const nav = (typeof navigator !== 'undefined' && navigator.language) || 'en';
    lang = nav.startsWith('ar') ? 'ar' : nav.startsWith('fr') ? 'fr' : 'en';
  }
  if (lang === 'ar' || lang === 'fr') return NOTIF_STRINGS[lang];
  return NOTIF_STRINGS.en;
}

/**
 * Deterministically turns a medication's (string) id into a stable positive
 * 32-bit integer, because @capacitor/local-notifications requires numeric ids.
 * Two distinct ids are derived per medication (expiringSoon / expired) so each
 * alert can be scheduled and cancelled independently.
 */
function hashToInt(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0; // force 32-bit
  }
  // Keep it positive and leave the low bit free for the two notification kinds
  return Math.abs(hash) * 2;
}

function idsForMedication(medId: string): { expiringSoon: number; expired: number } {
  const base = hashToInt(medId);
  return { expiringSoon: base, expired: base + 1 };
}

async function ensureReady(): Promise<boolean> {
  if (!isNative) return false;

  if (!permissionRequested) {
    permissionRequested = true;
    try {
      const current = await LocalNotifications.checkPermissions();
      if (current.display !== 'granted') {
        await LocalNotifications.requestPermissions();
      }
    } catch {
      return false;
    }
  }

  if (!channelReady) {
    channelReady = true;
    try {
      // Android 8+ requires a channel before notifications can be shown.
      await LocalNotifications.createChannel({
        id: CHANNEL_ID,
        name: 'Medication Expiration',
        description: 'Alerts for medications that are expiring soon or have expired',
        importance: 4, // HIGH
        visibility: 1,
      });
    } catch {
      // createChannel is Android-only; ignore failures on other platforms
    }
  }

  return true;
}

/**
 * Schedules (or re-schedules) the "expiring soon" and "expired" system
 * notifications for one medication, based on the current notification
 * preferences. Returns the notification ids that were actually scheduled,
 * to be stored on the medication so they can be cancelled later.
 */
export async function scheduleMedicationNotifications(
  med: Pick<Medication, 'id' | 'name' | 'dosage' | 'quantity' | 'expirationDate'>,
  prefs: NotificationPreferences
): Promise<{ expiringSoon?: number; expired?: number }> {
  // No point scheduling anything for a medication that's already used up.
  if (med.quantity <= 0) return {};

  const ready = await ensureReady();
  if (!ready) return {};

  const ids = idsForMedication(med.id);
  const expirationDate = new Date(med.expirationDate);
  if (isNaN(expirationDate.getTime())) return {};

  const now = Date.now();
  const notifications: any[] = [];
  const scheduled: { expiringSoon?: number; expired?: number } = {};
  const strings = notifStrings();

  if (prefs.expiringSoonEnabled) {
    const days = Math.max(0, Number(prefs.daysBeforeExpiry) || 30);
    const alertTime = new Date(expirationDate);
    alertTime.setDate(alertTime.getDate() - days);
    alertTime.setHours(9, 0, 0, 0); // 9 AM local time, friendlier than midnight

    if (alertTime.getTime() > now) {
      notifications.push({
        id: ids.expiringSoon,
        title: strings.expiringSoonTitle,
        body: strings.expiringSoonBody(med.name, med.dosage, days),
        schedule: { at: alertTime, allowWhileIdle: true },
        channelId: CHANNEL_ID,
        smallIcon: 'ic_stat_homemed',
      });
      scheduled.expiringSoon = ids.expiringSoon;
    }
  }

  if (prefs.expiredEnabled) {
    const alertTime = new Date(expirationDate);
    alertTime.setHours(9, 0, 0, 0);

    if (alertTime.getTime() > now) {
      notifications.push({
        id: ids.expired,
        title: strings.expiredTitle,
        body: strings.expiredBody(med.name, med.dosage),
        schedule: { at: alertTime, allowWhileIdle: true },
        channelId: CHANNEL_ID,
        smallIcon: 'ic_stat_homemed',
      });
      scheduled.expired = ids.expired;
    }
  }

  if (notifications.length > 0) {
    try {
      await LocalNotifications.schedule({ notifications });
    } catch {
      return {};
    }
  }

  return scheduled;
}

/**
 * Cancels any previously scheduled notifications for a medication. Safe to
 * call even if nothing was ever scheduled.
 */
export async function cancelMedicationNotifications(
  notificationIds?: { expiringSoon?: number; expired?: number }
): Promise<void> {
  if (!isNative || !notificationIds) return;

  const toCancel = [notificationIds.expiringSoon, notificationIds.expired]
    .filter((id): id is number => typeof id === 'number')
    .map((id) => ({ id }));

  if (toCancel.length === 0) return;

  try {
    await LocalNotifications.cancel({ notifications: toCancel });
  } catch {
    // Nothing to do — the notification may already have fired/been cleared.
  }
}
