import type { MedicationId } from '../lib/medications';

export type Reason = 'weight_loss' | 'diabetes' | 'health' | 'tracking';
export type Units = 'lb' | 'kg';
export type DoseUnit = 'mg' | 'mcg' | 'mL' | 'units';
export type TrackArea = 'weight' | 'side_effects' | 'protein' | 'water' | 'activity' | 'blood_sugar';

export type Settings = {
  theme: 'system' | 'light' | 'dark';
  units: Units;
  notifications: boolean;
  reminderTime: string; // "09:00"
};

export type Goals = {
  proteinG: number;
  waterMl: number;
  steps: number;
  activityMin: number;
  sleepHours: number;
};

export type Profile = {
  onboarded: boolean;
  signedIn: boolean;
  /** Supabase auth uid, or a local- prefixed id when running without a backend. */
  userId: string | null;
  name: string;
  email: string;
  isAdmin: boolean;
  reason: Reason | null;
  medication: MedicationId | null;
  doseMg: number | null;
  /** Unit the user entered their dose in. Canonical numeric lives in doseMg. */
  doseUnit: DoseUnit;
  injectionDay: number | null; // 0 = Sunday
  injectionHour: number; // 24h
  /** Epoch ms of the next scheduled injection picked during onboarding. */
  nextInjectionAt: number | null;
  /** Areas the user chose to track during onboarding. */
  trackAreas: TrackArea[];
  startWeight: number | null;
  goalWeight: number | null;
  isPro: boolean;
  /** FCM registration token for this device, synced to the backend. */
  pushToken: string | null;
  settings: Settings;
  goals: Goals;
};

export type LogKind =
  | 'weight'
  | 'water'
  | 'meal'
  | 'symptom'
  | 'dose'
  | 'photo'
  | 'activity'
  | 'sleep';

export type LogEntry = {
  id: string;
  kind: LogKind;
  at: number;
  /**
   * weight: lb|kg · water: ml · meal: protein g · dose: mg
   * symptom: severity 1-5 (0 = checked in feeling fine) · activity: minutes · sleep: hours
   */
  value: number;
  note?: string;
  /** symptom name, meal name, photo uri */
  label?: string;
};

export type AppState = {
  profile: Profile;
  logs: LogEntry[];
  /** Deleted entries, kept so any delete can be undone. */
  trash: LogEntry[];
};

export const DEFAULT_STATE: AppState = {
  profile: {
    onboarded: false,
    signedIn: false,
    userId: null,
    name: '',
    email: '',
    isAdmin: false,
    reason: null,
    medication: null,
    doseMg: null,
    doseUnit: 'mg',
    injectionDay: null,
    injectionHour: 9,
    nextInjectionAt: null,
    trackAreas: ['weight', 'side_effects', 'protein', 'water', 'activity', 'blood_sugar'],
    startWeight: null,
    goalWeight: null,
    isPro: false,
    pushToken: null,
    settings: { theme: 'system', units: 'lb', notifications: false, reminderTime: '09:00' },
    goals: { proteinG: 100, waterMl: 2500, steps: 7000, activityMin: 30, sleepHours: 7 },
  },
  logs: [],
  trash: [],
};
