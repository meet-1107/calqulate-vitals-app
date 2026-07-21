/**
 * Supabase client.
 *
 * The anon key is public by design — Row Level Security in
 * `supabase/schema.sql` is what actually protects the data, not key secrecy.
 * The service-role key must never appear in this app; it lives only in
 * `server/.env`.
 *
 * Sessions are persisted in SecureStore (Keychain / Keystore) rather than
 * AsyncStorage, because a refresh token is a bearer credential. Web falls back
 * to localStorage, which is what the SDK does natively.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** SecureStore caps values at 2048 bytes; large sessions spill to AsyncStorage. */
const secureAdapter = {
  getItem: async (key: string) => {
    const value = await SecureStore.getItemAsync(key).catch(() => null);
    return value ?? AsyncStorage.getItem(key);
  },
  setItem: async (key: string, value: string) => {
    if (value.length > 2000) return AsyncStorage.setItem(key, value);
    await SecureStore.setItemAsync(key, value).catch(() => AsyncStorage.setItem(key, value));
  },
  removeItem: async (key: string) => {
    await SecureStore.deleteItemAsync(key).catch(() => {});
    await AsyncStorage.removeItem(key);
  },
};

/**
 * Null until the project is configured. Every caller must handle that — the app
 * stays fully usable offline, storing everything locally, so a missing backend
 * degrades sync rather than breaking screens.
 */
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          storage: Platform.OS === 'web' ? undefined : secureAdapter,
          autoRefreshToken: true,
          persistSession: true,
          // Native apps have no URL bar to read a session out of.
          detectSessionInUrl: Platform.OS === 'web',
        },
      })
    : null;

export const isSupabaseConfigured = () => supabase !== null;

/** Emails granted admin access, from the build-time allowlist. */
const ADMIN_EMAILS = (process.env.EXPO_PUBLIC_ADMIN_EMAILS ?? '')
  .split(',')
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean);

/**
 * Client-side admin hint only — it unlocks the in-app admin shortcuts and
 * treats the account as Pro for testing. Real authority comes from
 * `profiles.is_admin`, which only the service role can set.
 */
export const isAdminEmail = (email?: string | null) =>
  !!email && ADMIN_EMAILS.includes(email.trim().toLowerCase());
