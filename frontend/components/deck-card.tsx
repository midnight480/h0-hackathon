import Link from 'next/link'
import { Heart, Layers } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { type Deck, formatCount, languageLabel } from '@/lib/data'

export function DeckCard({ deck }: { deck: Deck }) {
  const href = `/@${deck.author.username}/${deck.slug}`
  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <Link href={href} className="relative block aspect-[16/10] overflow-hidden bg-muted">
        <img
          src={deck.cover || '/placeholder.svg'}
          alt={`Cover slide of ${deck.title}`}
          className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <div className="absolute left-3 top-3 flex items-center gap-1.5">
          <Badge className="bg-background/90 text-foreground backdrop-blur">
            {languageLabel(deck.originalLanguage)}
          </Badge>
          {deck.targetLanguages.length > 0 && (
            <Badge variant="secondary" className="bg-accent/90 text-accent-foreground backdrop-blur">
              +{deck.targetLanguages.length} langs
            </Badge>
          )}
        </div>
        <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-md bg-background/90 px-2 py-1 text-xs font-medium text-foreground backdrop-blur">
          <Layers className="size-3.5" />
          {deck.slideCount}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <Link href={href}>
          <h3 className="line-clamp-2 text-pretty font-heading text-lg font-semibold leading-snug text-foreground transition-colors group-hover:text-accent">
            {deck.title}
          </h3>
        </Link>
        <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {deck.description}
        </p>

        <div className="mt-auto flex items-center justify-between pt-2">
          <Link
            href={`/@${deck.author.username}`}
            className="flex items-center gap-2 text-sm text-foreground hover:text-accent"
          >
            <Avatar className="size-6">
              <AvatarImage src={deck.author.avatarUrl || '/placeholder.svg'} alt="" />
              <AvatarFallback>{deck.author.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="font-medium">{deck.author.name}</span>
          </Link>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Heart className="size-3.5" />
              {formatCount(deck.likes)}
            </span>
          </div>
        </div>
      </div>
    </article>
  )
}
