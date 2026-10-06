import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { normalizePublicId, isCanonicalId, formatPublicId } from '@/lib/public-id'
import { isUserId, normalizeUsername } from '@/lib/username'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { DeckViewer } from '@/components/deck-viewer'
import { ViewTracker } from '@/components/view-tracker'
import { type Deck, type Slide, type SlideBlock, type LanguageCode } from '@/lib/data'
import { withDb } from '@/lib/db'
import { getClerkUsers } from '@/lib/clerk-users'
import { hasLikedDeck } from '@/app/actions/deck'

// 公開URLの所有者部分を解決する際の検索キー列。`user_id`（旧URL）または `username`（新URL）。
// 値は固定リテラルのみを渡すため SQL インジェクションの懸念はない。
type OwnerColumn = 'user_id' | 'username'

async function getAuthorInfo(userId: string) {
  try {
    const client = await clerkClient()
    const user = await client.users.getUser(userId)
    const name =
      [user.firstName, user.lastName].filter(Boolean).join(' ') ||
      user.username ||
      userId
    return { name, avatarUrl: user.imageUrl ?? '' }
  } catch {
    return { name: userId, avatarUrl: '' }
  }
}

async function getDeckFromDb(
  ownerColumn: OwnerColumn,
  ownerValue: string,
  slug: string,
  viewerId: string | null,
): Promise<Deck | null> {
  try {
    return await withDb(async (client) => {
      const { rows } = await client.query<{
        id: string
        slug: string
        short_id: string | null
        title: string
        description: string
        user_id: string
        username: string | null
        category: string
        original_language: string
        target_languages: string[] | string
        slide_count: number
        views: number
        likes: number
        status: string
        is_public: boolean | null
        cover_image_key: string | null
        published_at: string
      }>(
        `SELECT id, slug, short_id, title, description, user_id, username, category, original_language,
                target_languages, slide_count, views, likes, status, is_public, cover_image_key, published_at
         FROM decks
         WHERE ${ownerColumn} = $1 AND slug = $2 AND deleted_at IS NULL`,
        [ownerValue, slug],
      )
      if (rows.length === 0) return null
      const d = rows[0]

      // 非公開（is_public = false）のデッキは所有者のみ閲覧可能
      if (d.is_public === false && viewerId !== d.user_id) return null

      // 著者表示（氏名・アバター）は解決後の user_id で Clerk から取得する（表示用）。
      const authorInfo = await getAuthorInfo(d.user_id)

      const { rows: slideRows } = await client.query<{
        page_number: number
        image_key: string | null
        layout: unknown
        language_code: string | null
        content: string | null
      }>(
        `SELECT s.page_number, s.image_key, s.layout, st.language_code, st.content
         FROM slides s
         LEFT JOIN slide_texts st ON st.slide_id = s.id
         WHERE s.deck_id = $1
         ORDER BY s.page_number`,
        [d.id],
      )

      // JSONB は pg ドライバ次第で object または string で来るため両対応でパース
      const parseLayout = (raw: unknown): SlideBlock[] => {
        if (!raw) return []
        try {
          const arr = typeof raw === 'string' ? JSON.parse(raw) : raw
          return Array.isArray(arr) ? (arr as SlideBlock[]) : []
        } catch {
          return []
        }
      }

      const slideMap = new Map<
        number,
        { imageKey: string | null; layout: SlideBlock[]; texts: Record<string, string> }
      >()
      for (const row of slideRows) {
        if (!slideMap.has(row.page_number)) {
          slideMap.set(row.page_number, {
            imageKey: row.image_key,
            layout: parseLayout(row.layout),
            texts: {},
          })
        }
        if (row.language_code && row.content) {
          slideMap.get(row.page_number)!.texts[row.language_code] = row.content
        }
      }

      const region = process.env.NEXT_PUBLIC_AWS_REGION ?? 'us-east-1'
      const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_NAME ?? ''
      const s3Base = `https://${bucket}.s3.${region}.amazonaws.com`

      const slides: Slide[] = Array.from(slideMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([pageNumber, { imageKey, layout, texts }]) => ({
          pageNumber,
          imageUrl: imageKey ? `${s3Base}/${imageKey}` : '/placeholder.svg',
          text: texts as Partial<Record<LanguageCode, string>>,
          layout,
        }))

      const targetLanguages = Array.isArray(d.target_languages)
        ? d.target_languages
        : JSON.parse(d.target_languages as string)

      return {
        id: d.id,
        slug: d.slug,
        shortId: d.short_id ?? undefined,
        title: d.title,
        description: d.description,
        // 公開URL/リンク用の著者識別子は username（無ければ user_id へフォールバック）。
        author: { username: d.username ?? d.user_id, name: authorInfo.name, avatarUrl: authorInfo.avatarUrl },
        category: d.category as Deck['category'],
        tags: [],
        originalLanguage: d.original_language as LanguageCode,
        targetLanguages: targetLanguages as LanguageCode[],
        slideCount: d.slide_count,
        views: d.views,
        likes: d.likes,
        status: d.status as Deck['status'],
        publishedAt: d.published_at,
        cover: d.cover_image_key ? `${s3Base}/${d.cover_image_key}` : '/placeholder.svg',
        slides,
        ownerId: d.user_id,
      }
    })
  } catch {
    return null
  }
}

