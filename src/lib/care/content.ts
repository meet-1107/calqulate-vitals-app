/**
 * The Care knowledge base.
 *
 * When a GLP-1 user opens the app after feeling sick or missing a dose, the
 * question is not "where is my chart" — it is "is this normal, and what do I
 * do?". This module answers that.
 *
 * EDITORIAL RULES, because this is health content:
 *
 *  1. Every article carries a red-flag section: the specific signs that mean
 *     stop reading and contact a clinician. These come first in spirit even
 *     when they render last, and they are never softened.
 *  2. Self-care advice is limited to what is genuinely safe for anyone — hydration,
 *     smaller meals, bland food, gentle movement. Nothing here adjusts a dose or
 *     recommends a drug.
 *  3. Nothing diagnoses. The language is "often", "many people", "usually",
 *     because that is what general guidance earns.
 *  4. Dosing questions defer to the prescriber, always.
 *
 * It is content, not a model, so it is plain data that the search index and the
 * article screen both read.
 */

export type Category = 'symptom' | 'medication' | 'nutrition' | 'lifestyle' | 'faq';

export type ArticleSection = {
  heading: string;
  /** Paragraphs and bullet lines. A line starting with "• " renders as a bullet. */
  body: string[];
};

export type Article = {
  id: string;
  category: Category;
  title: string;
  /** One line shown in lists and search results. */
  summary: string;
  icon: string;
  /** Extra search terms beyond the title — how people actually phrase it. */
  keywords: string[];
  sections: ArticleSection[];
  /** The stop-and-call-someone signs. Rendered in a distinct, unmissable block. */
  redFlags?: string[];
  /** Links to related article ids. */
  related?: string[];
};

// ---------------------------------------------------------------------------
// Symptoms
// ---------------------------------------------------------------------------

