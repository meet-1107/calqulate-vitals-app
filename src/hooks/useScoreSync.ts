import { useEffect, useRef } from 'react';
import { dayKey } from '../lib/dates';
import { pushScore } from '../lib/sync';
import type { MetabolicScore } from '../lib/score';
import { useProfile } from '../store/profile';

/**
 * Persists the day's score once it settles.
 *
 * Writing on every point change would mean a request per sip of water, so this
 * debounces and skips writes that would not change the stored row. The upsert
 * is keyed on (user_id, scored_on), so a repeat write is a no-op anyway — this
 * just avoids the traffic.
 */
export function useScoreSync(score: MetabolicScore) {
  const { profile } = useProfile();
  const lastWritten = useRef<string>('');

  useEffect(() => {
    const userId = profile.userId;
    if (!userId) return;

    const key = `${dayKey()}:${score.total}`;
    if (lastWritten.current === key) return;

    const timer = setTimeout(() => {
      lastWritten.current = key;
      pushScore(userId, dayKey(), score);
    }, 2000);

    return () => clearTimeout(timer);
  }, [profile.userId, score]);
}
