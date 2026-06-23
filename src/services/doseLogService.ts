import type { DoseLog } from '@/types/doseLog';

const STORAGE_KEY = 'homemed-dose-log';
const MAX_AGE_DAYS = 90;

function loadAll(): DoseLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAll(logs: DoseLog[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
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
