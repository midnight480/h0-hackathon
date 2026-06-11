export type Category = 'tech' | 'business' | 'design' | 'education' | 'other'

export type ProcessingStatus = 'ready' | 'processing' | 'pending' | 'failed'

export type LanguageCode =
  | 'ja'
  | 'en'
  | 'zh'
  | 'ko'
  | 'es'
  | 'fr'
  | 'de'
  | 'pt'

export interface Language {
  code: LanguageCode
  label: string
  native: string
}

export const LANGUAGES: Language[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'ja', label: 'Japanese', native: '日本語' },
  { code: 'zh', label: 'Chinese', native: '中文' },
  { code: 'ko', label: 'Korean', native: '한국어' },
  { code: 'es', label: 'Spanish', native: 'Español' },
  { code: 'fr', label: 'French', native: 'Français' },
  { code: 'de', label: 'German', native: 'Deutsch' },
  { code: 'pt', label: 'Portuguese', native: 'Português' },
]

export interface Author {
  username: string
  name: string
  avatarUrl: string
}

export interface Slide {
  pageNumber: number
  imageUrl: string
  // Extracted original text + translations keyed by language code
  text: Partial<Record<LanguageCode, string>>
}

export interface Deck {
  id: string
  slug: string
  title: string
  description: string
  author: Author
  category: Category
  tags: string[]
  originalLanguage: LanguageCode
  targetLanguages: LanguageCode[]
  slideCount: number
  views: number
  likes: number
  status: ProcessingStatus
  publishedAt: string
  cover: string
  slides: Slide[]
}

export const CATEGORIES: { value: Category | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'tech', label: 'Technology' },
  { value: 'business', label: 'Business' },
  { value: 'design', label: 'Design' },
  { value: 'education', label: 'Education' },
  { value: 'other', label: 'Other' },
]

const AUTHORS: Record<string, Author> = {
  haruki: {
    username: 'haruki',
    name: 'Haruki Tanaka',
    avatarUrl: '/avatars/haruki.png',
  },
  mei: {
    username: 'mei',
    name: 'Mei Lin',
    avatarUrl: '/avatars/mei.png',
  },
  sofia: {
    username: 'sofia',
    name: 'Sofia Alvarez',
    avatarUrl: '/avatars/sofia.png',
  },
  daniel: {
    username: 'daniel',
    name: 'Daniel Weber',
    avatarUrl: '/avatars/daniel.png',
  },
}

function makeSlides(
  cover: string,
  count: number,
  texts: { ja?: string; en: string; zh?: string }[],
): Slide[] {
  return Array.from({ length: count }, (_, i) => {
    const t = texts[i % texts.length]
    return {
      pageNumber: i + 1,
      imageUrl: i === 0 ? cover : `/slides/slide-${(i % 6) + 1}.png`,
      text: {
        ja: t.ja,
        en: t.en,
        zh: t.zh,
      },
    }
  })
}

