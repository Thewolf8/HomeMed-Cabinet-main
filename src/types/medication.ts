export interface DoseReminder {
  enabled: boolean;
  /** The dose required per intake, in mg (e.g. 500). */
  doseMg: number;
  /** How many mg are in a single tablet/capsule/unit (e.g. 1000). Used to convert the dose into a fraction of a unit. */
  unitConcentrationMg: number;
  /** Number of intakes per day — also the length of `times`. */
  timesPerDay: number;
  /** Clock times ("HH:mm", 24h, local time) for each daily intake. */
  times: string[];
  /** Running fractional accumulator (0 ≤ x < 1) of partially-consumed units, carried between confirmations so quantity only drops by whole units. */
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
