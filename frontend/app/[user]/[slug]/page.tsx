import { notFound } from 'next/navigation'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { DeckViewer } from '@/components/deck-viewer'
import { DECKS, getDeck } from '@/lib/data'

export default async function DeckPage({
  params,
}: {
  params: Promise<{ user: string; slug: string }>
}) {
  const { user, slug } = await params
  const username = decodeURIComponent(user).replace(/^@/, '')
  const deck = getDeck(username, slug)

  if (!deck || deck.slides.length === 0) notFound()

  const related = DECKS.filter(
    (d) => d.id !== deck.id && d.category === deck.category && d.slides.length > 0,
  ).slice(0, 3)

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <DeckViewer deck={deck} related={related} />
      </main>
      <SiteFooter />
    </div>
  )
}
