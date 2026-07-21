/**
 * Feature catalogue and the free/Pro split.
 *
 * This is the single source of truth for what is gated. The paywall, the plan
 * comparison screen, and every `<ProGate>` in the app read from it, so a feature
 * can never be listed as Pro in one place and be free in another.
 *
 * The entitlement itself is named `pro` in RevenueCat. `profile.isPro` is a
 * cached client-side mirror of it — convenient for rendering, never trusted for
 * anything that matters. Server-side checks own the real answer.
 */

export type Tier = 'free' | 'premium';

export type FeatureId =
  // Overview
  | 'overview.metabolic-score'
  | 'overview.lifespan'
  | 'overview.body-3d'
  | 'overview.vitals'
  | 'overview.risk-trend'
  | 'overview.goal-date'
  | 'overview.top-lever'
  | 'overview.checkins'
  | 'overview.health-report'
  // GLP-1 tracker
  | 'glp1.fast-setup'
  | 'glp1.next-action'
  | 'glp1.medication-level'
  | 'glp1.trial-benchmark'
  | 'glp1.progress'
  | 'glp1.scorecard'
  | 'glp1.quick-log'
  | 'glp1.body-composition-logging'
  | 'glp1.protein-lookup'
  | 'glp1.injection-reminders'
  | 'glp1.vial-calculator'
  | 'glp1.timeline'
  | 'glp1.undo-delete'
  | 'glp1.day-forecast'
  | 'glp1.weekly-review'
  | 'glp1.plateau-cause'
  | 'glp1.titration-readiness'
  | 'glp1.doctor-report'
  | 'glp1.muscle-guard'
  | 'glp1.multi-medication'
  | 'glp1.refill-tracking'
  | 'glp1.protein-lookup-unlimited'
  // Future You / Autopilot / History
  | 'future.scenarios'
  | 'autopilot.adaptive-plan'
  | 'history.90-days'
  | 'history.forever'
  // Settings
  | 'settings.in-app-support'
  | 'settings.account'
  | 'settings.reminders'
  | 'settings.subscription'
  | 'settings.data-control';

export type FeatureSection =
  | 'Overview'
  | 'GLP-1 Tracker'
  | 'Future You'
  | 'Autopilot'
  | 'History'
  | 'Settings';

export type Feature = {
  id: FeatureId;
  section: FeatureSection;
  /** User-facing outcome, written as a benefit rather than a capability. */
  title: string;
  tier: Tier;
  /** Why it matters — shown on the paywall for headline features. */
  detail?: string;
  /** Free-tier limit, when the feature exists on both tiers in reduced form. */
  freeLimit?: string;
  /** Surfaced on the paywall's highlight reel. */
  headline?: boolean;
};