const SYMPTOMS: Article[] = [
  {
    id: 'nausea',
    category: 'symptom',
    title: 'Nausea',
    summary: 'The most common GLP-1 side effect, and usually the first to settle.',
    icon: 'sad-outline',
    keywords: ['sick', 'queasy', 'stomach', 'feel sick', 'want to vomit', 'nauseated'],
    sections: [
      {
        heading: 'Why it happens',
        body: [
          'GLP-1 medications slow how fast your stomach empties, so food sits longer and you feel full and sometimes queasy. It is most common in the first days after a dose and after each dose increase.',
          'For most people it eases over a few weeks as the body adjusts. It tends to be strongest at higher doses and right after an injection.',
        ],
      },
      {
        heading: 'What tends to help',
        body: [
          '• Eat smaller meals, more often, and stop at the first sign of fullness.',
          '• Favour bland, dry foods — crackers, toast, rice — on the worst days.',
          '• Go easy on greasy, fried and very rich food; it is the hardest to digest.',
          '• Sip fluids steadily through the day rather than drinking a lot at once.',
          '• Eat slowly, and stay upright for a while after eating.',
          '• Fresh air and ginger tea help some people.',
        ],
      },
      {
        heading: 'When it usually shows up',
        body: [
          'Nausea often clusters in the day or two after your injection and fades through the week. If you track your symptoms, the app learns your own pattern and can warn you before the harder days.',
        ],
      },
    ],
    redFlags: [
      'Vomiting that will not stop, or you cannot keep any fluids down',
      'Severe stomach pain, especially pain that spreads to your back',
      'Signs of dehydration — very dark urine, dizziness, a racing heart',
    ],
    related: ['vomiting', 'dehydration', 'eating-tips'],
  },
  {
    id: 'constipation',
    category: 'symptom',
    title: 'Constipation',
    summary: 'Slower digestion means slower everything. Fluid and fibre are the levers.',
    icon: 'ellipse-outline',
    keywords: ['cant go', 'bowel', 'blocked', 'hard stool', 'not pooping', 'irregular'],
    sections: [
      {
        heading: 'Why it happens',
        body: [
          'The same slowed digestion that reduces appetite also slows the bowel, and eating less means less fibre and fluid moving through. Together that commonly leads to constipation.',
        ],
      },
      {
        heading: 'What tends to help',
        body: [
          '• Drink more water — this is the single biggest lever, and easy to forget when appetite is low.',
          '• Build fibre up gradually: vegetables, fruit, wholegrains, beans. Adding a lot at once can bloat.',
          '• Move daily. Even a walk helps the bowel keep moving.',
          '• Keep a roughly regular routine around meals and the bathroom.',
          '• A pharmacist can suggest a gentle over-the-counter option if food and fluid are not enough.',
        ],
      },
    ],
    redFlags: [
      'No bowel movement for several days with pain, bloating and vomiting',
      'Blood in your stool',
      'Severe or worsening abdominal pain',
    ],
    related: ['nausea', 'hydration', 'eating-tips'],
  },
  {
    id: 'vomiting',
    category: 'symptom',
    title: 'Vomiting',
    summary: 'Occasional is common; persistent needs attention because of dehydration.',
    icon: 'warning-outline',
    keywords: ['throwing up', 'threw up', 'being sick', 'puke'],
    sections: [
      {
        heading: 'What to do in the moment',
        body: [
          '• Stop eating solid food for a short while and let your stomach settle.',
          '• Once it eases, sip small amounts of water or an oral rehydration drink often.',
          '• Reintroduce food slowly and bland — a few crackers, some toast.',
          '• Rich, greasy and large meals are the most likely to bring it back.',
        ],
      },
      {
        heading: 'Why it matters',
        body: [
          'A one-off is usually just the medication working strongly, often after a dose increase. The real risk from repeated vomiting is dehydration, which can affect your kidneys — so keeping fluids in is the priority.',
        ],
      },
    ],
    redFlags: [
      'You cannot keep any fluids down for more than a day',
      'Vomiting with severe stomach pain, especially spreading to the back',
      'Blood in the vomit, or it looks like coffee grounds',
      'Signs of dehydration — dizziness, very little urine, confusion',
    ],
    related: ['nausea', 'dehydration'],
  },
  {
    id: 'heartburn',
    category: 'symptom',
    title: 'Heartburn & reflux',
    summary: 'Food lingering in the stomach can push acid upward. Meal timing helps.',
    icon: 'flame-outline',
    keywords: ['acid', 'reflux', 'burning chest', 'indigestion', 'gerd', 'burping'],
    sections: [
      {
        heading: 'Why it happens',
        body: [
          'Because the stomach empties more slowly, food and acid can sit long enough to rise back up, giving that burning feeling behind the breastbone.',
        ],
      },
      {
        heading: 'What tends to help',
        body: [
          '• Eat smaller meals and avoid lying down for two to three hours after eating.',
          '• Common triggers are spicy food, caffeine, alcohol, chocolate and very fatty meals.',
          '• Raising the head of the bed helps night-time reflux.',
          '• A pharmacist can recommend an antacid; if it is frequent, mention it to your prescriber.',
        ],
      },
    ],
    redFlags: [
      'Chest pain you are unsure about — treat new or severe chest pain as an emergency',
      'Difficulty or pain when swallowing',
      'Heartburn that keeps waking you or does not respond to antacids',
    ],
    related: ['nausea', 'eating-tips'],
  },
  {
    id: 'fatigue',
    category: 'symptom',
    title: 'Fatigue',
    summary: 'Often tied to eating far less. Protein, fluid and sleep are the anchors.',
    icon: 'battery-dead-outline',
    keywords: ['tired', 'no energy', 'exhausted', 'sleepy', 'weak', 'low energy'],
    sections: [
      {
        heading: 'Why it happens',
        body: [
          'Eating much less means fewer calories and can mean too little protein or fluid, all of which drain energy. It is most noticeable early on and around dose increases.',
        ],
      },
      {
        heading: 'What tends to help',
        body: [
          '• Hit your protein target even when appetite is low — it steadies energy and protects muscle.',
          '• Stay hydrated; mild dehydration alone causes tiredness.',
          '• Do not skip meals entirely, even small ones.',
          '• Protect your sleep, and keep some gentle movement in the day.',
        ],
      },
    ],
    redFlags: [
      'Sudden or severe weakness, or feeling faint',
      'Fatigue with a racing heart, shakiness or sweating (possible low blood sugar, especially if you also take insulin or a sulfonylurea)',
    ],
    related: ['protein', 'hydration'],
  },
  {
    id: 'hair-loss',
    category: 'symptom',
    title: 'Hair thinning',
    summary: 'Usually about rapid weight loss, not the drug itself — and usually temporary.',
    icon: 'cut-outline',
    keywords: ['hair', 'shedding', 'thinning', 'bald', 'losing hair'],
    sections: [
      {
        heading: 'Why it happens',
        body: [
          'Shedding a few months into significant weight loss is a known pattern called telogen effluvium. Rapid weight change and lower nutrient intake nudge more hairs into their resting phase at once. It is a response to the weight loss, not damage from the medication, and it is usually temporary.',
        ],
      },
      {
        heading: 'What tends to help',
        body: [
          '• Get enough protein — hair is largely protein.',
          '• Adequate iron, zinc and vitamin D matter; a balanced diet or a check with your clinician helps.',
          '• Be gentle with styling and avoid tight pulling.',
          '• Losing weight a little more slowly can reduce the effect.',
        ],
      },
    ],
    related: ['protein', 'muscle'],
  },
  {
    id: 'injection-pain',
    category: 'symptom',
    title: 'Injection-site reactions',
    summary: 'Small redness or a bump is common. Rotation and technique reduce it.',
    icon: 'bandage-outline',
    keywords: ['injection hurts', 'red', 'bruise', 'lump', 'sore spot', 'bump', 'itchy'],
    sections: [
      {
        heading: 'What is normal',
        body: [
          'Mild redness, a small bump, itching or a little bruising at the site is common and settles within a day or two.',
        ],
      },
      {
        heading: 'What tends to help',
        body: [
          '• Rotate sites every dose — the app tracks this for you. Repeatedly using one spot causes hard, lumpy tissue that absorbs unevenly.',
          '• Let the pen reach room temperature before injecting; cold stings more.',
          '• Do not inject into bruised, tender or hardened skin.',
          '• Relax the muscle and inject at the angle your clinician showed you.',
        ],
      },
    ],
    redFlags: [
      'Spreading redness, warmth and swelling that worsens after a day or two (possible infection)',
      'A widespread rash, hives, or any swelling of the lips, tongue or throat — seek emergency care',
    ],
    related: ['injection-guide', 'rotation'],
  },
  {
    id: 'plateau',
    category: 'symptom',
    title: 'Weight-loss plateau',
    summary: 'Almost everyone hits one. It rarely means the medication stopped working.',
    icon: 'remove-outline',
    keywords: ['stalled', 'stuck', 'not losing', 'plateau', 'stopped losing', 'no progress'],
    sections: [
      {
        heading: 'Why it happens',
        body: [
          'As you lose weight your body needs fewer calories, so the same habits produce slower loss — the maths shifts under you. Plateaus are a normal stage, not a failure, and they often break on their own.',
        ],
      },
      {
        heading: 'What tends to help',
        body: [
          '• Hold your protein and hydration; under-eating can slow your metabolism and cost muscle.',
          '• Add or keep up resistance training — muscle protects your rate of loss.',
          '• Check whether portions have crept up as appetite returned between doses.',
          '• If you are weeks into a stall at a stable dose, that is worth raising with your prescriber, who may discuss a titration.',
        ],
      },
    ],
    related: ['muscle', 'protein', 'titration'],
  },
];

