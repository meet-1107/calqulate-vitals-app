import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { Logo } from '../src/components/Logo';
import { Text } from '../src/components/Text';
import { currentSession } from '../src/lib/auth';
import { useProfile } from '../src/store/profile';
import { useColors } from '../src/theme/ThemeProvider';
import { motion, spacing } from '../src/theme';

const SPLASH_MS = 1800;

export default function Splash() {
  const c = useColors();
  const router = useRouter();
  const { ready, profile, patchProfile, syncWithRemote } = useProfile();

  const scale = useRef(new Animated.Value(0.86)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: motion.slow, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }),
    ]).start();
  }, [fade, scale]);

  // Restore a Supabase session the device already holds — after a reinstall the
  // refresh token outlives local state, and the user should not sign in again.
  useEffect(() => {
    if (!ready || profile.signedIn) return;
    let cancelled = false;

    currentSession().then(async (session) => {
      if (cancelled || !session) return;
      patchProfile({
        signedIn: true,
        userId: session.userId,
        email: session.email,
        name: session.name,
        isAdmin: session.isAdmin,
        isPro: session.isAdmin,
      });
      await syncWithRemote(session.userId);
    });

    return () => {
      cancelled = true;
    };
  }, [ready, profile.signedIn, patchProfile, syncWithRemote]);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      if (!profile.signedIn) router.replace('/onboarding/welcome');
      else if (!profile.onboarded) router.replace('/onboarding/medication');
      else router.replace('/(tabs)');
    }, SPLASH_MS);
    return () => clearTimeout(t);
  }, [ready, profile.signedIn, profile.onboarded, router]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ opacity: fade, transform: [{ scale }], alignItems: 'center' }}>
        <Logo size={124} tagline={false} />
        <Text variant="caption" tone="secondary" style={{ marginTop: spacing.md }}>
          Your GLP-1 Health Companion
        </Text>
      </Animated.View>
    </View>
  );
}
