import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button } from '../src/components/Button';
import { Field } from '../src/components/Field';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { sendPasswordReset, signIn } from '../src/lib/auth';
import { useProfile } from '../src/store/profile';
import { useColors } from '../src/theme/ThemeProvider';
import { radius, spacing } from '../src/theme';

export default function SignIn() {
  const c = useColors();
  const router = useRouter();
  const { profile, patchProfile, syncWithRemote } = useProfile();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await signIn(email, password);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      const { session } = result;
      patchProfile({
        signedIn: true,
        userId: session.userId,
        email: session.email,
        name: session.name,
        isAdmin: session.isAdmin,
        isPro: session.isAdmin || profile.isPro,
      });

      // Pull this account's history before deciding where to land, so a returning
      // user on a new device does not get sent back through onboarding.
      await syncWithRemote(session.userId);
      router.replace('/');
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!email.includes('@')) {
      setError('Enter your email first, then tap reset.');
      return;
    }
    setError(null);
    await sendPasswordReset(email);
    setNotice('If that email has an account, a reset link is on its way.');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen
        scroll
        footer={
          <Button
            title="Sign In"
            loading={busy}
            disabled={!email.includes('@') || password.length < 6}
            onPress={submit}
          />
        }
      >
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginBottom: spacing.xl }}>
          <Ionicons name="chevron-back" size={26} color={c.textSecondary} />
        </Pressable>
        <Text variant="title">Welcome back</Text>

        <View style={{ marginTop: spacing.xl, gap: spacing.lg }}>
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
            autoComplete="current-password"
          />
        </View>

        {error ? (
          <View
            style={{
              flexDirection: 'row',
              gap: spacing.sm,
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
          <Text variant="caption" tone="primary" style={{ marginTop: spacing.lg }}>
            {notice}
          </Text>
        ) : null}

        <Pressable onPress={reset} style={{ marginTop: spacing.lg }}>
          <Text variant="caption" tone="primary">
            Forgot password?
          </Text>
        </Pressable>
      </Screen>
    </KeyboardAvoidingView>
  );
}
