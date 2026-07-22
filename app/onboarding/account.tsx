import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button } from '../../src/components/Button';
import { Field } from '../../src/components/Field';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { OnboardingHeader } from '../../src/components/OnboardingHeader';
import { GoogleButton, OrDivider } from '../../src/components/GoogleButton';
import { signUp, type Session } from '../../src/lib/auth';
import { isSupabaseConfigured } from '../../src/lib/supabase';
import { useProfile } from '../../src/store/profile';
import { useColors } from '../../src/theme/ThemeProvider';
import { radius, spacing } from '../../src/theme';

export default function Account() {
  const c = useColors();
  const router = useRouter();
  const { patchProfile, syncWithRemote } = useProfile();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const valid = email.includes('@') && password.length >= 6;

  const submit = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await signUp(email, password, name);

      if (!result.ok) {
        // A confirmation requirement is a success for the user, not a failure.
        if (result.needsConfirmation) setNotice(result.error);
        else setError(result.error);
        return;
      }

      await land(result.session);
    } finally {
      setBusy(false);
    }
  };

  const land = async (session: Session) => {
      patchProfile({
        signedIn: true,
        userId: session.userId,
        email: session.email,
        name: session.name,
        isAdmin: session.isAdmin,
        // Admin accounts get the full product so every paid surface is testable.
        isPro: session.isAdmin,
      });
      await syncWithRemote(session.userId);
      router.push('/onboarding/premium');
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen
        scroll
        footer={<Button title="Create Account" loading={busy} disabled={!valid} onPress={submit} />}
      >
        <OnboardingHeader step={8} />
        <Text variant="title">Create your account</Text>
        <Text variant="body" tone="secondary" style={{ marginTop: spacing.sm }}>
          {isSupabaseConfigured()
            ? 'Your data syncs across phone and web.'
            : 'Running offline — data stays on this device only.'}
        </Text>

        <View style={{ marginTop: spacing.xl, gap: spacing.lg }}>
          <GoogleButton onSuccess={land} onError={setError} label="Continue with Google" />
          <OrDivider />
        </View>

        <View style={{ marginTop: spacing.lg, gap: spacing.lg }}>
          <Field label="First name" value={name} onChangeText={setName} autoCapitalize="words" />
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            placeholder="At least 6 characters"
          />
        </View>

        {error ? (
          <View
            style={{
              flexDirection: 'row',
              gap: spacing.sm,
              alignItems: 'flex-start',
              marginTop: spacing.lg,
              padding: spacing.md,
              borderRadius: radius.md,
              backgroundColor: c.cardAlt,
            }}
          >
            <Ionicons name="alert-circle" size={18} color={c.danger} />
            <Text variant="caption" style={{ flex: 1, color: c.danger }}>
              {error}
            </Text>
          </View>
        ) : null}

        {notice ? (
          <View
            style={{
              flexDirection: 'row',
              gap: spacing.sm,
              alignItems: 'flex-start',
              marginTop: spacing.lg,
              padding: spacing.md,
              borderRadius: radius.md,
              backgroundColor: c.primarySoft,
            }}
          >
            <Ionicons name="mail-outline" size={18} color={c.primary} />
            <Text variant="caption" tone="primary" style={{ flex: 1 }}>
              {notice}
            </Text>
          </View>
        ) : null}

        <Pressable onPress={() => router.push('/sign-in')} style={{ marginTop: spacing.xl }}>
          <Text variant="caption" tone="secondary" style={{ textAlign: 'center' }}>
            Already have an account?{' '}
            <Text variant="caption" tone="primary">
              Sign in
            </Text>
          </Text>
        </Pressable>
      </Screen>
    </KeyboardAvoidingView>
  );
}