// リダイレクト判定に使う所有者・可視性情報。
type DeckOwner = { username: string | null; userId: string; isPublic: boolean | null }

// 閲覧可能か判定する。公開（is_public が true / NULL）か、閲覧者が所有者なら可視。
// 非公開デッキの旧URLを知る非所有者に対して、301 のリダイレクト先（username）や
// デッキ存在を漏らさないため、リダイレクト前に必ずこの判定を通す。
function isVisible(owner: DeckOwner, viewerId: string | null): boolean {
  return owner.isPublic !== false || viewerId === owner.userId
}

// 正規形 slug で所有者デッキを引き、username・所有者・可視性を返す軽量ルックアップ。
// 旧 user_id URL を username 形式へ 301 すべきか判定するために使う（Clerk は呼ばない）。
async function lookupDeckOwner(
  ownerColumn: OwnerColumn,
  ownerValue: string,
  slug: string,
): Promise<DeckOwner | null> {
  try {
    return await withDb(async (client) => {
      const { rows } = await client.query<{ username: string | null; user_id: string; is_public: boolean | null }>(
        `SELECT username, user_id, is_public FROM decks
         WHERE ${ownerColumn} = $1 AND slug = $2 AND deleted_at IS NULL
         LIMIT 1`,
        [ownerValue, slug],
      )
      return rows[0]
        ? { username: rows[0].username ?? null, userId: rows[0].user_id, isPublic: rows[0].is_public }
        : null
    })
  } catch {
    return null
  }
}

// レガシー slug（旧タイトル由来URL）から現在の正規形 slug と所有者・可視性を引く。
// 見つかり、かつ可視な場合のみ新URLへリダイレクトするために使用する。
async function getCanonicalSlugByLegacy(
  ownerColumn: OwnerColumn,
  ownerValue: string,
  legacySlug: string,
): Promise<{ canonicalSlug: string; owner: DeckOwner } | null> {
  try {
    return await withDb(async (client) => {
      const { rows } = await client.query<{ slug: string; username: string | null; user_id: string; is_public: boolean | null }>(
        `SELECT slug, username, user_id, is_public FROM decks
         WHERE ${ownerColumn} = $1 AND legacy_slug = $2 AND deleted_at IS NULL
         LIMIT 1`,
        [ownerValue, legacySlug],
      )
      return rows[0]
        ? {
            canonicalSlug: rows[0].slug,
            owner: { username: rows[0].username ?? null, userId: rows[0].user_id, isPublic: rows[0].is_public },
          }
        : null
    })
  } catch {
    return null
  }
}

