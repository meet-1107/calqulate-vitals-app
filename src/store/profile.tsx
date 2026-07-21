import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { pullRemote, pushAll, pushLog, pushLogDeleted, pushProfile } from '../lib/sync';
import { DEFAULT_STATE, type AppState, type LogEntry, type LogKind, type Profile } from './types';

const KEY = 'calqulate.state.v1';

type Ctx = {
  ready: boolean;
  profile: Profile;
  logs: LogEntry[];
  trash: LogEntry[];
  syncing: boolean;
  patchProfile: (patch: Partial<Profile>) => void;
  addLog: (kind: LogKind, value: number, extra?: { label?: string; note?: string; at?: number }) => void;
  removeLog: (id: string) => void;
  undoDelete: () => void;
  /** Pulls this account's data down, merges it with whatever is local, pushes back. */
  syncWithRemote: (userId: string) => Promise<void>;
  reset: () => void;
};

const Context = createContext<Ctx | null>(null);

/** RFC 4122 v4, so local ids are valid Postgres uuids and upserts line up. */
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const hydrated = useRef(false);

  // Kept in a ref so background pushes always read the latest state without
  // re-creating every callback on each keystroke.
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as AppState;
        setState({
          ...DEFAULT_STATE,
          ...saved,
          logs: saved.logs ?? [],
          trash: saved.trash ?? [],
          profile: {
            ...DEFAULT_STATE.profile,
            ...saved.profile,
            settings: { ...DEFAULT_STATE.profile.settings, ...saved.profile?.settings },
            goals: { ...DEFAULT_STATE.profile.goals, ...saved.profile?.goals },
          },
        });
      })
      .catch(() => {
        /* first run, or corrupt payload — fall back to defaults */
      })
      .finally(() => {
        hydrated.current = true;
        setReady(true);
      });
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  }, [state]);

  const patchProfile = useCallback((patch: Partial<Profile>) => {
    setState((s) => {
      const profile = { ...s.profile, ...patch };
      if (profile.userId) void pushProfile(profile.userId, profile);
      return { ...s, profile };
    });
  }, []);

  const addLog = useCallback<Ctx['addLog']>((kind, value, extra) => {
    setState((s) => {
      const entry: LogEntry = {
        id: uuid(),
        kind,
        value,
        at: extra?.at ?? Date.now(),
        label: extra?.label,
        note: extra?.note,
      };
      if (s.profile.userId) void pushLog(s.profile.userId, entry);
      return { ...s, logs: [entry, ...s.logs] };
    });
  }, []);

  // Deletes move to trash rather than vanishing, so any delete can be undone.
  const removeLog = useCallback((id: string) => {
    setState((s) => {
      const entry = s.logs.find((l) => l.id === id);
      if (!entry) return s;
      void pushLogDeleted(id, true);
      return {
        ...s,
        logs: s.logs.filter((l) => l.id !== id),
        trash: [entry, ...s.trash].slice(0, 50),
      };
    });
  }, []);

  const undoDelete = useCallback(() => {
    setState((s) => {
      const [entry, ...rest] = s.trash;
      if (!entry) return s;
      void pushLogDeleted(entry.id, false);
      return { ...s, logs: [entry, ...s.logs].sort((a, b) => b.at - a.at), trash: rest };
    });
  }, []);

  /**
   * Merge rule: entries are unioned by id, so nothing logged offline is lost and
   * nothing logged on another device is dropped. Profile fields come from the
   * server only when the server has actually completed onboarding — otherwise a
   * fresh remote row would wipe the setup the user just did on this device.
   */
  const syncWithRemote = useCallback(async (userId: string) => {
    setSyncing(true);
    try {
      const remote = await pullRemote(userId);

      if (remote) {
        setState((s) => {
          const byId = new Map(remote.logs.map((l) => [l.id, l]));
          for (const local of s.logs) byId.set(local.id, local);

          return {
            ...s,
            profile: remote.profile.onboarded
              ? { ...s.profile, ...remote.profile, userId, signedIn: true }
              : { ...s.profile, isPro: remote.profile.isPro ?? s.profile.isPro, userId, signedIn: true },
            logs: [...byId.values()].sort((a, b) => b.at - a.at),
          };
        });
      }

      const current = stateRef.current;
      await pushAll(userId, { ...current.profile, userId }, current.logs);
    } finally {
      setSyncing(false);
    }
  }, []);

  const reset = useCallback(() => setState(DEFAULT_STATE), []);

  const value = useMemo<Ctx>(
    () => ({
      ready,
      syncing,
      profile: state.profile,
      logs: state.logs,
      trash: state.trash,
      patchProfile,
      addLog,
      removeLog,
      undoDelete,
      syncWithRemote,
      reset,
    }),
    [ready, syncing, state, patchProfile, addLog, removeLog, undoDelete, syncWithRemote, reset],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useProfile() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('useProfile must be used inside <ProfileProvider>');
  return ctx;
}