export const DECKS: Deck[] = [
  {
    id: 'd1',
    slug: 'designing-for-aurora-dsql',
    title: 'Designing for Aurora DSQL at Global Scale',
    description:
      'A deep dive into building INSERT-only, event-sourced schemas that thrive under optimistic concurrency control across multiple regions.',
    author: AUTHORS.haruki,
    category: 'tech',
    tags: ['database', 'aws', 'architecture', 'scale'],
    originalLanguage: 'ja',
    targetLanguages: ['en', 'zh'],
    slideCount: 28,
    views: 14820,
    likes: 1243,
    status: 'ready',
    publishedAt: '2026-05-21',
    cover: '/slides/cover-dsql.png',
    slides: makeSlides('/slides/cover-dsql.png', 28, [
      {
        ja: 'グローバル規模のためのデータベース設計',
        en: 'Database design for global scale',
        zh: '面向全球规模的数据库设计',
      },
      {
        ja: '楽観的同時実行制御とは何か',
        en: 'What is optimistic concurrency control?',
        zh: '什么是乐观并发控制？',
      },
      {
        ja: 'イベントソーシングで競合を回避する',
        en: 'Avoiding conflicts with event sourcing',
        zh: '通过事件溯源避免冲突',
      },
      {
        ja: 'UUID 主キーでホットスポットを排除',
        en: 'Eliminating hotspots with UUID primary keys',
        zh: '使用 UUID 主键消除热点',
      },
    ]),
  },
  {
    id: 'd2',
    slug: 'product-strategy-2026',
    title: 'Product Strategy for a Borderless Market',
    description:
      'How to think about positioning, pricing, and go-to-market when your customers span every timezone and language.',
    author: AUTHORS.mei,
    category: 'business',
    tags: ['strategy', 'product', 'growth'],
    originalLanguage: 'zh',
    targetLanguages: ['en', 'ja'],
    slideCount: 22,
    views: 9310,
    likes: 728,
    status: 'ready',
    publishedAt: '2026-05-18',
    cover: '/slides/cover-strategy.png',
    slides: makeSlides('/slides/cover-strategy.png', 22, [
      {
        zh: '无边界市场的产品策略',
        en: 'Product strategy for a borderless market',
        ja: 'ボーダーレス市場のプロダクト戦略',
      },
      {
        zh: '定位与差异化',
        en: 'Positioning and differentiation',
        ja: 'ポジショニングと差別化',
      },
      {
        zh: '全球定价模型',
        en: 'Global pricing models',
        ja: 'グローバル価格モデル',
      },
    ]),
  },
  {
    id: 'd3',
    slug: 'quiet-interfaces',
    title: 'Quiet Interfaces: The Art of Restraint',
    description:
      'A visual essay on calm technology, negative space, and designing products that respect human attention.',
    author: AUTHORS.sofia,
    category: 'design',
    tags: ['ux', 'visual', 'minimalism'],
    originalLanguage: 'en',
    targetLanguages: ['ja', 'es'],
    slideCount: 34,
    views: 21450,
    likes: 2890,
    status: 'ready',
    publishedAt: '2026-05-29',
    cover: '/slides/cover-design.png',
    slides: makeSlides('/slides/cover-design.png', 34, [
      {
        en: 'Quiet interfaces: the art of restraint',
        ja: '静かなインターフェース：抑制の美学',
      },
      {
        en: 'Negative space is not empty space',
        ja: '余白は空白ではない',
      },
      {
        en: 'Design for attention, not engagement',
        ja: 'エンゲージメントではなく注意のためにデザインする',
      },
    ]),
  },
  {
    id: 'd4',
    slug: 'intro-to-distributed-systems',
    title: 'An Approachable Intro to Distributed Systems',
    description:
      'Consensus, replication, and consistency explained with diagrams instead of equations. For students and curious engineers.',
    author: AUTHORS.daniel,
    category: 'education',
    tags: ['systems', 'lecture', 'cs'],
    originalLanguage: 'en',
    targetLanguages: ['ja', 'zh'],
    slideCount: 41,
    views: 33120,
    likes: 4102,
    status: 'ready',
    publishedAt: '2026-06-01',
    cover: '/slides/cover-systems.png',
    slides: makeSlides('/slides/cover-systems.png', 41, [
      {
        en: 'An approachable intro to distributed systems',
        ja: '分散システムへのやさしい入門',
        zh: '分布式系统的友好入门',
      },
      {
        en: 'Why is consensus hard?',
        ja: 'なぜ合意形成は難しいのか',
        zh: '为什么共识很难？',
      },
    ]),
  },
  {
    id: 'd5',
    slug: 'frontend-performance-budgets',
    title: 'Shipping Fast: Frontend Performance Budgets',
    description:
      'Practical techniques for keeping your app under budget — from image optimization to edge caching with ISR.',
    author: AUTHORS.haruki,
    category: 'tech',
    tags: ['performance', 'frontend', 'web'],
    originalLanguage: 'ja',
    targetLanguages: ['en'],
    slideCount: 19,
    views: 7640,
    likes: 612,
    status: 'ready',
    publishedAt: '2026-05-12',
    cover: '/slides/cover-perf.png',
    slides: makeSlides('/slides/cover-perf.png', 19, [
      {
        ja: 'フロントエンドパフォーマンス予算',
        en: 'Frontend performance budgets',
      },
      {
        ja: '画像最適化の基本',
        en: 'The basics of image optimization',
      },
    ]),
  },
  {
    id: 'd6',
    slug: 'storytelling-with-data',
    title: 'Storytelling with Data',
    description:
      'Turn dense spreadsheets into narratives that move decisions. A workshop on charts, framing, and clarity.',
    author: AUTHORS.mei,
    category: 'business',
    tags: ['data', 'communication', 'charts'],
    originalLanguage: 'zh',
    targetLanguages: ['en'],
    slideCount: 26,
    views: 11200,
    likes: 980,
    status: 'ready',
    publishedAt: '2026-05-25',
    cover: '/slides/cover-data.png',
    slides: makeSlides('/slides/cover-data.png', 26, [
      {
        zh: '用数据讲故事',
        en: 'Storytelling with data',
      },
      {
        zh: '选择正确的图表',
        en: 'Choosing the right chart',
      },
    ]),
  },
  {
    id: 'd7',
    slug: 'typography-systems',
    title: 'Building Typographic Systems',
    description:
      'Scale, rhythm, and hierarchy — a designer’s guide to type systems that work across languages and scripts.',
    author: AUTHORS.sofia,
    category: 'design',
    tags: ['type', 'systems', 'visual'],
    originalLanguage: 'en',
    targetLanguages: ['ja'],
    slideCount: 30,
    views: 16780,
    likes: 1870,
    status: 'ready',
    publishedAt: '2026-05-09',
    cover: '/slides/cover-type.png',
    slides: makeSlides('/slides/cover-type.png', 30, [
      {
        en: 'Building typographic systems',
        ja: 'タイポグラフィシステムの構築',
      },
      {
        en: 'Scale, rhythm, hierarchy',
        ja: 'スケール、リズム、階層',
      },
    ]),
  },
  {
    id: 'd8',
    slug: 'machine-learning-foundations',
    title: 'Foundations of Machine Learning',
    description:
      'A semester’s worth of intuition in one deck: gradients, loss, and the bias-variance tradeoff.',
    author: AUTHORS.daniel,
    category: 'education',
    tags: ['ml', 'ai', 'lecture'],
    originalLanguage: 'en',
    targetLanguages: ['ja', 'ko'],
    slideCount: 52,
    views: 28940,
    likes: 3340,
    status: 'ready',
    publishedAt: '2026-06-03',
    cover: '/slides/cover-ml.png',
    slides: makeSlides('/slides/cover-ml.png', 52, [
      {
        en: 'Foundations of machine learning',
        ja: '機械学習の基礎',
      },
      {
        en: 'Gradient descent, intuitively',
        ja: '直感で理解する勾配降下法',
      },
    ]),
  },
]