// ---------------------------------------------------------------------------
// Medication guides
// ---------------------------------------------------------------------------

const MEDICATIONS: Article[] = [
  {
    id: 'missed-dose',
    category: 'medication',
    title: 'I missed a dose',
    summary: 'What to do depends on how long it has been. When in doubt, ask your pharmacist.',
    icon: 'time-outline',
    keywords: ['forgot', 'skipped', 'late dose', 'missed injection', 'missed shot', 'missed pill'],
    sections: [
      {
        heading: 'Weekly injections (Ozempic, Wegovy, Mounjaro, Zepbound)',
        body: [
          'General guidance from the manufacturers is: if it has been fewer than about 5 days, take it as soon as you remember, then carry on with your normal day. If more than about 5 days have passed, skip the missed dose and take the next one on your regular day.',
          'Never take two doses close together to catch up.',
        ],
      },
      {
        heading: 'Daily medications (Rybelsus, Saxenda)',
        body: [
          'Skip the missed day and take the next dose at your usual time. Do not double up.',
        ],
      },
      {
        heading: 'The safe default',
        body: [
          'These are general rules and your specific product may differ. A quick call to your pharmacist confirms the right step for you — it is exactly what they are there for.',
        ],
      },
    ],
    related: ['storage', 'travel'],
  },
  {
    id: 'injection-guide',
    category: 'medication',
    title: 'How to inject',
    summary: 'The basics of a clean, comfortable injection.',
    icon: 'medkit-outline',
    keywords: ['how to inject', 'injection technique', 'where to inject', 'pen', 'needle'],
    sections: [
      {
        heading: 'Where',
        body: [
          'The usual sites are the abdomen (a couple of inches from the navel), the front of the thighs, and the back of the upper arms. All work; rotating between them matters more than which you pick.',
        ],
      },
      {
        heading: 'Steps',
        body: [
          '• Wash your hands and check the pen and dose.',
          '• Let a refrigerated pen warm to room temperature.',
          '• Clean the site if your clinician advised it, and pick a fresh spot.',
          '• Pinch the skin if shown to, insert at the taught angle, and hold for the count your pen requires so the full dose goes in.',
          '• Dispose of the needle in a sharps bin — never in household waste.',
        ],
      },
      {
        heading: 'Rotate',
        body: [
          'Use a different site each time. The app suggests the next spot and warns if one is overused, which prevents the hard lumps that make absorption unreliable.',
        ],
      },
    ],
    related: ['injection-pain', 'rotation', 'storage'],
  },
  {
    id: 'storage',
    category: 'medication',
    title: 'Storing your medication',
    summary: 'Keep it cold until first use, then follow the in-use window.',
    icon: 'thermometer-outline',
    keywords: ['fridge', 'refrigerate', 'store', 'temperature', 'keep cold', 'expire'],
    sections: [
      {
        heading: 'Before first use',
        body: [
          'Keep pens in the fridge, roughly 2–8°C (36–46°F). Do not freeze — a frozen pen must be thrown away. Keep it in its box, away from the light.',
        ],
      },
      {
        heading: 'After first use',
        body: [
          'Most pens can then be kept at room temperature or in the fridge for a set number of days — commonly up to 4–8 weeks depending on the product. Check your specific pen’s leaflet for its in-use limit and do not use it past that.',
        ],
      },
    ],
    related: ['travel', 'missed-dose'],
  },
  {
    id: 'travel',
    category: 'medication',
    title: 'Travelling with your pen',
    summary: 'Keep it cool, carry it on, and bring a bit of proof.',
    icon: 'airplane-outline',
    keywords: ['flight', 'holiday', 'vacation', 'plane', 'airport', 'trip', 'travel'],
    sections: [
      {
        heading: 'On the day',
        body: [
          '• Carry pens in your hand luggage — hold luggage can freeze at altitude, which ruins them.',
          '• Use an insulated pouch or a medical cool bag; avoid direct ice contact.',
          '• Needles and pens are allowed through security. A letter or a copy of the prescription from your clinician smooths any questions.',
        ],
      },
      {
        heading: 'Time zones',
        body: [
          'For a weekly dose, a few hours’ shift either way is fine — keep the same weekday. For big changes or daily dosing, ask your pharmacist how to adjust timing.',
        ],
      },
    ],
    related: ['storage', 'missed-dose'],
  },
  {
    id: 'titration',
    category: 'medication',
    title: 'Dose increases (titration)',
    summary: 'Doses step up slowly on purpose, to keep side effects manageable.',
    icon: 'trending-up-outline',
    keywords: ['increase dose', 'titrate', 'step up', 'higher dose', 'ready to increase', 'go up'],
    sections: [
      {
        heading: 'Why it is gradual',
        body: [
          'Starting low and increasing every few weeks lets your body adjust, which keeps nausea and other GI effects tolerable. The starting doses are often about tolerance, not weight loss.',
        ],
      },
      {
        heading: 'Moving up',
        body: [
          'Your prescriber decides when to step up, usually once you have settled at a dose. If side effects are rough, staying longer at a dose — or going up more slowly — is a normal and reasonable plan.',
          'Never increase your own dose or use more than prescribed to speed things up. It raises side effects sharply without a matching benefit.',
        ],
      },
    ],
    related: ['nausea', 'plateau'],
  },
  {
    id: 'alcohol',
    category: 'faq',
    title: 'Can I drink alcohol?',
    summary: 'No hard ban, but a few good reasons for caution.',
    icon: 'wine-outline',
    keywords: ['drink', 'alcohol', 'wine', 'beer', 'drinking'],
    sections: [
      {
        heading: 'The short answer',
        body: [
          'There is no absolute rule against alcohol on GLP-1 medication, but there are reasons to be careful. Many people find their tolerance drops and that alcohol worsens nausea. It also adds empty calories and can lower blood sugar — a bigger concern if you also take insulin or a sulfonylurea.',
          'If you drink, keep it modest, never on an empty stomach, and see how you feel. Check with your clinician if you take other medicines.',
        ],
      },
    ],
    related: ['nausea'],
  },
];

