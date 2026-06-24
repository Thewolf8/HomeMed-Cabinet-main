import type { DoseLog } from '@/types/doseLog';
import { getActiveProfile } from './profileService';

const MAX_AGE_DAYS = 90;

/** Always resolves to the current active profile's storage key. */
function storageKey(): string {
  return `homemed-dose-log-${getActiveProfile().id}`;
}

function loadAll(): DoseLog[] {
  try {
    const raw = localStorage.getItem(storageKey());
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAll(logs: DoseLog[]): void {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(logs));
  } catch {
    // Storage full — silently skip
  }
}

/** Removes entries older than MAX_AGE_DAYS to prevent unbounded growth. */
function pruned(logs: DoseLog[]): DoseLog[] {
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  return logs.filter((l) => new Date(l.confirmedAt).getTime() >= cutoff);
}

export function getDoseLogs(): DoseLog[] {
  return loadAll().sort(
    (a, b) => new Date(b.confirmedAt).getTime() - new Date(a.confirmedAt).getTime()
  );
}

export function getDoseLogsForMedication(medicationId: string): DoseLog[] {
  return getDoseLogs().filter((l) => l.medicationId === medicationId);
}

export function addDoseLog(entry: Omit<DoseLog, 'id'>): DoseLog {
  const log: DoseLog = { ...entry, id: `dl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` };
  const updated = pruned([...loadAll(), log]);
  saveAll(updated);
  return log;
}

export function clearDoseLogs(): void {
  saveAll([]);
}

export function clearDoseLogsForMedication(medicationId: string): void {
  saveAll(loadAll().filter((l) => l.medicationId !== medicationId));
}

/**
 * Reads dose logs for a specific profile by ID without changing the active
 * profile — used by the backup service to include all profiles' histories.
 */
export function getDoseLogsForProfile(profileId: string): DoseLog[] {
  try {
    const raw = localStorage.getItem(`homemed-dose-log-${profileId}`);
    const logs: DoseLog[] = raw ? JSON.parse(raw) : [];
    return logs.sort(
      (a, b) => new Date(b.confirmedAt).getTime() - new Date(a.confirmedAt).getTime(),
    );
  } catch {
    return [];
  }
}
