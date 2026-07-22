export type MedicationId =
  | 'ozempic'
  | 'wegovy'
  | 'mounjaro'
  | 'zepbound'
  | 'saxenda'
  | 'compounded_sema'
  | 'compounded_tirz'
  | 'compounded'
  | 'rybelsus'
  | 'oral_sema'
  | 'other';

/** How the medication is taken. Changes the schedule, the reminders and the copy. */
export type Route = 'injection' | 'oral';

export type Medication = {
  id: MedicationId;
  name: string;
  molecule: string;
  /** Elimination half-life in hours. Drives the medication-level curve. */
  halfLifeHours: number;
  doses: number[];
  unit: 'mg';
  route: Route;
  /**
   * Hours between doses at label cadence: 168 for a weekly shot, 24 for a
   * daily pill. The PK model normalises against this, so an oral taken daily
   * is not judged against a weekly peak.
   */
  intervalHours: number;
};

export const MEDICATIONS: Medication[] = [
  {
    id: 'ozempic',
    name: 'Ozempic',
    molecule: 'Semaglutide',
    halfLifeHours: 168,
    doses: [0.25, 0.5, 1.0, 1.7, 2.0],
    unit: 'mg',
    route: 'injection',
    intervalHours: 168,
  },
  {
    id: 'wegovy',
    name: 'Wegovy',
    molecule: 'Semaglutide',
    halfLifeHours: 168,
    doses: [0.25, 0.5, 1.0, 1.7, 2.4],
    unit: 'mg',
    route: 'injection',
    intervalHours: 168,
  },
  {
    id: 'mounjaro',
    name: 'Mounjaro',
    molecule: 'Tirzepatide',
    halfLifeHours: 120,
    doses: [2.5, 5, 7.5, 10, 12.5, 15],
    unit: 'mg',
    route: 'injection',
    intervalHours: 168,
  },
  {
    id: 'zepbound',
    name: 'Zepbound',
    molecule: 'Tirzepatide',
    halfLifeHours: 120,
    doses: [2.5, 5, 7.5, 10, 12.5, 15],
    unit: 'mg',
    route: 'injection',
    intervalHours: 168,
  },
  {
    id: 'saxenda',
    name: 'Saxenda',
    molecule: 'Liraglutide',
    halfLifeHours: 13,
    doses: [0.6, 1.2, 1.8, 2.4, 3.0],
    unit: 'mg',
    route: 'injection',
    // Liraglutide is a once-daily injection, unlike the weekly GLP-1s.
    intervalHours: 24,
  },
  {
    id: 'compounded_sema',
    name: 'Compounded Semaglutide',
    molecule: 'Semaglutide',
    halfLifeHours: 168,
    doses: [0.25, 0.5, 1.0, 1.7, 2.4],
    unit: 'mg',
    route: 'injection',
    intervalHours: 168,
  },
  {
    id: 'compounded_tirz',
    name: 'Compounded Tirzepatide',
    molecule: 'Tirzepatide',
    halfLifeHours: 120,
    doses: [2.5, 5, 7.5, 10, 12.5, 15],
    unit: 'mg',
    route: 'injection',
    intervalHours: 168,
  },
  {
    id: 'rybelsus',
    name: 'Rybelsus',
    molecule: 'Semaglutide (oral)',
    halfLifeHours: 168,
    doses: [3, 7, 14, 25],
    unit: 'mg',
    route: 'oral',
    intervalHours: 24,
  },
  {
    id: 'oral_sema',
    name: 'Compounded oral',
    molecule: 'Semaglutide (oral)',
    halfLifeHours: 160,
    doses: [1, 2, 3, 5, 7, 10, 14],
    unit: 'mg',
    route: 'oral',
    intervalHours: 24,
  },
  {
    id: 'other',
    name: 'Other',
    molecule: 'GLP-1',
    halfLifeHours: 150,
    doses: [0.25, 0.5, 1.0, 1.7, 2.4, 5, 7.5, 10, 12.5, 15],
    unit: 'mg',
    route: 'injection',
    intervalHours: 168,
  },
];

export const getMedication = (id?: MedicationId | null) =>
  MEDICATIONS.find((m) => m.id === id) ?? MEDICATIONS[0];

export const isOral = (id?: MedicationId | null) => getMedication(id).route === 'oral';

/** "shot" or "pill" — used everywhere the copy must match how it is taken. */
export const doseNoun = (id?: MedicationId | null) =>
  getMedication(id).route === 'oral' ? 'pill' : 'shot';

/** "Daily" / "Weekly" / "Every 3 days", from the medication's own cadence. */
export function cadenceLabel(id?: MedicationId | null): string {
  const hours = getMedication(id).intervalHours;
  if (hours <= 24) return 'Daily';
  if (hours === 168) return 'Weekly';
  const days = Math.round(hours / 24);
  return `Every ${days} days`;
}
