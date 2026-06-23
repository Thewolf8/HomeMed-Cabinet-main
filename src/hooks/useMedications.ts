import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  Medication,
  MedicationFilters,
  SortField,
  SortOrder,
  NotificationPreferences,
  DoseReminder,
} from '@/types/medication';
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
import {
  scheduleDoseReminders,
  cancelDoseReminders,
  scheduleSnoozeReminder,
  cancelSnoozeReminder,
  computeDoseDeduction,
  reconcileReminderDay,
  getDueTimes,
  registerDoseActionListener,
} from '@/services/doseReminderService';
import { checkAndRunAutoBackup } from '@/services/backupService';
import { addDoseLog } from '@/services/doseLogService';

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

  // Holds the latest confirmDose implementation, so the notification-action
  // listener registered in the startup effect below never calls a stale closure.
  const confirmDoseRef = useRef<((medId: string, doseTime: string, taken: boolean) => void) | null>(null);

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
        // Same safety net for dose reminders.
        if (med.reminder?.enabled && (!med.reminder.notificationIds || med.reminder.notificationIds.length === 0)) {
          const notificationIds = await scheduleDoseReminders(med, med.reminder);
          if (notificationIds.length > 0) {
            updateMedication(med.id, { reminder: { ...med.reminder, notificationIds } });
            dataChanged = true;
          }
        }
        // Reset "confirmed today" tracking when the date has rolled over.
        if (med.reminder?.enabled) {
          const reconciled = reconcileReminderDay(med.reminder);
          if (reconciled !== med.reminder) {
            updateMedication(med.id, { reminder: reconciled });
            dataChanged = true;
          }
        }
      }

      // 3) Weekly auto-backup (Requirement II): creates HM-backup.json if
      // missing, or refreshes it if it's more than 7 days old.
      void checkAndRunAutoBackup();

      if (dataChanged) refresh();
    })();

    // Handle Yes/No taps on dose-reminder notifications. Routed through a
    // ref (confirmDose is defined further down in this hook, and a plain
    // closure here would otherwise go stale across re-renders).
    const unsubscribe = registerDoseActionListener((medId, taken, doseTime) => {
      if (!doseTime) return;
      confirmDoseRef.current?.(medId, doseTime, taken);
    });
    return unsubscribe;
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
        const updates: Partial<Medication> = { notificationIds };

        // If a dose reminder was configured on creation (Requirement III,
        // "Add Medicine" page entry point), schedule it now.
        if (medication.reminder?.enabled) {
          const doseIds = await scheduleDoseReminders(medication, medication.reminder);
          updates.reminder = { ...medication.reminder, notificationIds: doseIds };
        }

        updateMedication(medication.id, updates);
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
        void cancelDoseReminders(before?.reminder);
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
      void Promise.all(removed.map((m) => cancelDoseReminders(m.reminder)));
    }
    refresh();
    return removed.length;
  }, [refresh]);

  const reset = useCallback(() => {
    const before = getMedications();
    resetAllData();
    void Promise.all(before.map((m) => cancelMedicationNotifications(m.notificationIds)));
    void Promise.all(before.map((m) => cancelDoseReminders(m.reminder)));
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
          await Promise.all(previous.map((m) => cancelDoseReminders(m.reminder)));
        }

        // (Re)schedule notifications for the inventory as it stands now —
        // imported medications may never have had local alerts scheduled
        // on this device (and any notification ids they carry belong to
        // whatever device originally exported them).
        const current = getMedications();
        for (const med of current) {
          const ids = await scheduleMedicationNotifications(med, settings.notifications);
          const updates: Partial<Medication> = { notificationIds: ids };
          if (med.reminder?.enabled) {
            const doseIds = await scheduleDoseReminders(med, med.reminder);
            updates.reminder = { ...med.reminder, notificationIds: doseIds, snoozeNotificationId: undefined };
          }
          updateMedication(med.id, updates);
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

  /** Enables/updates a medication's dose reminder (Requirement I — usable from any of the 3 entry points). */
  const setReminder = useCallback(
    (id: string, reminder: DoseReminder) => {
      const before = getMedications().find((m) => m.id === id);
      if (!before) return;

      void (async () => {
        if (before.reminder) {
          await cancelDoseReminders(before.reminder);
          await cancelSnoozeReminder(before.reminder);
        }
        const notificationIds = await scheduleDoseReminders(before, reminder);
        updateMedication(id, { reminder: { ...reminder, notificationIds, snoozeNotificationId: undefined } });
        refresh();
      })();
    },
    [refresh]
  );

  /** Turns off and cancels a medication's dose reminder entirely. */
  const removeReminder = useCallback(
    (id: string) => {
      const before = getMedications().find((m) => m.id === id);
      if (!before?.reminder) return;

      void (async () => {
        await cancelDoseReminders(before.reminder);
        await cancelSnoozeReminder(before.reminder);
        updateMedication(id, { reminder: undefined });
        refresh();
      })();
    },
    [refresh]
  );

  /**
   * Confirms (or declines) one specific dose. On "taken", deducts stock
   * using the smart fraction-of-a-unit math and auto-disables the reminder
   * if that brings quantity to 0. On "not yet", schedules a ~45 minute
   * follow-up reminder. Used by: the notification's Yes/No buttons, and the
   * Dashboard's "I took my medicine" button (Requirement I's safety net).
   */
  const confirmDose = useCallback(
    (id: string, doseTime: string, taken: boolean) => {
      const med = getMedications().find((m) => m.id === id);
      if (!med?.reminder) return;
      const reminder = reconcileReminderDay(med.reminder);
      if (reminder.confirmedToday.includes(doseTime)) return; // already handled — avoid double-deduction

      void (async () => {
        await cancelSnoozeReminder(reminder);
        let finalReminder: DoseReminder = { ...reminder, snoozeNotificationId: undefined };

        if (taken) {
          const { newQuantity, newConsumedFraction } = computeDoseDeduction(reminder, med.quantity);
          const unitsDeducted = med.quantity - newQuantity;

          // Write an immutable log entry — this is the only place where
          // confirmed doses are recorded so the history is always accurate.
          addDoseLog({
            medicationId: med.id,
            medicationName: med.name,
            activeIngredient: med.activeIngredient,
            dosage: med.dosage,
            doseMg: reminder.doseMg,
            unitsDeducted,
            quantityAfter: newQuantity,
            scheduledTime: doseTime,
            confirmedAt: new Date().toISOString(),
            source: 'reminder',
          });

          finalReminder = {
            ...finalReminder,
            consumedFraction: newConsumedFraction,
            confirmedToday: [...finalReminder.confirmedToday, doseTime],
          };

          // Auto-disable once the medicine is fully used up, so the app
          // stops asking about a dose that no longer exists in the cabinet.
          if (newQuantity <= 0) {
            await cancelDoseReminders(finalReminder);
            finalReminder = { ...finalReminder, enabled: false, notificationIds: [] };
          }

          updateMedication(id, { quantity: newQuantity, reminder: finalReminder });
        } else {
          const snoozeId = await scheduleSnoozeReminder(med, doseTime);
          finalReminder = { ...finalReminder, snoozeNotificationId: snoozeId };
          updateMedication(id, { reminder: finalReminder });
        }

        refresh();
      })();
    },
    [refresh]
  );

  // Keep the ref used by the notification-action listener (registered in the
  // startup effect above) pointed at the latest confirmDose implementation.
  useEffect(() => {
    confirmDoseRef.current = confirmDose;
  }, [confirmDose]);

  /** Medications with a dose currently due (time has passed, not yet confirmed today) — for the Dashboard widget. */
  const dueReminders = medications
    .filter((m) => m.reminder?.enabled)
    .map((m) => ({ medication: m, dueTimes: getDueTimes(m.reminder!) }))
    .filter((entry) => entry.dueTimes.length > 0);

  /** ALL medications that have an active reminder, regardless of whether a dose is currently due. */
  const activeReminders = medications.filter((m) => m.reminder?.enabled);

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

      // Storage location filter
      if (filters.storageLocation !== 'all') {
        result = result.filter((med) => med.storageLocation === filters.storageLocation);
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
          case 'storageLocation':
            comparison = (a.storageLocation ?? '').localeCompare(b.storageLocation ?? '');
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
    setReminder,
    removeReminder,
    confirmDose,
    dueReminders,
    activeReminders,
  };
}
