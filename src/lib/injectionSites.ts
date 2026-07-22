/**
 * Injection sites and rotation.
 *
 * Repeatedly injecting the same spot causes lipohypertrophy — thickened tissue
 * that absorbs erratically, which shows up as an unexplained change in how the
 * dose works. Rotation is the standard advice, so the app should make the next
 * site obvious rather than leaving the user to remember where they went last
 * week.
 *
 * Only meaningful for injectables. Oral medications skip all of this.
 */

import { DAY } from './dates';
import type { LogEntry } from '../store/types';

export type SiteId =
  | 'abdomen-left'
  | 'abdomen-right'
  | 'thigh-left'
  | 'thigh-right'
  | 'arm-left'
  | 'arm-right';

export type Site = { id: SiteId; label: string; group: 'Abdomen' | 'Thigh' | 'Arm' };

/**
 * Rotation order walks across the body rather than around one region, so
 * consecutive doses land as far apart as possible.
 */
export const SITES: Site[] = [
  { id: 'abdomen-left', label: 'Abdomen · left', group: 'Abdomen' },
  { id: 'thigh-right', label: 'Thigh · right', group: 'Thigh' },
  { id: 'arm-left', label: 'Arm · left', group: 'Arm' },
  { id: 'abdomen-right', label: 'Abdomen · right', group: 'Abdomen' },
  { id: 'thigh-left', label: 'Thigh · left', group: 'Thigh' },
  { id: 'arm-right', label: 'Arm · right', group: 'Arm' },
];

export const siteLabel = (id?: string | null) =>
  SITES.find((s) => s.id === id)?.label ?? null;

/** Doses that recorded a site, newest first. */
export function siteHistory(logs: LogEntry[]): { site: SiteId; at: number }[] {
  return logs
    .filter((l) => l.kind === 'dose' && l.site)
    .sort((a, b) => b.at - a.at)
    .map((l) => ({ site: l.site as SiteId, at: l.at }));
}

/**
 * The site to use next.
 *
 * Continues the rotation from the last recorded site. With no history it starts
 * at the beginning rather than guessing.
 */
export function nextSite(logs: LogEntry[]): Site {
  const last = siteHistory(logs)[0];
  if (!last) return SITES[0];
  const index = SITES.findIndex((s) => s.id === last.site);
  return SITES[(index + 1) % SITES.length];
}

/** Days since a given site was last used, or null if never. */
export function daysSinceSite(logs: LogEntry[], site: SiteId, now = Date.now()): number | null {
  const hit = siteHistory(logs).find((h) => h.site === site);
  return hit ? Math.floor((now - hit.at) / DAY) : null;
}

export type RotationWarning = { site: SiteId; label: string; times: number };

/**
 * Sites used too often in the recent window.
 *
 * Three or more doses into the same spot within a month is the point worth
 * flagging — often enough to thicken tissue, and early enough that moving on
 * costs the user nothing.
 */
export function rotationWarnings(logs: LogEntry[], now = Date.now()): RotationWarning[] {
  const recent = siteHistory(logs).filter((h) => h.at >= now - 30 * DAY);
  const counts = new Map<SiteId, number>();
  for (const h of recent) counts.set(h.site, (counts.get(h.site) ?? 0) + 1);

  return [...counts.entries()]
    .filter(([, n]) => n >= 3)
    .map(([site, times]) => ({ site, label: siteLabel(site) ?? site, times }))
    .sort((a, b) => b.times - a.times);
}

/** How many of the six sites have been used in the last month. */
export function rotationCoverage(logs: LogEntry[], now = Date.now()): number {
  const recent = siteHistory(logs).filter((h) => h.at >= now - 30 * DAY);
  return new Set(recent.map((h) => h.site)).size;
}
