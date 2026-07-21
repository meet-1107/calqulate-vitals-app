import { useRouter } from 'expo-router';
import { Alert, Pressable, Switch, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, SectionTitle } from '../src/components/Card';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { restore } from '../src/lib/billing';
import { formatHour } from '../src/lib/dates';
import { useProfile } from '../src/store/profile';
import type { Units } from '../src/store/types';
import { useColors } from '../src/theme/ThemeProvider';
import { HIT, radius, spacing } from '../src/theme';

function Row({
  label,
  value,
  onPress,
  right,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  right?: React.ReactNode;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        minHeight: HIT,
        paddingVertical: spacing.sm,
      }}
    >
      <Text variant="body" style={{ flex: 1 }}>
        {label}
      </Text>
      {value ? (
        <Text variant="body" tone="secondary">
          {value}
        </Text>
      ) : null}
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={c.textTertiary} /> : null)}
    </Pressable>
  );
}

export default function Settings() {
  const c = useColors();
  const router = useRouter();
  const { profile, patchProfile, logs, trash, undoDelete, reset } = useProfile();
  const s = profile.settings;

  const restorePurchases = async () => {
    const result = await restore();
    patchProfile({ isPro: result.isPro });
    Alert.alert(
      result.isPro ? 'Subscription restored' : 'Nothing to restore',
      result.isPro
        ? 'Calqulate Vitals is active on this account.'
        : 'No active subscription was found for this account.',
    );
  };

  const setSettings = (patch: Partial<typeof s>) =>
    patchProfile({ settings: { ...s, ...patch } });

  const cycleTheme = () =>
    setSettings({ theme: s.theme === 'system' ? 'light' : s.theme === 'light' ? 'dark' : 'system' });

  const toggleUnits = () => setSettings({ units: (s.units === 'lb' ? 'kg' : 'lb') as Units });

  const confirmDelete = () =>
    Alert.alert('Delete account', 'This erases all local data on this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          reset();
          router.replace('/');
        },
      },
    ]);

  return (
    <Screen scroll>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={c.textSecondary} />
        </Pressable>
        <Text variant="heading">Settings</Text>
      </View>

      <SectionTitle>Preferences</SectionTitle>
      <Card>
        <Row label="Theme" value={s.theme[0].toUpperCase() + s.theme.slice(1)} onPress={cycleTheme} />
        <View style={{ height: 1, backgroundColor: c.border }} />
        <Row label="Units" value={s.units.toUpperCase()} onPress={toggleUnits} />
        <View style={{ height: 1, backgroundColor: c.border }} />
        <Row label="Reminder time" value={formatHour(profile.injectionHour)} />
        <View style={{ height: 1, backgroundColor: c.border }} />
        <Row
          label="Notifications"
          right={
            <Switch
              value={s.notifications}
              onValueChange={(v) => setSettings({ notifications: v })}
              trackColor={{ true: c.primary, false: c.track }}
            />
          }
        />
      </Card>

      <SectionTitle>Daily goals</SectionTitle>
      <Card>
        <Row label="Protein" value={`${profile.goals.proteinG} g`} />
        <View style={{ height: 1, backgroundColor: c.border }} />
        <Row label="Water" value={`${profile.goals.waterMl} ml`} />
        <View style={{ height: 1, backgroundColor: c.border }} />
        <Row label="Activity" value={`${profile.goals.activityMin} min`} />
        <View style={{ height: 1, backgroundColor: c.border }} />
        <Row label="Sleep" value={`${profile.goals.sleepHours} h`} />
      </Card>

      <SectionTitle>Medication</SectionTitle>
      <Card>
        <Row
          label="Change medication"
          onPress={() => router.push('/onboarding/medication')}
        />
        <View style={{ height: 1, backgroundColor: c.border }} />
        <Row label="Current dose" value={profile.doseMg ? `${profile.doseMg} mg` : '—'} />
      </Card>

      <SectionTitle>Subscription</SectionTitle>
      <Card>
        <Row
          label="Plan"
          value={profile.isPro ? 'Calqulate Vitals' : 'Free'}
          onPress={() => router.push('/paywall')}
        />
        <View style={{ height: 1, backgroundColor: c.border }} />
        <Row label="Compare plans" onPress={() => router.push('/plans')} />
        <View style={{ height: 1, backgroundColor: c.border }} />
        <Row label="Restore purchases" onPress={restorePurchases} />
      </Card>

      <SectionTitle>Data</SectionTitle>
      <Card>
        <Row label="Entries stored" value={String(logs.length)} />
        <View style={{ height: 1, backgroundColor: c.border }} />
        <Row
          label="Undo last delete"
          value={trash.length ? `${trash.length} in trash` : 'Nothing to undo'}
          onPress={trash.length ? undoDelete : undefined}
        />
        <View style={{ height: 1, backgroundColor: c.border }} />
        <Row label="Export data" onPress={() => {}} />
      </Card>

      <Card
        onPress={confirmDelete}
        style={{ marginTop: spacing.xl, alignItems: 'center', borderRadius: radius.xl }}
      >
        <Text variant="bodyStrong" style={{ color: c.danger }}>
          Delete account
        </Text>
      </Card>
    </Screen>
  );
}
