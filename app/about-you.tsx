import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { WheelPicker } from '../src/components/WheelPicker';
import { useProfile } from '../src/store/profile';
import { useColors, useTheme } from '../src/theme/ThemeProvider';
import { radius, spacing } from '../src/theme';

const YEAR = new Date().getFullYear();
const AGES = Array.from({ length: 73 }, (_, i) => i + 18);
const HEIGHTS = Array.from({ length: 91 }, (_, i) => i + 130);
const BODY_FAT = Array.from({ length: 51 }, (_, i) => i + 10);

/**
 * Inputs the Body Composition Engine uses directly.
 *
 * Age drives the sarcopenia term; height supports BMI and lean-mass estimates;
 * a measured body fat percentage replaces the population prior, which is the
 * single biggest improvement available to estimate confidence.
 */
export default function AboutYou() {
  const c = useColors();
  const { scheme } = useTheme();
  const router = useRouter();
  const { profile, patchProfile } = useProfile();

  const [age, setAge] = useState(profile.birthYear ? YEAR - profile.birthYear : 40);
  const [height, setHeight] = useState(profile.heightCm ?? 170);
  const [bodyFat, setBodyFat] = useState<number | null>(profile.bodyFatPct);

  const save = () => {
    patchProfile({ birthYear: YEAR - age, heightCm: height, bodyFatPct: bodyFat });
    router.back();
  };

  return (
    <Screen scroll footer={<Button title="Save" onPress={save} />}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={c.textSecondary} />
        </Pressable>
        <Text variant="heading">About you</Text>
      </View>

      <Text variant="body" tone="secondary" style={{ marginTop: spacing.md }}>
        These sharpen your body-composition estimate. Everything is optional.
      </Text>

      <Text variant="caption" tone="secondary" style={{ marginTop: spacing.xl }}>
        Age
      </Text>
      <WheelPicker values={AGES} value={age} onChange={setAge} suffix="years" />

      <Text variant="caption" tone="secondary" style={{ marginTop: spacing.lg }}>
        Height
      </Text>
      <WheelPicker values={HEIGHTS} value={height} onChange={setHeight} suffix="cm" />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xl }}>
        <Text variant="caption" tone="secondary">
          Body fat %
        </Text>
        <Pressable
          onPress={() => setBodyFat((v) => (v == null ? 35 : null))}
          style={{
            paddingHorizontal: spacing.md,
            paddingVertical: 6,
            borderRadius: radius.pill,
            backgroundColor: bodyFat == null ? (scheme === 'dark' ? c.cardAlt : c.bgElevated) : c.primarySoft,
          }}
        >
          <Text variant="micro" tone={bodyFat == null ? 'secondary' : 'primary'}>
            {bodyFat == null ? 'I have a measurement' : 'Use estimate instead'}
          </Text>
        </Pressable>
      </View>

      {bodyFat == null ? (
        <Card style={{ marginTop: spacing.md }}>
          <Text variant="caption" tone="secondary">
            Without a measurement we use a population average for people starting GLP-1
            treatment, and cap the estimate&apos;s confidence at Moderate. A DXA scan, InBody, or
            smart scale reading removes that assumption.
          </Text>
        </Card>
      ) : (
        <WheelPicker values={BODY_FAT} value={bodyFat} onChange={setBodyFat} suffix="%" />
      )}
    </Screen>
  );
}
