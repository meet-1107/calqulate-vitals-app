import { useRouter } from 'expo-router';
import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, SectionTitle } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { signOut } from '../../src/lib/auth';
import { isSupabaseConfigured } from '../../src/lib/supabase';
import { useProfile } from '../../src/store/profile';
import { useColors } from '../../src/theme/ThemeProvider';
import { HIT, radius, spacing } from '../../src/theme';

type Row = { icon: keyof typeof Ionicons.glyphMap; label: string; href?: string; danger?: boolean };

const SECTIONS: { title: string; rows: Row[] }[] = [
  {
    title: 'Your plan',
    rows: [
      { icon: 'flag-outline', label: 'Goals', href: '/settings' },
      { icon: 'sparkles-outline', label: 'Subscription', href: '/paywall' },
    ],
  },
  {
    title: 'App',
    rows: [
      { icon: 'settings-outline', label: 'Settings', href: '/settings' },
      { icon: 'book-outline', label: 'Journal' },
      { icon: 'trophy-outline', label: 'Achievements' },
      { icon: 'gift-outline', label: 'Invite Friends' },
    ],
  },
  {
    title: 'Support',
    rows: [
      { icon: 'help-circle-outline', label: 'Help & Support' },
      { icon: 'lock-closed-outline', label: 'Privacy Policy' },
      { icon: 'document-text-outline', label: 'Terms' },
    ],
  },
];

export default function ProfileTab() {
  const c = useColors();
  const router = useRouter();
  const { profile, logs, syncing, reset } = useProfile();

  const initial = (profile.name || profile.email || '?').charAt(0).toUpperCase();

  return (
    <Screen scroll>
      <Text variant="title" style={{ marginTop: spacing.sm }}>
        Profile
      </Text>

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.lg }}>
        <View
          style={{
            width: 60,
            height: 60,
            borderRadius: radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: c.primarySoft,
          }}
        >
          <Text variant="heading" tone="primary">
            {initial}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="heading">{profile.name || 'Your name'}</Text>
          <Text variant="caption" tone="secondary" style={{ marginTop: 2 }}>
            {profile.email || 'Not signed in'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <View
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: 4,
              borderRadius: radius.pill,
              backgroundColor: profile.isPro ? c.proSoft : c.cardAlt,
            }}
          >
            <Text variant="micro" tone={profile.isPro ? 'pro' : 'secondary'}>
              {profile.isPro ? 'VITALS' : 'FREE'}
            </Text>
          </View>
          {profile.isAdmin ? (
            <View
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: 4,
                borderRadius: radius.pill,
                backgroundColor: c.primarySoft,
              }}
            >
              <Text variant="micro" tone="primary">
                ADMIN
              </Text>
            </View>
          ) : null}
        </View>
      </Card>

      <Text variant="caption" tone="tertiary" style={{ marginTop: spacing.sm }}>
        {syncing
          ? 'Syncing…'
          : isSupabaseConfigured()
            ? `Synced · ${logs.length} entries`
            : 'Offline mode · data stays on this device'}
      </Text>

      {SECTIONS.map((section) => (
        <View key={section.title}>
          <SectionTitle>{section.title}</SectionTitle>
          <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
            {section.rows.map((row, i) => (
              <Card
                key={row.label}
                padded={false}
                onPress={row.href ? () => router.push(row.href as never) : () => {}}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  minHeight: HIT,
                  paddingVertical: spacing.md,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: c.border,
                  borderRadius: 0,
                  backgroundColor: 'transparent',
                  shadowOpacity: 0,
                  elevation: 0,
                  borderWidth: 0,
                }}
              >
                <Ionicons name={row.icon} size={20} color={c.textSecondary} />
                <Text variant="body" style={{ flex: 1 }}>
                  {row.label}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={c.textTertiary} />
              </Card>
            ))}
          </Card>
        </View>
      ))}

      <Card
        onPress={async () => {
          await signOut();
          reset();
          router.replace('/');
        }}
        style={{ marginTop: spacing.xl, alignItems: 'center' }}
      >
        <Text variant="bodyStrong" style={{ color: c.textSecondary }}>
          Log out
        </Text>
      </Card>

      <Text variant="caption" tone="tertiary" style={{ textAlign: 'center', marginTop: spacing.xl }}>
        Calqulate 1.0.0
      </Text>
    </Screen>
  );
}
