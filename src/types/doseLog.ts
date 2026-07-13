export interface DoseLog {
  id: string;
  medicationId: string;
  medicationName: string;
  activeIngredient: string;
  /** Free-text dosage string from the medication (e.g. "500mg"). */
  dosage: string;
  /** The dose taken in mg. 0 when the dose was volume-based (see doseVolumeMl) or non-deducting. */
  doseMg: number;
  /** The dose taken in ml, for volume-mode reminders (syrup/solution/suspension/drops). Absent for unit-based (mg) or non-deducting doses. */
  doseVolumeMl?: number;
  /** How many whole units were deducted from stock for this dose. */
  unitsDeducted: number;
  /** Quantity remaining after this dose was deducted. */
  quantityAfter: number;
  /** The HH:mm scheduled time from the reminder (e.g. "09:00"). */
  scheduledTime: string;
  /** ISO timestamp of when the user confirmed this dose. */
  confirmedAt: string;
  /** How the confirmation happened. */
  source: 'reminder' | 'manual';
}
