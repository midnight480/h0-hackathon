'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

export function HeroSearch() {
  const router = useRouter()
  const [q, setQ] = useState('')

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        router.push(q.trim() ? `/browse?q=${encodeURIComponent(q.trim())}` : '/browse')
      }}
      className="relative w-full max-w-xl"
      role="search"
    >
      <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search talks, topics, or authors…"
        aria-label="Search slide decks"
        className="h-14 rounded-full border-border bg-card pl-12 pr-28 text-base shadow-sm"
      />
      <button
        type="submit"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Search
      </button>
    </form>
  )
}
