'use client'

import { useRouter } from 'next/navigation'
import { BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ダッシュボード行（全体がデッキへの Link）内に置くため、<a> の入れ子を避けて
// ボタン＋router.push で分析ページへ遷移する。
export function DeckAnalyticsButton({ deckId, label }: { deckId: string; label: string }) {
  const router = useRouter()
  return (
    <Button
      variant="ghost"
      size="icon"
      className="shrink-0 text-muted-foreground hover:text-accent"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        router.push(`/dashboard/decks/${deckId}`)
      }}
    >
      <BarChart3 className="size-4" />
    </Button>
  )
}
