import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { themes, type Colors } from './index';
import { useProfile } from '../store/profile';

type ThemeValue = { colors: Colors; scheme: 'light' | 'dark' };

const ThemeContext = createContext<ThemeValue>({ colors: themes.light, scheme: 'light' });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const { profile } = useProfile();
  const pref = profile.settings.theme;

  const scheme: 'light' | 'dark' =
    pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;

  const value = useMemo(() => ({ colors: themes[scheme], scheme }), [scheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Forces a fixed scheme for everything inside, regardless of the app theme. */
export function ThemeScope({ scheme, children }: { scheme: 'light' | 'dark'; children: ReactNode }) {
  const value = useMemo(() => ({ colors: themes[scheme], scheme }), [scheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
export const useColors = () => useContext(ThemeContext).colors;
