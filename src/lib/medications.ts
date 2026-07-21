export type MedicationId =
  | 'ozempic'
  | 'wegovy'
  | 'mounjaro'
  | 'zepbound'
  | 'saxenda'
  | 'compounded_sema'
  | 'compounded_tirz'
  | 'compounded'
  | 'other';

export type Medication = {
  id: MedicationId;
  name: string;
  molecule: string;
  /** Elimination half-life in hours. Drives the medication-level curve. */
  halfLifeHours: number;
  doses: number[];
  unit: 'mg';
};

export const MEDICATIONS: Medication[] = [
  {
    id: 'ozempic',
    name: 'Ozempic',
    molecule: 'Semaglutide',
    halfLifeHours: 168,
    doses: [0.25, 0.5, 1.0, 1.7, 2.0],
    unit: 'mg',
  },
  {
    id: 'wegovy',
    name: 'Wegovy',
    molecule: 'Semaglutide',
    halfLifeHours: 168,
    doses: [0.25, 0.5, 1.0, 1.7, 2.4],
    unit: 'mg',
  },
  {
    id: 'mounjaro',
    name: 'Mounjaro',
    molecule: 'Tirzepatide',
    halfLifeHours: 120,
    doses: [2.5, 5, 7.5, 10, 12.5, 15],
    unit: 'mg',
  },
  {
    id: 'zepbound',
    name: 'Zepbound',
    molecule: 'Tirzepatide',
    halfLifeHours: 120,
    doses: [2.5, 5, 7.5, 10, 12.5, 15],
    unit: 'mg',
  },
  {
    id: 'saxenda',
    name: 'Saxenda',
    molecule: 'Liraglutide',
    halfLifeHours: 13,
    doses: [0.6, 1.2, 1.8, 2.4, 3.0],
    unit: 'mg',
  },
  {
    id: 'compounded_sema',
    name: 'Compounded Semaglutide',
    molecule: 'Semaglutide',
    halfLifeHours: 168,
    doses: [0.25, 0.5, 1.0, 1.7, 2.4],
    unit: 'mg',
  },
  {
    id: 'compounded_tirz',
    name: 'Compounded Tirzepatide',
    molecule: 'Tirzepatide',
    halfLifeHours: 120,
    doses: [2.5, 5, 7.5, 10, 12.5, 15],
    unit: 'mg',
  },
  {
    id: 'other',
    name: 'Other',
    molecule: 'GLP-1',
    halfLifeHours: 150,
    doses: [0.25, 0.5, 1.0, 1.7, 2.4, 5, 7.5, 10, 12.5, 15],
    unit: 'mg',
  },
];

export const getMedication = (id?: MedicationId | null) =>
  MEDICATIONS.find((m) => m.id === id) ?? MEDICATIONS[0];
