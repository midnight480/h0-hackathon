import { notFound } from 'next/navigation'
import Link from 'next/link'
import { clerkClient } from '@clerk/nextjs/server'
import { Heart, Layers } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { withDb } from '@/lib/db'
import { formatCount, languageLabel } from '@/lib/data'

interface PublicDeck {
  id: string
  slug: string
  title: string
  original_language: string
  target_languages: string[] | string
  slide_count: number
  views: number
  likes: number
  cover_image_key: string | null
}

export default async function UserPage({
  params,
}: {
  params: Promise<{ user: string }>
}) {
  const { user } = await params
  const userId = decodeURIComponent(user).replace(/^@/, '')

  // Clerk からユーザー情報を取得
  let displayName = ''
  let avatarUrl = ''
  try {
    const clerk = await clerkClient()
    const clerkUser = await clerk.users.getUser(userId)
    displayName =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') ||
      clerkUser.username ||
      ''
    avatarUrl = clerkUser.imageUrl ?? ''
  } catch {
    notFound()
  }

  const decks = await withDb(async (client) => {
    const { rows } = await client.query<PublicDeck>(
      `SELECT id, slug, title, original_language, target_languages,
              slide_count, views, likes, cover_image_key
       FROM decks
       WHERE user_id = $1
         AND status = 'ready'
         AND (is_public = true OR is_public IS NULL)
         AND deleted_at IS NULL
       ORDER BY published_at DESC`,
      [userId],
    )
    return rows.map((r) => ({
      ...r,
      target_languages: Array.isArray(r.target_languages)
        ? r.target_languages
        : JSON.parse(r.target_languages as string),
    }))
  }).catch(() => [] as PublicDeck[])

  const region = process.env.NEXT_PUBLIC_AWS_REGION ?? 'us-east-1'
  const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_NAME ?? ''
  const s3Base = `https://${bucket}.s3.${region}.amazonaws.com`

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          {/* プロフィールヘッダー */}
          <div className="mb-10 flex items-center gap-5">
            <Avatar className="size-16">
              <AvatarImage src={avatarUrl || '/placeholder.svg'} alt={displayName} />
              <AvatarFallback>{displayName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                {displayName}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {decks.length} public {decks.length === 1 ? 'deck' : 'decks'}
              </p>
            </div>
          </div>

          {/* デッキ一覧 */}
          {decks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No public decks yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {decks.map((deck) => {
                const coverUrl = deck.cover_image_key
                  ? `${s3Base}/${deck.cover_image_key}`
                  : '/placeholder.svg'
                const langs = deck.target_languages as string[]
                return (
                  <Link
                    key={deck.id}
                    href={`/@${userId}/${deck.slug}`}
                    className="flex items-center gap-4 rounded-xl border border-border bg-card p-3 transition-colors hover:border-accent/50 sm:p-4"
                  >
                    <div className="relative aspect-[16/10] w-28 shrink-0 overflow-hidden rounded-md bg-muted sm:w-36">
                      <img src={coverUrl} alt="" className="size-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {languageLabel(deck.original_language as any)} →{' '}
                          {langs.slice(0, 4).map((l) => languageLabel(l as any)).join(', ')}
                          {langs.length > 4 && ` +${langs.length - 4}`}
                        </Badge>
                      </div>
                      <h3 className="truncate font-heading text-base font-semibold text-foreground">
                        {deck.title}
                      </h3>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Layers className="size-3.5" />
                          {deck.slide_count} slides
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart className="size-3.5" />
                          {formatCount(deck.likes)}
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