// OGP 用の軽量メタルックアップ。タイトル・説明・先頭スライド画像を取得する。
// 非公開デッキ（is_public = false）は null を返し、タイトル・説明・画像を OGP に出力しない。
async function getDeckMetaForOg(
  ownerColumn: OwnerColumn,
  ownerValue: string,
  slug: string,
): Promise<{ title: string; description: string; imageUrl: string | null } | null> {
  try {
    return await withDb(async (client) => {
      const { rows } = await client.query<{
        title: string
        description: string
        is_public: boolean | null
        cover_image_key: string | null
        image_key: string | null
      }>(
        `SELECT d.title, d.description, d.is_public, d.cover_image_key,
                (SELECT s.image_key FROM slides s
                 WHERE s.deck_id = d.id AND s.image_key IS NOT NULL
                 ORDER BY s.page_number LIMIT 1) AS image_key
         FROM decks d
         WHERE d.${ownerColumn} = $1 AND d.slug = $2 AND d.deleted_at IS NULL
         LIMIT 1`,
        [ownerValue, slug],
      )
      const d = rows[0]
      if (!d || d.is_public === false) return null
      const region = process.env.NEXT_PUBLIC_AWS_REGION ?? 'us-east-1'
      const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_NAME ?? ''
      const s3Base = `https://${bucket}.s3.${region}.amazonaws.com`
      const imageKey = d.image_key ?? d.cover_image_key
      return {
        title: d.title,
        description: d.description,
        imageUrl: imageKey ? `${s3Base}/${imageKey}` : null,
      }
    })
  } catch {
    return null
  }
}

// デッキ固有の OGP/Twitter カードを返す。未ヒット・非公開・旧URL形式の場合は
// 空オブジェクトを返し、ルートレイアウトの既定メタ（ブランドOGP）にフォールバックする。
export async function generateMetadata({
  params,
}: {
  params: Promise<{ user: string; slug: string }>
}): Promise<Metadata> {
  const { user, slug } = await params
  const raw = decodeURIComponent(user).replace(/^@/, '')
  const normalized = normalizePublicId(slug)
  if (!isCanonicalId(normalized)) return {}

  const ownerColumn: OwnerColumn = isUserId(raw) ? 'user_id' : 'username'
  const ownerValue = isUserId(raw) ? raw : normalizeUsername(raw)
  const meta = await getDeckMetaForOg(ownerColumn, ownerValue, normalized)
  if (!meta) return {}

  const description = meta.description || undefined
  const images = meta.imageUrl ? [meta.imageUrl] : undefined
  return {
    title: meta.title,
    description,
    openGraph: {
      title: meta.title,
      description,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title: meta.title,
      description,
      images,
    },
  }
}

async function fetchRelated(deckId: string, category: string): Promise<Deck[]> {
  try {
    const rows = await withDb(async (client) => {
      const { rows } = await client.query<{
        id: string; slug: string; title: string; description: string
        user_id: string; username: string | null; category: string; original_language: string
        target_languages: string[] | string; slide_count: number
        views: number; likes: number; cover_image_key: string | null; published_at: string
      }>(
        `SELECT id, slug, title, description, user_id, username, category, original_language,
                target_languages, slide_count, views, likes, cover_image_key, published_at
         FROM decks
         WHERE id != $1 AND category = $2
           AND status = 'ready'
           AND (is_public = true OR is_public IS NULL)
           AND deleted_at IS NULL
         ORDER BY views DESC
         LIMIT 3`,
        [deckId, category],
      )
      return rows
    })
    const userMap = await getClerkUsers(rows.map((r) => r.user_id))
    const region = process.env.NEXT_PUBLIC_AWS_REGION ?? 'us-east-1'
    const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_NAME ?? ''
    const s3Base = `https://${bucket}.s3.${region}.amazonaws.com`
    return rows.map((r) => {
      const author = userMap.get(r.user_id) ?? { name: r.user_id, avatarUrl: '' }
      const targetLanguages = Array.isArray(r.target_languages)
        ? r.target_languages : JSON.parse(r.target_languages as string)
      return {
        id: r.id, slug: r.slug, title: r.title, description: r.description,
        author: { username: r.username ?? r.user_id, name: author.name, avatarUrl: author.avatarUrl },
        category: r.category as Deck['category'], tags: [],
        originalLanguage: r.original_language as LanguageCode,
        targetLanguages: targetLanguages as LanguageCode[],
        slideCount: r.slide_count, views: r.views, likes: r.likes,
        status: 'ready' as const, publishedAt: r.published_at,
        cover: r.cover_image_key ? `${s3Base}/${r.cover_image_key}` : '/placeholder.svg',
        slides: [],
      }
    })
  } catch {
    return []
  }
}

