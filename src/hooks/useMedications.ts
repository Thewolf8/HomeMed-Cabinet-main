import { useState, useCallback, useEffect } from 'react';
import type { Medication, MedicationFilters, SortField, SortOrder } from '@/types/medication';
import { EMERGENCY_ITEMS } from '@/types/medication';
import {
  getMedications,
  addMedication,
  updateMedication,
  deleteMedication,
  resetAllData,
  importMedications,
} from '@/services/medicationService';
import { getDaysUntilExpiration } from '@/services/exportService';

export function useMedications() {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMedications(getMedications());
    setLoading(false);
  }, []);

  const refresh = useCallback(() => {
    setMedications(getMedications());
  }, []);

  const add = useCallback(
    (med: Omit<Medication, 'id' | 'createdAt' | 'updatedAt'>) => {
      const newMed = addMedication(med);
      refresh();
      return newMed;
    },
    [refresh]
  );

  const update = useCallback(
    (id: string, updates: Partial<Medication>) => {
      const updated = updateMedication(id, updates);
      refresh();
      return updated;
    },
    [refresh]
  );

  const remove = useCallback(
    (id: string) => {
      const result = deleteMedication(id);
      refresh();
      return result;
    },
    [refresh]
  );

  const reset = useCallback(() => {
    resetAllData();
    refresh();
  }, [refresh]);

  const importData = useCallback(
    (data: unknown, merge: boolean = true) => {
      const result = importMedications(data, merge);
      refresh();
      return result;
    },
    [refresh]
  );

  const filteredMedications = useCallback(
    (filters: MedicationFilters, sortField: SortField = 'name', sortOrder: SortOrder = 'asc') => {
      let result = [...medications];

      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        result = result.filter(
          (med) =>
            med.name.toLowerCase().includes(searchLower) ||
            med.activeIngredient.toLowerCase().includes(searchLower) ||
            med.dosage.toLowerCase().includes(searchLower)
        );
      }

      // Category filter
      if (filters.category !== 'all') {
        result = result.filter((med) => med.category === filters.category);
      }

      // Expiration filter
      if (filters.expiration !== 'all') {
        result = result.filter((med) => {
          const days = getDaysUntilExpiration(med.expirationDate);
          if (filters.expiration === 'expired') return days < 0;
          if (filters.expiration === 'expiring-soon') return days >= 0 && days <= 30;
          if (filters.expiration === 'valid') return days > 30;
          return true;
        });
      }

      // Emergency filter
      if (filters.emergencyOnly) {
        result = result.filter((med) => med.category === 'emergency');
      }

      // Sorting
      result.sort((a, b) => {
        let comparison = 0;
        switch (sortField) {
          case 'name':
            comparison = a.name.localeCompare(b.name);
            break;
          case 'expirationDate':
            comparison = new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime();
            break;
          case 'quantity':
            comparison = a.quantity - b.quantity;
            break;
          case 'category':
            comparison = a.category.localeCompare(b.category);
            break;
        }
        return sortOrder === 'asc' ? comparison : -comparison;
      });

      return result;
    },
    [medications]
  );

  // Stats
  const stats = {
    total: medications.length,
    expired: medications.filter((m) => getDaysUntilExpiration(m.expirationDate) < 0).length,
    expiringSoon: medications.filter(
      (m) => {
        const days = getDaysUntilExpiration(m.expirationDate);
        return days >= 0 && days <= 30;
      }
    ).length,
    lowStock: medications.filter((m) => m.quantity <= 5).length,
  };

  // Emergency readiness
  const emergencyReadiness = (() => {
    const medNames = medications.map((m) => m.name.toLowerCase());
    const medIngredients = medications.map((m) => m.activeIngredient.toLowerCase());
    
    let found = 0;
    const missing: string[] = [];
    
    for (const item of EMERGENCY_ITEMS) {
      const itemLower = item.toLowerCase();
      const hasItem = medNames.some((name) => name.includes(itemLower)) ||
        medIngredients.some((ing) => ing.includes(itemLower));
      
      if (hasItem) {
        found++;
      } else {
        missing.push(item);
      }
    }
    
    const score = Math.round((found / EMERGENCY_ITEMS.length) * 100);
    let status = 'weak';
    if (score >= 80) status = 'excellent';
    else if (score >= 50) status = 'moderate';
    
    return { score, missing, status, total: EMERGENCY_ITEMS.length, found };
  })();

  return {
    medications,
    loading,
    add,
    update,
    remove,
    reset,
    importData,
    refresh,
    filteredMedications,
    stats,
    emergencyReadiness,
  };
}
