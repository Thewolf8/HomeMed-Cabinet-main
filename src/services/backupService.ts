import { Capacitor } from '@capacitor/core';
import { getMedications } from './medicationService';
import { writeAutoBackup, readAutoBackup, getAutoBackupModifiedTime } from './fileSystem';
import { setLastBackupAtDirect } from '@/hooks/useSettings';
import type { Medication } from '@/types/medication';

const isNative = Capacitor.isNativePlatform();
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function buildBackupContent(): string {
  const medications = getMedications();
  return JSON.stringify(
    {
      app: 'HomeMed Cabinet',
      version: '1.0.2',
      kind: 'auto-backup',
      exportDate: new Date().toISOString(),
      medications,
    },
    null,
    2
  );
}

/** Writes (overwrites) HM-backup.json right now with the current inventory. */
export async function writeBackupNow(): Promise<boolean> {
  if (!isNative) return false;
  try {
    await writeAutoBackup(buildBackupContent());
    setLastBackupAtDirect(new Date().toISOString());
    return true;
  } catch {
    return false;
  }
}

/**
 * Startup check (Requirement II): makes sure HM-backup.json exists, creating
 * it immediately if it's missing (first launch, or the user deleted it), and
 * refreshes it if it's more than 7 days old. There's no OS-level background
 * scheduler involved — like the rest of this app, the check simply runs
 * every time the app is opened, which is the practical equivalent of
 * "weekly" for an app that doesn't run a persistent background process.
 * Returns true if a backup was (re)written.
 */
export async function checkAndRunAutoBackup(): Promise<boolean> {
  if (!isNative) return false;
  const mtime = await getAutoBackupModifiedTime();
  const isMissing = mtime === null;
  const isStale = mtime !== null && Date.now() - mtime > SEVEN_DAYS_MS;
  if (isMissing || isStale) {
    return writeBackupNow();
  }
  return false;
}

/**
 * Reads HM-backup.json and returns its medications array, ready to pass
 * straight into importMedications()/onImport() — mirrors how the manual
 * "Import" flow already unwraps `{ medications: [...] }` before importing.
 * Returns null if the file is missing, unreadable, or malformed.
 */
export async function readAutoBackupMedications(): Promise<Medication[] | null> {
  const content = await readAutoBackup();
  if (!content) return null;
  try {
    const parsed = JSON.parse(content);
    if (parsed && Array.isArray(parsed.medications)) return parsed.medications;
    return null;
  } catch {
    return null;
  }
}
