export interface DoseReminder {
  enabled: boolean;
  /**
   * How the dose amount is interpreted and deducted from stock:
   *  - 'units'  — doseMg / unitConcentrationMg fraction-of-a-tablet accounting
   *               (tablets, capsules, suppository, lozenge, granules, patch,
   *               injection, spray, inhaler, powder, other). This is the
   *               original/default model.
   *  - 'volume' — doseVolumeMl is deducted directly from quantity, both
   *               expressed in ml (syrup, solution, suspension, drops — for
   *               drops the ml value is computed from a drop count × a
   *               standard drop volume, see DROP_VOLUME_ML).
   *  - 'none'   — no stock deduction happens on confirm (cream, ointment,
   *               gel). The reminder still fires and can be confirmed —
   *               useful for "remember to apply" — it just never touches
   *               quantity, since there's no reliable way to know how much
   *               is left in an opened tube.
   * Absent on reminders stored before this field existed — always treat a
   * missing value as 'units' for full backward compatibility.
   */
  doseMode?: 'units' | 'volume' | 'none';
  /**
   * How often this reminder recurs:
   *  - 'daily'    — due every day at `times` (the original/default model).
   *  - 'weekly'   — due only on the days listed in `daysOfWeek`, at `times`.
   *  - 'interval' — due every `intervalDays` days. Unlike a fixed calendar
   *                 grid, the next due date is recalculated from the date
   *                 of the last *actual* confirmation, so a late dose
   *                 shifts the whole cadence forward with it rather than
   *                 leaving the schedule to drift out of sync with reality.
   * Absent on reminders stored before this field existed — always treat a
   * missing value as 'daily' for full backward compatibility.
   */
  frequency?: 'daily' | 'weekly' | 'interval';
  /** Days of week this reminder is due (0 = Sunday … 6 = Saturday, matching JS Date.getDay()). Used only when frequency === 'weekly'. */
  daysOfWeek?: number[];
  /** Number of days between doses (e.g. 2, 3). Used only when frequency === 'interval'. */
  intervalDays?: number;
  /** The next date (YYYY-MM-DD) this reminder is due. Used only when frequency === 'interval' — advances by intervalDays from the date of each full confirmation, not a fixed grid. */
  nextDueDate?: string;
  /** The dose required per intake, in mg (e.g. 500). Used only when doseMode is 'units' (or absent). */
  doseMg: number;
  /** How many mg are in a single tablet/capsule/unit (e.g. 1000). Used to convert the dose into a fraction of a unit. Used only when doseMode is 'units' (or absent). */
  unitConcentrationMg: number;
  /** ml deducted from quantity per confirmed intake. Used only when doseMode === 'volume'. */
  doseVolumeMl?: number;
  /** Number of intakes per day — also the length of `times`. */
  timesPerDay: number;
  /** Clock times ("HH:mm", 24h, local time) for each daily intake. */
  times: string[];
  /** Running fractional accumulator (0 ≤ x < 1) of partially-consumed units, carried between confirmations so quantity only drops by whole units. Used only when doseMode is 'units' (or absent). */
  consumedFraction: number;
  /** IDs of the scheduled daily-repeating notifications (one per entry in `times`), for cancellation. */
  notificationIds: number[];
  /** ID of a pending one-off "snooze" follow-up notification, if the user answered "No" to the last prompt. */
  snoozeNotificationId?: number;
  /** Which of today's `times` have already been confirmed (taken or manually logged). */
  confirmedToday: string[];
  /** The date (YYYY-MM-DD) `confirmedToday` applies to — reset automatically when the date rolls over. */
  confirmedDate: string;
}

export type StorageLocation = 'fridge' | 'firstAidKit' | 'drawer' | 'cabinet' | 'kitchen' | 'bedroom' | 'other';
export const STORAGE_LOCATIONS: StorageLocation[] = [
  'fridge', 'firstAidKit', 'drawer', 'cabinet', 'kitchen', 'bedroom', 'other',
];

