'use client'

import { useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { deleteDeck } from '@/app/actions/deck'

export function DeckDeleteButton({ deckId }: { deckId: string }) {
  const [confirming, setConfirming] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteDeck(deckId)
        toast.success('Deck deleted')
      } catch {
        toast.error('Failed to delete deck')
        setConfirming(false)
      }
    })
  }

  if (confirming) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="destructive"
          size="sm"
          disabled={isPending}
          onClick={handleDelete}
        >
          {isPending ? 'Deleting…' : 'Delete'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => setConfirming(false)}
        >
          Cancel
        </Button>
      </div>
    )
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="shrink-0 text-muted-foreground hover:text-destructive"
      onClick={(e) => {
        e.preventDefault()
        setConfirming(true)
      }}
    >
      <Trash2 className="size-4" />
    </Button>
  )
}
