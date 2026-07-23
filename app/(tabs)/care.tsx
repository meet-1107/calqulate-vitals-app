import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { medicationCycle, outlookFor } from '../../src/lib/cycle';
import { getMedication } from '../../src/lib/medications';
import {
  ARTICLES,
  CATEGORY_META,
  articlesIn,
  getArticle,
  type Article,
  type Category,
} from '../../src/lib/care/content';
import { SUGGESTED_QUERIES, searchCare } from '../../src/lib/care/search';
import { useProfile } from '../../src/store/profile';
import { useColors, useTheme } from '../../src/theme/ThemeProvider';
import { HIT, radius, spacing, type as typeScale } from '../../src/theme';

const CATEGORIES: Category[] = ['symptom', 'medication', 'nutrition', 'lifestyle', 'faq'];

function ArticleRow({ article, onPress }: { article: Article; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        minHeight: HIT,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: c.primarySoft,
        }}
      >
        <Ionicons name={article.icon as keyof typeof Ionicons.glyphMap} size={19} color={c.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{article.title}</Text>
        <Text variant="caption" tone="secondary" numberOfLines={1} style={{ marginTop: 1 }}>
          {article.summary}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.textTertiary} />
    </Pressable>
  );
}

/**
 * Care — the knowledge centre.
 *
 * The fourth pillar: when a user opens the app worried rather than curious,
 * this answers "is this normal, and what do I do?". Search leads because that
 * is how people arrive at a worry — with a question, not a menu path.
 */
export default function Care() {
  const c = useColors();
  const { scheme } = useTheme();
  const router = useRouter();
  const { profile, logs } = useProfile();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | null>(null);

  const results = useMemo(() => searchCare(query), [query]);
  const searching = query.trim().length > 0;

  // A contextual pick: what is worth reading given where the user is right now.
  const suggestion = useMemo(() => {
    const cycle = medicationCycle(profile, logs);
    const outlook = outlookFor(cycle);
    if (cycle.overdueHours > 0) return getArticle('missed-dose');
    if (outlook.nausea === 'High') return getArticle('nausea');
    if (cycle.position === 'trough') return getArticle('eating-tips');
    if (cycle.position === 'none') return getArticle('injection-guide');
    return getArticle('protein');
  }, [profile, logs]);

  const open = (id: string) => router.push({ pathname: '/care/[id]', params: { id } });

  return (
    <Screen scroll>
      <Text variant="title" style={{ marginTop: spacing.sm }}>
        Care
      </Text>
      <Text variant="caption" tone="secondary" style={{ marginTop: 2, marginBottom: spacing.lg }}>
        Answers, not another chart.
      </Text>

      {/* Search leads — people arrive with a question. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          borderRadius: radius.pill,
          backgroundColor: scheme === 'dark' ? c.card : c.cardAlt,
          borderWidth: 1,
          borderColor: c.border,
        }}
      >
        <Ionicons name="search" size={18} color={c.textTertiary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Ask anything…"
          placeholderTextColor={c.textTertiary}
          style={[typeScale.body, { flex: 1, color: c.text, minHeight: HIT }]}
          returnKeyType="search"
          autoCorrect={false}
        />
        {searching ? (
          <Pressable onPress={() => setQuery('')} hitSlop={10}>
            <Ionicons name="close-circle" size={18} color={c.textTertiary} />
          </Pressable>
        ) : null}
      </View>

      {searching ? (
        <View style={{ marginTop: spacing.lg }}>
          {results.length ? (
            <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
              {results.map((h, i) => (
                <View key={h.article.id}>
                  {i > 0 ? <View style={{ height: 1, backgroundColor: c.border }} /> : null}
                  <ArticleRow article={h.article} onPress={() => open(h.article.id)} />
                </View>
              ))}
            </Card>
          ) : (
            <Card>
              <Text variant="body" tone="secondary">
                No guide matches that yet. Try a symptom, a medication, or a word like “protein” or
                “travel”.
              </Text>
            </Card>
          )}
        </View>
      ) : (
        <>
          {/* Common questions, so the empty search is not a dead end. */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg }}>
            {SUGGESTED_QUERIES.slice(0, 5).map((q) => (
              <Pressable
                key={q}
                onPress={() => setQuery(q)}
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.pill,
                  backgroundColor: c.primarySoft,
                }}
              >
                <Text variant="caption" tone="primary">
                  {q}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Contextual card — reads the user's current cycle. */}
          {suggestion ? (
            <Pressable onPress={() => open(suggestion.id)} style={{ marginTop: spacing.xl }}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: radius.md,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: c.primarySoft,
                  }}
                >
                  <Ionicons name="sparkles" size={20} color={c.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="micro" tone="tertiary" style={{ textTransform: 'uppercase' }}>
                    Worth reading today
                  </Text>
                  <Text variant="bodyStrong" style={{ marginTop: 1 }}>
                    {suggestion.title}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={c.textTertiary} />
              </Card>
            </Pressable>
          ) : null}

          {/* Browse by category. */}
          {CATEGORIES.map((cat) => {
            const meta = CATEGORY_META[cat];
            const list = articlesIn(cat);
            const collapsed = category != null && category !== cat;
            if (collapsed) return null;
            return (
              <View key={cat} style={{ marginTop: spacing.xl }}>
                <Pressable
                  onPress={() => setCategory((v) => (v === cat ? null : cat))}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}
                >
                  <Ionicons name={meta.icon as keyof typeof Ionicons.glyphMap} size={16} color={c.textSecondary} />
                  <Text variant="heading" style={{ flex: 1 }}>
                    {meta.label}
                  </Text>
                  <Text variant="caption" tone="tertiary">
                    {list.length}
                  </Text>
                </Pressable>
                <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
                  {list.map((a, i) => (
                    <View key={a.id}>
                      {i > 0 ? <View style={{ height: 1, backgroundColor: c.border }} /> : null}
                      <ArticleRow article={a} onPress={() => open(a.id)} />
                    </View>
                  ))}
                </Card>
              </View>
            );
          })}
        </>
      )}

      <Text variant="caption" tone="tertiary" style={{ marginTop: spacing.xxl }}>
        These guides are general information to help you feel prepared, not medical advice, and they
        do not replace your prescriber or pharmacist. If something worries you, contact them.
      </Text>
    </Screen>
  );
}