export interface Medication {
  id: string;
  name: string;
  activeIngredient: string;
  dosage: string;
  form: 'tablets' | 'capsules' | 'syrup' | 'solution' | 'suspension' | 'injection' | 'drops' | 'spray' | 'inhaler' | 'cream' | 'ointment' | 'gel' | 'patch' | 'suppository' | 'powder' | 'lozenge' | 'granules' | 'other';
  quantity: number;
  /**
   * The size of a full, unopened package, in the same unit as `quantity`
   * (a plain count for tablets/capsules/etc., or ml for
   * syrup/solution/suspension/drops). Used to compute an accurate "running
   * low" percentage instead of a fixed absolute threshold — critical for
   * forms where "5 remaining" means very different things depending on
   * whether a full pack is 10 or 200. Not applicable to cream/ointment/gel
   * forms, which don't track quantity meaningfully at all — see
   * quantityCategoryForForm().
   */
  fullPackQuantity?: number;
  expirationDate: string;
  usageInstructions: string;
  category: 'adult' | 'children' | 'emergency' | 'chronic' | 'other';
  prescriptionRequired: boolean;
  notes: string;
  image?: string;
  /** Barcode / Data Matrix payload scanned from the package, used for offline auto-recognition next time. */
  barcode?: string;
  /** IDs of the local notifications scheduled for this medication, so they can be cancelled later. */
  notificationIds?: {
    expiringSoon?: number;
    expired?: number;
  };
  /** Where this medication is physically stored at home. */
  storageLocation?: StorageLocation;
  /** Free-text detail for storageLocation === 'other' (or extra detail for any location). */
  storageLocationNote?: string;
  /** Smart dose reminder / stock-sync configuration. */
  reminder?: DoseReminder;
  createdAt: string;
  updatedAt: string;
}

export type MedicineForm = Medication['form'];
export type MedicineCategory = Medication['category'];

export interface MedicationFilters {
  search: string;
  category: MedicineCategory | 'all';
  expiration: 'all' | 'expired' | 'expiring-soon' | 'valid';
  emergencyOnly: boolean;
  storageLocation: StorageLocation | 'all';
}

export type SortField = 'expirationDate' | 'name' | 'quantity' | 'category' | 'storageLocation';
export type SortOrder = 'asc' | 'desc';

export interface DashboardStats {
  total: number;
  expiringSoon: number;
  expired: number;
  lowStock: number;
  emergencyReadiness: number;
}

