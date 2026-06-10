import type { EmergencyItem } from '@/types/medicine';

export const MEDICINE_FORMS = [
  { value: 'tablets' as const, label: 'Tablets' },
  { value: 'syrup' as const, label: 'Syrup' },
  { value: 'injection' as const, label: 'Injection' },
  { value: 'cream' as const, label: 'Cream' },
  { value: 'drops' as const, label: 'Drops' },
  { value: 'other' as const, label: 'Other' },
] as const;

export const MEDICINE_CATEGORIES = [
  { value: 'adult' as const, label: 'Adult', color: 'bg-blue-500/20 text-blue-300' },
  { value: 'children' as const, label: 'Children', color: 'bg-green-500/20 text-green-300' },
  { value: 'emergency' as const, label: 'Emergency', color: 'bg-rose-500/20 text-rose-300' },
  { value: 'chronic' as const, label: 'Chronic Illness', color: 'bg-amber-500/20 text-amber-300' },
  { value: 'other' as const, label: 'Other', color: 'bg-slate-500/20 text-slate-300' },
] as const;

export const EMERGENCY_ITEMS: EmergencyItem[] = [
  { name: 'Paracetamol / Acetaminophen', keywords: ['paracetamol', 'acetaminophen', 'tylenol', 'panadol'] },
  { name: 'Bandages / Plasters', keywords: ['bandage', 'plaster', 'band-aid', 'bandaid', 'dressing'] },
  { name: 'Antiseptic Solution', keywords: ['antiseptic', 'iodine', 'betadine', 'hydrogen peroxide', 'alcohol swab'] },
  { name: 'Allergy Medicine', keywords: ['antihistamine', 'cetirizine', 'loratadine', 'diphenhydramine', 'allergy'] },
  { name: 'Thermometer', keywords: ['thermometer', 'temperature'] },
  { name: 'Disposable Gloves', keywords: ['glove', 'gloves'] },
  { name: 'Pain Reliever (Ibuprofen)', keywords: ['ibuprofen', 'advil', 'motrin', 'brufen'] },
  { name: 'Anti-diarrheal', keywords: ['loperamide', 'imodium', 'anti-diarrheal', 'diarrhea'] },
  { name: 'Oral Rehydration Salts', keywords: ['ors', 'rehydration', 'electrolyte'] },
  { name: 'Tweezers', keywords: ['tweezer', 'tweezers'] },
];

export const DEFAULT_SETTINGS = {
  darkMode: true,
  exportPreferences: {
    includeNotes: true,
    includeImages: false,
    includeExpired: true,
    dateFormat: 'iso' as const,
  },
};

export const STORAGE_KEYS = {
  medicines: 'homemed_medicines',
  settings: 'homemed_settings',
};

export const CATEGORY_IMAGES: Record<string, string> = {
  'pain': '/images/category-pain.jpg',
  'emergency': '/images/category-emergency.jpg',
  'vitamins': '/images/category-vitamins.jpg',
  'prescription': '/images/category-prescription.jpg',
};

export const CAROUSEL_IMAGES = [
  '/images/carousel-1.jpg',
  '/images/carousel-2.jpg',
  '/images/carousel-3.jpg',
  '/images/carousel-4.jpg',
  '/images/carousel-5.jpg',
];
