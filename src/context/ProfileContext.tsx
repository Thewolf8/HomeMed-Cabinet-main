import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { Profile, ProfileColor } from '@/types/profile';
import {
  getProfiles,
  getActiveProfile,
  setActiveProfileId,
  addProfile    as svcAdd,
  renameProfile as svcRename,
  changeProfileColor as svcColor,
  deleteProfile as svcDelete,
} from '@/services/profileService';

// ── Context shape ─────────────────────────────────────────────────────────────

interface ProfileCtx {
  profiles: Profile[];
  activeProfile: Profile;
  /** Switch the active profile (triggers re-render everywhere via context). */
  switchProfile: (id: string) => void;
  addProfile: (name: string, color: ProfileColor) => Profile | null;
  renameProfile: (id: string, name: string) => boolean;
  changeProfileColor: (id: string, color: ProfileColor) => boolean;
  /** Deletes a profile and its scoped data. Returns false if it is the only profile. */
  deleteProfile: (id: string) => boolean;
  refreshProfiles: () => void;
}

const Ctx = createContext<ProfileCtx | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function ProfileProvider({ children }: { children: ReactNode }) {
  // getActiveProfile() auto-creates the "Me" profile on first run
  const [activeProfile, setActive] = useState<Profile>(() => getActiveProfile());
  const [profiles, setProfiles]    = useState<Profile[]>(() => getProfiles());

  const refresh = useCallback(() => {
    const active = getActiveProfile();
    setActive(active);
    setProfiles(getProfiles());
  }, []);

  const switchProfile = useCallback(
    (id: string) => { setActiveProfileId(id); refresh(); },
    [refresh],
  );

  const addProfile = useCallback(
    (name: string, color: ProfileColor): Profile | null => {
      const p = svcAdd(name, color);
      if (p) refresh();
      return p;
    },
    [refresh],
  );

  const renameProfile = useCallback(
    (id: string, name: string): boolean => {
      const ok = svcRename(id, name);
      if (ok) refresh();
      return ok;
    },
    [refresh],
  );

  const changeProfileColor = useCallback(
    (id: string, color: ProfileColor): boolean => {
      const ok = svcColor(id, color);
      if (ok) refresh();
      return ok;
    },
    [refresh],
  );

  const deleteProfile = useCallback(
    (id: string): boolean => {
      const ok = svcDelete(id);
      if (ok) refresh();
      return ok;
    },
    [refresh],
  );

  return (
    <Ctx.Provider
      value={{
        profiles,
        activeProfile,
        switchProfile,
        addProfile,
        renameProfile,
        changeProfileColor,
        deleteProfile,
        refreshProfiles: refresh,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useProfile(): ProfileCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useProfile must be used inside <ProfileProvider>');
  return ctx;
}
