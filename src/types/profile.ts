// ── Profile types ─────────────────────────────────────────────────────────────
// Medicines are shared across all profiles (shared physical cabinet).
// Reminders and dose history are profile-scoped.

export type ProfileColor = 'blue' | 'emerald' | 'violet' | 'rose' | 'amber' | 'teal';

export const PROFILE_COLORS: ProfileColor[] = [
  'blue', 'emerald', 'violet', 'rose', 'amber', 'teal',
];

export const PROFILE_COLOR_CLASSES: Record<
  ProfileColor,
  { bg: string; text: string; ring: string; light: string }
> = {
  blue:    { bg: 'bg-blue-500',    text: 'text-blue-500',    ring: 'ring-blue-500',    light: 'bg-blue-500/15' },
  emerald: { bg: 'bg-emerald-500', text: 'text-emerald-500', ring: 'ring-emerald-500', light: 'bg-emerald-500/15' },
  violet:  { bg: 'bg-violet-500',  text: 'text-violet-500',  ring: 'ring-violet-500',  light: 'bg-violet-500/15' },
  rose:    { bg: 'bg-rose-500',    text: 'text-rose-500',    ring: 'ring-rose-500',    light: 'bg-rose-500/15' },
  amber:   { bg: 'bg-amber-500',   text: 'text-amber-500',   ring: 'ring-amber-500',   light: 'bg-amber-500/15' },
  teal:    { bg: 'bg-teal-500',    text: 'text-teal-500',    ring: 'ring-teal-500',    light: 'bg-teal-500/15' },
};

export const MAX_PROFILES = 6;

export interface Profile {
  id: string;
  name: string;
  color: ProfileColor;
  createdAt: string;
}
