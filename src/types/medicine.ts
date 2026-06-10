export type MedicineForm = 'tablets' | 'syrup' | 'injection' | 'cream' | 'drops' | 'other';
export type MedicineCategory = 'adult' | 'children' | 'emergency' | 'chronic' | 'other';

export interface Medicine {
  id: string;
  name: string;
  activeIngredient: string;
  dosage: string;
  form: MedicineForm;
  quantity: number;
  expirationDate: string;
  usageInstructions: string;
  category: MedicineCategory;
  prescriptionRequired: boolean;
  notes: string;
  image?: string;
  createdAt: string;
  updatedAt: string;
}

export type SortOption = 'expiration' | 'name' | 'quantity' | 'category';
export type FilterCategory = 'all' | MedicineCategory;
export type FilterExpiration = 'all' | 'expired' | 'expiring-soon' | 'good';

export interface FilterState {
  search: string;
  category: FilterCategory;
  expiration: FilterExpiration;
  emergencyOnly: boolean;
  sort: SortOption;
}

export interface EmergencyItem {
  name: string;
  keywords: string[];
}

export interface EmergencyCheckResult {
  item: EmergencyItem;
  found: boolean;
  matchedMedicine?: Medicine;
}

export interface DashboardStats {
  totalMedicines: number;
  expiringSoon: number;
  expired: number;
  lowStock: number;
  emergencyCount: number;
  childrenCount: number;
  readinessScore: number;
  readinessStatus: 'weak' | 'moderate' | 'excellent';
}

export interface ExportPreferences {
  includeNotes: boolean;
  includeImages: boolean;
  includeExpired: boolean;
  dateFormat: 'iso' | 'us' | 'eu';
}

export interface AppSettings {
  darkMode: boolean;
  exportPreferences: ExportPreferences;
}
