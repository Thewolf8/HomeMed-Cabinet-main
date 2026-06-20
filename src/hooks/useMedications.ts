import { useState, useCallback, useEffect } from 'react';
import type { Medication, MedicationFilters, SortField, SortOrder, NotificationPreferences } from '@/types/medication';
import { EMERGENCY_ITEMS } from '@/types/medication';
import {
  getMedications,
  addOrMergeMedication,
  updateMedication,
  deleteMedication,
  deleteExpiredMedications,
  resetAllData,
  importMedications,
} from '@/services/medicationService';
import { getDaysUntilExpiration } from '@/services/exportService';
import { getSettings } from '@/hooks/useSettings';
import { scheduleMedicationNotifications, cancelMedicationNotifications } from '@/services/notificationService';

export function useMedications() {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [manuallyPresent, setManuallyPresent] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('homemed-emergency-overrides');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const refresh = useCallback(() => {
    setMedications(getMedications());
  }, []);

  useEffect(() => {
    const initial = getMedications();
    setMedications(initial);
    setLoading(false);

    // Startup maintenance: runs once per app open.
    void (async () => {
      const settings = getSettings();
      let dataChanged = false;

      // 1) Auto-delete expired medications immediately, if the user opted in.
      if (settings.autoDeleteExpired) {
        const removed = deleteExpiredMedications();
        if (removed.length > 0) {
          await Promise.all(removed.map((m) => cancelMedicationNotifications(m.notificationIds)));
          dataChanged = true;
        }
      }

      // 2) Safety net: make sure every remaining medication has its system
      // notifications scheduled (covers data created before this feature
      // existed, or alarms cleared by the OS after a reboot/force-stop).
      const current = getMedications();
      for (const med of current) {
        const hasSchedule = !!(med.notificationIds?.expiringSoon || med.notificationIds?.expired);
        if (!hasSchedule && med.quantity > 0) {
          const ids = await scheduleMedicationNotifications(med, settings.notifications);
          if (ids.expiringSoon || ids.expired) {
            updateMedication(med.id, { notificationIds: ids });
            dataChanged = true;
          }
        }
      }

      if (dataChanged) refresh();
    })();
  }, [refresh]);

  const add = useCallback(
    (med: Omit<Medication, 'id' | 'createdAt' | 'updatedAt'>) => {
      const settings = getSettings();
      const { medication, merged } = addOrMergeMedication(med, settings.smartMergeEnabled);

      void (async () => {
        // Re-evaluate notifications for the (new or merged) medication —
        // a merge can change the quantity from 0 to >0, which should
        // (re)activate alerts that may not have existed before.
        if (merged) {
          await cancelMedicationNotifications(medication.notificationIds);
        }
        const notificationIds = await scheduleMedicationNotifications(medication, settings.notifications);
        updateMedication(medication.id, { notificationIds });
        refresh();
      })();

      refresh();
      return { medication, merged };
    },
    [refresh]
  );

  const update = useCallback(
    (id: string, updates: Partial<Medication>) => {
      const before = getMedications().find((m) => m.id === id);
      const updated = updateMedication(id, updates);

      if (updated) {
        void (async () => {
          // Cancel whatever was scheduled before, then reschedule from
          // scratch based on the (possibly changed) expiration date/quantity.
          await cancelMedicationNotifications(before?.notificationIds);
          const notificationIds = await scheduleMedicationNotifications(updated, getSettings().notifications);
          updateMedication(id, { notificationIds });
          refresh();
        })();
      }

      refresh();
      return updated;
    },
    [refresh]
  );

  const remove = useCallback(
    (id: string) => {
      const before = getMedications().find((m) => m.id === id);
      const result = deleteMedication(id);
      if (result) {
        void cancelMedicationNotifications(before?.notificationIds);
      }
      refresh();
      return result;
    },
    [refresh]
  );

  const deleteExpired = useCallback(() => {
    const removed = deleteExpiredMedications();
    if (removed.length > 0) {
      void Promise.all(removed.map((m) => cancelMedicationNotifications(m.notificationIds)));
    }
    refresh();
    return removed.length;
  }, [refresh]);

  const reset = useCallback(() => {
    const before = getMedications();
    resetAllData();
    void Promise.all(before.map((m) => cancelMedicationNotifications(m.notificationIds)));
    refresh();
  }, [refresh]);

  const importData = useCallback(
    (data: unknown, merge: boolean = true) => {
      const previous = getMedications();
      const result = importMedications(data, merge);

      void (async () => {
        const settings = getSettings();

        // Replacing the whole inventory: cancel every notification that
        // belonged to the data we just wiped out.
        if (!merge) {
          await Promise.all(previous.map((m) => cancelMedicationNotifications(m.notificationIds)));
        }

        // (Re)schedule notifications for the inventory as it stands now —
        // imported medications may never have had local alerts scheduled
        // on this device.
        const current = getMedications();
        for (const med of current) {
          const ids = await scheduleMedicationNotifications(med, settings.notifications);
          updateMedication(med.id, { notificationIds: ids });
        }
        refresh();
      })();

      refresh();
      return result;
    },
    [refresh]
  );

  /** Re-applies the given notification preferences to every medication currently in the cabinet. */
  const rescheduleAllNotifications = useCallback(
    async (prefs: NotificationPreferences) => {
      const current = getMedications();
      for (const med of current) {
        await cancelMedicationNotifications(med.notificationIds);
        const ids = await scheduleMedicationNotifications(med, prefs);
        updateMedication(med.id, { notificationIds: ids });
      }
      refresh();
    },
    [refresh]
  );

  const toggleEmergencyOverride = useCallback((item: string) => {
    setManuallyPresent((prev) => {
      const next = prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item];
      try {
        localStorage.setItem('homemed-emergency-overrides', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

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
    const inMedications: string[] = [];
    
    for (const item of EMERGENCY_ITEMS) {
      const itemLower = item.toLowerCase();
      const hasInMeds = medNames.some((name) => name.includes(itemLower)) ||
        medIngredients.some((ing) => ing.includes(itemLower));
      const hasManually = manuallyPresent.includes(item);
      
      if (hasInMeds) {
        inMedications.push(item);
        found++;
      } else if (hasManually) {
        found++;
      } else {
        missing.push(item);
      }
    }
    
    const score = Math.round((found / EMERGENCY_ITEMS.length) * 100);
    let status = 'weak';
    if (score >= 80) status = 'excellent';
    else if (score >= 50) status = 'moderate';
    
    return { score, missing, status, total: EMERGENCY_ITEMS.length, found, inMedications, manuallyPresent };
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
    toggleEmergencyOverride,
    deleteExpired,
    rescheduleAllNotifications,
  };
}