export default async function DeckPage({
  params,
}: {
  params: Promise<{ user: string; slug: string }>
}) {
  const { user, slug } = await params
  const raw = decodeURIComponent(user).replace(/^@/, '')

  const { userId: viewerId } = await auth()

  // 公開識別子を正規化（ハイフン除去・小文字化）。正規形なら slug で検索する。
  // 例: `abc-defg-hij` も `abcdefghij` も同一デッキに解決する。
  const normalized = normalizePublicId(slug)
  let deck: Deck | null = null

  if (isUserId(raw)) {
    // ===== 旧URL（Clerk user_id 形式）=====
    // 所有者に username があれば username 形式へ 301、無ければ user_id のまま表示（フォールバック）。
    // ただし非公開デッキの存在・所有者 username を漏らさないため、可視（公開 or 所有者）な場合のみ。
    if (isCanonicalId(normalized)) {
      const owner = await lookupDeckOwner('user_id', raw, normalized)
      if (owner && isVisible(owner, viewerId)) {
        if (owner.username) {
          permanentRedirect(`/@${owner.username}/${formatPublicId(normalized)}`)
        }
        // username 無し（フォールバック）→ user_id のまま表示
        deck = await getDeckFromDb('user_id', raw, normalized, viewerId)
      }
      // 非公開・非所有者、または未ヒットは下の legacy 検索 → notFound に委ねる
    }
    if (!deck) {
      // レガシー slug（旧タイトルURL）として検索。可視な場合のみ、username があれば username 形式へ、無ければ user_id のまま 301。
      const legacy = await getCanonicalSlugByLegacy('user_id', raw, slug)
      if (legacy && isVisible(legacy.owner, viewerId)) {
        const target = legacy.owner.username ?? raw
        permanentRedirect(`/@${target}/${formatPublicId(legacy.canonicalSlug)}`)
      }
      notFound()
    }
  } else {
    // ===== username 形式（新URL）=====
    const uname = normalizeUsername(raw)
    if (isCanonicalId(normalized)) {
      deck = await getDeckFromDb('username', uname, normalized, viewerId)
    }
    if (!deck) {
      // 未ヒット時はレガシー slug（旧タイトルURL）として検索し、可視な場合のみ新URLへリダイレクト（BR-5: 301相当）。
      // 非公開デッキの正規 slug を旧URL経由で漏らさないため、可視性を確認する。
      const legacy = await getCanonicalSlugByLegacy('username', uname, slug)
      if (legacy && isVisible(legacy.owner, viewerId)) {
        permanentRedirect(`/@${raw}/${formatPublicId(legacy.canonicalSlug)}`)
      }
      notFound()
    }
  }

  // スライドがまだない（pending/processing/failed）場合は処理中ページを表示
  if (deck.slides.length === 0) {
    return (
      <div className="flex min-h-dvh flex-col">
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="font-heading text-lg font-semibold text-foreground">{deck.title}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {deck.status === 'failed'
                ? 'Processing failed. Please try uploading again.'
                : 'This deck is still being processed. Check back shortly.'}
            </p>
          </div>
        </main>
        <SiteFooter />
      </div>
    )
  }

  const related = await fetchRelated(deck.id, deck.category)
  const initialLiked = await hasLikedDeck(deck.id)

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <ViewTracker deckId={deck.id} />
        <DeckViewer
          deck={deck}
          related={related}
          initialLiked={initialLiked}
          isOwner={viewerId === deck.ownerId}
        />
      </main>
      <SiteFooter />
    </div>
  )
}
