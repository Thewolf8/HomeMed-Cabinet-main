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