export interface ToastParams {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

export const EMERGENCY_ITEMS = [
  'Paracetamol',
  'Bandages',
  'Antiseptic',
  'Allergy medicine',
  'Thermometer',
  'Gloves',
];

export const MEDICINE_FORMS: MedicineForm[] = [
  'tablets', 'capsules', 'syrup', 'solution', 'suspension',
  'injection', 'drops', 'spray', 'inhaler',
  'cream', 'ointment', 'gel', 'patch',
  'suppository', 'powder', 'lozenge', 'granules', 'other',
];
export const MEDICINE_CATEGORIES: MedicineCategory[] = ['adult', 'children', 'emergency', 'chronic', 'other'];

// ── Form-aware quantity & dosing model ──────────────────────────────────────
//
// Different medicine forms need fundamentally different quantity and dosing
// treatment:
//   - Tablets/capsules/etc.  → a plain count, dosed as a fraction of a unit
//   - Syrup/solution/suspension → an ml volume, dosed directly in ml (or via
//     a spoon count that converts to ml)
//   - Drops → an ml volume (bottle capacity), dosed via a drop count that
//     converts to ml using a standard drop size
//   - Cream/ointment/gel → no meaningful quantity tracking at all (there's
//     no reliable way to know how much is left in an opened tube without
//     weighing it), so these are excluded from quantity/low-stock logic
//     entirely rather than forcing an inaccurate number on the user.

export type QuantityCategory = 'count' | 'volume' | 'none';

/** Which quantity model applies to a medicine form — drives the Add/Edit page's quantity & full-pack fields. */
export function quantityCategoryForForm(form: MedicineForm): QuantityCategory {
  if (form === 'cream' || form === 'ointment' || form === 'gel') return 'none';
  if (form === 'syrup' || form === 'solution' || form === 'suspension' || form === 'drops') return 'volume';
  return 'count';
}

export type DoseCategory = 'units' | 'volume' | 'drops' | 'none';

/** Which dosing input the reminder editor should show — drives the "how much per dose" section. */
export function doseCategoryForForm(form: MedicineForm): DoseCategory {
  if (form === 'cream' || form === 'ointment' || form === 'gel') return 'none';
  if (form === 'drops') return 'drops';
  if (form === 'syrup' || form === 'solution' || form === 'suspension') return 'volume';
  return 'units';
}

/** Standard spoon sizes in ml, used when the user doesn't know the exact ml dose for a liquid. */
export const SPOON_ML: Record<'tablespoon' | 'teaspoon', number> = {
  tablespoon: 15,
  teaspoon: 5,
};

/** Standard pharmacological drop size in ml (≈ 20 drops per ml), used to convert a drop count into a deductible volume. */
export const DROP_VOLUME_ML = 0.05;

/** Percentage-of-full-pack threshold below which a medication is considered "running low", when fullPackQuantity is known. */
export const LOW_STOCK_PERCENT = 0.2;

/** Legacy absolute-count threshold, used only as a fallback when fullPackQuantity hasn't been recorded. */
export const LOW_STOCK_THRESHOLD = 5;

/**
 * Whether a medication should be flagged as "running low" on stock.
 *  - Forms with no meaningful quantity tracking (cream/ointment/gel) are
 *    never flagged, since there's no reliable way to know how much is left.
 *  - When fullPackQuantity is known, uses a percentage-of-full-pack rule so
 *    the same logic works whether a pack is 30 tablets or a 200ml bottle —
 *    this also fixes the case where quantity=1 (one tube/bottle) would
 *    otherwise always look "low" under a fixed absolute threshold.
 *  - Falls back to the legacy absolute LOW_STOCK_THRESHOLD only when the
 *    user hasn't recorded a full-pack size yet (e.g. older entries).
 */
export function isLowStock(med: Pick<Medication, 'form' | 'quantity' | 'fullPackQuantity'>): boolean {
  if (quantityCategoryForForm(med.form) === 'none') return false;
  if (med.fullPackQuantity && med.fullPackQuantity > 0) {
    return med.quantity / med.fullPackQuantity <= LOW_STOCK_PERCENT;
  }
  return med.quantity <= LOW_STOCK_THRESHOLD;
}

export interface ExportPreferences {
  includeNotes: boolean;
  includeEmergencySection: boolean;
}

export interface NotificationPreferences {
  /** Notify when a medication is approaching its expiration date. */
  expiringSoonEnabled: boolean;
  /** Notify exactly when a medication's expiration date is reached. */
  expiredEnabled: boolean;
  /** How many days before expirationDate the "expiring soon" alert should fire. */
  daysBeforeExpiry: number;
}

export type Language = 'en' | 'ar' | 'fr' | 'system';
export type Theme = 'dark' | 'light' | 'system';

export interface BackupPreferences {
  /** ISO timestamp of the last successful automatic backup write. */
  lastBackupAt: string | null;
}

export interface AppSettings {
  language: Language;
  theme: Theme;
  exportPreferences: ExportPreferences;
  animationsEnabled: boolean;
  dateFormat: 'DMY' | 'MDY' | 'YMD';
  datePickerType: 'full' | 'month-year';
  notifications: NotificationPreferences;
  /** If true, expired medications are deleted automatically every time the app opens. */
  autoDeleteExpired: boolean;
  /** If true, adding a medication identical to an existing one (name + active ingredient + dosage + expiration date) merges quantities instead of creating a new entry. */
  smartMergeEnabled: boolean;
  backup: BackupPreferences;
}
