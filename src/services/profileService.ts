import type { Profile, ProfileColor } from '@/types/profile';
import { MAX_PROFILES } from '@/types/profile';
import type { DoseReminder } from '@/types/medication';

// ── Storage keys ─────────────────────────────────────────────────────────────
const PROFILES_KEY   = 'homemed-profiles';
const ACTIVE_KEY     = 'homemed-active-profile';
const REM_PREFIX     = 'homemed-reminders-';
const DOSELOG_PREFIX = 'homemed-dose-log-';

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

// ── Profile CRUD ─────────────────────────────────────────────────────────────

export function getProfiles(): Profile[] {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    return raw ? (JSON.parse(raw) as Profile[]) : [];
  } catch {
    return [];
  }
}

function saveProfiles(list: Profile[]): void {
  try { localStorage.setItem(PROFILES_KEY, JSON.stringify(list)); } catch {}
}

/**
 * Returns the currently-active profile.  Auto-creates a default "Me" profile
 * on first run so the rest of the app never has to handle the zero-profile case.
 */
export function getActiveProfile(): Profile {
  const list = getProfiles();

  if (list.length === 0) {
    const me: Profile = {
      id: uid(),
      name: 'Me',
      color: 'blue',
      createdAt: new Date().toISOString(),
    };
    saveProfiles([me]);
    localStorage.setItem(ACTIVE_KEY, me.id);
    return me;
  }

  const storedId = localStorage.getItem(ACTIVE_KEY);
  return list.find((p) => p.id === storedId) ?? list[0];
}

export function setActiveProfileId(id: string): void {
  localStorage.setItem(ACTIVE_KEY, id);
}

export function addProfile(name: string, color: ProfileColor): Profile | null {
  const list = getProfiles();
  if (list.length >= MAX_PROFILES) return null;
  const p: Profile = {
    id: uid(),
    name: name.trim(),
    color,
    createdAt: new Date().toISOString(),
  };
  saveProfiles([...list, p]);
  return p;
}

export function renameProfile(id: string, name: string): boolean {
  const list = getProfiles();
  const i = list.findIndex((p) => p.id === id);
  if (i === -1) return false;
  list[i] = { ...list[i], name: name.trim() };
  saveProfiles(list);
  return true;
}

export function changeProfileColor(id: string, color: ProfileColor): boolean {
  const list = getProfiles();
  const i = list.findIndex((p) => p.id === id);
  if (i === -1) return false;
  list[i] = { ...list[i], color };
  saveProfiles(list);
  return true;
}

/**
 * Deletes a profile and all of its scoped data (reminders + dose history).
 * Returns false if this is the last remaining profile (must keep at least one).
 */
export function deleteProfile(id: string): boolean {
  const list = getProfiles();
  if (list.length <= 1) return false;
  const next = list.filter((p) => p.id !== id);
  saveProfiles(next);
  // Wipe scoped data
  try { localStorage.removeItem(REM_PREFIX + id); } catch {}
  try { localStorage.removeItem(DOSELOG_PREFIX + id); } catch {}
  // If the deleted profile was the active one, switch to the first remaining
  if (localStorage.getItem(ACTIVE_KEY) === id) {
    localStorage.setItem(ACTIVE_KEY, next[0].id);
  }
  return true;
}

/** Wipes ALL profile-scoped data for every profile (used by Reset All Data). */
export function clearAllProfileScopedData(): void {
  const list = getProfiles();
  for (const p of list) {
    try { localStorage.removeItem(REM_PREFIX + p.id); } catch {}
    try { localStorage.removeItem(DOSELOG_PREFIX + p.id); } catch {}
  }
}

// ── Per-profile reminder store ────────────────────────────────────────────────
// Reminders are decoupled from the shared medication objects and stored
// here, keyed by profileId → medicationId → DoseReminder.

export function getProfileReminders(profileId: string): Record<string, DoseReminder> {
  try {
    const raw = localStorage.getItem(REM_PREFIX + profileId);
    return raw ? (JSON.parse(raw) as Record<string, DoseReminder>) : {};
  } catch {
    return {};
  }
}

export function saveProfileReminders(
  profileId: string,
  map: Record<string, DoseReminder>,
): void {
  try { localStorage.setItem(REM_PREFIX + profileId, JSON.stringify(map)); } catch {}
}

export function setProfileReminder(
  profileId: string,
  medId: string,
  reminder: DoseReminder,
): void {
  const map = getProfileReminders(profileId);
  map[medId] = reminder;
  saveProfileReminders(profileId, map);
}

export function removeProfileReminder(profileId: string, medId: string): void {
  const map = getProfileReminders(profileId);
  delete map[medId];
  saveProfileReminders(profileId, map);
}
