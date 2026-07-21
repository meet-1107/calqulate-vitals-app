/**
 * Weekly Health Story — swipeable, Instagram-style summary cards instead of a
 * dashboard row. Each card makes one point, large.
 */

import { ScrollView, useWindowDimensions, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from './Text';
import { useColors, useTheme } from '../theme/ThemeProvider';
import { radius, spacing } from '../theme';

export type StoryCard = {
  icon: keyof typeof Ionicons.glyphMap;
  kicker: string;
  value: string;
  message: string;
  tone?: 'primary' | 'pro';
};

export function StoryCards({ cards }: { cards: StoryCard[] }) {
  const c = useColors();
  const { scheme } = useTheme();
  const { width } = useWindowDimensions();
  const cardW = width - spacing.xl * 2 - spacing.xl;

  if (!cards.length) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={cardW + spacing.md}
      decelerationRate="fast"
      contentContainerStyle={{ gap: spacing.md, paddingRight: spacing.xl }}
    >
      {cards.map((card, i) => {
        const tint = card.tone === 'pro' ? c.pro : c.primary;
        const soft = card.tone === 'pro' ? c.proSoft : c.primarySoft;
        return (
          <View
            key={i}
            style={{
              width: cardW,
              borderRadius: radius.xl,
              padding: spacing.xl,
              backgroundColor: scheme === 'dark' ? c.card : c.cardAlt,
              gap: spacing.md,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: soft,
                }}
              >
                <Ionicons name={card.icon} size={16} color={tint} />
              </View>
              <Text variant="micro" tone="secondary" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                {card.kicker}
              </Text>
            </View>
            <Text variant="hero" style={{ color: tint }}>
              {card.value}
            </Text>
            <Text variant="body" tone="secondary">
              {card.message}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}