// ---------------------------------------------------------------------------
// Nutrition & lifestyle
// ---------------------------------------------------------------------------

const NUTRITION: Article[] = [
  {
    id: 'protein',
    category: 'nutrition',
    title: 'Getting enough protein',
    summary: 'The most important thing to get right — it protects muscle while you lose fat.',
    icon: 'nutrition-outline',
    keywords: ['protein', 'muscle', 'how much protein', 'meat', 'eggs', 'shakes'],
    sections: [
      {
        heading: 'Why it matters most',
        body: [
          'When you lose weight fast on a GLP-1, some of the loss can be muscle, not fat. Protein is what tips that balance back toward fat — it is the single most protective thing you can eat.',
        ],
      },
      {
        heading: 'Hitting your target when appetite is low',
        body: [
          '• Eat protein first at each meal, before it fills you up.',
          '• Reach for dense sources: eggs, Greek yogurt, chicken, fish, tofu, beans, cottage cheese.',
          '• A protein shake is an easy win on days solid food is hard.',
          '• Spread it across the day rather than one big serving.',
        ],
      },
    ],
    related: ['muscle', 'eating-tips', 'fatigue'],
  },
  {
    id: 'hydration',
    category: 'nutrition',
    title: 'Staying hydrated',
    summary: 'Easy to forget when you are not thirsty, and behind half of the side effects.',
    icon: 'water-outline',
    keywords: ['water', 'drink', 'dehydrated', 'fluids', 'how much water'],
    sections: [
      {
        heading: 'Why it slips',
        body: [
          'GLP-1 medication dampens appetite and thirst, so it is genuinely easy to drink too little without noticing. Yet low fluid drives constipation, fatigue, headaches and worse nausea.',
        ],
      },
      {
        heading: 'What helps',
        body: [
          '• Keep a bottle in sight and sip through the day rather than gulping at once.',
          '• The app’s hydration target scales to your body weight.',
          '• Herbal teas and water-rich foods count.',
          '• Watch for dark urine — a simple sign you are behind.',
        ],
      },
    ],
    related: ['constipation', 'fatigue', 'dehydration'],
  },
  {
    id: 'dehydration',
    category: 'nutrition',
    title: 'Spotting dehydration',
    summary: 'It amplifies almost every side effect and can affect your kidneys.',
    icon: 'alert-circle-outline',
    keywords: ['dehydration', 'dizzy', 'dark urine', 'thirsty', 'lightheaded'],
    sections: [
      {
        heading: 'The signs',
        body: [
          '• Dark yellow urine, or going much less often.',
          '• Dry mouth, headache, dizziness or feeling lightheaded when you stand.',
          '• A faster heartbeat and unusual tiredness.',
        ],
      },
      {
        heading: 'What to do',
        body: [
          'Sip fluids steadily; an oral rehydration solution replaces salts better than water alone if you have been vomiting or have diarrhoea. Dehydration is a bigger risk during bouts of vomiting, so keeping fluids in then matters most.',
        ],
      },
    ],
    redFlags: [
      'Confusion, fainting, or a rapid weak pulse',
      'Not passing urine for many hours',
      'Cannot keep fluids down at all',
    ],
    related: ['vomiting', 'hydration'],
  },
  {
    id: 'eating-tips',
    category: 'nutrition',
    title: 'Eating comfortably',
    summary: 'Small changes to how — not just what — you eat make the biggest difference.',
    icon: 'restaurant-outline',
    keywords: ['what to eat', 'meals', 'portion', 'food', 'diet', 'how to eat'],
    sections: [
      {
        heading: 'The pattern that works',
        body: [
          '• Smaller plates, eaten more often, and stop at comfortable — not full.',
          '• Protein and vegetables first; save heavier carbs for last.',
          '• Slow down. Fullness catches up late on this medication, so a slow meal prevents overshooting.',
          '• Keep the greasy, fried and very sugary meals small — they sit heaviest.',
          '• Notice which foods you personally tolerate and lean on them on rough days.',
        ],
      },
    ],
    related: ['protein', 'nausea', 'heartburn'],
  },
  {
    id: 'muscle',
    category: 'lifestyle',
    title: 'Protecting muscle',
    summary: 'Muscle is what keeps the weight off. Two levers protect it.',
    icon: 'barbell-outline',
    keywords: ['muscle', 'strength', 'lean mass', 'resistance', 'weights', 'lifting'],
    sections: [
      {
        heading: 'Why it matters',
        body: [
          'Up to a large share of rapid weight loss can be muscle rather than fat. Muscle burns energy and keeps your metabolism up, so protecting it is what makes the loss last.',
        ],
      },
      {
        heading: 'The two levers',
        body: [
          '• Protein — the dietary side, covered in its own guide.',
          '• Resistance training — the signal that tells your body to keep the muscle it has. Two or three sessions a week is plenty; bodyweight work counts.',
          'The app estimates how much of your loss is fat versus muscle and shows which lever will help you most.',
        ],
      },
    ],
    related: ['protein', 'plateau', 'exercise'],
  },
  {
    id: 'exercise',
    category: 'lifestyle',
    title: 'Exercising on a GLP-1',
    summary: 'Match the effort to where you are in your dose cycle and how you feel.',
    icon: 'walk-outline',
    keywords: ['exercise', 'workout', 'gym', 'walk', 'run', 'cardio', 'training'],
    sections: [
      {
        heading: 'Listen to the day',
        body: [
          'Energy dips in the day or two after a dose for many people. That is a good time for a walk or light movement rather than a hard session, and to save intense training for when you feel strong.',
        ],
      },
      {
        heading: 'What to prioritise',
        body: [
          '• Resistance training two to three times a week to protect muscle.',
          '• Daily walking — low cost, keeps the bowel moving, protects mood.',
          '• Eat some protein and stay hydrated around training, especially when appetite is low.',
        ],
      },
    ],
    related: ['muscle', 'fatigue'],
  },
  {
    id: 'rotation',
    category: 'medication',
    title: 'Rotating injection sites',
    summary: 'Same drug, different spot each time — it keeps absorption reliable.',
    icon: 'sync-outline',
    keywords: ['rotate', 'same spot', 'site rotation', 'where to inject next', 'lump'],
    sections: [
      {
        heading: 'Why rotate',
        body: [
          'Injecting the same spot repeatedly causes lipohypertrophy — hardened, lumpy tissue that absorbs the medication unevenly. That can make the dose feel like it is working less predictably.',
        ],
      },
      {
        heading: 'How',
        body: [
          'Move across the body between doses — abdomen, thigh, arm — rather than staying in one area. The app remembers where you last injected, suggests the next site, and flags any spot you have used too often.',
        ],
      },
    ],
    related: ['injection-guide', 'injection-pain'],
  },
];

export const ARTICLES: Article[] = [...SYMPTOMS, ...MEDICATIONS, ...NUTRITION];

export const ARTICLE_MAP = new Map(ARTICLES.map((a) => [a.id, a]));
export const getArticle = (id: string) => ARTICLE_MAP.get(id);

export const CATEGORY_META: Record<Category, { label: string; icon: string }> = {
  symptom: { label: 'Symptoms', icon: 'pulse-outline' },
  medication: { label: 'Medication', icon: 'medkit-outline' },
  nutrition: { label: 'Nutrition', icon: 'nutrition-outline' },
  lifestyle: { label: 'Lifestyle', icon: 'barbell-outline' },
  faq: { label: 'Questions', icon: 'help-circle-outline' },
};

export const articlesIn = (category: Category) => ARTICLES.filter((a) => a.category === category);

/** Symptom articles keyed by the label used in symptom logging, for deep links. */
export const SYMPTOM_ARTICLE_BY_LABEL: Record<string, string> = {
  Nausea: 'nausea',
  Fatigue: 'fatigue',
  Constipation: 'constipation',
  Headache: 'dehydration',
  Heartburn: 'heartburn',
  'Injection site': 'injection-pain',
};
