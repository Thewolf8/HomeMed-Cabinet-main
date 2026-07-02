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
import {
  scheduleMedicationNotifications,
  cancelMedicationNotifications,
  scheduleLowStockAlert,
  LOW_STOCK_THRESHOLD,
} from '@/services/notificationService';
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
import {
  getProfileReminders,
  saveProfileReminders,
  setProfileReminder,
  removeProfileReminder as removeProfileReminderSvc,
  clearAllProfileScopedData,
  getProfiles,
} from '@/services/profileService';
import { useProfile } from '@/context/ProfileContext';

// ── Helper ────────────────────────────────────────────────────────────────────

/** Merges per-profile reminders over the shared medication base objects. */
function mergeReminders(
  base: Medication[],
  profileId: string,
): Medication[] {
  const map = getProfileReminders(profileId);
  return base.map((med) => ({ ...med, reminder: map[med.id] }));
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useMedications() {
  const { activeProfile } = useProfile();
  const activeProfileId = activeProfile.id;

  // A ref that always holds the latest profileId so stable callbacks can
  // still read the current value without re-creating themselves on every switch.
  const profileIdRef = useRef(activeProfileId);
  profileIdRef.current = activeProfileId;

  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading]         = useState(true);
  const [manuallyPresent, setManuallyPresent] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('homemed-emergency-overrides');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  // Stable refresh — reads the current profileId from the ref so
  // the startup effect never needs to re-run when the profile changes.
  const refresh = useCallback(() => {
    const base = getMedications();
    setMedications(mergeReminders(base, profileIdRef.current));
  }, []);

  // Ref so the notification-action listener never goes stale.
  const confirmDoseRef = useRef<((medId: string, time: string, taken: boolean) => void) | null>(null);

  // ── Startup effect (runs once on mount) ────────────────────────────────────
  useEffect(() => {
    const base = getMedications();
    setMedications(mergeReminders(base, activeProfileId));
    setLoading(false);

    void (async () => {
      const settings = getSettings();
      let dataChanged = false;

      // 1) Auto-delete expired medications.
      if (settings.autoDeleteExpired) {
        const removed = deleteExpiredMedications();
        if (removed.length > 0) {
          await Promise.all(removed.map((m) => cancelMedicationNotifications(m.notificationIds)));
          dataChanged = true;
        }
      }

      // 2) Safety net: (re)schedule expiry notifications for all medications.
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

      // 3) Safety net + day-reconciliation for the active profile's dose reminders.
      const profileRems = getProfileReminders(activeProfileId);
      let remsChanged = false;
      for (const med of current) {
        const rem = profileRems[med.id];
        if (!rem?.enabled) continue;

        // Re-schedule if notification IDs are missing (first run / cleared by OS).
        if (!rem.notificationIds || rem.notificationIds.length === 0) {
          const ids = await scheduleDoseReminders(med, rem);
          if (ids.length > 0) {
            profileRems[med.id] = { ...rem, notificationIds: ids };
            remsChanged = true;
          }
        }

        // Reset "confirmed today" if the calendar date has rolled over.
        const reconciled = reconcileReminderDay(profileRems[med.id] ?? rem);
        if (reconciled !== (profileRems[med.id] ?? rem)) {
          profileRems[med.id] = reconciled;
          remsChanged = true;
        }
      }
      if (remsChanged) {
        saveProfileReminders(activeProfileId, profileRems);
        dataChanged = true;
      }

      // 4) Weekly auto-backup.
      void checkAndRunAutoBackup();

      if (dataChanged) refresh();
    })();

    // Handle Yes/No taps on dose-reminder notifications.
    const unsubscribe = registerDoseActionListener((medId, taken, doseTime) => {
      if (!doseTime) return;
      confirmDoseRef.current?.(medId, doseTime, taken);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);   // intentionally runs once on mount

  // ── Profile-switch effect ──────────────────────────────────────────────────
  // When the active profile changes: cancel the previous profile's dose
  // notifications, schedule the new profile's, then re-merge the state.
  const prevProfileIdRef = useRef(activeProfileId);
  useEffect(() => {
    const prevId = prevProfileIdRef.current;
    if (prevId === activeProfileId) return;
    prevProfileIdRef.current = activeProfileId;

    void (async () => {
      // Cancel old profile's dose reminders.
      const oldRems = getProfileReminders(prevId);
      for (const rem of Object.values(oldRems)) {
        await cancelDoseReminders(rem);
        await cancelSnoozeReminder(rem);
      }

      // Schedule new profile's dose reminders.
      const base        = getMedications();
      const newRems     = getProfileReminders(activeProfileId);
      let remsChanged   = false;
      for (const med of base) {
        const rem = newRems[med.id];
        if (!rem?.enabled) continue;
        const ids = await scheduleDoseReminders(med, rem);
        newRems[med.id] = { ...rem, notificationIds: ids };
        remsChanged = true;
      }
      if (remsChanged) saveProfileReminders(activeProfileId, newRems);

      refresh();
    })();
  }, [activeProfileId, refresh]);

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const add = useCallback(
    (med: Omit<Medication, 'id' | 'createdAt' | 'updatedAt'>) => {
      const settings = getSettings();
      const pid = profileIdRef.current;

      // Strip any reminder from the shared object — reminders are profile-scoped.
      const { reminder: incomingReminder, ...medWithoutReminder } = med;
      const { medication, merged } = addOrMergeMedication(medWithoutReminder, settings.smartMergeEnabled);

      void (async () => {
        if (merged) await cancelMedicationNotifications(medication.notificationIds);
        const notificationIds = await scheduleMedicationNotifications(medication, settings.notifications);
        const updates: Partial<Medication> = { notificationIds };
        updateMedication(medication.id, updates);

        // If a reminder was included, save it to the active profile's store.
        if (incomingReminder?.enabled) {
          const doseIds = await scheduleDoseReminders(medication, incomingReminder);
          setProfileReminder(pid, medication.id, {
            ...incomingReminder,
            notificationIds: doseIds,
          });
        }
        refresh();
      })();

      refresh();
      return { medication, merged };
    },
    [refresh],
  );

  const update = useCallback(
    (id: string, updates: Partial<Medication>) => {
      const before  = getMedications().find((m) => m.id === id);
      // Keep reminder changes out of the shared store.
      const { reminder: reminderUpdate, ...sharedUpdates } = updates;
      const updated = updateMedication(id, sharedUpdates);

      if (updated) {
        void (async () => {
          await cancelMedicationNotifications(before?.notificationIds);
          const notificationIds = await scheduleMedicationNotifications(
            updated,
            getSettings().notifications,
          );
          updateMedication(id, { notificationIds });
          refresh();
        })();
      }

      // If a reminder was part of the update, persist it to the profile store.
      if (reminderUpdate !== undefined) {
        setProfileReminder(profileIdRef.current, id, reminderUpdate);
      }

      refresh();
      return updated;
    },
    [refresh],
  );

  const remove = useCallback(
    (id: string) => {
      const before = getMedications().find((m) => m.id === id);
      const rem    = getProfileReminders(profileIdRef.current)[id];
      const result = deleteMedication(id);
      if (result) {
        void cancelMedicationNotifications(before?.notificationIds);
        if (rem) {
          void cancelDoseReminders(rem);
          void cancelSnoozeReminder(rem);
          removeProfileReminderSvc(profileIdRef.current, id);
        }
      }
      refresh();
      return result;
    },
    [refresh],
  );

  const deleteExpired = useCallback(() => {
    const removed = deleteExpiredMedications();
    if (removed.length > 0) {
      void Promise.all(removed.map((m) => cancelMedicationNotifications(m.notificationIds)));
      void Promise.all(
        removed.map((m) => {
          const rem = getProfileReminders(profileIdRef.current)[m.id];
          if (rem) {
            removeProfileReminderSvc(profileIdRef.current, m.id);
            return Promise.all([cancelDoseReminders(rem), cancelSnoozeReminder(rem)]);
          }
          return Promise.resolve();
        }),
      );
    }
    refresh();
    return removed.length;
  }, [refresh]);

  const reset = useCallback(() => {
    const before = getMedications();
    // Cancel all expiry notifications.
    void Promise.all(before.map((m) => cancelMedicationNotifications(m.notificationIds)));
    // Cancel the active profile's dose reminders.
    const activeRems = getProfileReminders(profileIdRef.current);
    void Promise.all(Object.values(activeRems).map((r) => cancelDoseReminders(r)));
    // Wipe shared medication store + all profile-scoped data.
    resetAllData();
    clearAllProfileScopedData();
    refresh();
  }, [refresh]);

  const importData = useCallback(
    (data: unknown, merge: boolean = true) => {
      const previous = getMedications();
      const result   = importMedications(data, merge);

      void (async () => {
        const settings = getSettings();
        if (!merge) {
          await Promise.all(previous.map((m) => cancelMedicationNotifications(m.notificationIds)));
          const activeRems = getProfileReminders(profileIdRef.current);
          await Promise.all(Object.values(activeRems).map((r) => cancelDoseReminders(r)));
          saveProfileReminders(profileIdRef.current, {});
        }

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
    [refresh],
  );

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
    [refresh],
  );

  // ── Reminder management (profile-scoped) ───────────────────────────────────

  const setReminder = useCallback(
    (id: string, reminder: DoseReminder) => {
      const med = getMedications().find((m) => m.id === id);
      if (!med) return;
      const pid = profileIdRef.current;

      void (async () => {
        const existing = getProfileReminders(pid)[id];
        if (existing) {
          await cancelDoseReminders(existing);
          await cancelSnoozeReminder(existing);
        }
        const notificationIds = await scheduleDoseReminders(med, reminder);
        setProfileReminder(pid, id, {
          ...reminder,
          notificationIds,
          snoozeNotificationId: undefined,
        });
        refresh();
      })();
    },
    [refresh],
  );

  const removeReminder = useCallback(
    (id: string) => {
      const pid      = profileIdRef.current;
      const existing = getProfileReminders(pid)[id];
      if (!existing) return;

      void (async () => {
        await cancelDoseReminders(existing);
        await cancelSnoozeReminder(existing);
        removeProfileReminderSvc(pid, id);
        refresh();
      })();
    },
    [refresh],
  );

  // ── Dose confirmation ──────────────────────────────────────────────────────

  const confirmDose = useCallback(
    (id: string, doseTime: string, taken: boolean) => {
      const pid       = profileIdRef.current;
      const med       = getMedications().find((m) => m.id === id);
      const baseRem   = getProfileReminders(pid)[id];
      if (!med || !baseRem) return;

      const reminder = reconcileReminderDay(baseRem);
      if (reminder.confirmedToday.includes(doseTime)) return;

      void (async () => {
        await cancelSnoozeReminder(reminder);
        let finalReminder: DoseReminder = { ...reminder, snoozeNotificationId: undefined };

        if (taken) {
          const { newQuantity, newConsumedFraction } = computeDoseDeduction(reminder, med.quantity);
          const unitsDeducted = med.quantity - newQuantity;

          addDoseLog({
            medicationId:   med.id,
            medicationName: med.name,
            activeIngredient: med.activeIngredient,
            dosage:         med.dosage,
            doseMg:         reminder.doseMg,
            unitsDeducted,
            quantityAfter:  newQuantity,
            scheduledTime:  doseTime,
            confirmedAt:    new Date().toISOString(),
            source: 'reminder',
          });

          finalReminder = {
            ...finalReminder,
            consumedFraction: newConsumedFraction,
            confirmedToday: [...finalReminder.confirmedToday, doseTime],
          };

          // Low-stock alert — fire exactly once, the moment this deduction
          // crosses the threshold from "fine" to "running low" (or empty).
          // Re-confirming further doses while already low won't re-fire.
          if (med.quantity > LOW_STOCK_THRESHOLD && newQuantity <= LOW_STOCK_THRESHOLD) {
            void scheduleLowStockAlert(med, newQuantity);
          }

          if (newQuantity <= 0) {
            await cancelDoseReminders(finalReminder);
            finalReminder = { ...finalReminder, enabled: false, notificationIds: [] };
          }

          updateMedication(id, { quantity: newQuantity });
          setProfileReminder(pid, id, finalReminder);
        } else {
          const snoozeId = await scheduleSnoozeReminder(med, doseTime);
          finalReminder  = { ...finalReminder, snoozeNotificationId: snoozeId };
          setProfileReminder(pid, id, finalReminder);
        }

        refresh();
      })();
    },
    [refresh],
  );

  useEffect(() => { confirmDoseRef.current = confirmDose; }, [confirmDose]);

  // ── Derived data ───────────────────────────────────────────────────────────

  const dueReminders = medications
    .filter((m) => m.reminder?.enabled)
    .map((m) => ({ medication: m, dueTimes: getDueTimes(m.reminder!) }))
    .filter((e) => e.dueTimes.length > 0);

  const activeReminders = medications.filter((m) => m.reminder?.enabled);

  const toggleEmergencyOverride = useCallback((item: string) => {
    setManuallyPresent((prev) => {
      const next = prev.includes(item)
        ? prev.filter((i) => i !== item)
        : [...prev, item];
      try { localStorage.setItem('homemed-emergency-overrides', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const filteredMedications = useCallback(
    (
      filters: MedicationFilters,
      sortField: SortField = 'name',
      sortOrder: SortOrder = 'asc',
    ) => {
      let result = [...medications];

      if (filters.search) {
        const q = filters.search.toLowerCase();
        result = result.filter(
          (m) =>
            m.name.toLowerCase().includes(q) ||
            m.activeIngredient.toLowerCase().includes(q) ||
            m.dosage.toLowerCase().includes(q),
        );
      }
      if (filters.category !== 'all') result = result.filter((m) => m.category === filters.category);
      if (filters.expiration !== 'all') {
        result = result.filter((m) => {
          const d = getDaysUntilExpiration(m.expirationDate);
          if (filters.expiration === 'expired')      return d < 0;
          if (filters.expiration === 'expiring-soon') return d >= 0 && d <= 30;
          if (filters.expiration === 'valid')         return d > 30;
          return true;
        });
      }
      if (filters.emergencyOnly) result = result.filter((m) => m.category === 'emergency');
      if (filters.storageLocation !== 'all') {
        result = result.filter((m) => m.storageLocation === filters.storageLocation);
      }

      result.sort((a, b) => {
        let cmp = 0;
        switch (sortField) {
          case 'name':            cmp = a.name.localeCompare(b.name); break;
          case 'expirationDate':  cmp = new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime(); break;
          case 'quantity':        cmp = a.quantity - b.quantity; break;
          case 'category':        cmp = a.category.localeCompare(b.category); break;
          case 'storageLocation': cmp = (a.storageLocation ?? '').localeCompare(b.storageLocation ?? ''); break;
        }
        return sortOrder === 'asc' ? cmp : -cmp;
      });

      return result;
    },
    [medications],
  );

  const stats = {
    total:        medications.length,
    expired:      medications.filter((m) => getDaysUntilExpiration(m.expirationDate) < 0).length,
    expiringSoon: medications.filter((m) => {
      const d = getDaysUntilExpiration(m.expirationDate);
      return d >= 0 && d <= 30;
    }).length,
    lowStock: medications.filter((m) => m.quantity <= LOW_STOCK_THRESHOLD).length,
  };

  const emergencyReadiness = (() => {
    const names = medications.map((m) => m.name.toLowerCase());
    const ings  = medications.map((m) => m.activeIngredient.toLowerCase());
    let found   = 0;
    const missing: string[] = [];
    const inMedications: string[] = [];

    for (const item of EMERGENCY_ITEMS) {
      const low      = item.toLowerCase();
      const hasInMed = names.some((n) => n.includes(low)) || ings.some((i) => i.includes(low));
      if (hasInMed)              { inMedications.push(item); found++; }
      else if (manuallyPresent.includes(item)) { found++; }
      else                       { missing.push(item); }
    }

    const score  = Math.round((found / EMERGENCY_ITEMS.length) * 100);
    const status = score >= 80 ? 'excellent' : score >= 50 ? 'moderate' : 'weak';
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
