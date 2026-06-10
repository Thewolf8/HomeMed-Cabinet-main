export interface Medication {
  id: string;
  name: string;
  activeIngredient: string;
  dosage: string;
  form: 'tablets' | 'syrup' | 'injection' | 'cream' | 'drops' | 'other';
  quantity: number;
  expirationDate: string;
  usageInstructions: string;
  category: 'adult' | 'children' | 'emergency' | 'chronic' | 'other';
  prescriptionRequired: boolean;
  notes: string;
  image?: string;
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

export const MEDICINE_FORMS: MedicineForm[] = ['tablets', 'syrup', 'injection', 'cream', 'drops', 'other'];
export const MEDICINE_CATEGORIES: MedicineCategory[] = ['adult', 'children', 'emergency', 'chronic', 'other'];

export interface ExportPreferences {
  includeNotes: boolean;
  includeEmergencySection: boolean;
}

export type Language = 'en' | 'ar' | 'fr' | 'system';
export type Theme = 'dark' | 'light';

export interface AppSettings {
  language: Language;
  theme: Theme;
  exportPreferences: ExportPreferences;
}
