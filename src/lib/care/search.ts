/**
 * Care search.
 *
 * The user types "can I drink", "missed my shot", "why am I so tired" — natural
 * phrasing, not article titles. So this scores every article across its title,
 * summary, keywords and body, ranks the matches, and tolerates the messy way
 * people actually ask.
 *
 * It is a local index over a fixed content set, which is the right tool here: it
 * works offline, returns instantly, and never invents an answer. When there is a
 * real backend the same interface can front a smarter retrieval model.
 */

import { ARTICLES, type Article, type Category } from './content';

const STOP = new Set([
  'a', 'an', 'the', 'is', 'are', 'i', 'my', 'me', 'to', 'of', 'on', 'in', 'for',
  'and', 'or', 'can', 'do', 'does', 'what', 'why', 'how', 'when', 'should', 'be',
  'am', 'have', 'has', 'it', 'this', 'that', 'with', 'about', 'get', 'if', 'so',
]);

/** Lowercase, strip punctuation, drop stop-words, keep 3+ char tokens. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP.has(t));
}

/** Precomputed haystack per article, so a search does not re-tokenize content. */
type Indexed = {
  article: Article;
  title: Set<string>;
  keywords: Set<string>;
  body: Set<string>;
};

const INDEX: Indexed[] = ARTICLES.map((article) => ({
  article,
  title: new Set(tokenize(article.title)),
  keywords: new Set([
    ...article.keywords.flatMap(tokenize),
    ...tokenize(article.summary),
  ]),
  body: new Set(article.sections.flatMap((s) => [...tokenize(s.heading), ...s.body.flatMap(tokenize)])),
}));

export type SearchHit = { article: Article; score: number };

/** Length of the common leading run of two words. */
function sharedPrefix(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}

/**
 * Ranked results.
 *
 * A hit in the title is worth most, a keyword next, the body least — someone
 * searching "nausea" wants the nausea article, not every article that mentions
 * it in passing. Whole-phrase substring matches get a bonus so "missed dose"
 * beats two loose word hits.
 */
export function searchCare(query: string, limit = 8): SearchHit[] {
  const tokens = tokenize(query);
  if (!tokens.length) return [];

  const phrase = query.toLowerCase().trim();

  const hits = INDEX.map(({ article, title, keywords, body }) => {
    let score = 0;
    for (const t of tokens) {
      if (title.has(t)) score += 6;
      else if (keywords.has(t)) score += 3;
      else if (body.has(t)) score += 1;
      // Partial: "hydrate"->"hydration", "constipated"->"constipation". Neither
      // is a prefix of the other, so match on a shared stem of 5+ characters.
      else if ([...title, ...keywords].some((k) => sharedPrefix(k, t) >= 5)) score += 1.5;
    }
    // Phrase appearing verbatim in the title or a keyword is a strong signal.
    if (article.title.toLowerCase().includes(phrase)) score += 5;
    if (article.keywords.some((k) => k.toLowerCase().includes(phrase))) score += 4;

    return { article, score };
  });

  return hits
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** The example prompts shown before the user types anything. */
export const SUGGESTED_QUERIES = [
  'Can I drink alcohol?',
  'What if I miss my dose?',
  'Why am I so tired?',
  'How much protein do I need?',
  'Can I inject in my thigh?',
  'Why have I stopped losing weight?',
  'Is nausea normal?',
  'Travelling with my pen',
];

/** Loose grouping so a category filter can sit above results. */
export const filterByCategory = (hits: SearchHit[], category: Category | null) =>
  category ? hits.filter((h) => h.article.category === category) : hits;
