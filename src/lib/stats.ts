/**
 * Statistics for the Intelligence Engine.
 *
 * Confidence is shown to users as a number, so it has to *be* a number —
 * derived from the data, not chosen because it looks persuasive. Everything
 * here is standard: Pearson correlation, a t-test on that correlation, and a
 * two-tailed p-value from the Student-t distribution via the regularized
 * incomplete beta function.
 *
 * The practical consequence: a strong-looking correlation over 10 days scores
 * far lower confidence than a moderate one over 60, which is exactly right and
 * exactly what a hand-picked number would get wrong.
 */

/** Below this many paired observations nothing is reported at all. */
export const MIN_PAIRS = 10;

export type Correlation = { r: number; n: number; p: number; confidence: number };

/** Pearson r. Null when the sample is too small or a series has no variance. */
export function pearson(xs: number[], ys: number[]): { r: number; n: number } | null {
  const n = Math.min(xs.length, ys.length);
  if (n < MIN_PAIRS) return null;

  const mx = xs.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const my = ys.slice(0, n).reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  if (dx === 0 || dy === 0) return null;

  const r = num / Math.sqrt(dx * dy);
  return Number.isFinite(r) ? { r: Math.max(-1, Math.min(1, r)), n } : null;
}

/** Continued-fraction expansion for the incomplete beta function (Lentz). */
function betacf(a: number, b: number, x: number): number {
  const MAXIT = 200;
  const EPS = 3e-12;
  const FPMIN = 1e-300;

  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;

    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Log-gamma, Lanczos approximation. */
function gammaln(x: number): number {
  const cof = [
    76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155,
    0.1208650973866179e-2, -0.5395239384953e-5,
  ];
  let y = x;
  const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += cof[j] / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

/** Regularized incomplete beta I_x(a, b). */
function betai(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(
    gammaln(a + b) - gammaln(a) - gammaln(b) + a * Math.log(x) + b * Math.log(1 - x),
  );
  return x < (a + 1) / (a + b + 2)
    ? (bt * betacf(a, b, x)) / a
    : 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Two-tailed p-value for Student's t with `df` degrees of freedom. */
export function tTestP(t: number, df: number): number {
  if (df <= 0) return 1;
  return betai(df / 2, 0.5, df / (df + t * t));
}

/**
 * Confidence that a correlation is not chance, as a percentage.
 *
 * Capped at 97: with observational self-reported data, certainty is never
 * warranted no matter how clean the arithmetic looks.
 */
export function correlationConfidence(r: number, n: number): { p: number; confidence: number } {
  if (n < 3 || Math.abs(r) >= 1) return { p: 0, confidence: 97 };
  const t = r * Math.sqrt((n - 2) / (1 - r * r));
  const p = tTestP(Math.abs(t), n - 2);
  return { p, confidence: Math.max(0, Math.min(97, Math.round((1 - p) * 100))) };
}

export function correlate(xs: number[], ys: number[]): Correlation | null {
  const base = pearson(xs, ys);
  if (!base) return null;
  const { p, confidence } = correlationConfidence(base.r, base.n);
  return { ...base, p, confidence };
}

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

/**
 * Where support for a claim comes from.
 *
 * `cohort` is deliberately absent: comparing a user against similar users needs
 * a user base we do not have, and a star awarded for evidence that does not
 * exist is a fabrication. When cohort data becomes real, add it here and the
 * ratings update everywhere at once.
 */
export type EvidenceSource = 'personal' | 'clinical';

export type Evidence = {
  /** 1-4 stars. Four requires strong personal data AND clinical support. */
  stars: 1 | 2 | 3 | 4;
  sources: EvidenceSource[];
  label: string;
};

/**
 * Rates a recommendation.
 *
 * Personal evidence is graded by the statistical confidence in the user's own
 * data. Clinical support is a property of the lever itself — resistance
 * training for muscle retention is well established; meal timing is not.
 */
export function rateEvidence(
  personalConfidence: number | null,
  clinicallySupported: boolean,
): Evidence {
  const sources: EvidenceSource[] = [];
  if (personalConfidence != null && personalConfidence >= 80) sources.push('personal');
  if (clinicallySupported) sources.push('clinical');

  let stars: Evidence['stars'] = 1;
  if (sources.length === 2) stars = 4;
  else if (clinicallySupported) stars = 3;
  else if (personalConfidence != null && personalConfidence >= 80) stars = 3;
  else if (personalConfidence != null && personalConfidence >= 60) stars = 2;

  const label =
    stars >= 4
      ? 'Your history and clinical evidence'
      : stars === 3
        ? sources.includes('clinical')
          ? 'Clinical evidence'
          : 'Your own history'
        : stars === 2
          ? 'Early signal in your data'
          : 'Limited evidence — still learning';

  return { stars, sources, label };
}