// Decks "owned" by the signed-in demo user (for the dashboard)
export const MY_DECKS: Deck[] = [
  DECKS[0],
  DECKS[4],
  {
    id: 'd9',
    slug: 'serverless-patterns',
    title: 'Serverless Patterns for 2026',
    description:
      'Queues, fan-out, and idempotent consumers — patterns for building resilient event-driven backends.',
    author: AUTHORS.haruki,
    category: 'tech',
    tags: ['serverless', 'aws', 'patterns'],
    originalLanguage: 'ja',
    targetLanguages: ['en', 'zh'],
    slideCount: 24,
    views: 0,
    likes: 0,
    status: 'processing',
    publishedAt: '2026-06-09',
    cover: '/slides/cover-serverless.png',
    slides: [],
  },
  {
    id: 'd10',
    slug: 'design-tokens-deep-dive',
    title: 'Design Tokens: A Deep Dive',
    description: 'From primitives to semantic aliases — a maintainable token architecture.',
    author: AUTHORS.haruki,
    category: 'design',
    tags: ['tokens', 'design-systems'],
    originalLanguage: 'ja',
    targetLanguages: ['en'],
    slideCount: 0,
    views: 0,
    likes: 0,
    status: 'failed',
    publishedAt: '2026-06-08',
    cover: '/slides/cover-tokens.png',
    slides: [],
  },
]

export function getDeck(username: string, slug: string): Deck | undefined {
  return [...DECKS, ...MY_DECKS].find(
    (d) => d.author.username === username && d.slug === slug,
  )
}

export function languageLabel(code: LanguageCode): string {
  return LANGUAGES.find((l) => l.code === code)?.label ?? code
}

export function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return `${n}`
}
