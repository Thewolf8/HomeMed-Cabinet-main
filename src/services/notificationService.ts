import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { Medication, NotificationPreferences } from '@/types/medication';
import { LOW_STOCK_THRESHOLD } from '@/types/medication';
import { getSettings } from '@/hooks/useSettings';

const isNative = Capacitor.isNativePlatform();

const CHANNEL_ID = 'homemed-expiry';
let channelReady = false;
let permissionRequested = false;

/** Re-exported for existing importers — the source of truth now lives in
 * types/medication.ts alongside isLowStock(), so both the percentage-based
 * and legacy absolute-threshold logic stay in one place. */
export { LOW_STOCK_THRESHOLD };

const LOW_STOCK_CHANNEL_ID = 'homemed-lowstock';
let lowStockChannelReady = false;

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

// Self-contained strings for the low-stock channel, same rationale as
// NOTIF_STRINGS above — kept local rather than pulled from the main i18n
// dictionary since this can fire from outside the React tree.
const LOW_STOCK_STRINGS = {
  en: {
    title: 'Running low',
    body: (name: string, dosage: string, qty: number) =>
      qty <= 0
        ? `${name} (${dosage}) is out of stock.`
        : `${name} (${dosage}) — only ${qty} left.`,
  },
  ar: {
    title: 'الكمية منخفضة',
    body: (name: string, dosage: string, qty: number) =>
      qty <= 0
        ? `${name} (${dosage}) — نفدت الكمية بالكامل.`
        : `${name} (${dosage}) — تبقّى ${qty} فقط.`,
  },
  fr: {
    title: 'Stock faible',
    body: (name: string, dosage: string, qty: number) =>
      qty <= 0
        ? `${name} (${dosage}) est en rupture de stock.`
        : `${name} (${dosage}) — il ne reste que ${qty}.`,
  },
} as const;

function lowStockStrings() {
  let lang = getSettings().language;
  if (lang === 'system') {
    const nav = (typeof navigator !== 'undefined' && navigator.language) || 'en';
    lang = nav.startsWith('ar') ? 'ar' : nav.startsWith('fr') ? 'fr' : 'en';
  }
  if (lang === 'ar' || lang === 'fr') return LOW_STOCK_STRINGS[lang];
  return LOW_STOCK_STRINGS.en;
}

/**
 * Deterministically turns a medication's (string) id into a stable positive
 * integer well within Java's 32-bit int range, because
 * @capacitor/local-notifications requires numeric ids and Android notification
 * ids are backed by a native int (max 2,147,483,647).
 *
 * Exported so other notification "namespaces" (e.g. dose reminders) can
 * derive their own non-colliding ids from the same medication id by adding
 * a distinct offset on top of this base.
 */
export function hashToInt(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0; // force 32-bit
  }
  // Constrain well below int32 max so callers have headroom to multiply/offset
  // (e.g. *2, +1) without ever risking overflow into an invalid native id.
  return Math.abs(hash) % 500_000_000;
}

function idsForMedication(medId: string): { expiringSoon: number; expired: number } {
  const base = hashToInt(medId) * 2;
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

// ==================== Low-stock alert ====================
// Fired once, exactly when a medication's quantity crosses at or below
// LOW_STOCK_THRESHOLD as a result of a confirmed dose deduction — never
// re-fired on every subsequent dose while it stays low, so the user isn't
// nagged daily about something they already know.

async function ensureLowStockChannelReady(): Promise<void> {
  if (lowStockChannelReady || !isNative) return;
  lowStockChannelReady = true;
  try {
    await LocalNotifications.createChannel({
      id: LOW_STOCK_CHANNEL_ID,
      name: 'Low Stock Alerts',
      description: 'Alerts when a medicine quantity drops to a low level',
      importance: 4, // HIGH
      visibility: 1,
    });
  } catch {
    // Android-only; ignore failures on other platforms
  }
}

/**
 * Own id band, deliberately clear of:
 *   - notificationService expiry ids   (≈ 0           .. 1,000,000,000)
 *   - doseReminderService dose/snooze  (≈ 1,200,000,000 .. 1,700,000,100)
 * and capped well under Android's 32-bit notification-id ceiling
 * (2,147,483,647), since hashToInt's own output can be up to ~500,000,000.
 */
const LOW_STOCK_ID_OFFSET = 1_800_000_000;
function lowStockNotificationId(medId: string): number {
  return LOW_STOCK_ID_OFFSET + (hashToInt(medId) % 200_000_000);
}

/**
 * Fires an immediate, one-shot "running low" notification. `remainingQuantity`
 * is shown in the body so the user knows exactly how urgent it is (including
 * 0, which reads naturally as "out of stock").
 */
export async function scheduleLowStockAlert(
  med: Pick<Medication, 'id' | 'name' | 'dosage'>,
  remainingQuantity: number
): Promise<void> {
  const ready = await ensureReady();
  if (!ready) return;
  await ensureLowStockChannelReady();

  const s = lowStockStrings();
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: lowStockNotificationId(med.id),
          title: s.title,
          body: s.body(med.name, med.dosage, remainingQuantity),
          schedule: { at: new Date(Date.now() + 1000), allowWhileIdle: true },
          channelId: LOW_STOCK_CHANNEL_ID,
          smallIcon: 'ic_stat_homemed',
        },
      ],
    });
  } catch {
    // Best-effort — a missed low-stock nudge isn't critical.
  }
}
