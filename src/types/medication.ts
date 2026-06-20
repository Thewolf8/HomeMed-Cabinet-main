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
}

export type SortField = 'expirationDate' | 'name' | 'quantity' | 'category';
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
}
