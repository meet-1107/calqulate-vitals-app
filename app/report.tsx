import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, useWindowDimensions, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { Button, ButtonStack } from '../src/components/Button';
import { ReportCard, REPORT_WIDTH } from '../src/components/ReportCard';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { buildWeeklyReport, reportFilename } from '../src/lib/weeklyReport';
import { useProfile } from '../src/store/profile';
import { useColors } from '../src/theme/ThemeProvider';
import { spacing } from '../src/theme';

/**
 * Weekly report.
 *
 * The card is captured as a PNG and handed to the OS share sheet, so it lands
 * in Instagram, iMessage, or a doctor's inbox as an image rather than a link
 * that needs an account to open.
 */
export default function ReportScreen() {
  const c = useColors();
  const router = useRouter();
  const { profile, logs } = useProfile();
  const cardRef = useRef<View>(null);
  const { width } = useWindowDimensions();
  // Fits the design width where there is room, and shrinks rather than clips.
  const cardWidth = Math.min(REPORT_WIDTH, width - spacing.xl * 2);
  const [busy, setBusy] = useState(false);

  const report = useMemo(() => buildWeeklyReport(profile, logs), [profile, logs]);

  const share = async () => {
    setBusy(true);
    try {
      // Captured at the device's own pixel density, so text stays crisp when
      // the image is viewed full-screen.
      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
        fileName: reportFilename(),
      });

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Sharing unavailable', 'This device cannot open a share sheet.');
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share your weekly report',
        UTI: 'public.png',
      });
    } catch {
      Alert.alert('Could not create the image', 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      scroll
      footer={
        <ButtonStack>
          <Button
            title={Platform.OS === 'web' ? 'Sharing needs the app' : 'Share report'}
            loading={busy}
            disabled={Platform.OS === 'web' || !report.hasEnoughData}
            onPress={share}
          />
          <Button title="Done" variant="ghost" onPress={() => router.back()} />
        </ButtonStack>
      }
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: spacing.sm,
        }}
      >
        <Text variant="heading">Your week</Text>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={26} color={c.textSecondary} />
        </Pressable>
      </View>

      <Text variant="caption" tone="secondary" style={{ marginTop: spacing.sm }}>
        Every number comes from your own logs. Nothing here is estimated for effect.
      </Text>

      {!report.hasEnoughData ? (
        <View
          style={{
            marginTop: spacing.xl,
            padding: spacing.lg,
            borderRadius: 16,
            backgroundColor: c.proSoft,
            flexDirection: 'row',
            gap: spacing.md,
          }}
        >
          <Ionicons name="information-circle" size={18} color={c.pro} />
          <Text variant="caption" tone="pro" style={{ flex: 1 }}>
            You have a few more days of logging before this card says anything worth
            posting. It will fill in as you go.
          </Text>
        </View>
      ) : null}

      {/* collapsable={false} keeps the view in the native tree so Android can
          capture it; without it the snapshot comes back blank. */}
      <View
        ref={cardRef}
        collapsable={false}
        style={{ alignSelf: 'center', marginVertical: spacing.xl }}
      >
        <ReportCard report={report} name={profile.name || undefined} width={cardWidth} />
      </View>
    </Screen>
  );
}