export const FEATURES: Feature[] = [
  // ---- Overview ----
  { id: 'overview.metabolic-score', section: 'Overview', tier: 'free', title: 'See your whole metabolic health as one score' },
  { id: 'overview.lifespan', section: 'Overview', tier: 'free', title: 'See how your habits are shaping your lifespan' },
  { id: 'overview.body-3d', section: 'Overview', tier: 'free', title: 'Watch your body change in 3D' },
  { id: 'overview.vitals', section: 'Overview', tier: 'free', title: 'Keep your key health numbers in one place' },
  { id: 'overview.risk-trend', section: 'Overview', tier: 'premium', title: 'Watch your heart and diabetes risk fall over time' },
  { id: 'overview.goal-date', section: 'Overview', tier: 'premium', title: 'See when you will reach your goal weight', headline: true },
  { id: 'overview.top-lever', section: 'Overview', tier: 'premium', title: 'Know the single change that will help you most', headline: true },
  { id: 'overview.checkins', section: 'Overview', tier: 'premium', title: 'Save full check-ins and build a real history' },
  { id: 'overview.health-report', section: 'Overview', tier: 'premium', title: 'Download your full health report' },

  // ---- GLP-1 tracker ----
  { id: 'glp1.fast-setup', section: 'GLP-1 Tracker', tier: 'free', title: 'Get set up in under two minutes' },
  { id: 'glp1.next-action', section: 'GLP-1 Tracker', tier: 'free', title: 'Be told what to do next, every time you open it' },
  { id: 'glp1.medication-level', section: 'GLP-1 Tracker', tier: 'free', title: 'See how much medication is still working today' },
  { id: 'glp1.trial-benchmark', section: 'GLP-1 Tracker', tier: 'free', title: 'Know if you are on track against the clinical trials' },
  { id: 'glp1.progress', section: 'GLP-1 Tracker', tier: 'free', title: 'See how far you have actually come' },
  { id: 'glp1.scorecard', section: 'GLP-1 Tracker', tier: 'free', title: 'Share a progress scorecard you are proud of' },
  { id: 'glp1.quick-log', section: 'GLP-1 Tracker', tier: 'free', title: 'Log a dose, weight, meal or symptom in seconds' },
  { id: 'glp1.body-composition-logging', section: 'GLP-1 Tracker', tier: 'free', title: 'Track body composition, labs and workouts too' },
  {
    id: 'glp1.protein-lookup',
    section: 'GLP-1 Tracker',
    tier: 'free',
    title: 'Find out how much protein is really in your meal',
    freeLimit: '3 checks per day',
  },
  { id: 'glp1.injection-reminders', section: 'GLP-1 Tracker', tier: 'free', title: 'Never miss an injection' },
  { id: 'glp1.vial-calculator', section: 'GLP-1 Tracker', tier: 'free', title: 'Draw the right dose from a compounded vial' },
  { id: 'glp1.timeline', section: 'GLP-1 Tracker', tier: 'free', title: 'See everything you have logged, in one timeline' },
  { id: 'glp1.undo-delete', section: 'GLP-1 Tracker', tier: 'free', title: 'Never lose an entry, and undo any delete' },
  { id: 'glp1.day-forecast', section: 'GLP-1 Tracker', tier: 'premium', title: 'Know how today will feel before it happens' },
  { id: 'glp1.weekly-review', section: 'GLP-1 Tracker', tier: 'premium', title: 'Watch your progress week by week, and see plateaus coming' },
  { id: 'glp1.plateau-cause', section: 'GLP-1 Tracker', tier: 'premium', title: 'Find out exactly why your weight loss slowed' },
  { id: 'glp1.titration-readiness', section: 'GLP-1 Tracker', tier: 'premium', title: 'Know when you are ready, or not ready, to increase your dose' },
  { id: 'glp1.doctor-report', section: 'GLP-1 Tracker', tier: 'premium', title: 'Bring organized progress reports to your appointments' },
  {
    id: 'glp1.muscle-guard',
    section: 'GLP-1 Tracker',
    tier: 'premium',
    title: 'Make sure you are losing fat, not the muscle that keeps weight off',
    detail:
      'Up to 40% of GLP-1 weight loss can be muscle. Muscle is what keeps the weight off, so we watch it for you.',
    headline: true,
  },
  { id: 'glp1.multi-medication', section: 'GLP-1 Tracker', tier: 'premium', title: 'Track more than one medication at the same time' },
  { id: 'glp1.refill-tracking', section: 'GLP-1 Tracker', tier: 'premium', title: 'Never run out of medication' },
  { id: 'glp1.protein-lookup-unlimited', section: 'GLP-1 Tracker', tier: 'premium', title: 'Check the protein in as many meals as you like' },

  // ---- Future You / Autopilot / History ----
  { id: 'future.scenarios', section: 'Future You', tier: 'premium', title: 'See your best case, likely case and worst case', headline: true },
  { id: 'autopilot.adaptive-plan', section: 'Autopilot', tier: 'premium', title: 'Get a plan that adapts as your body changes', headline: true },
  { id: 'history.90-days', section: 'History', tier: 'free', title: 'Look back over your last 90 days' },
  {
    id: 'history.forever',
    section: 'History',
    tier: 'premium',
    title: 'Keep your complete treatment history forever',
    detail:
      'Change your phone, change your doctor, change your medication. Your full timeline follows you.',
    headline: true,
  },

  // ---- Settings ----
  { id: 'settings.in-app-support', section: 'Settings', tier: 'free', title: 'Get help without leaving the app' },
  { id: 'settings.account', section: 'Settings', tier: 'free', title: 'Stay in control of your account' },
  { id: 'settings.reminders', section: 'Settings', tier: 'free', title: 'Choose how and when we remind you' },
  { id: 'settings.subscription', section: 'Settings', tier: 'free', title: 'Manage your subscription in one click' },
  { id: 'settings.data-control', section: 'Settings', tier: 'free', title: 'Export or permanently delete your data, any time' },
];

export const SECTIONS: FeatureSection[] = [
  'Overview',
  'GLP-1 Tracker',
  'Future You',
  'Autopilot',
  'History',
  'Settings',
];

export const FEATURE_MAP = new Map(FEATURES.map((f) => [f.id, f]));

export const getFeature = (id: FeatureId) => FEATURE_MAP.get(id)!;

export const isPremium = (id: FeatureId) => getFeature(id).tier === 'premium';

/** Free-tier caps that the app actually enforces. */
export const FREE_HISTORY_DAYS = 90;
export const FREE_PROTEIN_CHECKS_PER_DAY = 3;

export const headlineFeatures = () => FEATURES.filter((f) => f.headline);

export const featuresBySection = (section: FeatureSection) =>
  FEATURES.filter((f) => f.section === section);
