import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { CATEGORY_META, getArticle } from '../../src/lib/care/content';
import { useColors } from '../../src/theme/ThemeProvider';
import { radius, spacing } from '../../src/theme';

/**
 * A Care article.
 *
 * Red flags render in their own bordered, unmissable block — the one thing a
 * worried user must not scroll past — and every article ends with the same
 * "not medical advice, contact your prescriber" line, because it is true of all
 * of them.
 */
export default function CareArticle() {
  const c = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const article = getArticle(String(id));

  if (!article) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md }}>
          <Text variant="heading">Guide not found</Text>
          <Pressable onPress={() => router.back()}>
            <Text variant="body" tone="primary">
              Go back
            </Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const meta = CATEGORY_META[article.category];

  return (
    <Screen scroll>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={c.textSecondary} />
        </Pressable>
        <Text variant="micro" tone="tertiary" style={{ textTransform: 'uppercase' }}>
          {meta.label}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg }}>
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: radius.lg,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: c.primarySoft,
          }}
        >
          <Ionicons name={article.icon as keyof typeof Ionicons.glyphMap} size={24} color={c.primary} />
        </View>
        <Text variant="title" style={{ flex: 1 }}>
          {article.title}
        </Text>
      </View>

      <Text variant="body" tone="secondary" style={{ marginTop: spacing.md }}>
        {article.summary}
      </Text>

      {/* Red flags first in prominence — bordered and coloured so they cannot be
          mistaken for ordinary advice. */}
      {article.redFlags?.length ? (
        <View
          style={{
            marginTop: spacing.xl,
            padding: spacing.lg,
            borderRadius: radius.lg,
            backgroundColor: c.proSoft,
            borderWidth: 1,
            borderColor: c.pro,
            gap: spacing.sm,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Ionicons name="warning" size={18} color={c.pro} />
            <Text variant="bodyStrong" tone="pro">
              When to get medical help
            </Text>
          </View>
          {article.redFlags.map((flag) => (
            <View key={flag} style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Text variant="body" tone="pro">
                •
              </Text>
              <Text variant="body" tone="secondary" style={{ flex: 1 }}>
                {flag}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {article.sections.map((section) => (
        <View key={section.heading} style={{ marginTop: spacing.xl }}>
          <Text variant="heading" style={{ marginBottom: spacing.sm }}>
            {section.heading}
          </Text>
          {section.body.map((line, i) => {
            const bullet = line.startsWith('• ');
            return (
              <View
                key={i}
                style={{ flexDirection: 'row', gap: spacing.sm, marginTop: i === 0 ? 0 : spacing.sm }}
              >
                {bullet ? (
                  <Text variant="body" tone="primary">
                    •
                  </Text>
                ) : null}
                <Text variant="body" tone="secondary" style={{ flex: 1, lineHeight: 23 }}>
                  {bullet ? line.slice(2) : line}
                </Text>
              </View>
            );
          })}
        </View>
      ))}

      {/* Related reading. */}
      {article.related?.length ? (
        <View style={{ marginTop: spacing.xxl }}>
          <Text variant="micro" tone="tertiary" style={{ textTransform: 'uppercase', marginBottom: spacing.sm }}>
            Related
          </Text>
          <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
            {article.related
              .map(getArticle)
              .filter((a): a is NonNullable<typeof a> => !!a)
              .map((rel, i) => (
                <Pressable
                  key={rel.id}
                  onPress={() => router.push({ pathname: '/care/[id]', params: { id: rel.id } })}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    paddingVertical: spacing.md,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: c.border,
                  }}
                >
                  <Ionicons name={rel.icon as keyof typeof Ionicons.glyphMap} size={18} color={c.primary} />
                  <Text variant="body" style={{ flex: 1 }}>
                    {rel.title}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={c.textTertiary} />
                </Pressable>
              ))}
          </Card>
        </View>
      ) : null}

      <Text variant="caption" tone="tertiary" style={{ marginTop: spacing.xxl }}>
        General information, not medical advice. It does not replace your prescriber or pharmacist —
        if you are worried, contact them.
      </Text>
    </Screen>
  );
}
