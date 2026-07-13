import type { Medication } from '@/types/medication';

const STORAGE_KEY = 'homemed-medications';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

export function getMedications(): Medication[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch {
    // localStorage not available or invalid data
  }
  return [];
}

export function saveMedications(medications: Medication[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(medications));
  } catch {
    // localStorage not available
  }
}

export function addMedication(med: Omit<Medication, 'id' | 'createdAt' | 'updatedAt'>): Medication {
  const medications = getMedications();
  const newMed: Medication = {
    ...med,
    id: generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  medications.push(newMed);
  saveMedications(medications);
  return newMed;
}

/**
 * Finds an existing medication that is functionally identical to the given
 * one — same name + active ingredient + dosage + expiration date — which is
 * the matching rule used by the "Smart Merge" feature.
 */
export function findMatchingMedication(
  med: Pick<Medication, 'name' | 'activeIngredient' | 'dosage' | 'expirationDate'>,
  pool: Medication[] = getMedications()
): Medication | undefined {
  const norm = (s: string) => s.trim().toLowerCase();
  return pool.find(
    (m) =>
      norm(m.name) === norm(med.name) &&
      norm(m.activeIngredient) === norm(med.activeIngredient) &&
      norm(m.dosage) === norm(med.dosage) &&
      m.expirationDate === med.expirationDate
  );
}

/**
 * Adds a new medication, or — when smartMerge is enabled and a matching
 * medication already exists (same name + active ingredient + dosage +
 * expiration date) — merges the quantities into the existing entry instead
 * of creating a duplicate row.
 */
export function addOrMergeMedication(
  med: Omit<Medication, 'id' | 'createdAt' | 'updatedAt'>,
  smartMerge: boolean
): { medication: Medication; merged: boolean } {
  if (smartMerge) {
    const medications = getMedications();
    const match = findMatchingMedication(med, medications);
    if (match) {
      const index = medications.findIndex((m) => m.id === match.id);
      const merged: Medication = {
        ...match,
        quantity: match.quantity + med.quantity,
        // Sum full-pack sizes too when both are known, so a merge of two
        // identical 30-tablet boxes correctly reads as a 60-tablet full
        // pack rather than leaving the old (now-wrong) 30 in place.
        fullPackQuantity:
          match.fullPackQuantity && med.fullPackQuantity
            ? match.fullPackQuantity + med.fullPackQuantity
            : (match.fullPackQuantity ?? med.fullPackQuantity),
        // Keep the freshest free-text fields, in case the user added more detail this time.
        usageInstructions: med.usageInstructions || match.usageInstructions,
        notes: med.notes || match.notes,
        image: med.image || match.image,
        barcode: med.barcode || match.barcode,
        updatedAt: new Date().toISOString(),
      };
      medications[index] = merged;
      saveMedications(medications);
      return { medication: merged, merged: true };
    }
  }

  return { medication: addMedication(med), merged: false };
}

export function updateMedication(id: string, updates: Partial<Medication>): Medication | null {
  const medications = getMedications();
  const index = medications.findIndex((m) => m.id === id);
  if (index === -1) return null;
  
  medications[index] = {
    ...medications[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  saveMedications(medications);
  return medications[index];
}

export function deleteMedication(id: string): boolean {
  const medications = getMedications();
  const filtered = medications.filter((m) => m.id !== id);
  if (filtered.length === medications.length) return false;
  saveMedications(filtered);
  return true;
}

export function getMedicationById(id: string): Medication | undefined {
  return getMedications().find((m) => m.id === id);
}

function isExpired(expirationDate: string): boolean {
  const exp = new Date(expirationDate);
  if (isNaN(exp.getTime())) return false;
  const now = new Date();
  // Mirrors exportService's getDaysUntilExpiration()/getExpirationStatus()
  // definition of "expired" exactly, so the dashboard's expired count always
  // matches what this function actually removes.
  const days = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return days < 0;
}

/**
 * Removes every medication whose expirationDate has already passed.
 * Returns the removed medications so callers (e.g. to cancel their
 * scheduled notifications) know what was deleted.
 */
export function deleteExpiredMedications(): Medication[] {
  const medications = getMedications();
  const expired = medications.filter((m) => isExpired(m.expirationDate));
  if (expired.length === 0) return [];
  const remaining = medications.filter((m) => !isExpired(m.expirationDate));
  saveMedications(remaining);
  return expired;
}

export function resetAllData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage not available
  }
}

export function validateMedicationData(data: unknown): data is Medication {
  if (!data || typeof data !== 'object') return false;
  const med = data as Record<string, unknown>;
  
  return (
    typeof med.id === 'string' &&
    typeof med.name === 'string' &&
    typeof med.activeIngredient === 'string' &&
    typeof med.dosage === 'string' &&
    typeof med.quantity === 'number' &&
    typeof med.expirationDate === 'string' &&
    typeof med.createdAt === 'string'
  );
}

export function importMedications(
  data: unknown,
  merge: boolean = true
): { success: number; failed: number; medications: Medication[] } {
  let medications = getMedications();
  const imported = Array.isArray(data) ? data : [data];
  let success = 0;
  let failed = 0;

  if (!merge) {
    medications = [];
  }

  for (const item of imported) {
    if (validateMedicationData(item)) {
      // Check for duplicates by id
      const exists = medications.some((m) => m.id === item.id);
      if (exists) {
        // Update existing
        const index = medications.findIndex((m) => m.id === item.id);
        medications[index] = { ...item, updatedAt: new Date().toISOString() };
      } else {
        medications.push(item);
      }
      success++;
    } else {
      failed++;
    }
  }

  saveMedications(medications);
  return { success, failed, medications };
}
